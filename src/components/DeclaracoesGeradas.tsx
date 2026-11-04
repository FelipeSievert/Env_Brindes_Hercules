import { useState } from "react";
import {
  Eye, Printer, Download, Copy, Search, Trash2, AlertTriangle,
  PackageCheck, Clock, AlertCircle, X, Save, QrCode,
} from "lucide-react";
import { Declaracao, calcStatusRastreio, StatusRastreio } from "../types";
import * as db from "../lib/db";
import { declarationStatuses } from "../lib/declarationStatus";

interface Props {
  declaracoes: Declaracao[];
  onView: (dec: Declaracao) => void;
  onDuplicate: (dec: Declaracao) => void;
  onDelete: (dec: Declaracao) => Promise<void>;
  onUpdateRastreio: (id: string, codigo: string) => void;
}

const statusInfo = declarationStatuses;

const rastreioConfig: Record<StatusRastreio, { label: string; dot: string; text: string }> = {
  informado:  { label: "Rastreio informado",       dot: "bg-green-500",  text: "text-green-700" },
  aguardando: { label: "Aguardando rastreio",      dot: "bg-amber-400",  text: "text-amber-700" },
  pendente:   { label: "Rastreio pendente há 2d+", dot: "bg-red-500",    text: "text-red-700"   },
};

function RastreioIndicator({ status }: { status: StatusRastreio }) {
  const cfg = rastreioConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-['Inter'] font-500 ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
      {cfg.label}
    </span>
  );
}

export default function DeclaracoesGeradas({
  declaracoes, onView, onDuplicate, onDelete, onUpdateRastreio,
}: Props) {
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterRastreio, setFilterRastreio] = useState("todos");
  const [toDelete, setToDelete]     = useState<Declaracao | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // Inline rastreio edit state
  const [editingRastreio, setEditingRastreio] = useState<string | null>(null);
  const [rastreioInput, setRastreioInput]     = useState("");
  const [savingRastreio, setSavingRastreio]   = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try { await onDelete(toDelete); setToDelete(null); }
    finally { setDeleting(false); }
  }

  function openRastreioEdit(dec: Declaracao) {
    setEditingRastreio(dec.id);
    setRastreioInput(dec.codigoRastreio ?? "");
  }

  async function saveRastreio(dec: Declaracao) {
    setSavingRastreio(true);
    try {
      await db.updateCodigoRastreio(dec.id, rastreioInput.trim());
      onUpdateRastreio(dec.id, rastreioInput.trim());
      setEditingRastreio(null);
    } finally {
      setSavingRastreio(false);
    }
  }

  const filtered = declaracoes.filter((d) => {
    const q = search.toLowerCase();
    const matchQ =
      String(d.numero ?? "").toLowerCase().includes(q) ||
      String(d.destinatario?.nome ?? "").toLowerCase().includes(q) ||
      String(d.destinatario?.cidade ?? "").toLowerCase().includes(q);
    const matchStatus   = filterStatus === "todos"    || d.status === filterStatus;
    const rastreioSt    = calcStatusRastreio(d);
    const matchRastreio = filterRastreio === "todos"  || rastreioSt === filterRastreio;
    return matchQ && matchStatus && matchRastreio;
  });

  const pendentesCount = declaracoes.filter(
    (d) => calcStatusRastreio(d) === "pendente"
  ).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Declarações Geradas</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{declaracoes.length} declarações no total</p>
        </div>
        {pendentesCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm font-['Inter'] text-red-700">
            <AlertCircle size={15} />
            {pendentesCount} declaraç{pendentesCount > 1 ? "ões" : "ão"} sem rastreio há 2+ dias
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por número, destinatário ou cidade..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDE3EC] rounded text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B] bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-[#DDE3EC] rounded px-3 py-2.5 text-sm font-['Inter'] text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30"
        >
          <option value="todos">Todos os status</option>
          {Object.entries(statusInfo).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </select>
        <select
          value={filterRastreio}
          onChange={(e) => setFilterRastreio(e.target.value)}
          className="border border-[#DDE3EC] rounded px-3 py-2.5 text-sm font-['Inter'] text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30"
        >
          <option value="todos">Todos os rastreios</option>
          <option value="informado">🟢 Rastreio informado</option>
          <option value="aguardando">🟡 Aguardando rastreio</option>
          <option value="pendente">🔴 Pendente há 2d+</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[6px] border border-[#DDE3EC] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F8FAFC]">
              {["Número", "Destinatário", "Cidade", "Data", "Responsável", "Qtd.", "Peso", "Status", "Rastreio", "Código Rastreio", "Ações"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((dec, i) => {
              const s = statusInfo[dec.status];
              const rastreioSt = calcStatusRastreio(dec);
              const isPendente = rastreioSt === "pendente";
              const isEditingThis = editingRastreio === dec.id;

              return (
                <tr
                  key={dec.id}
                  className={`border-b border-[#DDE3EC]/60 ${
                    isPendente
                      ? "bg-red-50/40"
                      : i % 2 === 0 ? "" : "bg-[#F8FAFC]/50"
                  }`}
                >
                  <td className="px-4 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#1A3A6B] font-500 whitespace-nowrap">
                    {dec.numero}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#1E293B] font-['Inter'] font-500">
                    {dec.destinatario?.nome ?? 'Destinatário não informado'}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B] font-['Inter'] whitespace-nowrap">
                    {dec.destinatario?.cidade ?? '—'}/{dec.destinatario?.uf ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B] font-['Inter'] whitespace-nowrap">
                    {dec.data}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#1E293B] font-['Inter']">
                    {dec.responsavel || <span className="text-[#CBD5E1]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#1E293B]">
                    {dec.totalItens}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#1E293B] whitespace-nowrap">
                    {(Number(dec.pesoTotal) || 0).toFixed(3)} kg
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] font-['Inter'] font-600 px-2 py-1 rounded-full ${s.color}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <RastreioIndicator status={rastreioSt} />
                  </td>
                  <td className="px-4 py-3.5 min-w-[180px]">
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={rastreioInput}
                          onChange={(e) => setRastreioInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRastreio(dec);
                            if (e.key === "Escape") setEditingRastreio(null);
                          }}
                          placeholder="Código de rastreio..."
                          className={`flex-1 border rounded px-2 py-1 text-xs font-['JetBrains_Mono',monospace] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B] ${
                            isPendente ? "border-red-300 bg-red-50" : "border-[#DDE3EC]"
                          }`}
                        />
                        <button
                          onClick={() => saveRastreio(dec)}
                          disabled={savingRastreio}
                          className="p-1 rounded bg-[#1A3A6B] text-white hover:bg-[#15305a] disabled:opacity-50 transition-colors"
                          title="Salvar"
                        >
                          <Save size={12} />
                        </button>
                        <button
                          onClick={() => setEditingRastreio(null)}
                          className="p-1 rounded text-[#94A3B8] hover:text-[#64748B] transition-colors"
                          title="Cancelar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : dec.codigoRastreio ? (
                      <button
                        onClick={() => openRastreioEdit(dec)}
                        className="font-['JetBrains_Mono',monospace] text-xs text-[#1A3A6B] hover:underline flex items-center gap-1"
                        title="Editar código de rastreio"
                      >
                        <PackageCheck size={12} />
                        {dec.codigoRastreio}
                      </button>
                    ) : (
                      <button
                        onClick={() => openRastreioEdit(dec)}
                        className={`flex items-center gap-1.5 text-xs font-['Inter'] font-500 px-2.5 py-1 rounded border transition-colors ${
                          isPendente
                            ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                            : "border-[#DDE3EC] text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                        }`}
                      >
                        <QrCode size={12} />
                        {isPendente ? "Informar agora" : "Informar código"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onView(dec)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Visualizar"><Eye size={15} /></button>
                      <button onClick={() => onView(dec)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Imprimir"><Printer size={15} /></button>
                      <button className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Baixar PDF"><Download size={15} /></button>
                      <button onClick={() => onDuplicate(dec)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors" title="Duplicar"><Copy size={15} /></button>
                      <button onClick={() => setToDelete(dec)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-[#D42B1E] transition-colors" title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm text-[#64748B] font-['Inter']">
                  Nenhuma declaração encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda rastreio */}
      <div className="flex items-center gap-6 text-xs font-['Inter'] text-[#64748B]">
        <span className="font-600 uppercase tracking-[0.08em]">Legenda:</span>
        {(["informado", "aguardando", "pendente"] as StatusRastreio[]).map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${rastreioConfig[st].dot}`} />
            {rastreioConfig[st].label}
          </span>
        ))}
      </div>

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-[8px] shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-start gap-3 px-6 py-5 border-b border-[#DDE3EC]">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-[#D42B1E]">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Excluir declaração</h2>
                <p className="text-sm text-[#64748B] mt-1 font-['Inter']">
                  Tem certeza que deseja excluir a declaração{" "}
                  <span className="font-600 text-[#1E293B]">{toDelete.numero}</span> de{" "}
                  <span className="font-600 text-[#1E293B]">{toDelete.destinatario?.nome ?? 'Destinatário não informado'}</span>?
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} disabled={deleting}
                className="px-4 py-2 text-sm font-['Inter'] text-[#64748B] disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 bg-[#D42B1E] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#b82318] disabled:opacity-50 transition-colors">
                <Trash2 size={15} />
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
