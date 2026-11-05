import { renderTrackingMessage } from "./message.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.115.0/cors";
import { createCorsPolicy } from "../manage-users/cors.ts";
import { previewOrigins } from "../manage-users/preview-origins.ts";
const cors=createCorsPolicy([Deno.env.get("ALLOWED_ORIGINS")??"",...previewOrigins].join(","),Deno.env.get("APP_URL")??"",corsHeaders);
export function encode(value:string){return btoa(String.fromCharCode(...new TextEncoder().encode(value))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
export function buildMessage(sender:string,to:string,text:string){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender)||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) throw new Error("Endereço de e-mail inválido.");
 const subject=btoa("Codigo de rastreio - Hercules");
 return encode([`From: ${sender}`,`To: ${to}`,`Subject: =?UTF-8?B?${subject}?=`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",btoa(String.fromCharCode(...new TextEncoder().encode(text)))].join("\r\n"));
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??"";
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...Object.fromEntries(cors.headers(origin)),"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(!cors.isAllowed(origin))return reply({error:"Origem não autorizada."},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors.headers(origin)});
 if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 let admin:ReturnType<typeof createClient>;let jobId:string|undefined;let providerAttempted=false;
 try{
 admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");
 const {data:auth,error:authError}=await admin.auth.getUser(token);
 if(authError||!auth.user)return reply({error:"Sessão inválida."},401);
 const {data:actor}=await admin.from("app_users").select("status").eq("id",auth.user.id).maybeSingle();
 if(actor?.status!=="active")return reply({error:"Conta sem acesso ativo."},403);
 const {id}=await req.json();
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Identificador inválido."},400);
 const {data:job,error:jobError}=await admin.from("rastreio_emails").select("*").eq("id",id).maybeSingle();
 if(jobError||!job)return reply({error:"Aviso não encontrado."},404);
 if(!["pendente","erro"].includes(job.status))return reply({status:job.status});
 const {data:claimed,error:claimError}=await admin.from("rastreio_emails").update({status:"enviando",erro:null}).eq("id",id).in("status",["pendente","erro"]).select("id").maybeSingle();
 if(claimError)throw new Error("Não foi possível reservar o envio.");
 if(!claimed)return reply({status:"enviando"});jobId=id;
 const {data:decl}=await admin.from("declaracoes").select("numero,responsavel,responsavel_email,codigo_rastreio,status").eq("id",job.declaracao_id).maybeSingle();
 if(!decl||decl.responsavel_email!==job.email||decl.codigo_rastreio!==job.codigo||["cancelado","devolvido"].includes(decl.status))throw new Error("Dados da declaração mudaram. Revise o aviso antes de enviar.");
 const {data:account}=await admin.from("gmail_oauth_tokens").select("email,refresh_token").eq("id",1).maybeSingle();
 const clientId=Deno.env.get("GOOGLE_CLIENT_ID"),secret=Deno.env.get("GOOGLE_CLIENT_SECRET");
 if(!account?.refresh_token||!clientId||!secret)throw new Error("Remetente não configurado. Autorize o Gmail do sistema.");
 const refresh=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:secret,refresh_token:account.refresh_token,grant_type:"refresh_token"})});
 const credentials=await refresh.json();
 if(!refresh.ok||!credentials.access_token)throw new Error("A autorização do Gmail precisa ser renovada.");
 const text=renderTrackingMessage(job.mensagem,job.codigo,decl.numero,decl.responsavel);
 const raw=buildMessage(account.email,job.email,text);
 providerAttempted=true;
 const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${credentials.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({raw})});
 if(!response.ok){if(response.status<500)providerAttempted=false;throw new Error("O provedor não confirmou o envio. Consulte o histórico.");}
 const {error:saveError}=await admin.from("rastreio_emails").update({status:"enviado",enviado_em:new Date().toISOString(),erro:null}).eq("id",id);
 if(saveError)throw new Error("O envio ocorreu, mas o registro não pôde ser confirmado. Não repita sem verificar.");
 return reply({status:"enviado"});
 }catch(error){const message=error instanceof Error?error.message:"Falha no envio.";
 if(jobId)await admin!.from("rastreio_emails").update({status:providerAttempted?"incerto":"erro",erro:message}).eq("id",jobId);
 return reply({error:message},400);
 }
});
