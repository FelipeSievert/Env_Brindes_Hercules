import { Users, Gift, Package, FileText, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { Destinatario, Brinde, Declaracao, Page } from "../types";

interface DashboardProps {
  destinatarios: Destinatario[];
  brindes: Brinde[];
  declaracoes: Declaracao[];
  onNavigate: (page: Page) => void;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  gerada: { label: "Gerada", color: "bg-blue-100 text-blue-700" },
  impressa: { label: "Impressa", color: "bg-amber-100 text-amber-700" },
  enviada: { label: "Enviada", color: "bg-green-100 text-green-700" },
  informado: { label: "Informado", color: "bg-green-100 text-green-700" },
  devolvido: { label: "Devolvido", color: "bg-orange-100 text-orange-700" },
  gerado: { label: "Gerado", color: "bg-blue-100 text-blue-700" },
};
const fallbackStatus = { label: "Outro status", color: "bg-slate-100 text-slate-700" };

export default function Dashboard({ destinatarios, brindes, declaracoes, onNavigate }: DashboardProps) {
  const totalEstoque = brindes.reduce((s, b) => s + (Number(b.quantidade) || 0), 0);
  const mesAtual = new Date().toLocaleDateString("pt-BR").slice(3);
  const decsMes = declaracoes.filter((d) => typeof d.data === "string" && d.data.endsWith(mesAtual)).length;

  const cards = [
    {
      label: "Destinatários",
      value: destinatarios.length,
      icon: <Users size={22} />,
      color: "bg-[#1A3A6B]",
      page: "destinatarios" as Page,
    },
    {
      label: "Brindes Cadastrados",
      value: brindes.length,
      icon: <Gift size={22} />,
      color: "bg-[#D42B1E]",
      page: "brindes" as Page,
    },
    {
      label: "Estoque Total",
      value: totalEstoque,
      icon: <Package size={22} />,
      color: "bg-emerald-600",
      page: "brindes" as Page,
    },
    {
      label: "Declarações no Mês",
      value: decsMes,
      icon: <TrendingUp size={22} />,
      color: "bg-violet-600",
      page: "declaracoes" as Page,
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Dashboard</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Bem-vindo ao Sistema de Declaração de Conteúdo</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-5">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.page)}
            className="bg-white rounded-[6px] border border-[#DDE3EC] p-5 text-left hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded ${card.color} flex items-center justify-center text-white`}>
                {card.icon}
              </div>
              <ArrowRight size={15} className="text-[#DDE3EC] group-hover:text-[#1A3A6B] transition-colors" />
            </div>
            <p className="mt-4 text-3xl font-['Outfit'] font-700 text-[#1E293B]">{card.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5 font-['Inter']">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => onNavigate("nova-declaracao")}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors"
        >
          <Plus size={16} />
          Nova Declaração
        </button>
        <button
          onClick={() => onNavigate("destinatarios")}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#DDE3EC] text-[#1E293B] rounded text-sm font-['Inter'] font-500 hover:bg-[#F1F4F8] transition-colors"
        >
          <Plus size={16} />
          Novo Destinatário
        </button>
        <button
          onClick={() => onNavigate("brindes")}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#DDE3EC] text-[#1E293B] rounded text-sm font-['Inter'] font-500 hover:bg-[#F1F4F8] transition-colors"
        >
          <Plus size={16} />
          Novo Brinde
        </button>
      </div>

      {/* Recent declarations */}
      <div className="bg-white rounded-[6px] border border-[#DDE3EC]">
        <div className="px-6 py-4 border-b border-[#DDE3EC] flex items-center justify-between">
          <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Declarações Recentes</h2>
          <button
            onClick={() => onNavigate("declaracoes")}
            className="text-xs text-[#1A3A6B] hover:underline font-['Inter'] font-500"
          >
            Ver todas
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DDE3EC]">
              {["Número", "Destinatário", "Data", "Qtd. Itens", "Peso Total", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[10px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {declaracoes.map((d, i) => {
              const s = statusLabel[String(d.status ?? "").toLowerCase()] ?? {
                ...fallbackStatus,
                label: String(d.status ?? "Desconhecido"),
              };
              return (
                <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F8FAFC]"}>
                  <td className="px-6 py-3.5 text-sm font-['JetBrains_Mono',monospace] text-[#1A3A6B] font-500">{d.numero}</td>
                  <td className="px-6 py-3.5 text-sm text-[#1E293B] font-['Inter']">{d.destinatario?.nome ?? "Destinatário não informado"}</td>
                  <td className="px-6 py-3.5 text-sm text-[#64748B] font-['Inter']">{d.data}</td>
                  <td className="px-6 py-3.5 text-sm text-[#1E293B] font-['Inter']">{d.totalItens}</td>
                  <td className="px-6 py-3.5 text-sm text-[#1E293B] font-['Inter']">{(Number(d.pesoTotal) || 0).toFixed(2)} kg</td>
                  <td className="px-6 py-3.5">
                    <span className={`text-[11px] font-['Inter'] font-600 px-2 py-1 rounded-full ${s.color}`}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
