# Destino da ativação de convites

A conta secundária confirmou o convite e definiu senha, mas permaneceu invited em app_users. Auth registrou callback para o endereço principal, que ainda usa o frontend anterior sem a etapa de ativação. As políticas de funcionário ativo retornam listas vazias para essa conta. Não houve perda de dados.

manage-users passa a direcionar convites para INVITE_URL, quando configurada, ou para o alias estável do Preview validado enquanto a interface nova não é promovida. O destino precisa pertencer à política CORS explícita. APP_URL e demais segredos não foram substituídos. Após a promoção definitiva, configurar INVITE_URL para a URL canônica de produção. Manter essa URL nos redirects permitidos do Supabase Auth.

Para o convite já confirmado, entrar diretamente no Preview com a conta secundária e concluir a tela Ativar convite. Nenhum status de usuário foi liberado manualmente, nenhum convite foi reenviado e nenhum acesso foi ampliado. O usuário precisa concluir a etapa de senha pessoalmente.

Os 14 testes de manage-users passaram, incluindo destino do convite, ativação apenas do próprio convidado e recusa para contas sem autorização. Teste de recebimento/callback real com novo convite continua pendente; nenhum e-mail real foi enviado nos testes.
