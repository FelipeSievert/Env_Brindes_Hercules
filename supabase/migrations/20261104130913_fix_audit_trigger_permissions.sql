-- Target: Hercules / cddxvgegzzyafxgcpklt.
-- Audit rows are written only by the database trigger, never by browser roles.
-- Keep business-table grants/RLS and existing service_role access unchanged.
CREATE SCHEMA IF NOT EXISTS eb_audit_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA eb_audit_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA eb_audit_private TO service_role;

-- Move the existing function, preserving its OID and all three trigger links.
DO $move$
BEGIN
  IF to_regprocedure('public.eb_audit_trigger()') IS NOT NULL THEN
    IF to_regprocedure('eb_audit_private.eb_audit_trigger()') IS NOT NULL THEN
      RAISE EXCEPTION 'Two audit trigger functions exist; review before continuing';
    END IF;
    ALTER FUNCTION public.eb_audit_trigger() SET SCHEMA eb_audit_private;
  ELSIF to_regprocedure('eb_audit_private.eb_audit_trigger()') IS NULL THEN
    RAISE EXCEPTION 'Existing audit trigger function not found';
  END IF;
END $move$;

CREATE OR REPLACE FUNCTION eb_audit_private.eb_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $audit$
DECLARE
  caller_role text := pg_catalog.current_setting('role', true);
  actor_id uuid := auth.uid();
BEGIN
  -- A privileged audit writer is valid only for these existing row triggers.
  IF TG_LEVEL <> 'ROW' OR TG_WHEN <> 'BEFORE' OR TG_NARGS <> 0
     OR TG_OP NOT IN ('INSERT', 'UPDATE', 'DELETE')
     OR TG_RELID NOT IN (
       'public.destinatarios'::regclass,
       'public.brindes'::regclass,
       'public.configuracoes'::regclass
     ) THEN
    RAISE EXCEPTION 'Contexto de auditoria não autorizado.' USING ERRCODE = '42501';
  END IF;

  -- Check the real invoking role, not current_user (the function owner).
  -- Preserve trusted service jobs and direct database-owner maintenance.
  IF caller_role = 'service_role'
     OR (session_user IN ('postgres', 'supabase_admin')
         AND caller_role IN ('none', 'postgres', 'supabase_admin')) THEN
    NULL;
  ELSIF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_users AS actor
    WHERE actor.id = actor_id AND actor.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Conta sem acesso ativo para registrar alterações.' USING ERRCODE = '42501';
  END IF;

  -- Preserve the existing audit payload and updated_at behavior.
  INSERT INTO public.eb_auditoria(tabela, registro_id, acao, detalhes)
  VALUES (
    TG_TABLE_NAME,
    coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id'),
    TG_OP,
    jsonb_build_object(
      'antes', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'depois', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $audit$;

ALTER FUNCTION eb_audit_private.eb_audit_trigger() OWNER TO postgres;
REVOKE ALL ON FUNCTION eb_audit_private.eb_audit_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION eb_audit_private.eb_audit_trigger() TO service_role;
