# Liberação da importação com IA

## Arquitetura observada no repositório

Next.js no Vercel, Prisma com adapter libsql/Turso, inferência Anthropic em `after()` e cron diário de limpeza em `vercel.json`. A rota de admissão tem duração máxima de 300 segundos. A documentação indica deploy automático de `main` e aplicação de migrações antes do código dependente. Isso descreve o repositório; a configuração efetiva de ambientes, planos, regiões e secrets remotos não foi consultada nem alterada.

As novas importações guardam mídia em um **Blob privado dedicado**, usando `IMPORT_BLOB_READ_WRITE_TOKEN`. O token `BLOB_READ_WRITE_TOKEN` das outras funcionalidades não é reaproveitado. Em desenvolvimento, os bytes ficam em `.import-media/`, fora de `public/`. A URL persistida aponta para `/api/import-media/<organização>/<arquivo>`; a rota autoriza sessão ativa da organização ou token válido com vínculo da mídia ao calendário. Não há redirect para Blob nem cache público. A inferência recebe bytes em base64, não URLs privadas. Documentos originais não são persistidos.

Nenhuma mídia anteriormente pública se torna privada retroativamente. Novos recibos e URLs não aceitam os uploads legados nas novas confirmações: reenvie arquivos de revisões antigas. A avaliação/migração/remoção de objetos já públicos precisa de decisão e autorização próprias, preservando materiais e histórico em uso.

## Controles locais

- Produção exige `IMPORT_AI_ENABLED=1`; ausente ou `0` desativa novas inferências/uploads. Não habilitar antes dos gates abaixo. Em desenvolvimento, `0` também desativa a feature.
- Corpo real do request limitado em bytes, mesmo sem Content-Length; timeout de leitura de 15 s; 4 MB por arquivo e no conjunto de documentos; mídia com tamanho incluído no recibo e 16 MB agregados.
- Office: até 512 entradas ZIP, 8 MB expandidos, estrutura e tamanhos conferidos com expansão limitada; sem entidades XML. Worker com deadline de 8 s e heap V8 limitado; 32 abas, 5000 linhas, 64 colunas, 10000 caracteres/célula e 300000 caracteres extraídos. Fórmulas exigem exportação para valores. O limite de heap não equivale a limite rígido de RSS do processo.
- Parsing sequencial, prazo total conferido entre arquivos. Contagem do provedor antes da inferência: até 20000 tokens de entrada; saída limitada a 16384 tokens, 200 posts e tamanhos individuais. Inferência com timeout de 180 s, sem retries ou fallback de modelo.
- Tabelas reconhecidas usam origem por ocorrência, canal e campos literais. Valores além dos cabeçalhos são recusados antes da inferência. Não se impõe contagem presumida a documentos ambíguos; cobertura parcial gera aviso.
- Nomes, metadados, OCR, links e documentos são dados não confiáveis. Não há ferramentas ou credenciais no contexto enviado. Isso reduz risco; não elimina prompt injection.
- Mídia desconhecida na resposta é recusada; mídia não associada gera aviso determinístico. A UI exige decisão explícita após a revisão, e edições resetam essa decisão. A API também exige o reconhecimento. Esse reconhecimento registra uma decisão, não prova que uma pessoa leu todos os campos.
- Confirmação limitada à proposta persistida, referências únicas e mídias com recibo que vincula organização/cliente/URL/nome/tipo/tamanho. Claim, criação e resultado idempotente são uma transação.
- Admissão serializada por organização, quota conservadora para chamadas incertas, claim antes da inferência, resultado tardio não revive job encerrado. `committing` legado pode voltar à revisão após expirar. Não há retry automático de inferência.
- Falhas desconhecidas do fluxo de importação não registram erro bruto, conteúdo enviado ou credenciais.

## Gates obrigatórios antes de produção

1. Revisão humana do diff incremental e das alterações pré-existentes. Não publicar todo o working tree sem revisar as mudanças de outras tarefas.
2. Ambiente staging Vercel isolado, Turso separado com dados sintéticos, Blob **privado** dedicado, credenciais exclusivas, limites de uso e ausência de integrações reais de e-mail/billing. Criar/configurar esses recursos requer autorização; não foram criados aqui.
3. Ensaio da migração de ImportJob já existente no repositório sobre snapshot **de schema**, sem dados reais. Verificar transações concorrentes no Turso efetivo, não apenas SQLite local.
4. Build com o runtime efetivo e validação do tracing dos pacotes `exceljs`/`mammoth` usados pelo worker. Verificar deadlines, cancelamento, memória/RSS sob ZIPs adversariais e término de funções `after()`.
5. Fluxo HTTP/UI real: upload privado, revisão, todas as advertências, seleção/exclusão, ausência de horário, confirmação, voltar/reabrir, perda de resposta e repetição; conferir banco e anexos. Verificar layout/teclado e mensagens de erro. Testes offline não aprovam UI.
6. Sem sessão, convite pendente, sessão revogada, outro tenant, outro cliente/calendário, token revogado/expirado e URL privada direta: nenhum acesso indevido. Confirmar que o Blob não é público e que o cache/CDN não expõe bytes. Verificar mídia de histórico e vídeo no navegador.
7. Limpeza de upload órfão e revisão expirada sem apagar mídia protegida por posts, versões, snapshots ou jobs. Verificar cron e falhas/retries de storage em staging. Confirmar política dos uploads legados públicos antes da liberação.
8. Reteste pago autorizado separadamente dos 60 ensaios anteriores, especialmente XLSX regularizado e referências de mídia. Registrar modelo exato, tokens, latência, custo, não associação e decisão humana. A rodada antiga já encerrou seu escopo; não repetir automaticamente.
9. Conferir logs e observabilidade em staging: erros sem documentos/secrets/tokens de acesso, jobs presos, custo, quota e tentativas. Definir responsáveis e limites de alerta antes de habilitar.

## Rollout e rollback

Começar com piloto sintético/limitado após todos os gates, monitorando erros, tempo, consumo, propostas rejeitadas, mídia omitida e jobs interrompidos. Não há aprovação de release baseada apenas em código/testes locais.

Rollback operacional: definir `IMPORT_AI_ENABLED=0` para bloquear novas inferências e uploads. Preservar leitura privada, jobs, quotas e confirmação idempotente já existentes; não apagar tabelas ou mídias como rollback. Reverter para uma versão sem a rota privada pode quebrar materiais já criados: manter um build compatível com esse leitor. Se for preciso voltar ao código anterior, primeiro drenar/reconciliar jobs e preparar migração compatível, autorizada e testada. Não repetir inferências com resultado incerto.

O orçamento histórico consumido é US$ 0,4599808 da autorização adicional de US$ 5; não houve gasto novo na remediação. A estimativa do próximo reteste deve usar os caps atuais e requerer autorização específica antes de chamar o provedor.
