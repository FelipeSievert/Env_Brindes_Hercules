import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('npm:'))s=s.slice(4).replace('@supabase/supabase-js@2.115.0','@supabase/supabase-js');return n(s,c);}});
let handler, sent=0, updates=[], authorized=true, jobStatus='pendente', providerFailure=false;
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
 if(u.pathname==='/rest/v1/declaracoes')return json({numero:'QA',responsavel:'Pessoa',responsavel_email:job.email,codigo_rastreio:job.codigo,status:'informado'});
 if(u.pathname==='/rest/v1/gmail_oauth_tokens')return json({email:'sender@example.invalid',refresh_token:'fake-refresh'});
 if(u.hostname==='oauth2.googleapis.com')return json({access_token:'fake-access'});
 if(u.hostname==='gmail.googleapis.com'){sent++;if(providerFailure)throw new Error('Network lost');return json({id:'provider-id'});}
 assert.fail('Unexpected request '+u);
};
const {buildMessage}=await import('../supabase/functions/send-tracking-email/index.ts');
beforeEach(()=>{sent=0;updates=[];authorized=true;jobStatus='pendente';providerFailure=false;});
const request=(body={id:job.id})=>new Request('https://function.example.invalid',{method:'POST',headers:{Origin:env.APP_URL,Authorization:'Bearer fake','Content-Type':'application/json'},body:JSON.stringify(body)});
test('Unauthorized calls never send mail',async()=>{authorized=false;assert.equal((await handler(request())).status,401);assert.equal(sent,0);});
test('Already sent jobs never send a second message',async()=>{jobStatus='enviado';assert.equal((await (await handler(request())).json()).status,'enviado');assert.equal(sent,0);});
test('A positive provider response is recorded before claiming success',async()=>{const response=await handler(request());assert.equal((await response.json()).status,'enviado');assert.equal(sent,1);assert.deepEqual(updates.map(u=>u.status),['enviando','enviado']);});
test('Ambiguous provider failures are marked uncertain, preventing blind retries',async()=>{providerFailure=true;assert.equal((await handler(request())).status,400);assert.equal(updates.at(-1).status,'incerto');});
test('MIME header injection is rejected and Unicode body survives encoding',()=>{assert.throws(()=>buildMessage('sender@example.invalid','person@example.invalid\r\nBcc: someone@example.invalid','text'));const decoded=Buffer.from(buildMessage('sender@example.invalid','person@example.invalid','Olá, ação!'),'base64url').toString();assert.ok(decoded.includes('Content-Transfer-Encoding: base64'));assert.equal(Buffer.from(decoded.split('\r\n\r\n')[1],'base64').toString(),'Olá, ação!');});
