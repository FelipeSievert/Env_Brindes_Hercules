import { useEffect, useState } from "react";
import { fetchStockMovements } from "../lib/db";
import type { Brinde } from "../types";
import AuthorInfo from "./AuthorInfo";

type Movement = Awaited<ReturnType<typeof fetchStockMovements>>[number];
export default function StockHistory({ gift, onClose }: { gift: Brinde; onClose: () => void }) {
  const [rows, setRows] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setRows([]); setError("");
    fetchStockMovements(gift.id).then(data => { if (!cancelled) setRows(data); })
      .catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Não foi possível carregar o histórico."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gift.id]);
  return <section aria-label={`Histórico de ${gift.nome}`} className="bg-white border rounded p-5 space-y-4">
    <div className="flex justify-between gap-4"><h2 className="font-semibold">Movimentações: {gift.nome}</h2>
      <button type="button" onClick={onClose} className="text-sm underline">Fechar histórico</button></div>
    {loading ? <p role="status">Carregando movimentações…</p> : error ? <p role="alert" className="text-red-700">{error}</p> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>
        {["Tipo", "Quantidade", "Saldo após", "Motivo", "Registrada por"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}
      </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t">
        <td className="p-3">{row.tipo}</td><td className="p-3">{row.quantidade > 0 ? "+" : ""}{row.quantidade}</td>
        <td className="p-3">{row.saldo}</td><td className="p-3">{row.motivo}</td><td className="p-3"><AuthorInfo record={row} /></td>
      </tr>)}{rows.length === 0 && <tr><td colSpan={5} className="p-3">Nenhuma movimentação registrada para este brinde.</td></tr>}</tbody></table>
      <p className="text-xs text-[#64748B] mt-3">Até 100 movimentações mais recentes.</p></div>}
  </section>;
}
