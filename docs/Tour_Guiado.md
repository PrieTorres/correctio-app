# Tour Guiado — Correctio

Especificação do tour de apresentação das telas. Atende **RF37** (tour contextual por tela) e **RNF19** (objetividade e acessibilidade).

---

## 1. O princípio: contextual, não de uma vez

O erro clássico é disparar um tour único no primeiro login e desfilar 60 passos por um sistema que a pessoa ainda não usou. Ninguém lê, todo mundo pula, e o conhecimento se perde.

**O tour do Correctio aparece por tela, na primeira vez que aquela tela é aberta.** O professor recebe 2 a 4 frases sobre o que está vendo, no momento em que aquilo importa. Isso significa que ele nunca vê mais de 4 passos de uma vez, e que aprende a tela de correção quando vai corrigir — não semanas antes.

## 2. Regras de escrita

| Regra | Motivo |
|---|---|
| **Máximo 4 passos por tela** | Mais que isso ninguém termina |
| **Máximo 90 caracteres por passo** | Cabe em uma linha no celular sem virar parágrafo |
| **Começa com verbo** | "Monte a prova aqui", nunca "Esta é a área onde você pode..." |
| **Só o que não é óbvio** | Não apontar para um botão escrito "Salvar" |
| **Sem jargão do sistema** | O professor não sabe o que é "Aplicação" no primeiro acesso — o tour é onde ele aprende |
| **Uma ideia por passo** | Se precisa de "e", provavelmente são dois passos ou nenhum |

## 3. Comportamento

- **Dispara na primeira visita de cada tela**, uma única vez. O estado "já viu" é guardado por tela.
- **Nunca bloqueia.** "Pular" sempre visível, `Esc` fecha, clique fora fecha. A tela continua utilizável por baixo.
- **Botão "Ajuda"** na barra superior reabre o tour **da tela atual**, não do sistema inteiro.
- **"Rever tour guiado"** no perfil zera o estado de todas as telas.
- **Não dispara em tela vazia.** Uma turma sem alunos já mostra o estado vazio com o botão certo — explicar uma tabela que não tem linhas é pior que não explicar nada. O tour espera existir conteúdo.
- **No celular**, o passo aparece como faixa na base da tela, não como balão flutuante.

## 4. Acessibilidade (RNF19)

Foco move para o passo ativo ao abrir · navegação por `Tab`, `Enter` e `Esc` · o passo é anunciado por leitor de tela · o destaque do elemento não depende só de cor · ao fechar, o foco volta para onde estava.

## 5. Conteúdo por tela

Os textos abaixo são a redação final, já dentro do limite de 90 caracteres.

### Acesso

**Cadastro** — 1 passo
1. `Sua conta é só sua: cada professor vê apenas as próprias turmas e provas.`

### Painel

**Painel** — 4 passos
1. `Estes cartões resumem seu semestre. Clique em qualquer um para ver a lista.`
2. `"Correções pendentes" é o que precisa da sua atenção hoje.`
3. `Os atalhos abrem direto as quatro ações mais comuns.`
4. `O menu à esquerda segue a ordem do trabalho: turma, questão, prova, aplicação.`

### Turmas

**Turmas (lista)** — 2 passos
1. `Turma é onde ficam seus alunos. Arquive as antigas para limpar a lista.`
2. `Turma arquivada não some: continua nos relatórios e pode voltar quando quiser.`

**Turma — detalhe** — 3 passos
1. `Cadastre alunos um a um, ou importe a lista inteira de uma planilha.`
2. `Remover aluno não apaga as notas dele — o histórico fica.`
3. `Aqui embaixo aparecem todas as provas já aplicadas nesta turma.`

### Banco de questões

**Banco de questões** — 3 passos
1. `Escreva a questão uma vez. Ela serve para todas as provas, todo semestre.`
2. `Use tags para separar por conteúdo: é por elas que a prova automática monta.`
3. `Excluir é reversível — a questão sai da lista, mas segue nas provas que já a usam.`

**Questão — criar/editar** — 2 passos
1. `Marque qual alternativa é a correta: é ela que o sistema usa para corrigir.`
2. `Desligue o embaralhar em questões como "todas as anteriores".`

### Provas

**Provas (lista)** — 3 passos
1. `Prova é o conteúdo. Aplicar a uma turma é o passo seguinte.`
2. `"Gerar automaticamente" monta a prova sozinho a partir das suas tags.`
3. `Duplicar cria uma cópia editável, sem mexer na original.`

**Prova — criar/editar** — 3 passos
1. `Arraste para reordenar. A pontuação de cada questão é livre.`
2. `A soma não é validada: conferir se fecha em 10,0 é com você.`
3. `O embaralhamento definido aqui vira o padrão de toda aplicação desta prova.`

**Gerar prova automaticamente** — 2 passos
1. `Escolha as tags e a quantidade: o sistema sorteia do seu banco.`
2. `Não gostou de uma questão? "Trocar" sorteia outra com os mesmos filtros.`

### Aplicações

**Aplicações (lista)** — 2 passos
1. `Aplicação é a prova entregue a uma turma numa data. A mesma prova rende várias.`
2. `Acompanhe aqui quantas folhas já foram corrigidas de cada uma.`

**Gerar PDF** — 3 passos
1. `Cada versão embaralha de um jeito. Mais versões, menos chance de cola.`
2. `"Com identificação" já imprime o nome do aluno em cada folha.`
3. `Sai um arquivo único com tudo dentro, pronto para imprimir.`

**Aplicação — detalhe** — 4 passos
1. `Baixe o PDF aqui. Regenerar troca as folhas e invalida os QR já impressos.`
2. `Publique o gabarito quando quiser que os alunos vejam as respostas certas.`
3. `"Corrigir provas" é onde você envia as fotos das folhas.`
4. `Liberar as notas faz cada aluno ver a dele ao escanear o QR da própria folha.`

### Correção

**Enviar folhas** — 3 passos
1. `No celular, fotografe as folhas uma a uma. No computador, arraste os arquivos.`
2. `O sistema lê o QR e as marcações, e já calcula a nota prévia.`
3. `Nada vira nota sem você confirmar. Revise antes.`

**Revisar e confirmar** — 3 passos
1. `À esquerda a folha, à direita o que o sistema leu. Compare e ajuste.`
2. `Clique no seletor para trocar a alternativa lida. A nota recalcula na hora.`
3. `"Salvar e próxima" mantém o ritmo: confirma esta e já abre a seguinte.`

**Pendentes de atribuição** — 1 passo
1. `Provas sem identificação caem aqui até você dizer de quem é cada folha.`

### Relatórios

**Relatório da aplicação** — 3 passos
1. `A distribuição mostra se a prova ficou fácil, difícil ou bem calibrada.`
2. `"Por questão" revela onde a turma errou — e qual alternativa errada atraiu mais.`
3. `Exporte para levar ao sistema acadêmico ou à coordenação.`

### Página pública do aluno

Sem tour. É uma tela de leitura, aberta uma vez, por quem não vai voltar. Qualquer passo ali é atrito.

---

## 6. Nota de implementação

O tour é **um componente compartilhado** em `components/ui`, alimentado por um arquivo de conteúdo por tela — nunca texto espalhado dentro dos componentes de página. Assim a revisão do texto é feita em um lugar só, o limite de caracteres é verificável por teste automatizado (RNF19) e traduzir depois é trocar um arquivo.

O estado "já viu esta tela" é preferência local do professor, não dado de negócio: vive no navegador, não no banco.
