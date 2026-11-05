import { DEFAULT_TRACKING_MESSAGE } from "../lib/trackingMessage";
import { useState } from "react";
import { Search, Plus, Trash2, ChevronRight, ChevronLeft, FileText, AlertCircle, X, Tag } from "lucide-react";
import { Destinatario, Brinde, Declaracao, ItemDeclaracao, Configuracoes } from "../types";
import * as db from "../lib/db";
import { recipientForDeclaration } from "../lib/recipient";

interface Props {
  responsaveis: import("../types").Responsavel[];
  destinatarios: Destinatario[];
  brindes: Brinde[];
  config: Configuracoes;
  onGenerate: (dec: Declaracao) => void;
}

function todayFormatted(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

export default function NovaDeclaracao({ responsaveis, destinatarios, brindes, config, onGenerate }: Props) {
  const [step, setStep] = useState(1);
  const [destSearch, setDestSearch] = useState("");
  const [destCategoria, setDestCategoria] = useState("");
  const [selectedDests, setSelectedDests] = useState<Destinatario[]>([]);
  const [items, setItems] = useState<ItemDeclaracao[]>([]);
  const [brindeSearch, setBrindeSearch] = useState("");
  const [showBrindeSelector, setShowBrindeSelector] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState("");
  const [mensagemRastreio,setMensagemRastreio]=useState(DEFAULT_TRACKING_MESSAGE);
  const local = config.remetente.cidade;

  const allCategorias = Array.from(
    new Set(destinatarios.flatMap((d) => d.categorias ?? []))
  ).sort();

  const filteredDest = destinatarios.filter((d) => {
    const q = destSearch.toLowerCase();
    const matchSearch = d.nome.toLowerCase().includes(q) || (d.cpfCnpj ?? "").includes(q);
    const matchCat = !destCategoria || (d.categorias ?? []).includes(destCategoria);
    return matchSearch && matchCat && !selectedDests.find((s) => s.id === d.id);
  });

  const filteredBrindes = brindes.filter(
    (b) => b.quantidade > 0 &&
      b.nome.toLowerCase().includes(brindeSearch.toLowerCase()) &&
      !items.find((i) => i.brindeId === b.id)
  );

  function addDest(d: Destinatario) {
    setSelectedDests((prev) => [...prev, recipientForDeclaration(d)]);
    setDestSearch("");
  }

  function removeDest(id: string) {
    setSelectedDests((prev) => prev.filter((d) => d.id !== id));
  }

  function addBrinde(b: Brinde) {
    setItems((prev) => [...prev, { brindeId: b.id, brinde: b, quantidade: 1, pesoTotal: b.pesoUnitario }]);
    setShowBrindeSelector(false);
    setBrindeSearch("");
  }

  function updateQty(brindeId: string, qty: number) {
    setItems((prev) => prev.map((item) =>
      item.brindeId === brindeId
        ? { ...item, quantidade: qty, pesoTotal: qty * item.brinde.pesoUnitario }
        : item
    ));
  }

  function removeItem(brindeId: string) {
    setItems((prev) => prev.filter((i) => i.brindeId !== brindeId));
  }

  const totalItens = items.reduce((s, i) => s + i.quantidade, 0);
  const pesoTotal = items.reduce((s, i) => s + i.pesoTotal, 0);
  const numDests = selectedDests.length;

  // Stock validation: total needed = qty × numDests
  const stockWarnings = items.filter((item) => {
    const needed = item.quantidade * Math.max(1, numDests);
    return needed > item.brinde.quantidade;
  });

  async function handleGenerate() {
    if (generating || !selectedDests.length || !items.length || stockWarnings.length) return;
    setGenerating(true);
    setGenError(null);

    try {
      const date = todayFormatted();
      const batch: Omit<Declaracao, "id">[] = selectedDests.map(dest => ({
        numero: `DC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        destinatario: dest,
        itens: items,
        data: date,
        local,
        status: "gerado",
        responsavelId: responsavel || undefined,
        mensagemRastreio,
        totalItens,
        pesoTotal,
      }));
      const saved = await db.insertDeclaracoes(batch);
      const lastDec = saved[saved.length - 1];

      if (lastDec) {
        onGenerate(lastDec);
        // Reset form
        setStep(1);
        setSelectedDests([]);
        setItems([]);
        setMensagemRastreio(DEFAULT_TRACKING_MESSAGE);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Erro ao gerar declaração.");
    } finally {
      setGenerating(false);
    }
  }

  const steps = ["Remetente", "Destinatário", "Itens", "Confirmar"];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Nova Declaração de Conteúdo</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Preencha as etapas para gerar a declaração</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, idx) => {
          const n = idx + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={s} className="flex items-center">
              <button
                onClick={() => (done || active) ? setStep(n) : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-['Inter'] font-500 transition-colors ${active ? "bg-[#1A3A6B] text-white" : done ? "text-[#1A3A6B] hover:bg-[#EEF2F7]" : "text-[#64748B]"}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-600 ${active ? "bg-white text-[#1A3A6B]" : done ? "bg-[#1A3A6B] text-white" : "bg-[#DDE3EC] text-[#64748B]"}`}>{n}</span>
                {s}
              </button>
              {idx < steps.length - 1 && <ChevronRight size={14} className="text-[#DDE3EC] mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[6px] border border-[#DDE3EC]">
        {/* Step 1 – Remetente */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h2 className="font-['Outfit'] font-600 text-[#1E293B] border-b border-[#DDE3EC] pb-3">Etapa 1 — Remetente</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                ["Nome / Razão Social", config.remetente.nome],
                ["CNPJ", config.remetente.cnpj],
                ["Endereço", `${config.remetente.endereco}, ${config.remetente.numero}`],
                ["Bairro", config.remetente.bairro],
                ["Cidade", config.remetente.cidade],
                ["UF", config.remetente.uf],
                ["CEP", config.remetente.cep],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
                  <p className="text-sm text-[#1E293B] font-['Inter'] mt-0.5 font-500">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#64748B] font-['Inter']">Dados configurados em <span className="text-[#1A3A6B] font-500">Configurações</span>.</p>
          </div>
        )}

        {/* Step 2 – Destinatário(s) */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <h2 className="font-['Outfit'] font-600 text-[#1E293B] border-b border-[#DDE3EC] pb-3">Etapa 2 — Destinatário(s)</h2>
            <p className="text-xs text-[#64748B] font-['Inter']">Selecione um ou mais destinatários. Uma declaração será gerada para cada um com os mesmos itens. Preencha o A/C no destinatário selecionado, se necessário.</p>

            {/* Category filter */}
            {allCategorias.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] flex items-center gap-1">
                  <Tag size={12} /> Filtrar por categoria:
                </span>
                <button
                  onClick={() => setDestCategoria("")}
                  className={`px-3 py-1 rounded-full text-xs font-['Inter'] font-500 border transition-colors ${
                    !destCategoria
                      ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                      : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                  }`}
                >
                  Todos
                </button>
                {allCategorias.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDestCategoria((prev) => (prev === c ? "" : c))}
                    className={`px-3 py-1 rounded-full text-xs font-['Inter'] font-500 border transition-colors ${
                      destCategoria === c
                        ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                        : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                value={destSearch}
                onChange={(e) => setDestSearch(e.target.value)}
                placeholder="Pesquisar destinatário por nome, CPF ou CNPJ..."
                className="w-full pl-9 pr-4 py-3 border border-[#DDE3EC] rounded text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
              />
            </div>
            <div className="border border-[#DDE3EC] rounded overflow-hidden">
                {filteredDest.slice(0, 8).map((d) => (
                  <button key={d.id} onClick={() => addDest(d)}
                    className="w-full px-4 py-3 text-left hover:bg-[#EEF2F7] border-b border-[#DDE3EC]/60 last:border-0 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-['Inter'] font-500 text-[#1E293B]">{d.nome}</p>
                        {(d.categorias ?? []).map((c) => (
                          <span key={c} className="px-1.5 py-0.5 rounded-full bg-[#EEF2F7] text-[#1A3A6B] text-[10px] font-['Inter'] border border-[#C7D4E8]">{c}</span>
                        ))}
                      </div>
                      <p className="text-xs text-[#64748B]">{d.cpfCnpj} · {d.cidade}/{d.uf}</p>
                    </div>
                    <Plus size={15} className="text-[#1A3A6B]" />
                  </button>
                ))}
                {filteredDest.length === 0 && <p className="px-4 py-3 text-sm text-[#64748B] font-['Inter']">Nenhum resultado.</p>}
                {filteredDest.length > 8 && <p className="px-4 py-2 text-xs text-[#64748B]">Exibindo 8 de {filteredDest.length}. Pesquise para encontrar outros destinatários.</p>}
              </div>
            {selectedDests.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#1A3A6B]">Selecionados ({selectedDests.length})</p>
                {selectedDests.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-4 bg-[#F1F4F8] border border-[#DDE3EC] rounded px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-['Inter'] font-500 text-[#1E293B]">{d.nome}</p>
                      <p className="text-xs text-[#64748B]">{d.endereco}, {d.numero} — {d.cidade}/{d.uf}</p>
                      <label className="block mt-3 text-xs text-[#475569]" htmlFor={`ac-${d.id}`}>A/C — Aos cuidados de (opcional)</label>
                      <input id={`ac-${d.id}`} maxLength={160} value={d.aosCuidados ?? ""}
                        onChange={e => setSelectedDests(prev => prev.map(dest => dest.id === d.id ? { ...dest, aosCuidados: e.target.value } : dest))}
                        placeholder="Nome da pessoa ou setor para esta declaração" className="mt-1 w-full max-w-lg bg-white border border-[#DDE3EC] rounded px-3 py-2 text-sm text-[#1E293B]" />
                    </div>
                    <button aria-label={`Remover ${d.nome}`} onClick={() => removeDest(d.id)} className="text-[#64748B] hover:text-[#D42B1E] transition-colors"><X size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3 – Itens */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDE3EC] pb-3">
              <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Etapa 3 — Brindes e Itens</h2>
              <button onClick={() => setShowBrindeSelector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors">
                <Plus size={15} />Adicionar Brinde
              </button>
            </div>

            {numDests > 1 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 font-['Inter']">
                <AlertCircle size={15} />
                {numDests} destinatários selecionados. O estoque necessário será multiplicado por {numDests}.
              </div>
            )}

            {stockWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 font-['Inter'] space-y-1">
                <p className="font-600">Estoque insuficiente:</p>
                {stockWarnings.map((w) => (
                  <p key={w.brindeId}>• {w.brinde.nome}: precisa de {w.quantidade * numDests}, disponível {w.brinde.quantidade}</p>
                ))}
              </div>
            )}

            {items.length === 0 && (
              <p className="text-sm text-[#64748B] font-['Inter'] py-4 text-center">Clique em "Adicionar Brinde" para incluir itens.</p>
            )}

            {items.length > 0 && (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#DDE3EC]">
                      {["#","Conteúdo","Qtd.","Peso Unit.","Peso Total","Valor",""].map((h) => (
                        <th key={h} className="pb-2 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const needed = item.quantidade * Math.max(1, numDests);
                      const insufficient = needed > item.brinde.quantidade;
                      return (
                        <tr key={item.brindeId} className={`border-b border-[#DDE3EC]/40 ${insufficient ? "bg-amber-50" : ""}`}>
                          <td className="py-3 pr-3 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{i + 1}</td>
                          <td className="py-3 pr-4 text-sm text-[#1E293B] font-['Inter'] font-500">{item.brinde.nome}</td>
                          <td className="py-3 pr-4">
                            <input type="number" min={1} max={Math.floor(item.brinde.quantidade / Math.max(1, numDests))}
                              value={item.quantidade}
                              onChange={(e) => updateQty(item.brindeId, parseInt(e.target.value) || 1)}
                              className="w-16 border border-[#DDE3EC] rounded px-2 py-1 text-sm font-['JetBrains_Mono',monospace] text-center focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30" />
                          </td>
                          <td className="py-3 pr-4 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">{item.brinde.pesoUnitario.toFixed(3)} kg</td>
                          <td className="py-3 pr-4 text-sm font-['JetBrains_Mono',monospace] text-[#1A3A6B] font-500">{item.pesoTotal.toFixed(3)} kg</td>
                          <td className="py-3 pr-4 text-sm font-['JetBrains_Mono',monospace] text-[#64748B]">R$ {(item.brinde.valor * item.quantidade).toFixed(2)}</td>
                          <td className="py-3">
                            <button onClick={() => removeItem(item.brindeId)} className="p-1 rounded hover:bg-red-50 text-[#64748B] hover:text-[#D42B1E] transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-[#1A3A6B] text-white rounded p-4 flex items-center gap-12">
                  <div>
                    <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.1em] text-white/60">Total de Itens</p>
                    <p className="text-2xl font-['Outfit'] font-700">{totalItens}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.1em] text-white/60">Peso Total</p>
                    <p className="text-2xl font-['Outfit'] font-700">{pesoTotal.toFixed(3)} kg</p>
                  </div>
                  {numDests > 1 && (
                    <div>
                      <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.1em] text-white/60">Declarações</p>
                      <p className="text-2xl font-['Outfit'] font-700">{numDests}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {showBrindeSelector && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[6px] border border-[#DDE3EC] w-full max-w-md shadow-xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
                    <h3 className="font-['Outfit'] font-600 text-[#1E293B]">Selecionar Brinde</h3>
                    <button onClick={() => setShowBrindeSelector(false)}><X size={18} className="text-[#64748B]" /></button>
                  </div>
                  <div className="p-4">
                    <input value={brindeSearch} onChange={(e) => setBrindeSearch(e.target.value)} placeholder="Pesquisar..."
                      className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30" />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredBrindes.map((b) => (
                      <button key={b.id} onClick={() => addBrinde(b)}
                        className="w-full px-6 py-3 text-left hover:bg-[#EEF2F7] border-b border-[#DDE3EC]/60 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-['Inter'] font-500 text-[#1E293B]">{b.nome}</p>
                          <p className="text-xs text-[#64748B]">{b.quantidade} disp. · {b.pesoUnitario.toFixed(3)} kg/un · R$ {b.valor.toFixed(2)}</p>
                        </div>
                        <Plus size={15} className="text-[#1A3A6B]" />
                      </button>
                    ))}
                    {filteredBrindes.length === 0 && <p className="px-6 py-4 text-sm text-[#64748B]">Nenhum brinde disponível.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4 – Confirmar */}
        {step === 4 && (
          <div className="p-6 space-y-4">
            <h2 className="font-['Outfit'] font-600 text-[#1E293B] border-b border-[#DDE3EC] pb-3">Etapa 4 — Confirmação</h2>
            <div className="bg-[#F1F4F8] border border-[#DDE3EC] rounded p-4 space-y-2">
              <p className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">Resumo</p>
              <p className="text-sm font-['Inter'] text-[#1E293B]">
                <span className="text-[#64748B]">Destinatário(s):</span>{" "}
                <span className="font-500">{selectedDests.map(d => d.nome).join(", ") || "–"}</span>
              </p>
              {selectedDests.filter(d => d.aosCuidados?.trim()).map(d => <p key={d.id} className="text-sm text-[#475569]">{d.nome} · A/C: <strong>{d.aosCuidados?.trim()}</strong></p>)}
              <p className="text-sm font-['Inter'] text-[#1E293B]">
                <span className="text-[#64748B]">Data automática:</span>{" "}
                <span className="font-500">{todayFormatted()}</span>
              </p>
              <p className="text-sm font-['Inter'] text-[#1E293B]">
                <span className="text-[#64748B]">Itens:</span>{" "}
                <span className="font-500">{totalItens}</span>
              </p>
              <p className="text-sm font-['Inter'] text-[#1E293B]">
                <span className="text-[#64748B]">Peso total:</span>{" "}
                <span className="font-500">{pesoTotal.toFixed(3)} kg</span>
              </p>
              {numDests > 1 && (
                <p className="text-sm font-['Inter'] text-[#1E293B]">
                  <span className="text-[#64748B]">Declarações a gerar:</span>{" "}
                  <span className="font-500 text-[#1A3A6B]">{numDests} (uma por destinatário)</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">
                Responsável pela solicitação
              </label>
              <select aria-label="Responsável pela solicitação" value={responsavel} onChange={e=>setResponsavel(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">Sem responsável / sem aviso por e-mail</option>
                {responsaveis.map(r=><option key={r.id} value={r.id}>{r.nome} — {r.email}</option>)}
              </select>
              <p className="text-xs text-slate-500">Cadastre nomes e e-mails no menu Responsáveis.</p>
              {responsavel && <label className="block pt-3 text-sm">Mensagem para acompanhar o rastreio<textarea value={mensagemRastreio} onChange={e=>setMensagemRastreio(e.target.value)} maxLength={3000} rows={4} placeholder="Escreva sua mensagem. (CÓDIGO) será substituído pelo rastreio informado." className="block w-full border rounded p-3" /></label>}
            </div>

            {stockWarnings.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-['Inter'] space-y-1">
                <p className="font-600">Não é possível gerar — estoque insuficiente:</p>
                {stockWarnings.map((w) => (
                  <p key={w.brindeId}>• {w.brinde.nome}: precisa de {w.quantidade * numDests}, disponível {w.brinde.quantidade}</p>
                ))}
              </div>
            )}

            {genError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-['Inter']">
                <AlertCircle size={15} />{genError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-[#DDE3EC] flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-['Inter'] font-500 text-[#64748B] hover:text-[#1E293B] disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} />Anterior
          </button>

          {step < 4 ? (
            <button onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={step === 2 && selectedDests.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-40 transition-colors">
              Próxima etapa<ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleGenerate}
              disabled={!selectedDests.length || !items.length || stockWarnings.length > 0 || generating}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#D42B1E] text-white rounded text-sm font-['Inter'] font-700 hover:bg-[#b82318] disabled:opacity-40 transition-colors">
              <FileText size={16} />
              {generating ? "Gerando..." : numDests > 1 ? `GERAR ${numDests} DECLARAÇÕES` : "GERAR DECLARAÇÃO"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
