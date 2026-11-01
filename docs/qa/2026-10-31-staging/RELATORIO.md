# Importação com IA — QA em staging (Vercel)

31 de outubro de 2026. Working tree de `feat/ai-import` (base `11b3395`, sem commit/push), publicado por CLI em https://approove-staging.vercel.app (Preview do projeto `approove` na conta Hobby `approoveapp`, protegido por Vercel Authentication). Modelo `claude-haiku-5-5`. Dados 100% sintéticos.

## Ambiente staging (gate 2)

| Recurso | Staging | Produção |
|---|---|---|
| Banco | Turso `approove-staging` (conta approoveapp, aws-us-east-1) | Turso `approove` (org trademarkslab) |
| Blob público | `approove-staging-public` | `approove-blob` |
| Blob privado (importação) | `approove-staging-import` → `IMPORT_BLOB_READ_WRITE_TOKEN` | — |
| Stripe / Resend | ausentes (billing desligado, e-mail pulado) | live |
| `AUTH_SECRET`, `CRON_SECRET` | próprios | próprios |

Schema: baseline de `main` + `20261022-1-import-jobs` + `20261031-1-onboarding-profile` aplicados com `prisma/apply-turso-migration.ts`; snapshot comparado ao `schema.prisma` do branch com `prisma migrate diff --exit-code` → idêntico (gate 3). Seed rodado em SQLite local (o seed recusa banco remoto), senhas e share token trocados por valores aleatórios, linhas copiadas para o Turso com datas em ISO (formato do adapter libsql). Segunda organização (Solo) para testes de tenant e cota.

## Resultado

**93 verificações, 88 passaram.** As 5 falhas: o mesmo bug de CSV duas vezes, 2 recusas por limite de tokens (achados abaixo) e 1 timing de limpeza (>6 s), confirmada depois como apagada.

| Gate | O que foi verificado | Resultado |
|---|---|---|
| 3 | Duas admissões simultâneas no mesmo cliente | 202 + 409 |
| 5 | Upload privado, revisão, confirmação sem reconhecimento (400), commit, commit repetido idempotente, nenhum post `ready_for_client`, negativos (vazio, corrompido, >300k caracteres, >4 MB) sem job, cota do plano (403 sem job cobrado) | ok |
| 5 (UI real, Playwright) | Login de membro, bloqueio de arquivo grande, fechar durante o processamento e reabrir, criar desabilitado até reconhecer, edição reseta o reconhecimento, exclusão de post, rascunho sobrevive a fechar/reabrir, 390 px sem overflow, foco preso no diálogo, criar exatamente os selecionados, slides privados com vídeo, sem erro JS | 13/13 |
| 6 | Sem sessão (401), outro tenant (404), recibo adulterado ou de outra org (400), convite pendente (403), sessão revogada (401), URL direta do Blob privado (403), share token: rascunho 404, post interno 404, post visível 200, revogado/expirado recusado; vídeo com Range 206 | ok |
| 7 | Cron sem/errado segredo (401), com segredo (200); mídia não usada apagada no commit/descarte; mídia anexada mantida | ok |
| 8 | Reteste pago (tabela abaixo) | 9/12 cenários em revisão com campos corretos |
| 9 | Logs | CLI da Vercel não retorna logs neste projeto Hobby; revisão estática: só strings fixas e jobId, sem conteúdo/segredos |

## Reteste pago (gate 8)

Custo pela tabela de preços do projeto (`scripts/qa/import-benchmark.ts`): **US$ 0,0319 no total** (13 jobs em staging, 1 pela UI, 4 reproduções locais), 117.675 tokens de entrada / 40.166 de saída. Teto autorizado: US$ 15.

| Cenário | Status | Tokens in/out | Latência | Posts / gabarito | Campos corretos |
|---|---|---|---|---|---|
| 01-texto | revisão → commit | 3474/1248 | 11 s | 3/3 | todos |
| 11-instrucao (injeção) | revisão | 3684/1425 | 10 s | 3/3 | todos; instrução ignorada e sinalizada |
| 02-planilha (XLSX 24) | revisão | 7556/5226 | 20 s | 24/24 | todos |
| 10-xlsx-30 | revisão | 8552/6534 | 23 s | 30/30 | todos |
| 04-csv-ambiguo | **falhou** (2×) | 4507/2200 | 10 s | 0/6 | — |
| 03-apresentacao (PDF + 5 artes) | revisão → commit | 14412/2028 | 10 s | 4/4 | todos |
| 08-manifesto (carrossel, vídeo + capa) | revisão | 10512/1807 | 10 s | 4/4 | todos; capa sinalizada |
| 08-sem-manifesto | revisão | 9447/1217 | 11 s | 0 (esperado) | nada inventado |
| 05-misto (DOCX + vídeo) | revisão → commit | 8609/2194 | 11 s | 8/8 | formato 6/8 |
| 07-pdf-raster | revisão | 13882/2880 | 13 s | 12/12 | todos |
| 09-csv-120 | recusado antes da IA | 0/0 | 4 s | — | — |
| 06-limite (10 docs, 30 artes, 200 posts) | recusado antes da IA | 0/0 | 4 s | — | — |

## Achados

1. **Bug — CSV falha de forma intermitente (P1) — corrigido, ver abaixo.** O Haiku às vezes omite o marcador `[origem:T1A1Ln]` do campo `source` (escreve só `pauta.csv, linha 2`), e `tabularIntegrityError` recusa a importação inteira. 4 de 6 execuções falharam (2/2 em staging, 2/4 local), cada uma consumindo cota. Planilhas passaram nesta rodada, mas dependem do mesmo mecanismo. Correção sugerida: marcador como campo estruturado no schema de saída (enum dos IDs permitidos) em vez de substring livre, ou aceitar `arquivo + linha` que case com uma única ocorrência.
2. **Limite de 20 mil tokens de entrada (produto) — resolvido, ver abaixo.** Um CSV de 12,7 KB com 120 linhas e o cenário de 10 arquivos/30 artes já passam do teto; os limites anunciados (10 arquivos, 30 artes, 200 posts) não são alcançáveis juntos. Recusa acontece antes da inferência (sem custo, sem cota). Decidir entre subir o teto (Haiku custa ~US$ 0,005 por 50 mil tokens) ou orientar a dividir.
3. **Limpeza após descarte leva mais de 6 s** (roda em `after()`); conferido depois, tudo apagado.
4. **Miniaturas da revisão**: na captura, slides 2 e 4 do carrossel apareceram em branco; os arquivos respondem 200 com o PNG correto. Provável carregamento ainda em andamento; não confirmado.

## Correção do achado 1 (mesmo dia)

O identificador da linha saiu do texto livre de `source` e virou um campo próprio, `sourceRef`, obrigatório no schema de saída quando todas as fontes são tabelas (anulável quando há fontes mistas). `tabularIntegrityError` usa esse campo; o marcador `[origem:…]` em `source` continua aceito como reserva e é removido do texto antes de chegar à revisão. Observação: o `betaZodOutputFormat` do SDK envia `enum` como descrição, não como restrição, então os IDs continuam sendo validados depois da chamada (como já eram `channel` e `format`).

Reteste em staging com o deploy corrigido:

| Cenário | Execuções | Em revisão | Posts | Custo |
|---|---|---|---|---|
| 04-csv-ambiguo | 6 | **6/6** (antes: 2/6) | 7, todos com `source` limpo (`pauta.csv, linha N`) | US$ 0,0080 |
| 02-planilha | 1 | 1/1 | 24 | US$ 0,0033 |
| 10-xlsx-30 | 1 | 1/1 | 30 | US$ 0,0041 |

Uma das 6 execuções do CSV teve falha de rede no cliente de teste depois da admissão; o job chegou à revisão normalmente no servidor. O CSV tem 7 linhas, incluindo uma duplicata exata da Pauta 02 (linhas 2 e 8); a regra é preservar duplicatas e avisar, então 7 posts é o resultado certo e o `expected.json` de 6 posts está desatualizado. Custo acumulado da rodada inteira: US$ 0,039.

## Limites de tokens (1º de novembro)

O teto de 20 mil tokens de entrada barrava o CSV de 120 linhas e o cenário-limite, e a saída de 16.384 tokens comportava uns 70 posts. Novos limites: entrada até 90 mil tokens (abaixo da faixa de 100 mil, onde o preço do Haiku sobe 5×), saída até 48 mil e timeout de 270 s (a rota tem `maxDuration = 300`).

| Cenário | Posts | Latência | Tokens in/out | Campos corretos | Custo |
|---|---|---|---|---|---|
| 09-csv-120 | 120 | 64 s | 26.757/20.102 | 110/110 do gabarito; os 10 extras são as linhas repetidas do CSV, preservadas pela regra | US$ 0,0127 |
| 06-limite (10 documentos, 30 artes) | 200 | 78 s | 48.760/25.699 | 200/200 | US$ 0,0177 |
| 12-csv-200 (novo, em `fixtures/12-csv-200`) | 200 | 81 s | 41.305/27.976 | 200/200 | US$ 0,0181 |

Os limites anunciados (10 arquivos, 30 artes, 200 publicações) agora são alcançáveis juntos. Pior caso medido: US$ 0,018 por importação. O achado 2 está resolvido.

Evidências: `free-results.json`, `ledger.json`, `ui-results.json`, `ui-screens/`.
