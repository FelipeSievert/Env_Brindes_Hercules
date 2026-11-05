-- This singleton table predates creation timestamps. Leave its historical date unknown.
ALTER TABLE public.configuracoes ADD COLUMN created_at timestamptz;
NOTIFY pgrst, 'reload schema';
