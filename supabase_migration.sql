-- ============================================================
-- Sistema de Declaração de Conteúdo — Hercules Motores Elétricos
-- Execute este script no Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ── Figma Make internal tables (required for edge function deploy) ──────────
CREATE TABLE IF NOT EXISTS kv_store_8d3e443d (
  key   TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- ── DESTINATÁRIOS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destinatarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cpf_cnpj    TEXT,
  cep         TEXT,
  endereco    TEXT,
  numero      TEXT,
  complemento TEXT DEFAULT '',
  bairro      TEXT,
  cidade      TEXT,
  uf          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE destinatarios ADD COLUMN IF NOT EXISTS categorias TEXT[] DEFAULT '{}';

-- ── BRINDES / ESTOQUE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brindes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT NOT NULL,
  categoria      TEXT DEFAULT '',
  quantidade     INTEGER NOT NULL DEFAULT 0,
  peso_unitario  NUMERIC(8,3) NOT NULL DEFAULT 0,
  valor          NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONFIGURAÇÕES (única linha, id = 1) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  id        INTEGER PRIMARY KEY DEFAULT 1,
  nome      TEXT DEFAULT 'HERCULES MOTORES ELÉTRICOS',
  cnpj      TEXT DEFAULT '07.442.711/0001-65',
  endereco  TEXT DEFAULT 'RUA CHAPECÓ',
  numero    TEXT DEFAULT '590',
  bairro    TEXT DEFAULT 'INDUSTRIAL',
  cidade    TEXT DEFAULT 'TIMBÓ',
  uf        TEXT DEFAULT 'SC',
  cep       TEXT DEFAULT '89120-000'
);

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS lembretes_ativos  BOOLEAN DEFAULT true;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS email_lembretes   TEXT    DEFAULT '';

INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── DECLARAÇÕES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declaracoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,
  destinatario_id UUID NOT NULL REFERENCES destinatarios(id),
  data            TEXT NOT NULL,
  local           TEXT NOT NULL DEFAULT 'TIMBÓ',
  status          TEXT NOT NULL DEFAULT 'gerada'
                    CHECK (status IN ('gerada','impressa','enviada','cancelada')),
  total_itens     INTEGER NOT NULL DEFAULT 0,
  peso_total      NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE declaracoes ADD COLUMN IF NOT EXISTS responsavel                 TEXT    DEFAULT '';
ALTER TABLE declaracoes ADD COLUMN IF NOT EXISTS codigo_rastreio             TEXT    DEFAULT '';
ALTER TABLE declaracoes ADD COLUMN IF NOT EXISTS lembrete_rastreio_enviado   BOOLEAN DEFAULT false;
ALTER TABLE declaracoes ADD COLUMN IF NOT EXISTS data_lembrete_rastreio      TIMESTAMPTZ;

-- ── ITENS DAS DECLARAÇÕES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declaracao_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaracao_id UUID NOT NULL REFERENCES declaracoes(id) ON DELETE CASCADE,
  brinde_id     UUID NOT NULL REFERENCES brindes(id),
  quantidade    INTEGER NOT NULL DEFAULT 1,
  peso_total    NUMERIC(10,3) NOT NULL DEFAULT 0
);

-- ── NOTIFICAÇÕES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaracao_id UUID REFERENCES declaracoes(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL DEFAULT 'rastreio_pendente',
  mensagem      TEXT NOT NULL,
  lida          BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── FUNÇÕES DE ESTOQUE ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrease_stock(p_brinde_id UUID, p_quantidade INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE brindes
  SET    quantidade = quantidade - p_quantidade
  WHERE  id = p_brinde_id
    AND  quantidade >= p_quantidade;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque insuficiente para o brinde %', p_brinde_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increase_stock(p_brinde_id UUID, p_quantidade INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE brindes
  SET    quantidade = quantidade + p_quantidade
  WHERE  id = p_brinde_id;
END;
$$ LANGUAGE plpgsql;

-- ── FUNÇÃO: verificar rastreio pendente e gerar notificações ─────────────────
-- Executada pelo pg_cron diariamente (e também pela Edge Function via trigger manual)
CREATE OR REPLACE FUNCTION public.run_rastreio_check()
RETURNS INTEGER AS $$
DECLARE
  rec   RECORD;
  cnt   INTEGER := 0;
  cfg   RECORD;
BEGIN
  -- Verifica se lembretes estão ativos
  SELECT lembretes_ativos INTO cfg FROM configuracoes WHERE id = 1;
  IF cfg IS NULL OR cfg.lembretes_ativos = false THEN
    RETURN 0;
  END IF;

  FOR rec IN
    SELECT d.id, d.numero, d.data
    FROM declaracoes d
    WHERE
      (d.codigo_rastreio IS NULL OR d.codigo_rastreio = '')
      AND (d.lembrete_rastreio_enviado IS NULL OR d.lembrete_rastreio_enviado = false)
      AND d.created_at <= NOW() - INTERVAL '2 days'
  LOOP
    -- Evita duplicar notificação não lida já existente
    IF NOT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE declaracao_id = rec.id
        AND tipo = 'rastreio_pendente'
        AND lida = false
    ) THEN
      INSERT INTO notificacoes (declaracao_id, tipo, mensagem)
      VALUES (
        rec.id,
        'rastreio_pendente',
        'A declaração nº ' || rec.numero || ' está há 2 dias sem código de rastreio. Verifique e informe o código.'
      );
    END IF;

    UPDATE declaracoes
    SET
      lembrete_rastreio_enviado = true,
      data_lembrete_rastreio    = NOW()
    WHERE id = rec.id;

    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── AGENDAR COM pg_cron (disponível no plano Pro do Supabase) ─────────────────
-- Executa todo dia às 08:00 UTC. Remova esta seção se estiver no plano Free.
-- Para ativar: Database > Extensions > enable pg_cron primeiro.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('rastreio-daily-check');
    PERFORM cron.schedule(
      'rastreio-daily-check',
      '0 8 * * *',
      'SELECT public.run_rastreio_check()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron não disponível neste plano; ignore
  NULL;
END $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE kv_store_8d3e443d ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinatarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brindes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaracoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaracao_itens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all_kv"             ON kv_store_8d3e443d;
  DROP POLICY IF EXISTS "allow_all_destinatarios"   ON destinatarios;
  DROP POLICY IF EXISTS "allow_all_brindes"         ON brindes;
  DROP POLICY IF EXISTS "allow_all_configuracoes"   ON configuracoes;
  DROP POLICY IF EXISTS "allow_all_declaracoes"     ON declaracoes;
  DROP POLICY IF EXISTS "allow_all_itens"           ON declaracao_itens;
  DROP POLICY IF EXISTS "allow_all_notificacoes"    ON notificacoes;
END $$;

CREATE POLICY "allow_all_kv"             ON kv_store_8d3e443d FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_destinatarios"   ON destinatarios      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_brindes"         ON brindes            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_configuracoes"   ON configuracoes      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_declaracoes"     ON declaracoes        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_itens"           ON declaracao_itens   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notificacoes"    ON notificacoes       FOR ALL USING (true) WITH CHECK (true);
