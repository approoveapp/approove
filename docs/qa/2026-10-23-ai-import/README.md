# QA de importação com IA — resultado final

Leia [RELATORIO.md](RELATORIO.md). Correções e otimização aplicadas no original, sem commit/push/deploy. Haiku padrão local configurável; sem fallback/retries automáticos. 126 testes, TypeScript e lint passaram.

38 inferências reais, custo cumulativo US$1.9297504. Seis cenários iniciais, variantes difíceis, retestes de prompt e dois fluxos reais no navegador. Gabaritos não foram transmitidos. Score de 245/245 cobre sete campos, não precisão total; definição e limitações no relatório.

Evidências finais: benchmark/, postapply-final/, live-browser-haiku/. Os documentos/fixtures continuam fictícios. Snapshots TypeScript em repro-scripts terminam em .ts.txt para não entrar no build. Scripts instalados estão em scripts/qa no projeto.

Incidente anterior de 41 objetos Blob preservado no manifesto, sem acesso/remoção. Nenhum upload remoto de artefatos nesta entrega. Leia os relatórios históricos somente como histórico; este README e RELATORIO.md são o estado final.
