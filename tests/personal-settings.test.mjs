import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const calls=[];
let failure=null;
globalThis.personalAuthUpdate=async(...args)=>{calls.push(args);return {error:failure};};
globalThis.personalAuthReauthenticate=async()=>{calls.push(['reauthenticate']);return {error:failure};};
registerHooks({
 resolve(s,c,n){if(s==='./supabase'&&c.parentURL?.endsWith('/personalSettings.ts'))return{url:'data:text/javascript,export const supabase={auth:{updateUser:(...args)=>globalThis.personalAuthUpdate(...args),reauthenticate:()=>globalThis.personalAuthReauthenticate()}};',shortCircuit:true};return n(s,c);},
 load(url,c,n){if(url.endsWith('.ts'))return{format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText};return n(url,c);}
});
const {savePersonalName,requestPersonalEmail,savePersonalPassword,requestPasswordCode}=await import('../src/lib/personalSettings.ts');
beforeEach(()=>{calls.length=0;failure=null;});
test('Personal name updates only the own Auth profile and validates before the request',async()=>{
 await assert.rejects(savePersonalName(' '));assert.equal(calls.length,0);
 await savePersonalName(' Felipe Sievert ');
 assert.deepEqual(calls,[[{data:{full_name:'Felipe Sievert'}}]]);
});
test('Email changes use the confirmation flow without directly rewriting app_users',async()=>{
 await requestPersonalEmail(' NEW@EXAMPLE.COM ','https://app.example.com/');
 assert.deepEqual(calls,[[{email:'new@example.com'},{emailRedirectTo:'https://app.example.com/'}]]);
});
test('Password confirmation is required and credentials go only to Auth',async()=>{
 await assert.rejects(savePersonalPassword('current','new-strong-password','different'),/coincidem/);assert.equal(calls.length,0);
 await savePersonalPassword('current','new-strong-password','new-strong-password','123456');
 assert.deepEqual(calls,[[{password:'new-strong-password',current_password:'current',nonce:'123456'}]]);
});
test('Failed Auth updates are surfaced and reauthentication codes are explicit',async()=>{
 failure={message:'Sessão inválida'};await assert.rejects(savePersonalName('Nome válido'),/Sessão inválida/);
 failure=null;await requestPasswordCode();assert.deepEqual(calls.at(-1),['reauthenticate']);
});
