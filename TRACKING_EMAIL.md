# Responsáveis e e-mail de rastreio

Menu Responsáveis: nome e e-mail, edição de cadastro e histórico de entrega. Nova declaração permite selecionar um responsável e escrever a mensagem. O nome e o e-mail são copiados para a declaração para preservar o histórico. Nenhum e-mail foi inventado para o nome da imagem.

Ao salvar um código válido, save_tracking_notification grava status Informado e um único aviso por declaração/e-mail/código. A função send-tracking-email usa a autorização Gmail já existente no servidor. A interface só afirma envio após confirmação do provedor. Falhas anteriores ao envio permitem nova tentativa pelo histórico; respostas ambíguas ficam como incerto, evitando repetição automática.

A migration responsible_tracking_email foi aplicada. Há RLS de funcionário ativo, sem leitura anônima das tabelas ou acesso do navegador a tokens, e sem permissão do funcionário para falsificar status de envio. O normalizador de status permite gravar gerada/impressa/enviada de telas anteriores sem remover declaracoes_status_check.

Validação: build passou; oito testes de Dashboard/declarações e 14 de convites/CORS continuam passando; cinco testes da função de e-mail passaram com provedor simulado. SQL real em transação com ROLLBACK confirmou responsável/email na geração, compatibilidade de status, gravação de rastreio e fila sem duplicidade, e restrições de acesso. Preflight da função publicada retornou 204; acesso sem sessão retornou 401. Advisors não apontaram novos avisos. Mantidas 25 declarações e saldo 3741; fila real segue vazia. Nenhuma mensagem real foi enviada durante os testes.

Convite do colega: Auth registrou mail.send às 13:55:09 UTC (10:55:09 de Brasília) em 04/11/2026, sem primeiro acesso posterior. Isso não comprova entrega na caixa de entrada e não demonstra incompatibilidade com Outlook. Verificar lixo eletrônico e quarentena do domínio corporativo; remetente registrado noreply@mail.app.supabase.io. Não foi reenviado convite nem alterada configuração de autenticação.

Limites: entrega real depende da validade da autorização do remetente Gmail. Conferência visual autenticada e recebimento real ainda pendentes. Frontend segue no Preview/PR #1, sem promoção a produção. TypeScript conserva os sete erros preexistentes de AuthGate/Configuracoes.
