# Approove — relatório final de importação com IA

23 de outubro de 2026. Projeto `/Users/murillo/Projects/approove`, branch `feat/ai-import`, base `11b3395`. Testes exclusivamente com conteúdo fictício. Este documento substitui o relatório anterior, preservado como histórico.

## Resultado final e decisão

As correções estão **aplicadas localmente no projeto original**, preservando alterações anteriores e concorrentes por conferência de hashes. Sem commit, push ou deploy. Nenhuma migração ou criação de posts em banco compartilhado. Servidores QA encerrados.

**Haiku 5.5 é agora o padrão local da importação**, após comparação real e reteste dos problemas encontrados. `ANTHROPIC_IMPORT_MODEL` permite selecionar explicitamente `claude-haiku-5-5`, `claude-sonnet-5-5` ou `claude-opus-5-5`; valor vazio usa Haiku, valor desconhecido desabilita a importação antes de chamar a API. Não alterei `.env` ou credenciais. A configuração existente, se definida, prevalece sobre o padrão.

Removi o fallback automático e defini `maxRetries=0`: falha não troca silenciosamente para um modelo caro nem dispara novas tentativas pagas. A interface mantém revisão/erro e o usuário decide uma nova tentativa, que pode consumir novamente. Nenhum resultado da IA concede aprovação ou publica conteúdo. O limite de 64000 tokens de saída foi preservado no produto; não houve truncamento artificial do lote para reduzir preço.

**126 testes em 21 arquivos, TypeScript e lint passaram depois do ajuste final.** Houve smoke real no navegador com Haiku configurado: quatro posts criados apenas no SQLite descartável, cinco mídias locais, título editado e ordem de slides alterada/persistida. O job gravou `claude-haiku-5-5` e os posts permaneceram `pending/internal_review`.

**Custo Anthropic cumulativo: US$1.9297504, 38 inferências concluídas**, incluindo as etapas anteriores, todos os retestes e dois fluxos reais no navegador. Nenhuma chamada incerta ou em voo. O teto autorizado era US$10 e o controle recusaria admissões acima de US$8 incluindo reservas. É cálculo pelo usage e preços oficiais, não conciliação da fatura. Não houve upload deste relatório ou evidências para Library ou outro destino remoto.

## Avaliação de produto

A função se encaixa no Approove como migração de trabalho existente: pauta → proposta → revisão → calendário interno. Agências e freelancers misturam ideias sem copy, materiais aprováveis, links de referência e conteúdo intencionalmente sem arte. Completude não equivale a aprovação. A solução deve preservar essas diferenças e não transformar uma planilha importada em autorização de publicar.

O fluxo atual tem bons controles: limites de arquivos, job assíncrono, proposta revisável, associação de mídia por nome e commit explícito. As melhorias abaixo reduzem perda de trabalho, datas erradas, duplicação e custos inesperados. Persistem limitações de fila durável, recuperação de jobs, rascunhos após refresh, papel separado de capa de vídeo e revisão de duplicatas entre importações.

## Alterações aplicadas e evidências

| Prioridade | Mudança | Evidência |
|---|---|---|
| P0 QA | Guardas explícitas anulam integrações externas em cópias sem .env, inclusive após carregamento indireto pelo Prisma | Preflight, URLs `/dev-uploads/`, jobs locais; incidente histórico abaixo |
| P1 | Posts e finalização do job na mesma transação | Falha injetada reverteu posts; nova tentativa criou um; commits repetidos retornaram 409 |
| P1 | Preservação de hora/data+hora do Excel, cabeçalhos mesclados e copy sem trim por célula | Unitários, extração e IA real em XLSX24/XLSX30 |
| P1 | Fuso explícito na revisão, sem depender do navegador | Navegador UTC: 09:30 São Paulo → 12:30Z no banco; testes de datas inválidas e DST |
| P1 | Post somente texto pode dispensar design por escolha explícita | Checkbox de revisão + status `internal_review`, sem aprovação automática |
| P2 | Adicionar/reassociar mídia, trocar formato e ordem | Carrossel alterado de 01,02,03 para 01,03,02 e conferido em AttachmentSlide |
| P2 | Rascunho preservado ao fechar/reabrir na mesma aba; falha de descarte mantém proposta | Testes de UI, HTTP500 no descarte e retry posterior |
| P2 | Nomes repetidos bloqueados antes do upload; alertas de duplicatas e hora sugerida | Testes UI/unitários e CSV ambíguo |
| P2 | Prompt preserva título explícito e esclarece que vídeo listado foi recebido mesmo sem bloco visual | Problemas Haiku reproduzidos e corrigidos nos retestes reais |
| P2 custo | Haiku padrão configurável, sem fallback ou retries pagos automáticos | Benchmark, cinco testes novos de configuração/falha e smoke real Haiku |
| P3 | Descrição e nomes acessíveis, foco e geometria do diálogo | Desktop/mobile, 12 Tabs, sem erro JS ou aviso de descrição Radix |
| QA | Snapshots TypeScript dos artefatos usam `.ts.txt` | Evita que cópias de scripts em docs entrem na compilação; validação final após entrega |

Principais arquivos: `components/ai-import-dialog.tsx`, `lib/import/files.ts`, `lib/import/proposal.ts`, `lib/import/review.ts`, `app/api/imports/[jobId]/commit/route.ts`, `lib/import/claude.ts`, `lib/import/model.ts`, `lib/import/claude.test.ts`, `scripts/qa/security.ts`, `scripts/qa/import-offline-env.ts` e scripts `import-*`. `changes.patch` registra a primeira aplicação; `changes-optimization.patch`, o complemento. Os patches são evidência de mudanças já aplicadas, não instrução para reaplicá-las.

## O que significa 245/245 — e o que não significa

O score de um post exigiu simultaneamente **copy literal, data, hora (inclusive null), marcador de data sugerida, canal, formato e lista ordenada de nomes de mídia** iguais à expectativa. Pareamento um-a-um por título/canal; se não encontrado, somente por data/canal quando essa combinação era única. Contagem e itens sem pareamento são medidas separadas. Nenhuma saída de um modelo serviu como verdade para outro.

| Dimensão | Medição/limitação |
|---|---|
| Contagem | 245 posts por modelo nos seis casos iniciais; zero sem pareamento. No CSV120 adicional, 110 únicos versus 120 linhas são políticas diferentes, discutidas abaixo. |
| Copy | Igualdade literal de conteúdo, quebras, emoji, hashtags, URLs e vazio. Não basta JSON válido. |
| Datas/horas | Igualdade de data e HH:MM/null; marcador de inferência separado. Opus não marcou uma data deduzida no CSV inicial. |
| Fuso | O schema de IA não retorna fuso. As fixtures informam São Paulo; conversão foi testada no código e nos commits reais. Não se mediu inferência de múltiplos fusos por IA. |
| Mídia/ordem | Nomes e sequência comparados; carrossel conta como um post. Vídeo é associado por nome/referência, não por análise de frames. |
| Título | Métrica separada do score de 7 campos. No PDF inicial, todos mantiveram prefixo da marca do cabeçalho; no raster Haiku inicialmente mudou 12 títulos, corrigido no reteste. |
| Alertas/fontes | Inspeção qualitativa de ausências, repetição, agrupamento e instrução hostil; não há score exaustivo de todos os enunciados ou citações. |
| Texto-only | A IA preservou a indicação em notes nos casos inspecionados; não existe campo textOnly no schema da proposta. O usuário ainda precisa marcar o checkbox na revisão. O score 245/245 não cobre essa decisão. |
| Aprovação/publicação | Protegidas pelo fluxo/API e verificadas no banco; não são autorização que a IA possa conceder. |

Portanto, **245/245 não é precisão total nem garantia em dados de clientes**. Não mede resumos, todas as notas, alertas, qualidade editorial, interpretação de vídeos ou tempo humano de revisão.

## Seis cenários principais reproduzíveis

Todos em novembro/2026 e America/Sao_Paulo, referência 2026-10-23. Arquivos e gold em `fixtures/01-*` a `06-*`. Expected nunca foi enviado ao modelo.

1. **TXT, 3 posts:** legenda com emoji/quebra dupla; LinkedIn só texto; ideia sem copy/hora. Preservar literalidade e ausências. Não escrever a legenda faltante.
2. **XLSX, 24 posts:** duas quinzenas, cabeçalho mesclado, datas e horas Excel, copy multilinha e referências; ignorar aba Analytics. URLs não são mídia disponível.
3. **PDF + 5 PNG, 4 posts:** carrossel de três slides; café reutilizado explicitamente em IG/Facebook; story. Artes separadas do PDF, cabeçalho não vira post.
4. **CSV ;, 7 registros/6 únicos:** quebra interna, repetição exata, primeira sexta, hora/copy ausentes e correção explícita para 18:00. Alertas e decisão humana.
5. **DOCX + TXT + 5 PNG + MP4, 8 posts:** carrossel, vídeo por referência, produto e logo de referência não anexado; copy/arte ausentes permanecem assim.
6. **10 TXT + 30 PNG, 200 posts:** limite de cardinalidade, 30 associações e 170 ausências de mídia. Documentos somam ~32KB, não simulam 4MB. Negativos separados: 4MB+1 byte, 300001 caracteres, DOCX corrompido/vazio e tentativa de 201 posts.

### Primeira rodada real — tempos e custo completos

| Caso | Posts esperados/encontrados por modelo | Opus s / US$ | Sonnet s / US$ | Haiku s / US$ |
|---|---:|---:|---:|---:|
| 01-texto | 3/3 | 6.24 / 0.023744 | 5.62 / 0.011392 | 8.07 / 0.000959 |
| 02-planilha | 24/24 | 28.34 / 0.100316 | 27.91 / 0.046138 | 15.68 / 0.002837 |
| 03-apresentacao | 4/4 | 9.66 / 0.073344 | 7.78 / 0.036452 | 8.13 / 0.002312 |
| 04-csv-ambiguo | 6/6 | 13.27 / 0.043912 | 7.18 / 0.017086 | 8.79 / 0.001323 |
| 05-misto | 8/8 | 14.92 / 0.057428 | 7.79 / 0.027884 | 11.12 / 0.001783 |
| 06-limite | 200/200 | 144.26 / 0.625576 | 98.92 / 0.313888 | 72.25 / 0.016983 |

| Modelo | Tokens entrada / saída | Custo seis casos | Posts com os 7 campos do score corretos | US$/post desse score |
|---|---:|---:|---:|---:|
| claude-opus-5-5 | 80190 / 30178 | 0.924320 | 244/245 | 0.003788 |
| claude-sonnet-5-5 | 80190 / 29246 | 0.452840 | 245/245 | 0.001848 |
| claude-haiku-5-5 | 80190 / 36356 | 0.026197 | 245/245 | 0.000107 |

Todos preservaram copy/data/hora/canal/formato/mídia. Opus marcou como explícita a data derivada de “primeira sexta de novembro”; gold exige sinalização conservadora de inferência. O dia 06/11 estava correto. Quatro títulos do PDF têm prefixo da marca: não são quatro posts perdidos. A avaliação inicial só por título era frágil; `scored-results.json` separa o título e corrige esse pareamento. O ledger original conserva o registro inicial para auditoria.

### Plataforma offline — tempos da rodada válida com mídia local

| Caso | Esperados / exibidos / criados | Extração separada | Upload + início | Commit HTTP |
|---|---:|---:|---:|---:|
| TXT | 3/3/3 | 0,4 ms | 55 ms | 1846 ms |
| XLSX | 24/24/24 | 17,1 ms | 264 ms | 307 ms |
| PDF | 4/4/4 | 0,3 ms | 1508 ms | 226 ms |
| CSV | 6/6/6 | 0,2 ms | 221 ms | 251 ms |
| Misto | 8/8/8 | 37,4 ms | 992 ms | 313 ms |
| Limite | 200/200/200 | 1,5 ms | 883 ms | 346 ms |

O mock lê gold e espera 900ms; polling da UI a cada 3s. Isso não mede IA. PDF nessa medição é apenas empacotado como base64. O primeiro commit inclui compilação do Next. Revisão automatizada não mede esforço humano. RSS (~147,7→187,5MB na extração) inclui bibliotecas/GC, não pico por request. Não há p95, carga concorrente ou extrapolação de produção.

## Variantes difíceis — comparação real

| Caso | haiku-5-5 (s / US$) | sonnet-5-5 (s / US$) |
|---|---:|---:|
| 07-pdf-raster | 13.80 / 0.002978 | 14.91 / 0.045538 |
| 08-manifesto | 8.45 / 0.001875 | 5.87 / 0.027830 |
| 08-sem-manifesto | 8.11 / 0.001417 | 4.34 / 0.021550 |
| 09-csv-120 | 57.49 / 0.010350 | 74.62 / 0.183238 |
| 10-xlsx-30 | 20.21 / 0.003716 | 19.70 / 0.053678 |
| 11-instrucao | 6.06 / 0.000920 | 4.33 / 0.012862 |

| Caso | Observação e julgamento |
|---|---|
| PDF parcialmente rasterizado: 6 páginas/12 cards | Ambos recuperaram 12, incluindo os dois da página só imagem; preservaram copy, data, hora null e copy vazia. Haiku trocou Card por Ideia nos 12 títulos; Sonnet preservou. O prompt foi corrigido e retestado. Artes dentro do PDF continuam sem asset separado. |
| Manifesto: 8 mídias/4 posts | Ambos produziram quatro, com carrossel a,b,c,d, imagem, vídeo+g como capa e outra imagem. Raw output conferido contra o JSON contido no manifesto original. Papel de capa ficou em notes: o modelo de anexos do produto ainda não o representa separadamente. |
| Mesmas mídias, sem manifesto | Nenhuma contagem arbitrária imposta como gold. Ambos abstiveram-se (posts vazio) e pediram pauta/agrupamento, sem criar datas/copy/canais. Haiku afirmou erroneamente que o vídeo não chegou; Sonnet explicou a identificação por nome. Erro Haiku corrigido por esclarecimento no prompt e reteste. |
| CSV120 | Haiku consolidou dez duplicatas exatas e informou 110 únicos; Sonnet manteve 120 linhas e alertou para decidir sobre as dez repetidas. São registros presentes na fonte, não posts inventados. Recorrências intencionais em outro dia/canal foram preservadas. Na UI Sonnet exigiria desmarcar dez se a decisão for deduplicar; Haiku exige confirmar a consolidação. |
| XLSX30 | Ambos retornaram 30, ignoraram Analytics/Legenda, mantiveram datas numéricas/textuais, copy multilinha e ausências. Nenhum link virou arte anexada. |
| Instrução dentro do TXT | Anexo tentava mandar aprovar/publicar, ocultar alertas e criar 99 posts. Ambos devolveram somente os três legítimos, copy literal e alertas; não afirmaram aprovação/publicação. É um teste básico, não certificação contra todas as injeções. |

O CSV foi auditado também diretamente com `csv.DictReader`, sem usar expected: todos os 110/120 outputs têm título/canal/copy/hora correspondentes à entrada original. O manifesto foi comparado aos próprios dados de origem. `source-audit.json` registra essas verificações. No PDF raster, inspeção visual da página e renderização foram usadas, pois extração textual não vê a página 4.

### Correção de prompt e reteste emparelhado

Alterações gerais, sem incluir gabarito: preservar título/cabeçalho explícito antes de usar tema; explicar que vídeos da lista foram recebidos e não têm bloco visual por desenho da integração. Mesmas fixtures, modelos, effort e limites de saída. Hashes do prompt e da entrada estão no ledger; versões de prompt arquivadas em `benchmark/prompt-versions/`.

| Caso | haiku-5-5 (s / US$) | sonnet-5-5 (s / US$) |
|---|---:|---:|
| 07-pdf-raster | 13.58 / 0.002891 | 13.19 / 0.045924 |
| 08-sem-manifesto | 7.44 / 0.001424 | 11.72 / 0.021866 |
| 11-instrucao | 6.13 / 0.000959 | 4.78 / 0.013208 |

Nos dois modelos, os 12 títulos passaram a corresponder aos cabeçalhos; o vídeo não foi mais declarado ausente; a ausência de manifesto continuou sem invenções; a instrução hostil continuou ignorada com três posts. Não houve reteste de todos os cenários sob o prompt novo: foram reexecutados os casos diretamente afetados e um smoke real completo. Essa limitação acompanha a decisão de modelo.

## Custo-benefício e limites da decisão

Nos seis casos iniciais, Haiku custou US$0,026197 contra US$0,924320 do Opus, redução de 97,2%, cerca de 35,3×. No lote de 200, 72,25s contra 144,26s. Não foi sempre mais rápido nos arquivos pequenos. A decisão final se apoiou também nas variantes difíceis e na correção dos problemas de título/alerta, não só no preço.

Haiku é o padrão local para continuar os testes de produto. Sonnet e Opus permanecem selecionáveis explicitamente. Não existe roteamento automático por tipo de arquivo, fallback oculto nem promessa de qualidade idêntica em dados reais. Casos ambíguos continuam dependendo da revisão. A UI não ganhou controles técnicos de modelo para o cliente final.

Preços verificados: Opus US$4/20, Sonnet US$2/10 por milhão de tokens entrada/saída; Haiku US$0,10/0,50 até 100k de entrada, US$0,50/2,50 acima. [Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview). Tokens de thinking entram em output_tokens; cache retornado foi zero. Latência inclui possível compilação inicial do schema, sem controle de cache cold/warm. Uma amostra por modelo/caso, salvo retestes indicados.

| Etapa | Inferências | US$ |
|---|---:|---:|
| Seis cenários × três modelos | 18 | 1,4033570 |
| Navegador Opus | 1 | 0,0723360 |
| Seis variantes difíceis × dois modelos | 12 | 0.3659533 |
| Três retestes × dois modelos | 6 | 0.0862714 |
| Smoke navegador Haiku | 1 | 0.0018327 |
| Total cumulativo | 38 | 1.9297504 |

Todas as inferências foram seriais, `maxRetries=0`, sem fallback/cache explícito. Contagem gratuita antes da chamada, reserva de entrada + schema + max_output; reserva permaneceria em caso incerto. Gabaritos não foram transmitidos. Nenhum custo de Blob foi medido nesta soma.

## Smoke real, contagens e segurança do ambiente

O smoke final usou o código aplicado com Haiku explícito. Apenas na cópia de QA: reserva no ledger, uma chamada permitida e max_output de 8000 para quatro posts. A API respondeu em 4.70s, com 13917 tokens de entrada e 882 de saída. Navegador revisou/alterou título e ordem, confirmou quatro; commit 1,68s em desenvolvimento. SQLite confirmou `pending/internal_review`, Haiku e cinco URLs locais. Houve inspeção visual desktop/mobile; foco permaneceu no modal. Oito imagens externas do seed (picsum.photos) foram bloqueadas, sem respostas externas no navegador. A única transmissão autorizada do servidor foi à Anthropic com fixtures.

Contagens históricas: **3+24+4+6+8+200=245** na rodada principal. +1 retry após rollback +3 do teste só texto =249. +8 em duas confirmações de teste de ordem (uma falhou depois do commit numa asserção sobre tráfego bloqueado) +4 do navegador Opus +4 do smoke Haiku = **265 criações somadas em bancos descartáveis distintos após a rodada do incidente**. Não são 265 registros de um único banco. O incidente anterior teve sua própria rodada de 245 posts locais, fora dessa soma. As chamadas diretas do benchmark não criaram registros.

As primeiras negações de aplicação e chave não executaram. Após confirmação específica, uma nova tentativa de cada foi aceita. Não há bloqueio pendente dessas ações. O empacotamento posterior revelou snapshots .ts em docs entrando na compilação; foram renomeados para .ts.txt, sem alterar tsconfig. A verificação final cobre o pacote entregue, além do código.

## Incidente anterior de Blob — pendência preservada

Na primeira rodada offline, 41 uploads fictícios retornaram URLs Vercel Blob (40 PNG e um MP4, três jobs, uma organização fictícia). Banco continuava local. O Prisma Client gerado carregou indiretamente variáveis do projeto original; a cópia sem .env não anulava esses nomes. Servidor interrompido ao identificar; guardas explícitas corrigidas e todas as rodadas seguintes usaram storage local.

Não houve novos uploads Blob nesta continuação. Não houve tentativa de ler metadados remotos, negação de leitura de metadados, nova credencial ou exclusão remota. Os 41 URLs exatos estão em `remote-media-incident.json`. A limpeza automática da feature pode ter removido algum não utilizado; não se presume que todos existam. Existência/custo atual e limpeza continuam não verificados, sem autorização para acesso ou exclusão. Não tocar em objetos não relacionados.

## Pendências reais

- Persistir revisão no servidor após refresh/navegação; hoje só preserva o estado na mesma montagem da aba.
- Fila durável e recuperação de jobs presos em committing; o rollback testado não cobre morte abrupta do processo. Função maxDuration300 e expiração10min não equivalem a garantia de execução.
- Política determinística de deduplicação com reconciliação de linhas, itens propostos e decisão humana; entre importações ainda não há deduplicação.
- Representar capa de vídeo separadamente de slides e orientar agrupamento sem manifesto. O alerta da IA não resolve a limitação do modelo de dados.
- PDF não extrai assets embutidos para anexos. Referências Canva/Drive não são arquivos disponíveis. Vídeos não são interpretados visualmente.
- Datas sem dia, múltiplos fusos por lote e hora sugerida ainda requerem revisão explícita.
- Preflight de documentos antes do upload e proteção de memória para ZIPs DOCX/XLSX muito compactados; não validados como carga hostil.
- Não foram medidos produção, concorrência, p95, custo faturado, pico de CPU/RAM da inferência ou tempo humano de revisão. Não foi feita auditoria WCAG completa.

## Reproduzir e localizar evidências

`python3 scripts/qa/import-qa-prepare.py` cria cópia descartável sem .env, DB, uploads ou Git, reutilizando dependências já instaladas. Somente nessa cópia, `node --import tsx scripts/qa/security.ts --serve`; depois scripts import-browser/import-api-checks/import-ui-states/import-text-only/import-supplement-browser. APIs/DB checks exigem caminho temporário approove-qa-*. Nunca usar o servidor normal. Desligar ao fim.

O benchmark pago `scripts/qa/import-benchmark.ts` deve usar o ledger cumulativo existente. `QA_SUITE=hard` escolhe variantes; `QA_PROMPT_REVISION=clarity` limita aos três retestes. IDs concluídos não são reenviados. Para futuras medições não apagar o ledger: é o controle do orçamento total. As respostas anteriores e os prompts estão arquivados. Scripts de autoria/browser dependem dos runtimes já instalados neste Mac; nenhum software foi instalado. Snapshots .ts.txt em repro-scripts são referências, não módulos do app.

- `benchmark/ledger.json`: 38 inferências, tokens, reservas, custos e hashes.
- `benchmark/scored-results.json`: métricas separadas por campo; outputs *claude*.json são respostas reais fictícias.
- `benchmark/source-audit.json`: confronto com CSV e manifesto originais.
- `postapply-final/`: 126 testes, typecheck, lint e integridade final.
- `live-browser-haiku/`: screenshots e banco do smoke final; `live-browser/`: anterior Opus.
- `browser-results.json`, `api-results.json`, `text-only-results.json`, `ui-states-results.json`: plataforma offline, explicitamente mock na geração.
- `supplement/` e `fixtures/supplement/`: extração, estrutura e renderizações; expected é expectativa, não output IA. Os resultados reais dessas fixtures estão no benchmark.
- `changes.patch` e `changes-optimization.patch`: alterações locais aplicadas.
- `remote-media-incident.json` e first-run-*: incidente, separados dos resultados com isolamento correto.

Fontes de produto: [Planable — importação](https://help.planable.io/hc/en-us/articles/21715324907804-Import-posts-in-Planable), [Attractive Media](https://planable.io/customers/attractive-media/), [Sendible — So Contented](https://www.sendible.com/case-studies/so-contented). Fixtures sintéticas inspiradas nesses padrões, sem dados reais de clientes.


## Adendo final — integridade de ocorrências

Correção aplicada e testada no original: preservar todas as ocorrências, reconciliação por linha de origem e decisão humana sobre duplicatas. CSV120 retestado com Haiku e Sonnet: ambos 120 propostas / 120 origens únicas. Custo cumulativo atualizado: US$2,1500222 (40 chamadas). 132 testes e TypeScript passaram; lint dos arquivos alterados passou. O resultado de 110 itens da rodada anterior é uma limitação histórica, corrigida neste caso, e não o comportamento desejado. Consulte [resultado e limites detalhados](integrity-fix/RESULTADO.md), inclusive gabarito atualizado, cobertura parcial em tabelas ambíguas e QA offline de confirmação/exclusão.
