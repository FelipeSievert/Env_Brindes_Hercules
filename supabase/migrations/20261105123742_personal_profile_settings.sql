-- Auth confirms address changes; clients never write app_users roles or status.
CREATE FUNCTION eb_audit_private.sync_personal_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE profile_name text;
BEGIN
 IF TG_LEVEL<>'ROW' OR TG_WHEN<>'AFTER' OR TG_OP<>'UPDATE' OR TG_NARGS<>0 OR TG_RELID<>'auth.users'::regclass THEN
   RAISE EXCEPTION 'Contexto de perfil não autorizado.' USING ERRCODE='42501';
 END IF;
 IF NEW.raw_user_meta_data->>'full_name' IS DISTINCT FROM OLD.raw_user_meta_data->>'full_name' THEN
   profile_name:=btrim(coalesce(NEW.raw_user_meta_data->>'full_name',''));
   IF char_length(profile_name)<2 OR char_length(profile_name)>160 THEN RAISE EXCEPTION 'Informe um nome entre 2 e 160 caracteres.' USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE public.app_users SET full_name=coalesce(profile_name,full_name),
   email=CASE WHEN NEW.email IS DISTINCT FROM OLD.email THEN NEW.email ELSE email END
   WHERE id=NEW.id;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION eb_audit_private.sync_personal_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER eb_sync_personal_profile AFTER UPDATE OF email,raw_user_meta_data ON auth.users
  FOR EACH ROW WHEN(OLD.email IS DISTINCT FROM NEW.email OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION eb_audit_private.sync_personal_profile();
