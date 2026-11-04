import { useEffect, useState, type FormEvent } from "react";
import { callManageUsers } from "../lib/manageUsers";
import { useAuth, type SystemRole, type SystemStatus, type SystemUser } from "../auth/AuthGate";

export default function AdministrarUsuarios() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const data = await callManageUsers("list");
    setUsers(data.users ?? []);
  }
  useEffect(() => { load().catch(e => setError(String(e))); }, []);
  async function invite(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await callManageUsers("invite", { name: name.trim(), email: email.trim() });
      setName(""); setEmail(""); await load(); setNotice("Convite enviado com sucesso.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao convidar."); }
    finally { setBusy(false); }
  }
  async function change(id: string, payload: { role?: SystemRole; status?: SystemStatus }) {
    setBusy(true); setError(""); setNotice("");
    try { await callManageUsers(payload.role ? "setRole" : "setStatus", { id, ...payload }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar usuário."); }
    finally { setBusy(false); }
  }
  return <div className="p-8 space-y-6 text-[#1E293B]">
    <header><h1 className="text-2xl font-semibold">Gerenciar usuários</h1>
      <p className="text-sm text-[#64748B]">Somente o administrador pode convidar ou alterar contas.</p></header>
    <form onSubmit={invite} className="bg-white border border-[#DDE3EC] rounded p-5 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Convidar funcionário</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">Nome completo<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} className="block mt-1 p-2.5 border rounded w-full"/></label>
        <label className="text-sm">E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="block mt-1 p-2.5 border rounded w-full"/></label>
      </div>
      <p className="text-xs text-[#64748B]">O convidado recebe um e-mail e define sua própria senha. Inicialmente terá o perfil Operador.</p>
      <button disabled={busy} className="px-4 py-2.5 bg-[#1A3A6B] text-white rounded disabled:opacity-50">{busy ? "Processando..." : "Enviar convite"}</button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    <section className="bg-white border border-[#DDE3EC] rounded overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#F1F4F8] text-[#64748B]"><tr>
          <th className="p-3">Funcionário</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Ações</th>
        </tr></thead>
        <tbody>{users.map(u => <tr key={u.id} className="border-t border-[#DDE3EC]">
          <td className="p-3"><strong>{u.full_name}</strong><div className="text-[#64748B]">{u.email}</div></td>
          <td className="p-3"><select aria-label={"Perfil de " + u.full_name} disabled={busy || u.id === me.id} value={u.role}
            onChange={e => void change(u.id, { role: e.target.value as SystemRole })} className="border rounded p-2">
            <option value="operator">Operador</option><option value="admin">Administrador</option></select></td>
          <td className="p-3">{{ invited:"Convidado", active:"Ativo", blocked:"Bloqueado" }[u.status]}</td>
          <td className="p-3">{u.id === me.id ? <span className="text-[#64748B]">Sua conta</span> :
            <button disabled={busy} className="text-[#1A3A6B] underline disabled:opacity-50" onClick={() => void change(u.id,
              {status: u.status === "blocked" ? "active" : "blocked"})}>{u.status === "blocked" ? "Reativar" : "Bloquear"}</button>}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
