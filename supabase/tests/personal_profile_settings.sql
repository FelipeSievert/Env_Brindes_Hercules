BEGIN;
DO $test$
DECLARE actor uuid; old_email text; old_role text; old_status text; others jsonb; confirmed_email text;
BEGIN
 SELECT id,email,role,status INTO actor,old_email,old_role,old_status FROM public.app_users WHERE status='active' ORDER BY created_at LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Active actor required'; END IF;
 SELECT jsonb_agg(to_jsonb(u) ORDER BY id) INTO others FROM public.app_users u WHERE id<>actor;
 UPDATE auth.users SET raw_user_meta_data=coalesce(raw_user_meta_data,'{}')||jsonb_build_object('full_name','Perfil de teste transacional','role','admin','status','blocked') WHERE id=actor;
 IF NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=actor AND full_name='Perfil de teste transacional' AND role=old_role AND status=old_status) THEN RAISE EXCEPTION 'Name sync failed or privileges changed'; END IF;
 confirmed_email:='profile-test-'||gen_random_uuid()||'@example.invalid';
 UPDATE auth.users SET email_change=confirmed_email WHERE id=actor;
 IF (SELECT email FROM public.app_users WHERE id=actor)<>old_email THEN RAISE EXCEPTION 'Unconfirmed email became login address'; END IF;
 UPDATE auth.users SET email=confirmed_email WHERE id=actor;
 IF (SELECT email FROM public.app_users WHERE id=actor)<>confirmed_email THEN RAISE EXCEPTION 'Confirmed email not synchronized'; END IF;
 IF others IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.app_users u WHERE id<>actor) THEN RAISE EXCEPTION 'Another account changed'; END IF;
 IF has_function_privilege('authenticated','eb_audit_private.sync_personal_profile()','EXECUTE') OR has_schema_privilege('authenticated','eb_audit_private','USAGE') THEN RAISE EXCEPTION 'Private profile synchronization exposed'; END IF;
END $test$;
ROLLBACK;
