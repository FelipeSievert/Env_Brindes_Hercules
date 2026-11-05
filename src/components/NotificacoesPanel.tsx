import { useState } from "react";
import { Bell, X, CheckCheck, PackageX, ChevronRight } from "lucide-react";
import { Notificacao } from "../types";
import * as db from "../lib/db";

interface Props {
  notificacoes: Notificacao[];
  onNavigateToDeclaracao: (declaracaoId: string) => void;
  onUpdate: (updated: Notificacao[]) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "Agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export default function NotificacoesPanel({ notificacoes, onNavigateToDeclaracao, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const naoLidas = notificacoes.filter((n) => !n.lida);

  async function marcarTodasLidas() {
    setLoading(true); setError("");
    try {
      await db.markAllNotificacoesLidas();
      onUpdate(notificacoes.map((n) => ({ ...n, lida: true })));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível marcar as notificações como lidas.");
    } finally { setLoading(false); }
  }

  async function handleClickNotificacao(n: Notificacao) {
    setLoading(true); setError("");
    try {
      if (!n.lida) {
        await db.markNotificacaoLida(n.id);
        onUpdate(notificacoes.map((row) => row.id === n.id ? { ...row, lida: true } : row));
      }
      onNavigateToDeclaracao(n.declaracaoId);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível marcar a notificação como lida.");
    } finally { setLoading(false); }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
          open ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
        title="Notificações"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell size={18} />
        {naoLidas.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#D42B1E] rounded-full flex items-center justify-center text-white text-[9px] font-['Inter'] font-700">
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute left-full ml-2 top-0 z-50 w-[360px] bg-white rounded-lg border border-[#DDE3EC] shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDE3EC] bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[#1A3A6B]" />
                <span className="font-['Outfit'] font-600 text-sm text-[#1E293B]">Notificações</span>
                {naoLidas.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#D42B1E] text-white text-[10px] font-['Inter'] font-700">
                    {naoLidas.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {naoLidas.length > 0 && (
                  <button
                    onClick={marcarTodasLidas}
                    disabled={loading}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-['Inter'] text-[#64748B] hover:text-[#1A3A6B] rounded hover:bg-[#EEF2F7] transition-colors disabled:opacity-50"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck size={13} />
                    Todas lidas
                  </button>
                )}
                <button
                  aria-label="Fechar notificações"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded text-[#64748B] hover:text-[#1E293B] hover:bg-[#EEF2F7] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {error && <p role="alert" className="px-4 py-3 text-xs text-red-700 bg-red-50">{error}</p>}
            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-[#DDE3EC]/60">
              {notificacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-[#F1F4F8] flex items-center justify-center mb-3">
                    <Bell size={18} className="text-[#94A3B8]" />
                  </div>
                  <p className="text-sm font-['Inter'] font-500 text-[#1E293B]">Sem notificações</p>
                  <p className="text-xs text-[#94A3B8] font-['Inter'] mt-0.5">
                    Lembretes de rastreio pendente aparecerão aqui.
                  </p>
                </div>
              ) : (
                notificacoes.map((n) => (
                  <button
                    key={n.id}
                    disabled={loading}
                    onClick={() => handleClickNotificacao(n)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-[#F8FAFC] transition-colors ${
                      !n.lida ? "bg-[#FEF9EC]" : ""
                    }`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      ["rastreio_pendente", "lembrete_rastreio"].includes(n.tipo) ? "bg-red-100 text-red-600" : "bg-[#EEF2F7] text-[#1A3A6B]"
                    }`}>
                      <PackageX size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-['Inter'] leading-snug whitespace-pre-line ${!n.lida ? "font-600 text-[#1E293B]" : "text-[#64748B]"}`}>
                        {n.mensagem}
                      </p>
                      <p className="text-[10px] text-[#94A3B8] font-['Inter'] mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-[#CBD5E1] shrink-0 mt-1" />
                    {!n.lida && (
                      <span className="w-2 h-2 rounded-full bg-[#D42B1E] shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
