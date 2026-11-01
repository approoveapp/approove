# Approove — revisão de importação com IA

23 de outubro de 2026. Branch `feat/ai-import`, base `11b3395`. Conteúdo de teste inteiramente fictício.

## Estado de entrega

**Correções aplicadas em `/Users/murillo/Projects/approove`, branch `feat/ai-import`, após confirmação específica do usuário.** A nova tentativa de aplicação foi aceita; os hashes dos seis arquivos existentes foram conferidos antes da gravação. Nenhuma edição concorrente precisou ser sobrescrita. Os demais arquivos locais preexistentes foram preservados. Sem commit, push ou deploy.

A tentativa inicial de aplicação e a tentativa inicial de uso da chave haviam sido negadas sem executar. Depois da confirmação explícita, cada ação foi tentada novamente uma vez e aceita. Não há confirmação pendente para essas duas ações. As credenciais não foram expostas nem gravadas nos artefatos.

Os artefatos estão em `docs/qa/2026-10-23-ai-import/` no projeto e no pacote local da tarefa `approove-ai-import-qa/`. A publicação anterior na Library falhou por DNS antes de retornar criação/ID; não foi repetida, não há link Library confirmado.

## Resultado e limites desta etapa

A direção do produto está correta: migrar o calendário existente, apresentar uma proposta editável e somente criar publicações depois da revisão. Não deve escrever legendas, inventar uma pauta ou conceder aprovação do cliente.

**Há resultados offline e reais, separados.** A rodada offline substituiu apenas o provedor por um shim que lê `expected.json`; upload, extração, validação, API, SQLite, anexos e transações eram reais. A etapa seguinte executou 18 chamadas Anthropic (seis cenários × três modelos), sem enviar os gabaritos, e mais uma chamada real pelo navegador. O modelo padrão do produto permanece Opus 5.5: o candidato econômico e a decisão estão abaixo.

- 121 testes unitários em 20 arquivos passaram.
- TypeScript (`--noEmit --incremental false`) e ESLint dos arquivos de feature alterados passaram.
- Seis fluxos de navegador: 245 publicações fictícias criadas. Contagem esperada = contagem na revisão = contagem confirmada.
- Seis confirmações repetidas retornaram 409, sem duplicar posts.
- 12 verificações HTTP/DB passaram, incluindo falha injetada ao finalizar o job: os posts foram revertidos e uma nova tentativa criou exatamente uma publicação.
- Teste adicional de publicação só de texto: três posts, com a escolha explícita do LinkedIn produzindo `pending/internal_review`.
- Validados desktop 1440×1000 e móvel 390×844; sem erro JavaScript. Teste com janela já móvel mediu modal de 759,6 px dentro de 844 px (topo 42,2 / base 801,8).
- Não houve commit, push, deploy ou migração em banco compartilhado. O SQLite de QA é novo e descartável.
- **Anthropic: 19 chamadas concluídas; US$ 1,475693 calculados pelo usage retornado e preços oficiais.** Nenhuma chamada pendente/incerta. Contagem de tokens antes de cada admissão, reserva cumulativa abaixo de US$8 e teto total US$10. Sem retries ou fallback no benchmark. O valor é cálculo por tokens, não conciliação de fatura.

## Incidente de isolamento de mídia — acompanhamento obrigatório

Na primeira rodada, o banco era descartável, mas os 41 uploads fictícios retornaram URLs públicas do Vercel Blob. A cópia não tinha `.env`, porém o Prisma Client gerado instalado no projeto original contém `schemaEnvPath: ../../../.env`, carregando variáveis indiretamente. Variáveis ausentes no harness foram preenchidas por esse carregamento; a proteção que anulava nomes lidos de `.env` não funcionava na cópia sem esses arquivos.

O servidor foi encerrado assim que isso foi identificado. Nenhum dado real de cliente foi enviado. Não foi feita limpeza remota manual. A limpeza automática da própria feature pode ter removido mídia não utilizada (por exemplo o logo de referência); **não se presume que os 41 objetos ainda existam**. As referências exatas estão em `remote-media-incident.json`. Não se consultou o armazenamento remoto para verificar existência ou custo. O custo eventual de Blob não foi medido.

Correção: `OFFLINE_IMPORT_ENV` anula explicitamente as chaves Anthropic, Blob, e-mail, Google, Turso e telemetria; o banco permanece um SQLite novo. A segunda rodada comprovou todas as URLs sob `/dev-uploads/`, decodificou as imagens e bloqueou tráfego externo do navegador. As evidências de primeira rodada estão separadas com prefixo `first-run-`; os resultados válidos desta etapa são `browser-results.json`, `api-results.json` e os screenshots sem esse prefixo.

**Pendência externa:** verificar/remover somente os objetos fictícios identificados no manifesto requer autorização específica. Não tocar em outros objetos ou dados de produção.

## Achados priorizados e alterações

| Prioridade | Achado | Ação nesta etapa |
|---|---|---|
| P0 QA | Prisma carregava configuração externa em cópia sem `.env` | Guardas explícitas no harness; segunda rodada com storage local comprovado. Pendência de limpeza remota descrita acima. |
| P1 | Posts eram confirmados em uma transação, mas o job era finalizado fora dela; falha poderia liberar nova criação | Posts + finalização do job na mesma transação; rollback comprovado por trigger que simula falha. |
| P1 | Horários do Excel eram convertidos em datas e perdiam a hora | Preservar hora/data+hora pelo formato da célula; teste 09:30 e 18:45. |
| P1 | Hora da pauta dependia silenciosamente do fuso do navegador | Seletor explícito, padrão São Paulo, conversão testada com navegador UTC; datas inválidas e horas ambíguas de DST são recusadas. |
| P1 produto | Post intencionalmente só texto entrava em espera de design | Checkbox explícito na revisão; com legenda vai para revisão interna, nunca aprovação do cliente. |
| P2 | Revisão permitia remover mídia, mas não adicionar/reassociar ou mudar ordem/formato | Seletores de mídia e formato, movimento de slides. Associação continua resolvida por nome no servidor. |
| P2 | Fechar e reabrir apagava edições | Mantém rascunho durante a mesma montagem da aba. Refresh ainda restaura proposta original, informado na UI. |
| P2 | Falha no descarte sumia da interface como sucesso | Checa status HTTP, mantém proposta e mostra erro; depois sucesso limpa a tela. |
| P2 | Nomes de mídia iguais só eram recusados depois de upload | Validação antecipada e deduplicação de seleção repetida no mesmo gesto. |
| P2 | Repetições e hora padrão eram pouco visíveis | Alertas determinísticos de possível duplicata e horário sugerido; nada é removido automaticamente. |
| P2 | Cabeçalhos mesclados repetidos e `.trim()` em cada célula prejudicavam custo/fidelidade | Cabeçalho aparece uma vez; texto literal das células preservado. |
| P3 | Modal sem descrição acessível e campos sem nomes explícitos | Descrição Radix, rótulos, foco e geometria revalidados no navegador desktop/mobile, incluindo fluxo real. |
| P2 QA | Teste DOCX dependia de `textutil` e falhava no sandbox | Fixture DOCX portátil substitui o gerador dependente do macOS. |

## Seis casos reproduzíveis

Todos usam `America/Sao_Paulo`, novembro de 2026, data de referência 2026-10-23. `expected.json` é o gold independente do modelo. Datas às 09:30 nesse fuso devem ser gravadas às 12:30Z. A revisão pode mudar isso explicitamente.

1. **01-texto — freelancer, 3 posts, TXT, nenhuma mídia.** Uma legenda com emoji, hashtags e quebra dupla; um artigo LinkedIn só texto; uma ideia sem legenda e sem hora. Preservar cópia literal. A ausência permanece vazia; 10:00 aparece como horário sugerido e exige revisão. A pessoa marca o LinkedIn como só texto. Não escrever copy ausente.
2. **02-planilha — agência, 24 posts, XLSX.** Duas abas de quinzena, cabeçalho mesclado, datas Excel, horas Excel, legendas multilinha e links de referência. Uma aba de Analytics não é calendário e não gera posts. Sem mídias: links `example.com` são referência, não arquivos anexados. Exigir 24 posts, datas corretas e hora 09:30. A serialização da fixture foi normalizada para a convenção OOXML que o ExcelJS aceita; o leitor atual ainda não aceita algumas planilhas válidas com todos os elementos prefixados `x:`.
3. **03-apresentacao — 4 posts, PDF de quatro páginas + 5 PNG.** Um carrossel de três slides é um post. Café é reutilizado explicitamente em Instagram e Facebook: são dois posts legítimos. Story é outro post. Logo/cabeçalho/página não são publicação. Os PNG são enviados separadamente: o produto não extrai artes embutidas do PDF. Corrigir mídia, formato e ordem deve ser possível na revisão.
4. **04-csv-ambiguo — 6 posts únicos, 7 registros CSV.** Separador `;`, campo multilinha, repetição exata, dia indicado como primeira sexta, horário faltante, legenda faltante e correção explícita para 18:00. Exigir alertas e não inventar legenda. A saída gold consolida a duplicata exata; se um modelo preservá-la, a revisão deve sinalizar e o humano decidir. Publicações em outro canal/dia não devem ser deduplicadas por semelhança de texto.
5. **05-misto — 8 posts, DOCX + TXT + 5 PNG + MP4.** Três slides são um carrossel, vídeo é identificado pelo nome, produto é imagem avulsa e logo é referência não anexada. Ausências de copy e de arte permanecem explícitas. O usuário pode associar uma arte que a IA deixou de fora. Vídeo não é interpretado visualmente pela integração atual.
6. **06-limite — 200 posts, 10 TXT + 30 PNG.** Atinge os limites de posts, quantidade de documentos e mídias, sem fingir atingir 4 MB de documentos: o texto soma aproximadamente 32 KB. Exigir 200 posts, 30 associações, 170 pendências de arte, nenhum truncamento e commit atômico. Os limites de tamanho são testados separadamente em `negativos/`: 4 MB + 1 byte, 300001 caracteres, DOCX corrompido e arquivo vazio. 201 posts são recusados no servidor; a interface bloqueia mais de 200 selecionados.

## Performance medida — uma execução de cada cenário, desenvolvimento local

| Caso | Criados/esperados | Extração local separada | Upload + início | Commit HTTP | Repetir commit |
|---|---:|---:|---:|---:|---:|
| 01-texto | 3/3 | 0.4 ms | 55 ms | 1846 ms | 409 |
| 02-planilha | 24/24 | 17.1 ms | 264 ms | 307 ms | 409 |
| 03-apresentacao | 4/4 | 0.3 ms | 1508 ms | 226 ms | 409 |
| 04-csv-ambiguo | 6/6 | 0.2 ms | 221 ms | 251 ms | 409 |
| 05-misto | 8/8 | 37.4 ms | 992 ms | 313 ms | 409 |
| 06-limite | 200/200 | 1.5 ms | 883 ms | 346 ms | 409 |

Tempos de extração vêm de `import-extraction.ts`, não de instrumentação do servidor. PDF é apenas empacotado como base64: o tempo não mede OCR nem compreensão visual. Upload + início inclui trabalho local, renderização e possível compilação do Next. O primeiro commit inclui aquecimento/compilação; não comparar diretamente como latência de produção.

O shim devolve a proposta após aproximadamente 900 ms e a UI consulta a cada 3 s. A espera observada (aprox. 3 s) **não é latência de IA**. `automatedReviewMs` é tempo de automação, não tempo humano. RSS do processo de extração inclui bibliotecas e GC e não é pico por requisição. Não há p95, throughput de produção ou estimativa de qualidade de modelo com esses dados.

## IA e custo-benefício: o que está comprovado e o que falta

IDs/preços verificados na documentação oficial atual: `claude-opus-5-5` US$4/20 por milhão de tokens de entrada/saída; `claude-sonnet-5-5` US$2/10; Haiku 5.5 US$0,10/0,50 até 100k de entrada, e US$0,50/2,50 acima. Fontes: [modelos](https://platform.claude.com/docs/en/models/overview), [Opus](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

O benchmark real comparou a mesma entrada e prompt de produção, saída estruturada e effort medium nos três modelos, sem cache explícito, fallback ou retries automáticos. Uma chamada em voo. O `expected.json` foi lido somente pelo avaliador local; não entrou no conteúdo enviado ao modelo. Todas as chamadas terminaram com `end_turn`. A latência inclui a eventual primeira compilação do schema, cujo cache não foi controlado; não há comparação cold/warm nem p95.

| Caso | Opus: segundos / US$ | Sonnet: segundos / US$ | Haiku: segundos / US$ | Posts retornados por modelo |
|---|---:|---:|---:|---:|
| 01-texto | 6.24 / 0.023744 | 5.62 / 0.011392 | 8.07 / 0.000959 | 3 |
| 02-planilha | 28.34 / 0.100316 | 27.91 / 0.046138 | 15.68 / 0.002837 | 24 |
| 03-apresentacao | 9.66 / 0.073344 | 7.78 / 0.036452 | 8.13 / 0.002312 | 4 |
| 04-csv-ambiguo | 13.27 / 0.043912 | 7.18 / 0.017086 | 8.79 / 0.001323 | 6 |
| 05-misto | 14.92 / 0.057428 | 7.79 / 0.027884 | 11.12 / 0.001783 | 8 |
| 06-limite | 144.26 / 0.625576 | 98.92 / 0.313888 | 72.25 / 0.016983 | 200 |

| Modelo | Entrada / saída (tokens) | Custo dos seis casos | Posts com campos principais corretos | Custo/post correto |
|---|---:|---:|---:|---:|
| claude-opus-5-5 | 80190 / 30178 | US$ 0.924320 | 244/245 | US$ 0.003788 |
| claude-sonnet-5-5 | 80190 / 29246 | US$ 0.452840 | 245/245 | US$ 0.001848 |
| claude-haiku-5-5 | 80190 / 36356 | US$ 0.026197 | 245/245 | US$ 0.000107 |

**Fidelidade:** todos os modelos retornaram 245 posts nos seis casos, sem itens não pareados, com legendas literais, datas/horas, canais, formatos e associações ordenadas de mídia corretos. Ao incluir o marcador de data sugerida, Opus fica em 244/245: interpretou a primeira sexta corretamente como 06/11, mas marcou a data como explícita. Sonnet e Haiku marcaram a dedução como sugestão. A política esperada da fixture exige essa sinalização conservadora; a expressão também pode ser entendida como data determinística. Essa divergência deve ser tratada como política de revisão, não como erro no dia do calendário.

No PDF, os três conservaram o prefixo do cabeçalho `Oficina Aurora |` nos quatro títulos. O avaliador inicial, que pareava só por título literal, classificou esses posts como ausentes. `scored-results.json` corrige a avaliação com pareamento um-a-um por título/canal e, somente quando único, data/canal. Título literal e título sem prefixo são métricas separadas. Não se trocou o gold por saída de outro modelo. O `ledger.json` original conserva a avaliação inicial para auditoria; use `scored-results.json` como avaliação final.

**Correções humanas necessárias neste conjunto:** zero em copy/data/hora/canal/formato/mídia nos três modelos; uma sinalização de data a corrigir no Opus segundo a política do gold; quatro títulos por modelo podem ser encurtados por preferência editorial, sem perda de conteúdo. Alertas/fontes foram inspecionados, mas não receberam score semântico exaustivo. Isso não é garantia de precisão em documentos reais e não mede tempo humano de revisão.

**Custo-benefício:** Haiku custou US$0,026197 nos seis casos, contra US$0,924320 do Opus — redução de aproximadamente 97,2% (35,3 vezes menor), com a mesma fidelidade de campos de conteúdo nesta amostra. No lote de 200, foi 72,25s contra 144,26s. Nos casos pequenos nem sempre foi o mais rápido. É o candidato recomendado para uma próxima configuração de importação. **Não houve troca silenciosa de modelo:** mantive Opus no código do produto porque o comparativo cobriu uma execução por fixture e os novos casos de rasterização e agrupamento ambíguo ainda não passaram pela IA. A adoção de Haiku é uma recomendação com evidência limitada, não promessa de equivalência geral.

**Fluxo completo real pelo navegador:** PDF + cinco artes, quatro posts encontrados, revisão de título e troca efetiva de slides `01,02,03 → 01,03,02`, commit de quatro posts no SQLite local. Ordem e `pending/internal_review` conferidos diretamente no banco; cinco URLs locais, sem Blob. Uso: 13799 tokens de entrada e 857 de saída, 7.60s de IA, US$0.072336. Commit observado: 1,57s, incluindo compilação local. O teste usou o provedor real com guardas apenas na cópia: máximo 8000 tokens para esse caso pequeno, uma chamada permitida, `maxRetries=0`, sem fallback e reserva persistida. Essas guardas não substituíram o provedor no original.

Total: US$1,403357 no comparativo + US$0,072336 no navegador = **US$1,475693**. Tokens de thinking estão incluídos em `output_tokens`; cache usage retornou zero. Não houve novos uploads Blob nem consulta/remoção remota nesta continuação. Os servidores QA foram encerrados ao fim.

## Complemento offline solicitado

`supplement/browser-results.json` comprova a ordem final diferente persistida, com slides 0/1/2 correspondendo a 01/03/02. A validação acessível conferiu título e descrição associados ao diálogo, foco dentro dele durante 12 Tabs e limites da viewport. Desktop e mobile foram inspecionados visualmente, tanto com mock quanto IA real. Após redimensionar, a asserção inicial ocorreu durante a transição CSS e falhou; a espera por layout estabilizado passou. Houve oito tentativas de imagens `picsum.photos` vindas do seed, todas bloqueadas pelo navegador, sem respostas externas. Imagens da importação eram exclusivamente locais. Não foi feita auditoria WCAG completa nem teste com leitor de tela.

Contagens: seis cenários principais = **3+24+4+6+8+200=245**. A rodada anterior terminou com **249** ao acrescentar 1 post da repetição após rollback + 3 do teste de texto puro. Este complemento teve duas confirmações locais de 4 posts (8, pois uma execução confirmou e depois falhou numa asserção sobre requisições externas bloqueadas), mais 4 do fluxo real, em bancos descartáveis distintos. São **261 criações somadas após a rodada do incidente**, não 261 registros num mesmo banco. A primeira rodada com incidente teve seus próprios 245 posts locais e não faz parte desse total. Nenhum post foi criado em banco remoto.

### Fixtures novas — expectativas, não resultados de IA

| Pasta em fixtures/supplement | Entrada | Expectativa humana | O que foi executado |
|---|---|---|---|
| 07-pdf-raster | PDF 6 páginas / 12 cards; página 4 só imagem | 12 posts; cards 07/08 exigem leitura visual; cabeçalho não vira post; sem inventar hora/copy ausentes | Arquivo gerado, página raster sem camada de texto confirmada, render visual e empacotamento PDF local. OCR/IA NÃO executados. |
| 08-manifesto | TXT + 8 mídias | 4 posts: carrossel de 4 imagens, imagem, vídeo+capa, outra imagem | Extração do manifesto e fixtures; agrupamento semântico NÃO executado. Schema não distingue papel de capa. |
| 08-sem-manifesto | TXT + os mesmos 8 arquivos | Quantidade indeterminada; pedir agrupamento/ordem/capa e dados ausentes | Extração local. Não há gold de 4 posts nem proposta fake para esconder a ambiguidade. |
| 09-csv-120 | CSV UTF-8, 120 registros | 110 únicos + 10 duplicados exatos; preservar recorrências com mesma copy em outro dia/canal | 121 marcadores de linha incluindo cabeçalho e preservação do CSV com aspas/emoji/quebras confirmados. Deduplicação/IA NÃO executadas. |
| 10-xlsx-30 | XLSX 30 pautas / duas quinzenas + Legenda e Analytics | 30 posts; ignorar abas auxiliares, preservar datas numéricas/textuais e ausências | 30 títulos, horários e abas preservados pela extração; quatro abas renderizadas. Interpretação/IA NÃO executadas. |

As novas pastas contêm `expected.json` explicitamente marcado como expectativa. Nenhum desses cinco complementos foi submetido à Anthropic ou confirmado no calendário. Os seis casos originais continuam intactos para comparação histórica.

## Pendências de produto e confiabilidade

- Persistir a revisão no servidor para sobreviver a refresh, navegação ou mudança de dispositivo. Hoje só permanece nesta aba enquanto o componente está montado.
- Recuperar jobs presos em `committing` após interrupção do processo; a correção atômica evita duplicação no erro testado, mas não transforma `after()` em fila durável.
- Avaliar fila durável/limites da função: `maxDuration=300`, expiração em 10 min. O lote de 200 levou 72–144s na API direta; timeout/reinício do servidor durante a inferência não foi exercitado.
- Datas sem dia, múltiplos fusos no mesmo lote e datas/horas ambíguas precisam de política explícita de proposta incompleta. A UI agora torna o fuso visível; não há configuração por organização nem fuso por post.
- Duplicatas entre importações e posts já existentes não são detectadas; o alerta atual cobre duplicatas aparentes dentro da proposta.
- Sem manifesto, nome de arquivo não basta para decidir carrossel, vídeo+capa ou reutilização. Medir esse caso na avaliação real; não prometer agrupamento correto pela simples existência de nomes parecidos.
- PDF com arte embutida exige arquivos originais separados; não há extração de assets ou download automático de Canva/Drive.
- ZIPs DOCX/XLSX muito compactados são expandidos antes do limite de texto; limitação de memória de arquivos hostis não foi testada.
- O upload de mídias pode acontecer antes de o POST de importação recusar documento inválido; a limpeza após 24h é uma compensação, não uma prevenção de custo. Reservar uma sessão de upload/preflight é melhoria futura.
- Registros só de texto não ganham aprovação automática; a opção explícita apenas evita a fila de design.

## Reproduzir sem tocar no ambiente normal

Os scripts e fixtures foram instalados no projeto original e também estão no pacote (`repro-scripts/`). `python3 scripts/qa/import-qa-prepare.py` cria outra cópia descartável, sem `.env`, bancos, uploads ou Git; reaproveita dependências instaladas. O script imprime o caminho. Na cópia, execute `node --import tsx scripts/qa/security.ts --serve`. Ele cria SQLite novo e imprime o caminho. O shim `offline-fixture` existe apenas nessa cópia.

Depois, na mesma cópia: `node scripts/qa/import-browser.mjs`. Com o caminho exato do SQLite impresso: `QA_DB=<caminho> node scripts/qa/import-api-checks.mjs`. Os scripts rejeitam banco fora de diretório temporário `approove-qa-*`. Rode também `node scripts/qa/import-ui-states.mjs` e `QA_DB=<caminho> node scripts/qa/import-text-only.mjs`. Use um banco novo para repetir os testes de contagem e rollback.

Dependências de autoria/browser usadas são as já instaladas no runtime deste Mac, com caminhos explícitos nos scripts. Não foi instalado software. O gerador `import-fixtures.py` requer Pillow, python-docx e ReportLab do runtime; `import-sheet.mjs` usa artifact-tool e normaliza OOXML. `import-extraction.ts` usa as dependências do projeto. O benchmark pago já autorizado foi concluído; novas execuções devem manter o mesmo ledger para respeitar o teto cumulativo. Nunca execute scripts de navegador contra o servidor normal de desenvolvimento.

## Evidências

- `postapply/results.json` e logs: 121 testes, TypeScript e lint passaram no original após aplicação.
- `benchmark/ledger.json`: 19 chamadas, tokens e custo; `scored-results.json`: avaliação final corrigida do pareamento.
- `benchmark/*claude*.json`: respostas reais, somente conteúdo fictício.
- `live-browser/`: screenshots e asserções do fluxo real, quatro registros e mídias locais.
- `supplement/`: ordem persistida, acessibilidade e extração das novas fixtures.
- `postapply/integrity.json`: conferência dos arquivos alterados e preservação dos demais hashes de origem.

- `all-tests.log`, `typecheck.log`, `lint.log`: regressões estáticas/unitárias.
- `browser-results.json`: tempos e contagens da rodada com mídia local.
- `api-results.json`: limites, acesso, atomicidade e fuso.
- `ui-states-results.json`: nomes repetidos, falha do provedor simulado, falha de descarte e geometria móvel.
- `text-only-results.json`: status e etapa gravados após escolha humana.
- `extraction-results.json`: bytes, caracteres, tempos e RSS de cada fixture.
- `screenshots/`: upload, limites, processamento, revisão desktop/móvel, erro e só texto.
- `remote-media-incident.json`: referências precisas dos arquivos fictícios da primeira rodada; não contém credenciais.
- `changes.patch`: diff sobre o trabalho local encontrado, sem desfazer as alterações anteriores.

Fontes de produto consultadas pela pesquisa da tarefa: [Planable — importação](https://help.planable.io/hc/en-us/articles/21715324907804-Import-posts-in-Planable), [fluxo de agência Attractive Media](https://planable.io/customers/attractive-media/), [Sendible — So Contented](https://www.sendible.com/case-studies/so-contented). As fixtures são cenários sintéticos inspirados nesses padrões, não dados extraídos de clientes dessas plataformas.
