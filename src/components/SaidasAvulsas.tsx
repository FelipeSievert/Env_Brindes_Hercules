import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, Plus, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import type { Brinde, SaidaAvulsa } from "../types";
import { fetchSaidasAvulsas, insertSaidaAvulsa } from "../lib/db";

type Linha = { brindeId: string; quantidade: number };
const novaLinha = (): Linha => ({ brindeId: "", quantidade: 1 });

export default function SaidasAvulsas({
  brindes, onRegistered,
}: {
  brindes: Brinde[];
  onRegistered: () => Promise<void>;
}) {
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [itens, setItens] = useState<Linha[]>([novaLinha()]);
  const [history, setHistory] = useState<SaidaAvulsa[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      setHistory(await fetchSaidasAvulsas());
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Não foi possível consultar o histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  const sortedGifts = useMemo(() => [...brindes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [brindes]);
  const totalUnidades = itens.reduce((sum, item) => sum + (Number.isFinite(item.quantidade) ? item.quantidade : 0), 0);

  function setLinha(index: number, update: Partial<Linha>) {
    setItens(previous => previous.map((item, i) => i === index ? { ...item, ...update } : item));
    setError("");
    setSuccess("");
  }

  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSuccess("");
    if (destino.trim().length < 2) { setError("Informe quem recebeu ou para onde foram os brindes."); return; }
    if (motivo.trim().length < 3) { setError("Informe a finalidade da retirada."); return; }
    if (itens.length === 0 || itens.some(item => !item.brindeId)) {
      setError("Selecione todos os brindes da retirada."); return;
    }
    if (new Set(itens.map(item => item.brindeId)).size !== itens.length) {
      setError("Cada brinde deve aparecer apenas uma vez."); return;
    }
    for (const item of itens) {
      const brinde = brindes.find(gift => gift.id === item.brindeId);
      if (!brinde || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 9999999) {
        setError("Informe uma quantidade inteira e positiva para cada brinde."); return;
      }
      if (item.quantidade > brinde.quantidade) {
        setError("Estoque insuficiente para " + brinde.nome + ". Disponíveis: " + brinde.quantidade + "."); return;
      }
    }
    setSaving(true);
    try {
      await insertSaidaAvulsa({ destino: destino.trim(), motivo: motivo.trim(), itens });
      setDestino("");
      setMotivo("");
      setItens([novaLinha()]);
      setSuccess("Saída registrada e estoque descontado com sucesso. Nenhuma declaração foi gerada.");
      const results = await Promise.allSettled([onRegistered(), loadHistory()]);
      if (results.some(result => result.status === "rejected")) {
        setHistoryError("Saída registrada. Atualize a página caso o saldo não apareça imediatamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a saída.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-['Outfit'] font-bold text-[#1E293B] flex items-center gap-2">
          <ArrowDownToLine size={24} className="text-[#1A3A6B]" /> Saída de Brindes
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Registre entregas ou usos internos. O estoque será baixado automaticamente, sem criar declaração de conteúdo.
        </p>
      </header>

      <form onSubmit={registrar} className="bg-white border border-[#DDE3EC] rounded-md p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-[#1E293B]">Nova saída avulsa</h2>
          <p className="text-xs text-[#64748B] mt-1">A data, o horário e o usuário serão registrados automaticamente.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="block text-sm text-[#475569]">
            Destino / Quem recebeu *
            <input required maxLength={160} minLength={2} value={destino}
              onChange={e => setDestino(e.target.value)}
              placeholder="Ex.: Marketing, visita à fábrica, colaborador"
              className="w-full mt-1.5 border border-[#DDE3EC] rounded p-2.5 outline-none focus:ring-2 focus:ring-blue-200" />
          </label>
          <label className="block text-sm text-[#475569]">
            Motivo / Finalidade *
            <input required maxLength={500} minLength={3} value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex.: Brindes para evento interno"
              className="w-full mt-1.5 border border-[#DDE3EC] rounded p-2.5 outline-none focus:ring-2 focus:ring-blue-200" />
          </label>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center gap-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">Brindes retirados</h3>
            <span className="text-xs text-[#64748B]">{totalUnidades} unidade(s) selecionada(s)</span>
          </div>
          {itens.map((item, index) => {
            const selected = brindes.find(gift => gift.id === item.brindeId);
            return (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-3 items-end">
                <label className="text-xs text-[#64748B]">
                  Brinde
                  <select value={item.brindeId} required
                    onChange={e => setLinha(index, { brindeId: e.target.value, quantidade: 1 })}
                    className="w-full mt-1.5 border border-[#DDE3EC] rounded p-2.5 text-sm bg-white text-[#1E293B]">
                    <option value="">Selecione um brinde</option>
                    {sortedGifts.map(gift => (
                      <option key={gift.id} value={gift.id}
                        disabled={gift.quantidade === 0 || itens.some((line, i) => i !== index && line.brindeId === gift.id)}>
                        {gift.nome} — {gift.quantidade} disponível(is)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[#64748B]">
                  Quantidade
                  <input type="number" required min={1} max={selected?.quantidade ?? 9999999} step={1}
                    value={item.quantidade} onChange={e => setLinha(index, { quantidade: Number(e.target.value) })}
                    className="w-full mt-1.5 border border-[#DDE3EC] rounded p-2.5 text-sm text-[#1E293B]" />
                </label>
                <button type="button" aria-label="Remover brinde" disabled={itens.length === 1}
                  onClick={() => setItens(prev => prev.filter((_, i) => i !== index))}
                  className="h-[40px] flex items-center justify-center text-[#64748B] hover:text-red-600 disabled:opacity-30">
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
          <button type="button" disabled={itens.length >= Math.min(50, brindes.length)}
            onClick={() => { setItens(prev => [...prev, novaLinha()]); setError(""); }}
            className="inline-flex items-center gap-2 text-sm text-[#1A3A6B] font-semibold disabled:opacity-40">
            <Plus size={16} /> Adicionar outro brinde
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="text-sm text-green-700 flex gap-2 items-center"><CheckCircle2 size={16} /> {success}</p>}
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <span className="text-xs text-[#64748B]">A retirada será registrada no histórico do estoque.</span>
          <button type="submit" disabled={saving || brindes.length === 0}
            className="px-4 py-2.5 rounded bg-[#1A3A6B] text-white text-sm font-semibold hover:bg-[#15305a] disabled:opacity-50">
            {saving ? "Registrando..." : "Registrar saída e baixar estoque"}
          </button>
        </div>
      </form>

      <section className="bg-white border border-[#DDE3EC] rounded-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div><h2 className="font-semibold text-[#1E293B]">Histórico de saídas avulsas</h2>
            <p className="text-xs text-[#64748B] mt-1">Últimos 100 registros, separados das declarações.</p></div>
          <button type="button" onClick={() => void loadHistory()} disabled={loadingHistory}
            className="text-sm text-[#1A3A6B] flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
        {loadingHistory ? <p role="status" className="text-sm text-[#64748B]">Carregando histórico...</p> :
          historyError ? <p role="alert" className="text-sm text-red-700">{historyError}</p> :
          history.length === 0 ? <p className="text-sm text-[#64748B]">Nenhuma saída avulsa registrada.</p> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[#64748B] text-xs"><tr>
              {["Data", "Destino", "Motivo", "Brindes e quantidades", "Registrado por"].map(label =>
                <th key={label} className="p-3 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody>{history.map(row =>
              <tr key={row.id} className="border-t border-[#DDE3EC] align-top">
                <td className="p-3 whitespace-nowrap text-[#475569]">{new Date(row.createdAt ?? "").toLocaleString("pt-BR")}</td>
                <td className="p-3 text-[#1E293B]">{row.destino}</td>
                <td className="p-3 text-[#475569]">{row.motivo}</td>
                <td className="p-3 text-[#475569]">
                  {row.itens.length ? row.itens.map(line =>
                    <div key={line.brindeId}>{line.nome} — {line.quantidade} un.</div>
                  ) : <span className="text-[#94A3B8]">Sem detalhes</span>}
                </td>
                <td className="p-3 text-[#475569]">{row.createdByName || "Não informado"}</td>
              </tr>
            )}</tbody>
          </table></div>}
      </section>
    </div>
  );
}
