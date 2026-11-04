# Ativação de convites

O site principal agora exige autenticação e apresenta Ativar convite para contas invited. Os dados só aparecem após o próprio convidado definir senha e concluir a ativação. Não é necessário redirecionar convites ao Preview: manage-users mantém APP_URL como destino.

A leitura do perfil usa Promise.resolve para converter o PostgREST PromiseLike em Promise antes de catch/finally. Isso corrige a interrupção da verificação de permissões; falhas exibem mensagem de acesso e encerram o carregamento.

Para o convite já confirmado, acessar o endereço principal com a conta secundária e concluir Ativar convite. Nenhum status foi liberado manualmente e nenhum convite foi reenviado. A senha precisa ser definida pelo usuário.

Testes de CORS, destino do convite e autorização executados com backend simulado. Recebimento e ativação com senha real dependem do usuário.
