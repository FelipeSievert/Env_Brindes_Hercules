import { useState } from "react";
import type { Declaracao } from "../types";
import { buildDashboardPeriodStats, dashboardRange } from "../lib/dashboard";

export default function DashboardCharts({ declaracoes }: { declaracoes: Declaracao[] }) {
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(() => dashboardRange("month"));
  const { months, statuses, gifts, count, label, error } = buildDashboardPeriodStats(declaracoes, range.start, range.end);
  const period = months.length;
  function selectPreset(value: string) {
    setPreset(value);
    if (value !== "custom") setRange(dashboardRange(value as "month" | "6" | "12"));
  }
  const maxMonth = Math.max(1, ...months.map(m => m.count));
  const maxGift = Math.max(1, ...gifts.map(g => g.average));
  const periodTotal = months.reduce((sum, m) => sum + m.count, 0);
  const panel = "bg-white rounded-[6px] border border-[#DDE3EC] p-5 min-w-0";

  return (
    <section aria-label="Gráficos do Dashboard" className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className={`${panel} xl:col-span-2`}>
        <h2 className="font-semibold text-[#1E293B]">Período dos gráficos</h2>
        <div className="flex flex-wrap items-end gap-4 mt-3">
          <label className="text-xs text-[#64748B]">Consultar<select aria-label="Período dos gráficos" value={preset} onChange={event=>selectPreset(event.target.value)} className="block bg-white border rounded px-3 py-2 mt-1 text-sm text-[#1E293B]">
            <option value="month">Este mês</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option><option value="custom">Personalizado</option>
          </select></label>
          <label className="text-xs text-[#64748B]">Data inicial<input type="date" value={range.start} onChange={event=>{setPreset("custom");setRange(prev=>({...prev,start:event.target.value}));}} className="block border rounded px-3 py-2 mt-1 text-sm text-[#1E293B]"/></label>
          <label className="text-xs text-[#64748B]">Data final<input type="date" value={range.end} onChange={event=>{setPreset("custom");setRange(prev=>({...prev,end:event.target.value}));}} className="block border rounded px-3 py-2 mt-1 text-sm text-[#1E293B]"/></label>
        </div>
        <p role={error?"alert":"status"} className={`text-xs mt-3 ${error?"text-red-700":"text-[#64748B]"}`}>{error || `${label} · ${count} declarações · pela data da declaração`}</p>
      </div>
      <div className={panel}>
        <div className="flex flex-wrap justify-between gap-3 items-start">
          <div>
            <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Declarações por mês</h2>
            <p className="text-xs text-[#64748B] mt-1">{label} · {periodTotal} declarações</p>
          </div>

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
        <p className="text-xs text-[#64748B] mt-1">{label} · {count} declarações</p>
        <div className="mt-6 space-y-5">
          {statuses.map(s => <div key={s.key}>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-[#475569]">{s.label}</span><span className="font-600 text-[#1E293B]">{s.count} <span className="font-normal text-xs text-[#64748B]">({count ? Math.round(s.count / count * 100) : 0}%)</span></span></div>
            <div className="h-2 rounded-full bg-[#F1F4F8]" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${count ? s.count / count * 100 : 0}%`, backgroundColor: s.hex }} /></div>
          </div>)}
        </div>
      </div>
      <div className={`${panel} xl:col-span-2`}>
        <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Uso médio dos brindes</h2>
        <p className="text-xs text-[#64748B] mt-1">{label} · Média por declaração em que o brinde apareceu · Gerado e Informado</p>
        {gifts.length ? <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-6">{gifts.map(g => <div key={g.key}>
          <div className="flex justify-between gap-4 text-sm mb-1.5"><span className="text-[#475569] break-words">{g.label}</span><span className="font-600 text-[#1E293B] shrink-0">{g.average.toLocaleString("pt-BR",{maximumFractionDigits:2})} un./decl.</span></div>
          <p className="text-xs text-[#64748B] mb-2">{g.count.toLocaleString("pt-BR")} unidades em {g.occurrences} {g.occurrences===1?"declaração":"declarações"}</p>
          <div className="h-2 rounded-full bg-[#F1F4F8]" aria-hidden="true"><div className="h-full rounded-full bg-[#1A3A6B]" style={{ width: `${g.average / maxGift * 100}%` }} /></div>
        </div>)}</div> : <p className="text-sm text-[#64748B] py-8">Nenhum item em declarações ativas neste período.</p>}
      </div>
    </section>
  );
}
