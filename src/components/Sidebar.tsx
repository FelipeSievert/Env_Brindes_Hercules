import {
  LayoutDashboard, Users, Gift, FilePlus, FileText,
  Settings, Zap, FileUp, UserCog, LogOut,
} from "lucide-react";
import { Page, Notificacao } from "../types";
import NotificacoesPanel from "./NotificacoesPanel";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  notificacoes: Notificacao[];
  onUpdateNotificacoes: (updated: Notificacao[]) => void;
  onNavigateToDeclaracao: (declaracaoId: string) => void;
  isAdmin: boolean;
  onSignOut: () => void;
}

const navItems: { label: string; page: Page; icon: React.ReactNode }[] = [
  { label: "Dashboard",          page: "dashboard",       icon: <LayoutDashboard size={18} /> },
  { label: "Destinatários",      page: "destinatarios",   icon: <Users size={18} /> },
  { label: "Brindes e Estoque",  page: "brindes",         icon: <Gift size={18} /> },
  { label: "Nova Declaração",    page: "nova-declaracao", icon: <FilePlus size={18} /> },
  { label: "Declarações Geradas",page: "declaracoes",     icon: <FileText size={18} /> },
  { label: "Importar Word",      page: "importar-word",   icon: <FileUp size={18} /> },
  { label: "Configurações",      page: "configuracoes",   icon: <Settings size={18} /> },
];

export default function Sidebar({
  currentPage, onNavigate, notificacoes, onUpdateNotificacoes, onNavigateToDeclaracao,
  isAdmin, onSignOut,
}: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen bg-[#1A3A6B] flex flex-col shrink-0">
      {/* Logo + notification bell */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#D42B1E] rounded flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-['Outfit'] font-700 text-sm leading-tight">HERCULES</p>
            <p className="text-white/50 text-[10px] font-['Inter'] uppercase tracking-widest leading-tight">
              Motores Elétricos
            </p>
          </div>
        </div>
        <NotificacoesPanel
          notificacoes={notificacoes}
          onUpdate={onUpdateNotificacoes}
          onNavigateToDeclaracao={onNavigateToDeclaracao}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 pt-2 pb-1 text-[10px] font-['Inter'] font-500 uppercase tracking-[0.12em] text-white/35">
          Menu
        </p>
        {navItems.map((item) => {
          const active = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-['Inter'] font-500 transition-all duration-150 text-left ${
                active
                  ? "bg-white text-[#1A3A6B]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={active ? "text-[#1A3A6B]" : "text-white/50"}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
        {isAdmin && <button onClick={() => onNavigate("usuarios")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-['Inter'] font-500 text-left ${currentPage === "usuarios" ? "bg-white text-[#1A3A6B]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
          <UserCog size={18} /> Gerenciar usuários
        </button>}
      </nav>

      <div className="px-4 py-3 border-t border-white/10"><button onClick={onSignOut} className="flex items-center gap-2 text-sm text-white/80 hover:text-white"><LogOut size={16} /> Sair da conta</button></div>
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-[10px] font-['Inter']">Sistema de Declaração v1.0</p>
      </div>
    </aside>
  );
}
