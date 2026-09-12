# Correctio — instruções do projeto

Sistema web de geração e correção de provas. Trabalho da disciplina Projeto e Arquitetura
de Software, Grupo 2, Católica SC.

## 🔴 Leia antes de tocar em qualquer entidade

**[`docs/Modelo_de_Dados.md`](docs/Modelo_de_Dados.md) é normativo.** Define a estrutura
obrigatória de `User`, `RefreshToken`, `Class`, `ClassEnrollment`, `Student`, `Question`,
`Exam`, `Application`, `ExamVersion`, `ExamAssignment`, `AnswerSheet` e `Correction`,
espelhando a seção 8 da Spec SGP Católica.

A regra, em uma linha: **acrescentar campo pode; remover, renomear ou mudar a forma de um
campo definido pela Spec, nunca.**

Erros que já aconteceram e não podem repetir:

- trocar `teacherId` por `ownerId`
- trocar `fullName` por `name`
- trocar `status: "active" | "archived"` por um campo `archivedAt`
- trocar `type: "objetiva" | "discursiva"` por `kind` com outros valores
- mover a alternativa correta para dentro de cada alternativa, em vez de `correctAlternativeId`
- esquecer `ExamVersion.layout`, sem o qual a correção é impossível

Se a Spec parecer atrapalhar, registre em "Divergências que restam" naquele documento. Não
resolva sozinho.

### Campos sem uso que NÃO são código morto

A área do aluno está fora do escopo deste projeto, mas o modelo foi deixado aberto para quem
herdar o código. Estes elementos existem de propósito e **não podem ser removidos por
parecerem inúteis**: `User.role = "estudante"`, `ClassEnrollment`, `Student.userId`,
`Class.inviteCode` e `ExamAssignment`. Ver "Reservado para escopo futuro" no modelo de dados
e a seção 9 de [docs/Arquitetura.md](docs/Arquitetura.md).

Pelo mesmo motivo, **não construa** rota, tela ou repositório de aluno: seria código morto.

O mesmo vale para `Correction.clientCorrectionId` e `syncStatus`: servem a um app mobile que
não existe, este site não os trata, e continuam no contrato porque chegariam pela API se
alguém migrasse para cá.

### Atualização não pode apagar campo que o cliente não conhece

Duas armadilhas, as duas já corrigidas e cobertas por teste — não reintroduza:

1. **Validação descarta chave desconhecida.** `z.object()` remove o que não está declarado.
   `lib/storage/collection.ts` reanexa essas chaves depois de validar. Validação confere a
   forma conhecida; nunca pode ser o motivo de um dado sumir.
2. **Atualização é mesclagem, nunca substituição.** `{ ...registroAtual, ...camposEnviados }`.
   Trocar o registro inteiro pelo payload do cliente apaga em silêncio tudo que ele não
   conhece. Vale em dobro para as rotas de escrita do Express na N2.

## Convenções de código

- **Todo identificador, arquivo e pasta em inglês.** Português só em texto de interface e
  em documentação.
- **Valor literal de enum:** o que a Spec define fica exatamente como ela escreve, inclusive
  `"objetiva"`. O que o grupo acrescenta usa `SCREAMING_SNAKE_CASE` em inglês e é exposto por
  objeto congelado (`CORRECTION_STATUS.DONE`), nunca string solta no ponto de uso. A caixa
  diz qual valor pode ser renomeado e qual está preso ao contrato.
- **Sem comentário `//`.** Apenas JSDoc quando agrega, ou `TODO` quando inevitável.
- Comentário explica **por que**, nunca o que a linha já diz. Se precisa de explicação ao
  lado, o nome está mal escolhido — renomeie em vez de comentar.
- **Comentário em inglês em todo arquivo versionado**, incluindo workflows, `.properties` e
  `.gitignore`. Português vive só em `docs/` e no texto de interface.

As três regras acima são verificadas pelo build, não por revisão:
`conventions/no-line-comments` e `conventions/english-only-comments` no ESLint para
`.ts`/`.tsx`/`.js`, e `npm run lint:comments` para os arquivos que o ESLint não alcança.
- Funções pequenas, com escopo definido e testáveis isoladamente.
- DRY: antes de criar componente, hook, util ou tipo, procure o que já existe.
- TypeScript estrito. Sem `any`; `unknown` na fronteira, com validação.
- Dado remoto vive no TanStack Query — nunca em `useState` nem em store global.
- Nada de `useEffect` para buscar dado.
- Modelar apenas estados válidos: união discriminada em vez de booleanos que combinam em
  estados impossíveis — **exceto** onde a Spec define outra forma, que prevalece.
- Acessibilidade não é etapa final: alvo de toque de 44 px, foco visível, ARIA correto.

## Todo comportamento novo entra com teste

Não existe "depois eu cubro". Cada elemento, função ou regra nova sai no mesmo PR que o
teste dela, e o tipo de teste segue o que está sendo criado:

| O que foi criado | Onde testar |
|---|---|
| Função pura, regra de negócio, cálculo | **Unitário** em `__tests__` ao lado do módulo |
| Hook de dado | **Unitário** com `renderHookWithProviders` de `src/test-utils.tsx` |
| Tela, fluxo, interação, estado vazio | **Cypress** em `apps/web/cypress/e2e` |
| Componente com comportamento (não só visual) | Cypress pelo fluxo que o usa |

Regra de bolso: se dá para quebrar sem nenhum teste ficar vermelho, falta teste.

Ao acrescentar lógica a um módulo que estava fora da métrica de cobertura, **tire-o da lista
de exclusão** em `vite.config.ts`. Foi o que aconteceu com `lib/seed`: nasceu como dado fixo,
ganhou quatro funções e continuou invisível para a cobertura.

### O Cypress roda local

`npm run test:e2e` sobe o preview e roda a suíte inteira. Se aparecer
`bad option: --no-sandbox`, a causa é `ELECTRON_RUN_AS_NODE=1` no ambiente — o VS Code
define isso para o processo de extensões, e com ela o Electron do Cypress roda como Node puro
e recusa as próprias flags. O script já remove a variável com `env -u`; ao rodar o binário
direto, faça o mesmo.

### O Cypress cobre o sistema inteiro, não só o que acabou de ser feito

A cada feature nova, **todas as regras e funcionalidades do sistema continuam validadas pelo
Cypress** — a que entrou agora e as que já existiam. Feature nova que muda uma tela existente
sem revisar o spec dela é como as regressões chegam.

Antes de abrir o PR, para cada tela que a mudança tocou:

1. o spec dela ainda descreve o que a tela faz hoje?
2. cada regra nova ganhou cenário — inclusive as visuais, que são as que mais escapam?
3. algum seletor dependia de detalhe de markup que mudou?

Erros que já aconteceram e não podem repetir:

- **Seletor preso à tag.** `input[aria-label="…"]` quebrou quando o campo virou `textarea`.
  Prenda ao papel ou ao nome acessível (`[aria-label="…"]`), não à tag.
- **Índice em vez de nome.** `checkbox.eq(0)` apontava para outra questão, porque a lista é
  ordenada pelo enunciado. Escolha pelo nome do que se quer.
- **Leitura única do DOM.** `cy.get('body').then(...)` não tenta de novo, então falha em tela
  ainda carregando. Use os comandos que repetem (`cy.contains`, `cy.get`).
- **Cenário que o sistema não alcança.** Pedir 5 objetivas de um banco com 4 esvazia o banco,
  e aí não há o que trocar. Confira se o estado que o teste exige existe.
- **Agir antes do dado chegar.** Sortear com o banco ainda carregando encontra nada e culpa o
  banco. Espere o que a tela mostra quando está pronta.
- **`.as()` sobre uma query não congela valor.** Um alias criado de `cy.get(...).invoke(...)`
  é **reexecutado** ao ser lido com `cy.get('@alias')`, devolvendo o estado de agora e não o
  de antes. Para comparar antes e depois, guarde em variável dentro de `.then()`.
- **Recarregar a página mata escrita em voo.** `cy.visit` e `cy.reload` destroem a mutação
  que ainda não terminou. Navegue pelos links do próprio app quando o que importa é o efeito
  de algo que acabou de ser salvo.

## Estrutura

```
apps/web/     front-end React + Vite (N1 em localStorage)
apps/api/     back-end Express + MySQL (a partir da N2)
docs/         documentação — ver índice no readme.md
.plano/       plano de execução interno, fora do controle de versão
.ui_v1/       protótipo visual de referência, fora do controle de versão
```

A fronteira de dados fica em `apps/web/src/lib/repositories`. Nenhum componente chama
`localStorage` ou `fetch` direto — chama um hook, que chama um repositório. Trocar a fonte
de dados na N2 muda só a fábrica.

## Comandos

```bash
npm run dev        # ambiente local
npm run typecheck
npm test           # unitários com cobertura
npm run test:e2e   # Cypress
npm run build
```

## Documentos

| Documento | Quando consultar |
|---|---|
| [Modelo_de_Dados.md](docs/Modelo_de_Dados.md) | **Sempre**, antes de mexer em entidade |
| [Correctio_Requisitos_e_Telas.md](docs/Correctio_Requisitos_e_Telas.md) | Fonte da verdade de RFs, RNFs e telas |
| [Arquitetura.md](docs/Arquitetura.md) | Por que a arquitetura é assim |
| [Seguranca_e_LGPD.md](docs/Seguranca_e_LGPD.md) | Autorização, limites, LGPD |
| [CI_CD.md](docs/CI_CD.md) | O que o PR precisa passar |
| [Versionamento.md](docs/Versionamento.md) | Qual versão publicar |
| [Tour_Guiado.md](docs/Tour_Guiado.md) | Texto do tour por tela |

## Nomenclatura em inglês, sempre

Vale para **tudo que tem nome**, não só para o código: nome de branch, título e corpo de
commit, título e descrição de Pull Request, título de issue, nome de workflow e de job.

| | Exemplo |
|---|---|
| ✅ | `feat/class-bulk-import`, `fix: keep unknown fields on update` |
| ❌ | `feat/importacao-turmas`, `fix: nao descartar campos` |

O conteúdo explicativo — descrição de PR, corpo de issue, documentação em `docs/` — pode
ficar em português, porque é o idioma do grupo e da disciplina. O que precisa ser inglês é a
**nomenclatura**: aquilo que vira identificador, aparece em listagem ou é lido fora de
contexto.

## Regras de trabalho

- Nunca dar `git push` nem abrir PR sem pedido explícito. Commit local é o padrão.
- Sem `Co-Authored-By` nas mensagens de commit.
- Sem merge direto na `main`: tudo por Pull Request com aprovação.
