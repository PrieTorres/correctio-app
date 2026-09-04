# Entrevista com o cliente: relato do problema e necessidades

> **Obs.:** Texto organizado a partir da fala do cliente, para levantamento de requisitos.

## 1. O problema

O principal problema, principalmente para os professores que têm 40 horas, é o grande volume. A gente chega em uma semana de provas com 200, 300, 400 provas para corrigir. Isso toma muito tempo, porque a gente normalmente não tem só a sala de aula, tem outras atividades junto. Então a gente precisa de um sistema que faça a correção automatizada dessas provas.

Isso evita que os alunos tenham que esperar até a próxima aula para ter a correção da prova, eles podem ver o resultado eventualmente já ao final da prova. Isso me ajuda bastante até na questão da devolução da avaliação.

## 2. Como funciona hoje

Eu uso hoje o GradePen e consigo gerar uma folha de resposta separada: eles me entregam só a folha de resposta, e a prova em si eles levam para casa. Assim eles já podem corrigir, já podem estudar, podem ver o que fizeram certo e o que fizeram errado.

Coloco as questões lá dentro do sistema, posso até criar um banco de questões dentro do próprio GradePen. E ele randomiza as questões: eu posso escolher entre colocar as mesmas questões para todo mundo ou criar provas diferentes. E mesmo que eu coloque as mesmas questões para todo mundo, o sistema também permite alterar a ordem das questões e das alternativas, ele faz isso sozinho. Eu só indico qual alternativa é a correta de cada questão, e depois ele faz a distribuição das questões e alternativas embaralhadas entre as provas.

Assim, em uma sala com 40 alunos, eu tenho 40 provas com as mesmas questões, mas com a ordem das questões e das alternativas embaralhada, cada aluno com uma variação. É o mesmo número de alternativas e a mesma prova, só que embaralhada. Se eu pedir para gerar 40 provas diferentes, ele gera 40 provas diferentes.

Isso é importante porque, para quem tenta colar, é preciso realmente prestar atenção no que o colega está fazendo, não basta olhar onde o colega está assinalando, já que a posição da resposta certa muda de prova para prova.

Além disso, no GradePen eu também consigo gerar a prova separada, se eu quiser: formato minha própria prova, gero só o gabarito, e ele me gera uma folha com um QR code, que o sistema reconhece para fazer a correção.

## 3. Como é feita a correção

A ideia é: eu uso o sistema só para correção. O sistema reconhece a prova e lê as alternativas que estão marcadas dentro dos quadradinhos da folha de resposta.

Abro o aplicativo, primeiro leio o QR code, leio o gabarito, depois leio a prova. Abre a opção de ler o gabarito e ele dá a nota automaticamente. Com isso, consigo corrigir as provas de uma turma de 50 alunos em quase meia hora.

## 4. Limitações do GradePen (o que falta / incomoda)

O sistema do GradePen não cuida se a questão ficou cortada no meio da página, às vezes o enunciado começa numa página e a alternativa pula pra outra parte.

Depois de corrigir, consigo ver as avaliações já corrigidas e gerar um arquivo Excel com as correções. Só que esse arquivo só me indica qual questão o aluno acertou ou errou, não me indica qual alternativa ele marcou naquela questão. E isso seria uma informação importante para fazer a análise da questão: porque os alunos erraram, o que erraram na questão.

## 5. Comparação com o concorrente

O Prova Fácil faz essa análise que o GradePen não faz: ele gera a estatística e mostra qual foi a alternativa mais assinalada em cada questão.

O Prova Fácil também gera relatório de notas, e essa funcionalidade de organizar a sala para prova (gerar o caderno de provas já com o nome do aluno) ele tem, mas só funciona no plano institucional pago.

Por outro lado, o Prova Fácil é o contrário do GradePen em um ponto: ele não dá a opção de criar/gerar a prova dentro do sistema, só gera o gabarito.

## 6. Requisitos / prioridades citadas pelo cliente

### Essencial

- Gerar e corrigir a prova de forma automatizada e fácil (o mais importante).

### Importante, mas não essencial

- Gerar estatística das respostas (ex: qual alternativa foi mais marcada por questão), para ajudar na análise pedagógica dos erros.

### Sugestões de funcionalidades adicionais

- Importar lista de alunos.
- Gerar prova individualizada por aluno, mesmo que seja a mesma prova para todos, mas que dê para identificar, pela folha de resposta, de qual aluno é aquela prova.
- Gerar relatório de notas (Excel) para lançar direto no sistema acadêmico da instituição.
- Permitir editar o layout da prova gerada, por exemplo, se uma questão ficar cortada no meio da página, poder movê-la para não cortar (gerar a prova em .doc).

### Preferência de formato de dados

- Planilha (Excel), a planilha é mais útil, porque dá para manipular os dados.

## 7. Preferência de interface / experiência de uso

No GradePen, só consigo criar prova pela versão Web. O aplicativo tem um botão para iniciar a correção, entre outras opções, só clico ali e já vou corrigindo.

**Sobre o layout:** contanto que seja lógico, que a construção seja lógica, não tenho uma exigência forte de estilo. Eu, particularmente, sou minimalista, acho que quanto menos elementos na tela, melhor. A ideia é que seja amigável e fácil de usar.
