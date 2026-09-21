import { useState } from "react";
import { Save, Bell, Mail, ToggleLeft, ToggleRight, Info } from "lucide-react";
import { Configuracoes as ConfigType } from "../types";

interface Props {
  config: ConfigType;
  onSave: (c: ConfigType) => Promise<void>;
}

export default function Configuracoes({ config, onSave }: Props) {
  const [form, setForm]       = useState(config.remetente);
  
  // ✅ CORRIGIDO: Usar nomes corretos do banco
  const [lembretes, setLembretes] = useState({
    lembretes_ativados: config.lembretes?.lembretes_ativados ?? false,
    dias_para_lembrete: config.lembretes?.dias_para_lembrete ?? 2,
    email_lembretes: config.lembretes?.email_lembretes ?? false,
    email_destino: config.lembretes?.email_destino ?? "",
    hora_verificacao_diaria: config.lembretes?.hora_verificacao_diaria ?? "08:00",
  });
  
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); 
    setError(null);
    try {
      await onSave({ 
        remetente: form, 
        lembretes: {
          lembretes_ativados: lembretes.lembretes_ativados,
          dias_para_lembrete: lembretes.dias_para_lembrete,
          email_lembretes: lembretes.email_lembretes,
          email_destino: lembretes.email_destino,
          hora_verificacao_diaria: lembretes.hora_verificacao_diaria,
        }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { 
      setSaving(false); 
    }
  }

  const Field = ({ label, field }: { label: string; field: keyof typeof form }) => (
    <div>
      <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">{label}</label>
      <input
        value={form[field]}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
      />
    </div>
  );

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-['Outfit'] font-700 text-[#1E293B]">Configurações</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Dados do remetente e preferências do sistema</p>
      </div>

      {/* Dados do remetente */}
      <div className="bg-white rounded-[6px] border border-[#DDE3EC]">
        <div className="px-6 py-4 border-b border-[#DDE3EC]">
          <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Dados do Remetente</h2>
          <p className="text-xs text-[#64748B] font-['Inter'] mt-0.5">Usados em todas as declarações de conteúdo</p>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Nome / Razão Social" field="nome" /></div>
          <Field label="CNPJ" field="cnpj" />
          <Field label="CEP" field="cep" />
          <Field label="Endereço" field="endereco" />
          <Field label="Número" field="numero" />
          <Field label="Bairro" field="bairro" />
          <Field label="Cidade" field="cidade" />
          <Field label="UF" field="uf" />
        </div>
      </div>

      {/* Lembretes de rastreio */}
      <div className="bg-white rounded-[6px] border border-[#DDE3EC]">
        <div className="px-6 py-4 border-b border-[#DDE3EC] flex items-center gap-2">
          <Bell size={16} className="text-[#1A3A6B]" />
          <div>
            <h2 className="font-['Outfit'] font-600 text-[#1E293B]">Lembretes Automáticos de Rastreio</h2>
            <p className="text-xs text-[#64748B] font-['Inter'] mt-0.5">
              Alerta quando uma declaração completa 2 dias sem código de rastreio
            </p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Toggle ativo */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-['Inter'] font-600 text-[#1E293B]">Ativar lembretes automáticos</p>
              <p className="text-xs text-[#64748B] font-['Inter'] mt-0.5">
                Gera notificações internas e registra no banco diariamente via rotina agendada
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLembretes((l) => ({ ...l, lembretes_ativados: !l.lembretes_ativados }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-['Inter'] font-500 border transition-colors ${
                lembretes.lembretes_ativados
                  ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                  : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#1A3A6B]"
              }`}
            >
              {lembretes.lembretes_ativados
                ? <><ToggleRight size={16} /> Ativado</>
                : <><ToggleLeft size={16} /> Desativado</>}
            </button>
          </div>

          {/* Dias para lembrete */}
          {lembretes.lembretes_ativados && (
            <div>
              <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">
                Dias para ativar o lembrete
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={lembretes.dias_para_lembrete}
                onChange={(e) => setLembretes((l) => ({ ...l, dias_para_lembrete: parseInt(e.target.value) }))}
                className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
              />
            </div>
          )}

          {/* Hora de verificação */}
          {lembretes.lembretes_ativados && (
            <div>
              <label className="block text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B] mb-1">
                Hora para verificação diária (UTC)
              </label>
              <input
                type="time"
                value={lembretes.hora_verificacao_diaria}
                onChange={(e) => setLembretes((l) => ({ ...l, hora_verificacao_diaria: e.target.value }))}
                className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
              />
            </div>
          )}

          {/* Email */}
          <div className={`space-y-1.5 transition-opacity ${lembretes.lembretes_ativados ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-['Inter'] font-600 uppercase tracking-[0.08em] text-[#64748B]">
                <Mail size={12} />
                Enviar lembretes por email
              </label>
              <button
                type="button"
                onClick={() => setLembretes((l) => ({ ...l, email_lembretes: !l.email_lembretes }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-['Inter'] font-500 border transition-colors ${
                  lembretes.email_lembretes
                    ? "bg-[#1A3A6B] text-white border-[#1A3A6B]"
                    : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#1A3A6B]"
                }`}
              >
                {lembretes.email_lembretes
                  ? <><ToggleRight size={16} /> Ativado</>
                  : <><ToggleLeft size={16} /> Desativado</>}
              </button>
            </div>

            {lembretes.email_lembretes && (
              <input
                type="email"
                value={lembretes.email_destino}
                onChange={(e) => setLembretes((l) => ({ ...l, email_destino: e.target.value }))}
                placeholder="exemplo@empresa.com.br"
                className="w-full border border-[#DDE3EC] rounded px-3 py-2 text-sm font-['Inter'] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/30 focus:border-[#1A3A6B]"
              />
            )}
            <div className="flex items-start gap-1.5 mt-2 p-3 bg-[#F8FAFC] border border-[#DDE3EC] rounded text-xs font-['Inter'] text-[#64748B]">
              <Info size={13} className="text-[#94A3B8] shrink-0 mt-0.5" />
              <span>
                O envio de e-mail requer a chave <code className="bg-[#EEF2F7] px-1 rounded">RESEND_API_KEY</code> configurada em{" "}
                <strong>Supabase → Settings → Edge Functions → Secrets</strong>.
                As notificações internas funcionam mesmo sem e-mail configurado.
              </span>
            </div>
          </div>

          {/* Sobre a rotina */}
          <div className="p-3 bg-[#EEF2F7] border border-[#C7D4E8] rounded text-xs font-['Inter'] text-[#1A3A6B] space-y-1">
            <p className="font-600">Rotina automática (backend)</p>
            <p className="text-[#64748B]">
              A verificação é executada diariamente à hora configurada via <code className="bg-white px-1 rounded border border-[#C7D4E8]">pg_cron</code> no Supabase.
              Para ativar: <strong>Database → Extensions → habilite pg_cron</strong>, depois execute a migration SQL atualizada.
              No plano Free do Supabase, execute <code className="bg-white px-1 rounded border border-[#C7D4E8]">SELECT public.check_tracking_reminders()</code> manualmente quando necessário.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-['Inter']">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3A6B] text-white rounded text-sm font-['Inter'] font-500 hover:bg-[#15305a] disabled:opacity-50 transition-colors"
        >
          <Save size={15} />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
        {saved && <span className="text-sm text-green-600 font-['Inter'] font-500">✓ Salvo com sucesso!</span>}
      </div>
    </div>
  );
}