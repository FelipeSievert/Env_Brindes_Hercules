-- Add one exclusive Master role, reserved for the existing account owner.
-- Does not modify other users and does not send emails.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = '7d6c943c-aae0-4799-a255-53a5e5fa8cd8'::uuid
      AND lower(email) = 'felipesievert864@gmail.com'
      AND role = 'admin' AND status = 'active'
  ) THEN RAISE EXCEPTION 'Existing owner administrator not found; refusing role change.'; END IF;
END $$;

ALTER TABLE public.app_users DROP CONSTRAINT app_users_role_check;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('master','admin','operator'));

-- Even a privileged backend action cannot assign Master to an unrelated account.
ALTER TABLE public.app_users ADD CONSTRAINT app_users_master_owner_guard
  CHECK (
    role <> 'master' OR (
      id = '7d6c943c-aae0-4799-a255-53a5e5fa8cd8'::uuid
      AND lower(email) = 'felipesievert864@gmail.com'
      AND status = 'active'
    )
  );
CREATE UNIQUE INDEX app_users_only_one_master ON public.app_users (role) WHERE role = 'master';

UPDATE public.app_users SET role = 'master'
 WHERE id = '7d6c943c-aae0-4799-a255-53a5e5fa8cd8'::uuid
  AND lower(email) = 'felipesievert864@gmail.com'
  AND role = 'admin' AND status = 'active';

DO $$
BEGIN
 IF (SELECT count(*) FROM public.app_users WHERE role='master') <> 1 THEN
  RAISE EXCEPTION 'Master role creation failed; refusing partial migration.';
 END IF;
END $$;