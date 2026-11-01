# Ajuste final: preservar ocorrências e revisar duplicatas

Aplicado no original `/Users/murillo/Projects/approove`, branch `feat/ai-import`, sem commit/push/deploy. Os cinco arquivos existentes foram comparados por SHA256 antes da gravação; três arquivos novos tinham destino ausente. Diff em `changes.patch`. Este adendo substitui a conclusão anterior de que consolidar as dez ocorrências no CSV120 seria aceitável.

## Solução

- Prompt explícito: preservar cada ocorrência, inclusive linhas idênticas; nunca consolidar automaticamente. Outra data, horário ou canal é uma ocorrência distinta. Duplicatas são alertadas para decisão humana.
- Novo `lib/import/tabular-integrity.ts`: indexa registros CSV/TSV e linhas XLSX já extraídas, respeitando células multilinha. Reconhece cabeçalho de canal e título/legenda e exige canal explícito permitido. Cada ocorrência recebe marcador único por arquivo/aba/linha, incluído na instrução junto da referência real da fonte. Esses dados são extraídos da entrada, não do gabarito.
- Reconciliação no servidor depois da resposta estruturada e antes de liberar revisão: rejeita linha reconhecida ausente, marcador reutilizado, referência desconhecida, canal errado ou agrupamento de várias ocorrências num item. Quando todas as entradas são tabulares e verificáveis, rejeita também itens sem marcador. Falha mantém uso de tokens contabilizado, não libera proposta parcial e não cria posts. Sem retry/fallback automático.
- Abas sem cabeçalhos reconhecidos (incluindo auxiliares) não entram na contagem de posts. Linhas com canal ausente ou múltiplos canais não ganham contagem inventada; são listadas no aviso de cobertura incompleta.
- UI remove a garantia “nenhuma foi removida automaticamente”. Explica que as ocorrências propostas permanecem selecionadas até decisão humana e que a comparação com a fonte ainda é necessária.

## Reteste real com a mesma fonte CSV120

Gabarito não enviado. A entrada foi o CSV fictício original, mais o índice determinístico de suas próprias linhas. Uma chamada por modelo, esforço medium, sem retries/fallback, com reserva de orçamento antes de admissão.

| Modelo | Propostas / linhas únicas | Latência | Tokens entrada / saída | Custo USD |
|---|---:|---:|---:|---:|
| Haiku 5.5 | 120 / 120 | 68,42 s | 14.788 / 21.974 | 0,0124658 |
| Sonnet 5.5 | 120 / 120 | 81,99 s | 14.788 / 17.823 | 0,2078060 |

Ambos preservaram as dez ocorrências duplicadas e sinalizaram a decisão humana; as recorrências em outra data/canal permaneceram. Conferência direta contra o CSV: 120/120 títulos, copy literal (incluindo quebras/emoji/URL), horas ou ausência delas, canais, formatos e ausência de mídia. As 118 datas ISO foram preservadas literalmente. As duas ocorrências de “primeira sexta de novembro de 2026” foram interpretadas como 2026-11-06, com dateIsSuggested=true e aviso. Isso não equivale a precisão universal nem à interpretação de mídia validada neste lote sem imagens.

Custo desta etapa: **US$0,2202718**. Total cumulativo: **US$2,1500222**, 40 chamadas pagas concluídas, nenhuma reserva pendente ou incerta. As medições incluem a resposta completa do provedor, excluem upload/extração/revisão/commit. Compilação do schema não controlada, uma amostra por modelo, sem p95. Os marcadores aumentam a entrada; não comparar custo/latência com a rodada anterior como se o prompt fosse idêntico.

As fixtures históricas mantêm os gabaritos usados na primeira rodada (CSV pequeno=6 únicos; CSV120=110 únicos). Esses números não são mais a política desejada antes da decisão humana. O gabarito atualizado do reteste está em `expected-preserve-occurrences.json` (120 ocorrências); os resultados anteriores permanecem históricos.

Evidências: `source-audit.json`, `../benchmark/ledger.json`, `../benchmark/integrity--09-csv-120-claude-haiku-5-5.json` e `../benchmark/integrity--09-csv-120-claude-sonnet-5-5.json`.

## Regressões e QA visual/funcional

- No original: **132 testes em 22 arquivos passaram**, TypeScript passou, lint dos seis arquivos de produção/testes alterados passou. Logs `original-unit.log`, `original-typecheck.log`, `original-lint-changed.log`.
- Cobertura nova: registros idênticos e recorrência legítima; CSV multilinha; duas abas XLSX com cabeçalhos/linha mesclada e abas Analytics/Legenda fora da contagem; canal ambíguo; proposta incompleta mesmo com total preenchido artificialmente; agrupamento/reuso de IDs; canal errado; ID inexistente; item extra sem origem; falha preserva tokens e não tenta novamente.
- Navegador real com proposta simulada, SQLite descartável e integrações externas anuladas: quatro ocorrências entram selecionadas, duas sinalizadas como possíveis duplicatas. Confirmar todas persiste quatro posts. Desmarcar só a segunda ocorrência persiste três, mantém outra data/canal e remove somente a referência de linha escolhida. Todos pending; nada publicado ou aprovado. **Este QA não é inferência real nem teste pago ponta a ponta.**
- A rodada visual foi repetida para esperar a estabilização do modal no resize: 14 posts fictícios ao todo nas duas execuções (7 por execução), apenas no banco descartável. Última evidência em `browser-results.json`, `keep-all-desktop.png`, `exclude-one-desktop.png`, `exclude-one-mobile.png`. Banco removido pelo encerramento normal do harness.
- O lint geral da cópia isolada encontrou 14 erros de `any` nos helpers QA preexistentes/import-benchmark/import-extraction e template temporário; não foi declarado aprovado. O lint focado dos arquivos de produção alterados passou. Não houve refatoração desses helpers fora do escopo.

## Limites reais

A reconciliação verifica cobertura das linhas identificadas e canal, não prova fidelidade de todos os campos em qualquer documento. PDFs, DOCX, imagens, tabelas sem cabeçalhos reconhecidos, canais abreviados/múltiplos e estruturas de carrossel distribuídas por linhas continuam sujeitos à revisão humana. Não há reconhecimento semântico universal de linhas. A nova proteção não é retroativa para propostas antigas já persistidas: descarte/refaça essas importações se necessário. Não há botão de recuperação automática de itens omitidos; uma divergência identificada falha antes da revisão e requer nova tentativa explícita, que pode gerar custo.

Haiku mantido como padrão configurável após 120/120 neste caso e com bloqueio de cobertura nas linhas reconhecidas. Não há troca silenciosa para modelo caro. Nenhum acesso/remoção aos 41 objetos do incidente anterior, nenhum Blob remoto, nenhuma entrega Library ou outro upload remoto.
