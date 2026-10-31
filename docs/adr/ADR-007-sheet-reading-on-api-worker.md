# ADR-007: Leitura da folha na própria API, numa worker thread

**Status:** aceito em 30/10/2026, decisão da PM · Substitui, no ADR-006, a parte de onde a leitura roda no servidor · Issues: #47 (envio da foto), #48 (telas), #78 (leitura)

## Contexto

O ADR-006 decidiu ler a foto da folha no servidor, numa **função separada da API**, disparada quando a foto chega ao Storage, com o resultado gravado para a revisão. Na reta final da N2, essa função ainda não existia, e ela traz custos que pesam no prazo:

- infraestrutura nova no Firebase: gatilho do Storage pelo Eventarc, permissões da conta de serviço e um segundo deploy, que costuma falhar por permissão na primeira vez;
- resposta assíncrona: o envio da foto termina antes da leitura, e a tela precisa perguntar de novo até o resultado ficar pronto.

A própria #47 já admitia ler dentro da API, desde que fora da thread principal (`docs/Seguranca_e_LGPD.md`, seção 7).

## Decisão

- **A leitura roda na API, numa worker thread** (`apps/api/src/lib/sheet-reading`).
  - O envio da foto (`POST /applications/:id/sheet-images`) guarda o arquivo no Storage (ADR-004), lê com o mesmo `@correctio/sheet-reader` do ADR-006 e já responde com o resultado: `READ`, `QR_NOT_RECOGNIZED` ou `READ_FAILED`.
  - A foto vira pixels com o `sharp`, que também aplica a orientação gravada pelo celular e reduz a foto a no máximo 2400 pixels no lado maior.
  - A thread é uma só, criada na primeira foto e reaproveitada, com as fotos em fila. Ela só segura o processo enquanto há leitura em andamento.
  - Rodando a partir do código-fonte (testes e `npm run dev:api`), não há worker empacotado, e a leitura roda na própria thread.
- **O navegador lê só no demo do GitHub Pages**, que não tem API, como o ADR-006 já previa. A leitura no navegador quando a API está fora do ar fica para depois da N2.
- **Nada muda no resto do ADR-006:** o leitor isomórfico, o zxing-wasm servido pelo projeto, os três resultados e a regra de que nenhuma leitura cria correção concluída.

## Consequências

- **Sem infraestrutura nova.** O `sharp` e o `zxing-wasm` entram como dependências da função da API, e o `build.mjs` empacota o worker ao lado dela.
- **Uma foto de cada vez.** A API tem uma instância só (ADR-005), e as leituras entram em fila na mesma thread. Num teste com uma foto sintética, a leitura levou cerca de 240 ms, já contando a partida da thread. Para uma turma fotografada em sequência, isso basta.
- **A CPU da leitura é a da instância da API.** As outras requisições continuam respondendo, porque a thread principal fica livre, mas dividem a mesma máquina. Se o volume crescer, a função separada do ADR-006 volta a ser o caminho.
- **O limite de 500 fotos e 200 MB por dia** (`docs/Seguranca_e_LGPD.md`, seção 4) é contado no banco, na tabela `sheet_images`, e vale mesmo depois de a API reiniciar.
