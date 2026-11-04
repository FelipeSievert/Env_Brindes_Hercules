import { useState } from "react";
import type { Declaracao } from "../types";
import { buildDashboardStats } from "../lib/dashboard";

export default function DashboardCharts({ declaracoes }: { declaracoes: Declaracao[] }) {
  const [period, setPeriod] = useState(6);
  const { months, statuses, gifts } = buildDashboardStats(declaracoes, period);
  const maxMonth = Math.max(1, ...months.map(m => m.count));
  const maxGift = Math.max(1, ...gifts.map(g => g.count));
  const periodTotal = months.reduce((sum, m) => sum + m.count, 0);
  const panel = "bg-white rounded-[6px] border border-[#DDE3EC] p-5 min-w-0";

  return (
    <section aria-label="Gráficos do Dashboard" className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className={panel}>
        <div className="flex flex-wrap justify-between gap-3 items-start">
          <div>
            <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Declarações por mês</h2>
            <p className="text-xs text-[#64748B] mt-1">{periodTotal} no período · pela data da declaração</p>
          </div>
          <select aria-label="Período do gráfico mensal" value={period} onChange={e => setPeriod(Number(e.target.value))} className="border border-[#DDE3EC] rounded px-2 py-1.5 text-xs text-[#475569] bg-white">
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <svg role="img" aria-label={months.map(m => `${m.label}: ${m.count}`).join("; ")} viewBox={`0 0 ${period * 64 + 32} 215`} className="w-full min-w-[320px] h-[225px] mt-3">
            <title>Quantidade de declarações por mês</title>
            {[0, 0.5, 1].map(fraction => <line key={fraction} x1="14" x2={period * 64 + 18} y1={172 - fraction * 140} y2={172 - fraction * 140} stroke="#E8EDF4" strokeDasharray="3 4" />)}
            {months.map((m, i) => {
              const height = m.count / maxMonth * 130;
              return <g key={m.key}>
                <title>{m.label}: {m.count} declarações</title>
                <rect x={i * 64 + 30} y={172 - height} width="34" height={m.count ? height : 2} rx="3" fill={i === period - 1 ? "#D42B1E" : "#1A3A6B"} />
                <text x={i * 64 + 47} y={163 - height} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1E293B">{m.count}</text>
                <text x={i * 64 + 47} y="195" textAnchor="middle" fontSize="10" fill="#64748B">{m.label}</text>
              </g>;
            })}
          </svg>
        </div>
      </div>
      <div className={panel}>
        <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Situação das declarações</h2>
        <p className="text-xs text-[#64748B] mt-1">Todos os registros · {declaracoes.length} declarações</p>
        <div className="mt-6 space-y-5">
          {statuses.map(s => <div key={s.key}>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-[#475569]">{s.label}</span><span className="font-600 text-[#1E293B]">{s.count} <span className="font-normal text-xs text-[#64748B]">({declaracoes.length ? Math.round(s.count / declaracoes.length * 100) : 0}%)</span></span></div>
            <div className="h-2 rounded-full bg-[#F1F4F8]" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${declaracoes.length ? s.count / declaracoes.length * 100 : 0}%`, backgroundColor: s.hex }} /></div>
          </div>)}
        </div>
      </div>
      <div className={`${panel} xl:col-span-2`}>
        <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Brindes mais usados</h2>
        <p className="text-xs text-[#64748B] mt-1">Quantidade de itens em declarações Gerado e Informado · até 6 brindes</p>
        {gifts.length ? <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-6">{gifts.map(g => <div key={g.key}>
          <div className="flex justify-between gap-4 text-sm mb-1.5"><span className="text-[#475569] break-words">{g.label}</span><span className="font-600 text-[#1E293B] shrink-0">{g.count.toLocaleString("pt-BR")}</span></div>
          <div className="h-2 rounded-full bg-[#F1F4F8]" aria-hidden="true"><div className="h-full rounded-full bg-[#1A3A6B]" style={{ width: `${g.count / maxGift * 100}%` }} /></div>
        </div>)}</div> : <p className="text-sm text-[#64748B] py-8">Nenhum item em declarações ativas.</p>}
      </div>
    </section>
  );
}
