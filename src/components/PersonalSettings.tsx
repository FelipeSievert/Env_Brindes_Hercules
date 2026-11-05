import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthGate";
import { savePersonalName, requestPersonalEmail, savePersonalPassword, requestPasswordCode } from "../lib/personalSettings";

const inputClass = "block w-full border border-[#DDE3EC] rounded px-3 py-2 mt-1 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30";
const buttonClass = "bg-[#1A3A6B] text-white px-4 py-2 rounded text-sm disabled:opacity-50";
const cardClass = "bg-white border border-[#DDE3EC] rounded-md p-6 space-y-4";
const errorText = (error: unknown) => error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";

export default function PersonalSettings() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState({ section: "", message: "", error: false });

  async function saveName(event: FormEvent) {
    event.preventDefault(); setBusy("name"); setFeedback({section:"",message:"",error:false});
    try {
      await savePersonalName(name);
      await refreshUser();
      setFeedback({section:"name",message:"Nome atualizado.",error:false});
    } catch (error) { setFeedback({section:"name",message:errorText(error),error:true}); }
    finally { setBusy(null); }
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault(); setBusy("email"); setFeedback({section:"",message:"",error:false});
    try {
      await requestPersonalEmail(email, window.location.origin + "/");
      setFeedback({section:"email",message:"Solicitação enviada. Confira as mensagens de confirmação no e-mail atual e no novo endereço. A alteração será concluída após a confirmação.",error:false});
    } catch (error) { setFeedback({section:"email",message:errorText(error),error:true}); }
    finally { setBusy(null); }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault(); setBusy("password"); setFeedback({section:"",message:"",error:false});
    try {
      await savePersonalPassword(current, password, confirmation, nonce);
      setCurrent(""); setPassword(""); setConfirmation(""); setNonce("");
      setFeedback({section:"password",message:"Senha alterada.",error:false});
    } catch (error) { setFeedback({section:"password",message:errorText(error),error:true}); }
    finally { setBusy(null); }
  }
  async function sendCode() {
    setBusy("code");
    try { await requestPasswordCode(); setFeedback({section:"password",message:"Código de segurança solicitado. Confira o e-mail da sua conta.",error:false}); }
    catch (error) { setFeedback({section:"password",message:errorText(error),error:true}); }
    finally { setBusy(null); }
  }
  function status(section: string) {
    return feedback.section === section && <p role={feedback.error ? "alert" : "status"} className={`text-sm ${feedback.error ? "text-red-700" : "text-green-700"}`}>{feedback.message}</p>;
  }
  return <div className="space-y-6">
    <div><h2 className="text-lg font-semibold text-[#1E293B]">Configurações pessoais</h2><p className="text-sm text-[#64748B]">Dados da sua conta e acesso ao sistema.</p></div>
    <form onSubmit={saveName} className={cardClass}>
      <h3 className="font-semibold">Nome</h3>
      <label className="block text-sm">Nome completo<input value={name} onChange={event=>setName(event.target.value)} required minLength={2} maxLength={160} autoComplete="name" className={inputClass} /></label>
      {status("name")}<button type="submit" disabled={busy!==null} className={buttonClass}>{busy==="name"?"Salvando…":"Salvar nome"}</button>
    </form>
    <form onSubmit={saveEmail} className={cardClass}>
      <h3 className="font-semibold">E-mail de acesso</h3>
      <p className="text-sm text-[#64748B]">E-mail atual: {user.email}</p>
      <label className="block text-sm">Novo e-mail<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" className={inputClass} /></label>
      <p className="text-xs text-[#64748B]">O endereço de envio dos rastreios é configurado separadamente do e-mail de acesso da sua conta.</p>
      {status("email")}<button type="submit" disabled={busy!==null||email.trim().toLowerCase()===user.email.toLowerCase()} className={buttonClass}>{busy==="email"?"Enviando…":"Solicitar alteração de e-mail"}</button>
    </form>
    <form onSubmit={savePassword} className={cardClass}>
      <h3 className="font-semibold">Alterar senha</h3>
      <label className="block text-sm">Senha atual<input type="password" value={current} onChange={event=>setCurrent(event.target.value)} required autoComplete="current-password" className={inputClass} /></label>
      <label className="block text-sm">Nova senha<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></label>
      <label className="block text-sm">Confirmar nova senha<input type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></label>
      <details className="text-sm text-[#64748B]"><summary className="cursor-pointer">Foi solicitado um código de segurança?</summary>
        <p className="mt-2">Solicite o código e informe-o abaixo para confirmar a troca.</p>
        <button type="button" onClick={sendCode} disabled={busy!==null} className="underline text-[#1A3A6B] mt-2">Enviar código de segurança</button>
        <label className="block mt-2">Código de segurança<input value={nonce} onChange={event=>setNonce(event.target.value)} autoComplete="one-time-code" className={inputClass} /></label>
      </details>
      {status("password")}<button type="submit" disabled={busy!==null} className={buttonClass}>{busy==="password"?"Salvando…":"Alterar senha"}</button>
    </form>
  </div>;
}
