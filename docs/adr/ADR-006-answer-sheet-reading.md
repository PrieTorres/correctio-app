# ADR-006: Leitura da folha no servidor por padrão, com o mesmo leitor no navegador

**Status:** aceito em 15/10/2026, decisão da PM · Onde a leitura roda no servidor foi substituído pelo [ADR-007](ADR-007-sheet-reading-on-api-worker.md) em 30/10/2026 · Issues: #78 (leitura), #46 (cartão impresso), #47 (envio da foto), #48 (telas)

## Contexto

O RF27 pede que o sistema leia a foto da folha: o QR Code diz qual folha é, e as bolinhas marcadas dizem a alternativa de cada questão objetiva. A leitura nunca vira nota sozinha: o professor confere e confirma na revisão (RF28, RNF07).

A foto tem nome e resposta de aluno, então nada de API de visão paga, que mandaria a imagem a terceiros. A leitura é processamento de imagem local, e as duas opções avaliadas para onde ela roda foram:

| | No servidor | No navegador do professor |
|---|---|---|
| CPU | da nuvem. Não pode rodar na thread que atende a API: trava todas as requisições (`docs/Seguranca_e_LGPD.md`, seção 7) | do aparelho; o servidor fica livre |
| Retorno | depois do envio, em segundo plano (RF41) | imediato, com a câmera ainda na mão |
| Confiança | lê a mesma imagem que guardou | o servidor recebe o resultado e precisa conferir |
| Sem API | não funciona | funciona: é o caso do GitHub Pages, e de uma API fora do ar |

Bibliotecas avaliadas para o QR, num teste com fotos sintéticas da folha. O QR leva o endereço da consulta pública, `/r/<código de 26>`. Foram 12 fotos por cenário, em 900 × 1200 pixels:

| Cenário | jsQR | zxing-wasm |
|---|---|---|
| Reta, boa luz | 12/12 | 12/12 |
| Girada 15°, 90° e 180° | 36/36 | 36/36 |
| Perspectiva (celular inclinado) | 3/12 | 12/12 |
| Ruído forte | 0/12 | 12/12 |
| Luz de um lado só, desfocada, módulo pequeno | 36/36 | 36/36 |
| Tudo junto | 0/12 | 12/12 |
| Tempo médio por foto | 20 a 1.100 ms | cerca de 5 ms |

- **jsQR** (Apache-2.0, cerca de 270 KB): falha justamente no que uma foto de celular tem, perspectiva e ruído, e não recebe atualização relevante desde 2021.
- **zxing-wasm** (MIT, ZXing compilado para WebAssembly, binário de cerca de 950 KB): leu todas as fotos de todos os cenários, mantido ativamente.
- **opencv.js** (Apache-2.0, cerca de 14 MB): detectaria os cantos da grade, mas é pesado demais para baixar no celular. Os cantos são quatro quadrados pretos de posição conhecida, e achá-los não exige o OpenCV inteiro.

## Decisão

- **Um leitor só, isomórfico,** no pacote `@correctio/sheet-reader`.
  - Recebe pixels RGBA (`{ data, width, height }`) e devolve o resultado.
  - Não usa nada de Node nem de navegador.
  - Cada lado só converte a foto em pixels: no servidor com o [`sharp`](https://sharp.pixelplumbing.com), que também aplica a orientação gravada pelo celular; no navegador com `createImageBitmap` e um canvas.
- **Por padrão, no servidor.**
  - Uma função separada da API, disparada quando a foto chega ao Storage (ADR-004), lê em segundo plano e grava o resultado para a revisão.
  - O trabalho pesado nunca roda na instância que atende a API (ADR-005).
- **No navegador, em dois casos:**
  - no GitHub Pages, que não tem API (`VITE_DEMO_MODE`);
  - quando a API não responde. O professor vê a leitura na hora, e o envio espera a API voltar.

  O leitor é carregado só na tela de correção.
- **QR com zxing-wasm.** O binário `.wasm` é sempre servido pelo próprio projeto: lido do `node_modules` no servidor, empacotado pelo Vite no navegador. Por padrão, a biblioteca baixaria de uma CDN pública.
- **Do QR à folha:**
  - o QR pode levar o código puro ou o endereço da consulta pública, em qualquer domínio (`answerSheetCodeFromQr`, em `@correctio/domain`);
  - só valem as folhas da própria aplicação. Código de outra aplicação, ou de PDF regenerado (RF24), é "QR não reconhecido" (RF30).
- **Bolinhas lidas pelo próprio pacote, sem OpenCV,** sobre a geometria do cartão que a #46 imprime:
  - acha os quatro quadrados dos cantos;
  - corrige a perspectiva;
  - mede a tinta de cada bolinha;
  - traduz linha e letra pelo `ExamVersion.layout`.

  Em branco ou com mais de uma marca, a questão volta sem alternativa, para o professor decidir.
- **Três resultados, nomes do grupo:** `READ`, `QR_NOT_RECOGNIZED` e `READ_FAILED` (o QR foi lido, as marcas não). Nenhum deles cria correção concluída.

## Consequências

- **O mesmo código roda nos dois lugares** e é testado no Node. Os testes usam fotos sintéticas com rotação, perspectiva, ruído, luz desigual e desfoque, e passam a usar fotos reais quando o cartão da #46 existir.
- **O navegador baixa cerca de 1 MB a mais, só na tela de correção.**
- **Leitura feita no navegador é sugestão.** O servidor confere que a folha é da aplicação e recalcula a nota a partir das respostas marcadas. A nota só existe depois da confirmação do professor.
- **A função de leitura tem limite de instâncias próprio,** dentro da cota gratuita do Cloud Run (ADR-005), com partida a frio de alguns segundos na primeira foto.
- **Falta medir com fotos reais.** O RNF07 pede menos de 1% de erro com boa iluminação, e isso só se mede com folhas impressas do PDF da #46. O resultado vai para o PR que fechar a #78.
- **`docs/Seguranca_e_LGPD.md` atualizado.** A seção 5 dizia que a leitura era só no servidor. Em nenhum dos dois casos a imagem vai a terceiros.
