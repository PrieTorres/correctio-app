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
- **Sem comentário `//`.** Apenas JSDoc quando agrega, ou `TODO` quando inevitável.
- Comentário explica **por que**, nunca o que a linha já diz.
- Funções pequenas, com escopo definido e testáveis isoladamente.
- DRY: antes de criar componente, hook, util ou tipo, procure o que já existe.
- TypeScript estrito. Sem `any`; `unknown` na fronteira, com validação.
- Dado remoto vive no TanStack Query — nunca em `useState` nem em store global.
- Nada de `useEffect` para buscar dado.
- Modelar apenas estados válidos: união discriminada em vez de booleanos que combinam em
  estados impossíveis — **exceto** onde a Spec define outra forma, que prevalece.
- Acessibilidade não é etapa final: alvo de toque de 44 px, foco visível, ARIA correto.

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

## Regras de trabalho

- Nunca dar `git push` nem abrir PR sem pedido explícito. Commit local é o padrão.
- Sem `Co-Authored-By` nas mensagens de commit.
- Sem merge direto na `main`: tudo por Pull Request com aprovação.
