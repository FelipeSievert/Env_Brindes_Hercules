import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { callManageUsers } from "../lib/manageUsers";

export type SystemRole = "admin" | "operator";
export type SystemStatus = "invited" | "active" | "blocked";
export interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  role: SystemRole;
  status: SystemStatus;
}
type AuthValue = { user: SystemUser; signOut: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);
export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Acesso fora da sessão autenticada.");
  return context;
}

function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="min-h-screen bg-[#F1F4F8] flex items-center justify-center p-4">
    <section className="w-full max-w-md bg-white border border-[#DDE3EC] rounded-lg shadow-sm p-8 space-y-5">
      <div><div className="text-[#1A3A6B] font-bold text-xl tracking-wide">HÉRCULES</div>
        <p className="text-[#64748B] text-xs uppercase tracking-widest">Envio de Brindes</p></div>
      <div><h1 className="text-xl font-semibold text-[#1E293B]">{title}</h1>
        <p className="text-sm text-[#64748B] mt-1">{description}</p></div>
      {children}
    </section>
  </div>;
}
const fieldClass = "w-full border border-[#DDE3EC] rounded p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200";
const buttonClass = "w-full bg-[#1A3A6B] text-white rounded p-2.5 text-sm font-semibold disabled:opacity-50";

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/" });
        if (error) throw error;
        setMessage("Se o e-mail possuir uma conta, você receberá instruções para redefinir a senha.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onSuccess();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na autenticação."); }
    finally { setBusy(false); }
  }
  return <AuthCard title={forgot ? "Recuperar senha" : "Acessar sistema"}
    description="Acesso exclusivo para funcionários convidados pelo administrador.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm text-[#475569]">E-mail
        <input className={fieldClass} type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {!forgot && <label className="block text-sm text-[#475569]">Senha
        <input className={fieldClass} type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      {message && <p role="status" className="text-sm text-[#475569]">{message}</p>}
      <button className={buttonClass} type="submit" disabled={busy}>{busy ? "Processando..." : forgot ? "Enviar instruções" : "Entrar"}</button>
    </form>
    <button className="text-sm text-[#1A3A6B] underline" onClick={() => { setForgot(!forgot); setMessage(""); }}>
      {forgot ? "Voltar ao login" : "Esqueci minha senha"}
    </button>
    <p className="text-xs text-[#64748B]">Ainda não tem acesso? Solicite um convite ao administrador.</p>
  </AuthCard>;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery"
  );
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, updated) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(updated);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session);
      if (error) setError("Não foi possível verificar sua sessão.");
      if (error || !data.session) setLoading(false);
    }).catch(() => {
      if (mounted) { setError("Não foi possível verificar sua sessão."); setLoading(false); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) { setUser(null); setLoading(false); return; }
    setLoading(true);
    supabase.from("app_users")
      .select("id, full_name, email, role, status")
      .eq("id", session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setUser(error ? null : data as SystemUser | null);
        setError(error ? "Não foi possível verificar as permissões de acesso." : "");
      }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.user.id, reload]);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null); setUser(null); setRecovering(false); setError("");
  }

  async function completePassword(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 10) { setError("Use uma senha com pelo menos 10 caracteres."); return; }
    if (password !== passwordConfirm) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      if (user?.status === "invited") {
        await callManageUsers("activate");
      }
      setPassword(""); setPasswordConfirm(""); setRecovering(false); setReload(n => n + 1);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível definir a senha."); }
    finally { setBusy(false); }
  }
  if (loading) return <AuthCard title="Verificando acesso" description="Conectando sua conta ao sistema..."><p className="text-sm">Aguarde a verificação da sessão.</p></AuthCard>;
  if (!session) return <Login onSuccess={() => setReload(n => n + 1)} />;
  if (user?.status === "invited" || (user?.status === "active" && recovering)) {
    return <AuthCard title={user.status === "invited" ? "Ativar convite" : "Criar nova senha"}
      description="Defina sua senha para acessar o sistema com segurança.">
      <form onSubmit={completePassword} className="space-y-4">
        <label className="block text-sm">Nova senha<input className={fieldClass} type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label className="block text-sm">Confirmar senha<input className={fieldClass} type="password" autoComplete="new-password" minLength={10} required value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)}/></label>
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className={buttonClass} disabled={busy}>{busy ? "Salvando..." : "Salvar senha e continuar"}</button>
      </form>
      <button className="text-sm underline text-[#1A3A6B]" onClick={signOut}>Sair</button>
    </AuthCard>;
  }
  if (!user || user.status !== "active") return <AuthCard title="Acesso não autorizado"
    description={error || "Esta conta não possui acesso ativo. Procure o administrador."}>
    <button className={buttonClass} onClick={signOut}>Voltar ao login</button>
  </AuthCard>;
  return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>;
}
