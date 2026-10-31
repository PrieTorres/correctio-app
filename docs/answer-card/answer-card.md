# Cartão-resposta

O cartão-resposta fica na primeira página de cada folha impressa. O PDF da aplicação (#46)
desenha o cartão, e a leitura da foto (#78) procura as marcações nas mesmas posições.

As medidas ficam num lugar só, `packages/domain/src/answer-card.ts` (`ANSWER_CARD`), e os dois
lados importam de lá. Nenhum dos dois guarda cópia: uma medida mudada de um lado só deixaria
toda folha impressa ilegível.

![Capa de uma folha com o cartão-resposta: cabeçalho, instruções, QR Code à esquerda e grade de bolinhas à direita, entre quatro quadrados pretos](answer-card.png)

## Medidas

Em milímetros, a partir do canto superior esquerdo da página A4 em retrato (210 × 297), com `y`
crescendo para baixo.

| Elemento | Onde fica |
|---|---|
| Moldura | canto em x = 15 e y = 112, com 180 de largura e 170 de altura |
| Marcadores | quadrados pretos de 5 mm, com centro em (115, 120), (185, 120), (115, 268) e (185, 268) |
| Letras A a E | na altura y = 129, centradas sobre as colunas |
| Bolinhas | 20 linhas por 5 colunas, com raio de 2,3. A questão `n` (0 a 19) na letra `k` (0 = A até 4 = E) tem centro em x = 134 + 8k e y = 136 + 6,5n |
| Número da questão | `n + 1`, alinhado à direita em x = 128, na altura da linha |
| QR Code | quadrado de lado 55, com o canto em x = 25 e y = 166,5 |
| Folha e versão | "Folha N · Versão V", acima do QR Code, fora da margem livre dele |
| Código da folha | "Código …", abaixo do QR Code, fora da margem livre dele |

A margem livre é a que o padrão do QR Code pede em volta do símbolo: 4 módulos de cada lado, sem
nada impresso, para o leitor achar o código. O tamanho do módulo depende do comprimento do
endereço (com `https://correctio-app.web.app`, o símbolo tem 33 módulos e a margem fica em torno
de 6,7 mm), por isso o PDF calcula a posição dos dois textos a partir do símbolo impresso. O QR
Code em si nunca muda de lugar.

As funções `bubbleCenter(n, k)` e `columnLetter(k)` fazem essas contas, e recusam uma linha ou uma
letra que o cartão não tem.

## O que o QR Code carrega

O endereço da consulta pública da folha, `<PUBLIC_APP_URL>/r/<code>`, por exemplo
`https://correctio-app.web.app/r/K7M2QX9RT4BV8NC3HW6PJ5DZ2A`.

- O `code` é o `AnswerSheet.code`, de 26 caracteres, a única chave da folha
  (`docs/Seguranca_e_LGPD.md`, seção 3).
- A base vem da variável de ambiente `PUBLIC_APP_URL` da API, nunca do código, porque fica
  impressa no papel.
- A correção de erro é de nível M: o QR Code continua legível com até 15% dele manchado ou
  dobrado.

Pelo código se chega à folha, pela folha à versão (`examVersionId`) e pela versão ao `layout`,
que registra o que foi impresso.

## Como ler uma foto

É o que faz o `readSheet`, em `packages/sheet-reader` (ADR-006), igual no navegador e no
servidor.

1. **Ler o QR Code primeiro.** Pelo código se chega à folha e ao `layout` da versão. Código que
   não é desta aplicação é "QR não reconhecido" (RF30).
2. **Tirar a orientação do próprio QR.** O leitor devolve os quatro cantos do símbolo com o nome
   que o símbolo dá a cada um: o canto superior esquerdo do QR é sempre o mesmo, com a folha
   girada 90°, 180° ou de cabeça para baixo. Como o QR tem lugar fixo no cartão, esses cantos
   dão um primeiro mapa do cartão na foto. Os quatro marcadores são iguais entre si, então
   sozinhos não diriam qual lado é o de cima.
3. **Achar cada marcador perto de onde o primeiro mapa diz.** A busca fica numa janela em volta
   da posição prevista. Isso deixa de fora os três quadrados dos cantos do próprio QR, que também
   têm 5 mm.
4. **Endireitar pelos marcadores.** A transformação que leva os quatro centros achados aos
   centros da tabela, em milímetros, corrige a inclinação do celular. Os marcadores cercam as
   bolinhas, então elas ficam entre pontos medidos, e não extrapoladas a partir do QR. Sem os
   quatro marcadores, a leitura falha ("Falha na leitura"), mas a folha já está identificada.
5. **Montar as linhas** com `answerCardRows(layout)`. A linha `n` é a questão
   `layout.questionOrder[n]`. A bolinha `k` dessa linha é a alternativa `printedOrder[k]` da
   entrada da questão em `layout.alternativeOrder`.
6. **Medir a tinta de cada bolinha** no miolo, longe do contorno impresso, contra o papel entre
   as bolinhas da mesma linha, o que compensa a luz desigual. Nenhuma marcada, ou duas marcadas
   na mesma linha, volta sem alternativa, e o professor decide na revisão (RF28). Pela instrução
   impressa na capa, duas marcações anulam a questão.

Uma linha sem bolinhas é questão discursiva: aparece no cartão com o número e a palavra
"discursiva", e não é lida. As linhas depois da última questão ficam em branco. O espaço é sempre
de 20 linhas, o máximo de questões por prova, para todo cartão ter a mesma geometria.

A leitura usa o `layout`, e não a prova, de propósito: o `layout` é o que foi impresso, e a prova
pode ter mudado depois.

## Antes de mudar uma medida

- Mudar uma medida muda o PDF e a leitura ao mesmo tempo, mas não muda o papel já impresso. Por
  isso cada folha grava com qual geometria saiu, em `AnswerSheet.answerCardVersion`, que a
  geração preenche com `ANSWER_CARD.version`. Quem muda uma medida aumenta essa versão e mantém
  a geometria anterior para a leitura das folhas que já estão com os alunos.
- `packages/domain/src/__tests__/answer-card.test.ts` confere que o cartão cabe na página, que as
  bolinhas não se encostam e ficam dentro dos marcadores, e que o QR Code nunca cobre uma bolinha.

## O resto da folha

- A capa traz prova, turma, data, versão e folha. Quando a aplicação é identificada, traz também
  o nome e a matrícula do aluno; senão, linhas em branco para ele preencher.
- O título da prova ocupa no máximo 2 linhas, e a linha da turma, 1; o que passar disso termina
  em reticências. São os únicos textos que o professor escreve do tamanho que quiser, e o corte
  garante que as instruções de preenchimento sempre caibam acima do cartão. O nome e a matrícula
  do aluno nunca são cortados. Um teste confere isso com os maiores textos que os schemas aceitam.
- As questões começam na segunda página, na ordem do `layout` da versão, com as alternativas
  na ordem de `printedOrder`, de A a E.
- Questão nunca quebra entre páginas (RF43). Cada folha termina em número par de páginas,
  contando a capa, com uma página em branco quando precisa (RF44), para a folha seguinte não
  começar no verso.
- Uma questão mais alta que uma página inteira não é impressa: o gerador recusa o PDF com o erro
  `QuestionTooTallError`, que diz qual questão é. Impressa assim mesmo, ela teria o enunciado
  cortado e abriria uma página fora do plano, quebrando o RF44.
- A fonte DejaVu vai embutida no PDF, para símbolos como →, ³ e √ saírem iguais em qualquer
  impressora.
