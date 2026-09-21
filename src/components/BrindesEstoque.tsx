import { useState } from "react";
import { Plus, Edit2, Trash2, X, Save, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Brinde } from "../types";

interface Props {
  brindes: Brinde[];
  onAdd: (b: Omit<Brinde, "id">) => Promise<void>;
  onEdit: (b: Brinde) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function stockStatus(b: Brinde): { label: string; icon: React.ReactNode; badge: string } {
  if (b.quantidade === 0) return { label: "Sem estoque", icon: <XCircle size={14} />, badge: "bg-red-100 text-red-700" };
  if (b.quantidade <= 10) return { label: "Estoque baixo", icon: <AlertTriangle size={14} />, badge: "bg-amber-100 text-amber-700" };
  return { label: "Normal", icon: <CheckCircle size={14} />, badge: "bg-green-100 text-green-700" };
}

const emptyForm = (): Omit<Brinde, "id"> => ({ nome: "", categoria: "", quantidade: 0, pesoUnitario: 0, valor: 0 });

export default function BrindesEstoque({ brindes, onAdd, onEdit, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Brinde | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() { setEditing(null); setForm(emptyForm()); setFormError(null); setShowForm(true); }
  function openEdit(b: Brinde) { setEditing(b); setForm({ ...b }); setFormError(null); setShowForm(true); }

  async function handleSave() {
    if (!form.nome.trim()) { setFormError("O campo Nome é obrigatório."); return; }
    setSaving(true); setFormError(null);
    try {
      if (editing) await onEdit({ ...form, id: editing.id });
      else await onAdd(form);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este brinde?")) return;
    try { await onDelete(id); } catch (e) { alert(e instanceof Error ? e.message : "Erro ao excluir."); }
  }

  const totalEstoque = brindes.reduce((s, b) => s + b.quantidade, 0);
  const semEstoque = brindes.filter((b) => b.quantidade === 0).length;
  const baixo = brindes.filter((b) => b.quantidade > 0 && b.quantidade <= 10).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Brindes e Estoque</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{brindes.length} itens cadastrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors">
          <Plus size={16} />Novo Brinde
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Estoque Total", value: totalEstoque, sub: "unidades disponíveis", cls: "bg-white border-[#DDE3EC]", vcls: "text-[#1E293B]", lcls: "text-[#64748B]" },
          { label: "Estoque Baixo", value: baixo, sub: "itens com pouco estoque", cls: "bg-amber-50 border-amber-200", vcls: "text-amber-700", lcls: "text-amber-600" },
          { label: "Sem Estoque", value: semEstoque, sub: "itens esgotados", cls: "bg-red-50 border-red-200", vcls: "text-red-700", lcls: "text-red-600" },
        ].map(({ label, value, sub, cls, vcls, lcls }) => (
          <div key={label} className={`border rounded p-4 ${cls}`}>
            <p className={`text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] ${lcls}`}>{label}</p>
            <p className={`text-2xl font-['Outfit'] font-700 mt-1 ${vcls}`}>{value}</p>
            <p className={`text-xs font-['Inter'] ${lcls}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[6px] border border-[#DDE3EC] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F8FAFC]">
              {["Nome","Categoria","Qtd. Disponível","Peso Unit. (kg)","Valor (R$)","Status","Ações"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brindes.map((b, i) => {
              const s = stockStatus(b);
              return (
                <tr key={b.id} className={`border-b border-[#DDE3EC]/60 ${i % 2 === 0 ? "" : "bg-[#F8FAFC]/50"}`}>
                  <td className="px-5 py-3.5 text-sm text-[#1E293B] font-['Inter'] font-500">{b.nome}</td>
                  <td className="px-5 py-3.5 text-sm text-[#64748B] font-['Inter']">{b.categoria}</td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#1E293B] font-500">{b.quantidade}</td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{b.pesoUnitario.toFixed(3)}</td>
                  <td className="px-5 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{b.valor.toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-['Inter'] font-600 px-2 py-1 rounded-full ${s.badge}`}>
                      {s.icon}{s.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-[#EEF2F7] text-[#64748B] hover:text-[#1A3A6B] transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-red-50 text-[#64748B] hover:text-[#D42B1E] transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {brindes.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#64748B] font-['Inter']">Nenhum brinde cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[6px] border border-[#DDE3EC] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
              <h2 className="font-['Outfit'] font-600 text-[#1E293B]">{editing ? "Editar Brinde" : "Novo Brinde"}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-[#64748B]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Nome do Brinde", key: "nome", type: "text" },
                { label: "Categoria", key: "categoria", type: "text" },
                { label: "Quantidade Disponível", key: "quantidade", type: "number", step: "1" },
                { label: "Peso Unitário (kg)", key: "pesoUnitario", type: "number", step: "1" },
                { label: "Valor (R$)", key: "valor", type: "number", step: "1" },
              ].map(({ label, key, type, step }) => (
                <div key={key}>
                  <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">{label}</label>
                  <input
                    type={type} step={step}
                    value={(form as Record<string, unknown>)[key] as string | number}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
                  />
                </div>
              ))}
              {formError && <p className="text-sm text-red-600 font-['Inter']">{formError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-[#DDE3EC] flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-['Inter'] text-[#64748B]">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-50 transition-colors">
                <Save size={15} />{saving ? "Salvando..." : "Salvar Brinde"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
