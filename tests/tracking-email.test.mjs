import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('npm:'))s=s.slice(4).replace('@supabase/supabase-js@2.115.0','@supabase/supabase-js').replace('pdf-lib@1.17.1','pdf-lib');return n(s,c);}});
let handler, sent=0, updates=[], authorized=true, jobStatus='pendente', providerFailure=false, rawEmail='', missingItems=false;
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-key',APP_URL:'https://app.example.com',GOOGLE_CLIENT_ID:'test-id',GOOGLE_CLIENT_SECRET:'test-secret'};
globalThis.Deno={env:{get:k=>env[k]},serve:fn=>handler=fn};
const job={id:'11111111-1111-4111-8111-111111111111',declaracao_id:'22222222-2222-4222-8222-222222222222',email:'person@example.invalid',codigo:'AA123456789BR',mensagem:'Sua encomenda foi enviada.'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(input,init={})=>{
 const u=new URL(typeof input==='string'?input:input.url),method=init.method??'GET';
 if(u.pathname==='/auth/v1/user')return authorized?json({id:'actor'}):json({message:'invalid'},401);
 if(u.pathname==='/rest/v1/app_users')return json({status:'active'});
 if(u.pathname==='/rest/v1/rastreio_emails'){
  if(method==='GET')return json({...job,status:jobStatus});
  const update=JSON.parse(init.body);updates.push(update);
  return update.status==='enviando'?json({id:job.id}):new Response(null,{status:204});
 }
 if(u.pathname==='/rest/v1/declaracoes')return json({numero:'QA',data:'05/11/2026',peso_total:0.5,total_itens:2,responsavel:'Pessoa',responsavel_email:job.email,codigo_rastreio:job.codigo,status:'informado',destinatario_snapshot:{nome:'Destinatário salvo',aos_cuidados:'Compras',endereco:'Rua Um',numero:'2',cidade:'Timbó',uf:'SC',cep:'89120-000',cpf_cnpj:'00.000.000/0001-00'},itens:missingItems?[]:[{quantidade:2,brinde_snapshot:{nome:'Caneta',valor:5}}]});
 if(u.pathname==='/rest/v1/configuracoes')return json({nome:'HÉRCULES',endereco:'Rua Dois',numero:'3',cidade:'Timbó',uf:'SC',cep:'89120-000',cnpj:'00.000.000/0001-00'});
 if(u.pathname==='/rest/v1/gmail_oauth_tokens')return json({email:'sender@example.invalid',refresh_token:'fake-refresh'});
 if(u.hostname==='oauth2.googleapis.com')return json({access_token:'fake-access'});
 if(u.hostname==='gmail.googleapis.com'){rawEmail=JSON.parse(init.body).raw;sent++;if(providerFailure)throw new Error('Network lost');return json({id:'provider-id'});}
 assert.fail('Unexpected request '+u);
};
const {buildMessage}=await import('../supabase/functions/send-tracking-email/index.ts');
beforeEach(()=>{sent=0;updates=[];authorized=true;jobStatus='pendente';providerFailure=false;rawEmail='';missingItems=false;});
const request=(body={id:job.id})=>new Request('https://function.example.invalid',{method:'POST',headers:{Origin:env.APP_URL,Authorization:'Bearer fake','Content-Type':'application/json'},body:JSON.stringify(body)});
test('Unauthorized calls never send mail',async()=>{authorized=false;assert.equal((await handler(request())).status,401);assert.equal(sent,0);});
test('Already sent jobs never send a second message',async()=>{jobStatus='enviado';assert.equal((await (await handler(request())).json()).status,'enviado');assert.equal(sent,0);});
test('A positive provider response is recorded before claiming success',async()=>{const response=await handler(request());assert.equal((await response.json()).status,'enviado');assert.equal(sent,1);assert.deepEqual(updates.map(u=>u.status),['enviando','enviado']);});
test('Ambiguous provider failures are marked uncertain, preventing blind retries',async()=>{providerFailure=true;assert.equal((await handler(request())).status,400);assert.equal(updates.at(-1).status,'incerto');});
test('MIME header injection is rejected and Unicode body survives encoding',()=>{assert.throws(()=>buildMessage('sender@example.invalid','person@example.invalid\r\nBcc: someone@example.invalid','text'));const decoded=Buffer.from(buildMessage('sender@example.invalid','person@example.invalid','Olá, ação!'),'base64url').toString();assert.ok(decoded.includes('Content-Transfer-Encoding: base64'));assert.equal(Buffer.from(decoded.split('\r\n\r\n')[1],'base64').toString(),'Olá, ação!');});


test('Standard reply replaces the placeholder and includes the code only once', async()=>{
 const { DEFAULT_TRACKING_MESSAGE, renderTrackingMessage } = await import('../supabase/functions/send-tracking-email/message.ts');
 const text=renderTrackingMessage(DEFAULT_TRACKING_MESSAGE,job.codigo,'QA','Pessoa','Destinatário salvo');
 assert.ok(text.startsWith('Bom dia, tudo bem?\nSegue aqui o código de rastreio: '+job.codigo));
 assert.equal(text.split(job.codigo).length-1,1);
 assert.ok(!text.includes('(CÓDIGO)'));
 assert.ok(!text.includes('Declaração:'));
 assert.ok(!text.includes('Hercules — Envio de Brindes'));
 assert.ok(text.includes('Enviado para: Destinatário salvo'));
 assert.equal(text.split('Enviado para:').length-1,1);
 const custom=renderTrackingMessage('Seu pedido foi enviado.',job.codigo,'QA','Pessoa','Destinatário salvo');
 assert.ok(custom.includes('Seu pedido foi enviado.'));
 assert.ok(custom.includes('Código de rastreio: '+job.codigo));
 assert.ok(custom.includes('Enviado para: Destinatário salvo'));
 assert.ok(!custom.includes('Declaração:'));
 assert.ok(!custom.includes('Hercules — Envio de Brindes'));
});


test('Sent email includes a readable PDF attachment for the selected declaration', async()=>{
 const { PDFDocument } = await import('pdf-lib');
 await handler(request());
 const mime=Buffer.from(rawEmail,'base64url').toString();
 assert.ok(mime.includes('Content-Type: multipart/mixed;'));
 const bodyEncoded=mime.split('Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
 const bodyText=Buffer.from(bodyEncoded,'base64').toString('utf8');
 assert.ok(bodyText.includes('Código de rastreio: '+job.codigo));
 assert.ok(bodyText.includes('Enviado para: Destinatário salvo'));
 assert.ok(!bodyText.includes('Declaração:'));
 assert.ok(!bodyText.includes('Hercules — Envio de Brindes'));
 assert.ok(mime.includes('Content-Disposition: attachment; filename="Declaracao_QA.pdf"'));
 const part=mime.split('Content-Type: application/pdf;')[1];
 const encoded=part.split('\r\n\r\n')[1].split('\r\n--')[0];
 const bytes=Buffer.from(encoded,'base64');
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
});

test('Attachment generation failure prevents sending and records a retryable error', async()=>{
 missingItems=true;
 const response=await handler(request());
 assert.equal(response.status,400);
 assert.equal(sent,0);
 assert.equal(updates.at(-1).status,'erro');
 assert.match(updates.at(-1).erro,/PDF/);
});
