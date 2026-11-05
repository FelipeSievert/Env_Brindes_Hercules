-- A/C belongs to this document's recipient snapshot, never to the client registry.
DO $update_rpc$
DECLARE definition text; old_expression text := 'coalesce(draft->>''aos_cuidados'', recipient.aos_cuidados, '''')';
BEGIN
  definition := pg_get_functiondef('public.create_declaracoes(jsonb)'::regprocedure);
  IF position(old_expression IN definition)=0 THEN
    RAISE EXCEPTION 'Declaration RPC differs from the reviewed A/C expression';
  END IF;
  EXECUTE replace(definition,old_expression,'coalesce(draft->>''aos_cuidados'', '''')');
END $update_rpc$;
