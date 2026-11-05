import { useState, type FormEvent } from "react";
import type { Configuracoes } from "../types";
const inputClass = "w-full border border-[#DDE3EC] rounded px-3 py-2 mt-1 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30";

export default function CompanySettings({ config, onSave }: { config: Configuracoes; onSave: (value: Configuracoes) => Promise<void> }) {
  const [sender,setSender]=useState(config.remetente);
  const [reminders,setReminders]=useState(config.lembretes);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try { await onSave({remetente:sender,lembretes:reminders}); setMessage("Configurações da empresa salvas."); }
    catch(error) { setError(true); setMessage(error instanceof Error?error.message:"Não foi possível salvar as configurações."); }
    finally { setBusy(false); }
  }
  const fields: [string,keyof typeof sender][]=[["Nome / Razão Social","nome"],["CNPJ","cnpj"],["CEP","cep"],["Endereço","endereco"],["Número","numero"],["Bairro","bairro"],["Cidade","cidade"],["UF","uf"]];
  return <form onSubmit={save} className="space-y-6">
    <div className="bg-white border border-[#DDE3EC] rounded-md">
      <div className="px-6 py-4 border-b"><h2 className="font-semibold">Configurações da empresa</h2><p className="text-xs text-[#64748B] mt-1">Dados do remetente usados nas declarações de conteúdo.</p></div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.map(([label,field])=><label key={field} className={`block text-xs text-[#64748B] ${field==="nome"?"sm:col-span-2":""}`}>{label}
        <input value={sender[field]} onChange={event=>setSender(prev=>({...prev,[field]:event.target.value}))} maxLength={field==="uf"?2:200} className={inputClass}/>
      </label>)}</div>
    </div>
    <div className="bg-white border border-[#DDE3EC] rounded-md p-6 space-y-4">
      <h2 className="font-semibold">Lembretes automáticos de rastreio</h2>
      <p className="text-xs text-[#64748B]">Preferências para declarações que completam dois dias sem código de rastreio.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminders.ativo} onChange={event=>setReminders(prev=>({...prev,ativo:event.target.checked}))}/>Ativar lembretes automáticos</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminders.emailAtivo??false} disabled={!reminders.ativo} onChange={event=>setReminders(prev=>({...prev,emailAtivo:event.target.checked}))}/>Enviar lembretes por e-mail</label>
      {reminders.emailAtivo&&<label className="block text-sm">E-mail para receber os lembretes<input type="email" value={reminders.emailDestinatario} required={reminders.ativo} onChange={event=>setReminders(prev=>({...prev,emailDestinatario:event.target.value}))} className={inputClass}/></label>}
    </div>
    {message&&<p role={error?"alert":"status"} className={`text-sm ${error?"text-red-700":"text-green-700"}`}>{message}</p>}
    <button type="submit" disabled={busy} className="bg-[#1A3A6B] text-white px-5 py-2.5 rounded text-sm disabled:opacity-50">{busy?"Salvando…":"Salvar configurações da empresa"}</button>
  </form>;
}
