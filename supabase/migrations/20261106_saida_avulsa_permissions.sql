-- Instalações Supabase antigas podem conceder UPDATE/DELETE por privilégios padrão.
-- O acesso direto a saídas avulsas deve permitir somente consulta e criação.
REVOKE ALL ON TABLE public.saidas_avulsas FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.saidas_avulsas TO authenticated;
NOTIFY pgrst, 'reload schema';
