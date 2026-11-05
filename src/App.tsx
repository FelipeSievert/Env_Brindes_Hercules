import { useState, useEffect, useCallback } from "react";
import { Page, Destinatario, Brinde, Declaracao, Configuracoes, Notificacao } from "./types";
import { defaultConfig } from "./data/mockData";
import * as db from "./lib/db";
import Sidebar from "./components/Sidebar";
import Responsaveis from "./components/Responsaveis";
import Dashboard from "./components/Dashboard";
import Destinatarios from "./components/Destinatarios";
import BrindesEstoque from "./components/BrindesEstoque";
import NovaDeclaracao from "./components/NovaDeclaracao";
import DeclaracaoPreview from "./components/DeclaracaoPreview";
import DeclaracoesGeradas from "./components/DeclaracoesGeradas";
import ConfiguracoesTela from "./components/Configuracoes";
import ImportarDeclaracoesWord from "./components/ImportarDeclaracoesWord";
import AdministrarUsuarios from "./components/AdministrarUsuarios";
import { useAuth } from "./auth/AuthGate";

export default function App() {
  const { user, signOut } = useAuth();
  const [responsaveis, setResponsaveis] = useState<import("./types").Responsavel[]>([]);
  const [page, setPage]                 = useState<Page>("dashboard");
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [brindes, setBrindes]           = useState<Brinde[]>([]);
  const [declaracoes, setDeclaracoes]   = useState<Declaracao[]>([]);
  const [config, setConfig]             = useState<Configuracoes>(defaultConfig);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [previewDec, setPreviewDec]     = useState<Declaracao | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dest, br, decs, cfg, notifs, resp] = await Promise.all([
        db.fetchDestinatarios(),
        db.fetchBrindes(),
        db.fetchDeclaracoes(),
        db.fetchConfig(),
        db.fetchNotificacoes(),
        db.fetchResponsaveis(),
      ]);
      setResponsaveis(resp);
      setDestinatarios(dest);
      setBrindes(br);
      setDeclaracoes(decs);
      if (cfg) setConfig(cfg);
      setNotificacoes(notifs);

      // Dispara verificação de rastreio ao carregar (silenciosa)
      db.triggerRastreioCheck().then(async (count) => {
        if (count > 0) {
          const fresh = await db.fetchNotificacoes();
          setNotificacoes(fresh);
        }
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados do banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function handleNavigate(p: Page) {
    setPage(p);
    if (p !== "declaracao-preview") setPreviewDec(null);
  }

  function handleNavigateToDeclaracao(declaracaoId: string) {
    setPage("declaracoes");
    setPreviewDec(null);
  }

  async function handleGenerateDeclaracao(dec: Declaracao) {
    setDeclaracoes((prev) => [dec, ...prev]);
    setPreviewDec(dec);
    setPage("declaracao-preview");
    try {
      const [updated, allDeclarations] = await Promise.all([db.fetchBrindes(), db.fetchDeclaracoes()]);
      setBrindes(updated);
      setDeclaracoes(allDeclarations);
    } catch (_) {}
  }

  function handleViewDeclaracao(dec: Declaracao) {
    setPreviewDec(dec);
    setPage("declaracao-preview");
  }

  async function handleDuplicate(dec: Declaracao) {
    const copy: Omit<Declaracao, "id"> = {
      ...dec,
      numero: `DC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status: "gerado",
      data: new Date().toLocaleDateString("pt-BR"),
      codigoRastreio: "",
      lembreteRastreioEnviado: false,
      dataLembreteRastreio: undefined,
    };
    try {
      const saved = await db.insertDeclaracao(copy);
      setDeclaracoes((prev) => [saved, ...prev]);
      try { setBrindes(await db.fetchBrindes()); } catch (_) {}
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao duplicar declaração.");
    }
  }

  function handleUpdateRastreio(id: string, codigo: string) {
    db.fetchDeclaracoes().then(setDeclaracoes).catch(() => {});
    setDeclaracoes((prev) =>
      prev.map((d) => d.id === id ? { ...d, codigoRastreio: codigo, status: "informado" } : d)
    );
    // Se o rastreio foi informado, remove notificações relacionadas localmente
    if (codigo) {
      setNotificacoes((prev) =>
        prev.map((n) => n.declaracaoId === id ? { ...n, lida: true } : n)
      );
    }
  }

  if (page === "declaracao-preview" && previewDec) {
    return (
      <DeclaracaoPreview
        declaracao={previewDec}
        config={config}
        onBack={() => setPage("declaracoes")}
        onEdit={() => setPage("nova-declaracao")}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F1F4F8]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#1A3A6B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#64748B] font-['Inter']">Conectando ao banco de dados...</p>
          <p className="text-xs text-[#94A3B8] font-['Inter']">Tentando novamente automaticamente se necessário</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F1F4F8]">
        <div className="text-center space-y-4 max-w-sm p-8 bg-white rounded border border-[#DDE3EC]">
          <p className="font-['Outfit'] font-600 text-[#1E293B]">Erro de conexão</p>
          <p className="text-sm text-[#64748B] font-['Inter']">{error}</p>
          <p className="text-xs text-[#94A3B8] font-['Inter']">
            Verifique se as tabelas do banco foram criadas executando o arquivo{" "}
            <code className="bg-[#F1F4F8] px-1 rounded">supabase_migration.sql</code> no Supabase Dashboard.
          </p>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#F1F4F8]">
      <Sidebar
        currentPage={page}
        isAdmin={user.role === "admin"}
        onSignOut={() => { void signOut(); }}
        onNavigate={handleNavigate}
        notificacoes={notificacoes}
        onUpdateNotificacoes={setNotificacoes}
        onNavigateToDeclaracao={handleNavigateToDeclaracao}
      />
      <main className="flex-1 overflow-y-auto">
        {page === "dashboard" && (
          <Dashboard
            destinatarios={destinatarios}
            brindes={brindes}
            declaracoes={declaracoes}
            onNavigate={handleNavigate}
          />
        )}
        {page === "responsaveis" && <Responsaveis rows={responsaveis} onSaved={async()=>setResponsaveis(await db.fetchResponsaveis())} />}
        {page === "destinatarios" && (
          <Destinatarios
            destinatarios={destinatarios}
            onAdd={async (d) => {
              const saved = await db.insertDestinatario(d);
              setDestinatarios((prev) => [saved, ...prev]);
            }}
            onEdit={async (d) => {
              const saved = await db.updateDestinatario(d);
              setDestinatarios((prev) => prev.map((x) => (x.id === d.id ? saved : x)));
            }}
            onDelete={async (id) => {
              await db.deleteDestinatario(id);
              setDestinatarios((prev) => prev.filter((x) => x.id !== id));
            }}
            onImport={async (rows) => {
              await db.upsertDestinatarios(rows);
              const updated = await db.fetchDestinatarios();
              setDestinatarios(updated);
            }}
          />
        )}
        {page === "brindes" && (
          <BrindesEstoque
            brindes={brindes}
            onAdd={async (b) => {
              const saved = await db.insertBrinde(b);
              setBrindes((prev) => [saved, ...prev]);
            }}
            onEdit={async (b) => {
              const saved = await db.updateBrinde(b);
              setBrindes((prev) => prev.map((x) => (x.id === b.id ? saved : x)));
            }}
            onDelete={async (id) => {
              await db.deleteBrinde(id);
              setBrindes((prev) => prev.filter((x) => x.id !== id));
            }}
          />
        )}
        {page === "nova-declaracao" && (
          <NovaDeclaracao responsaveis={responsaveis}
            destinatarios={destinatarios}
            brindes={brindes}
            config={config}
            onGenerate={handleGenerateDeclaracao}
          />
        )}
        {page === "declaracoes" && (
          <DeclaracoesGeradas
            declaracoes={declaracoes}
            onView={handleViewDeclaracao}
            onDuplicate={handleDuplicate}
            onUpdateRastreio={handleUpdateRastreio}
            onDelete={async (dec) => {
              await db.deleteDeclaracao(dec);
              setDeclaracoes((prev) => prev.filter((d) => d.id !== dec.id));
              try {
                const updated = await db.fetchBrindes();
                setBrindes(updated);
              } catch (_) {}
            }}
          />
        )}
        {page === "importar-word" && (
          <ImportarDeclaracoesWord
            destinatarios={destinatarios}
            onImported={(updated) => setDestinatarios(updated)}
          />
        )}
        {page === "usuarios" && user.role === "admin" && <AdministrarUsuarios />}
        {page === "configuracoes" && (
          <ConfiguracoesTela
            config={config}
            onSave={async (c) => {
              await db.saveConfig(c);
              setConfig(c);
            }}
          />
        )}
      </main>
    </div>
  );
}
