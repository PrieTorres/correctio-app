# Modelo de Dados — Contrato de Entidades

> **Documento normativo.** Define a estrutura obrigatória de cada entidade do Correctio.
> Vale para todo código do projeto — front-end, back-end e banco — e para qualquer pessoa
> ou ferramenta que gere código aqui.

## A regra

A base é a **seção 8 da Spec SGP Católica** (`docs/Spec SGP Católica.pdf`), confirmada pela
professora como referência de entidades e API.

| | |
|---|---|
| ✅ **Permitido** | Acrescentar campos novos a uma entidade. Acrescentar entidades novas. |
| ❌ **Proibido** | Remover uma chave definida pela Spec. Renomear uma chave. Trocar a estrutura de um campo — por exemplo transformar um `status` em timestamp, ou achatar um objeto aninhado. |

Se uma decisão de escopo do grupo entrar em conflito com a Spec, ela **não é aplicada em
silêncio**: o campo permanece no contrato, e a decisão é registrada neste documento antes de
qualquer código. Não tratar um campo é aceitável; removê-lo, não.

### Como os valores literais são escritos

| Origem | Estilo | Exemplos |
|---|---|---|
| **Definidos pela Spec** | exatamente como ela escreve, inclusive em português | `"objetiva"`, `"draft"`, `"invite_code"` |
| **Acrescentados pelo grupo** | `SCREAMING_SNAKE_CASE` em inglês | `"IN_PROGRESS"`, `"IMAGE_UPLOAD"` |

A diferença de caixa não é descuido: ela diz, de relance, qual valor pode ser renomeado e qual
está preso ao contrato. No código, os valores do grupo são expostos por objeto congelado
(`CORRECTION_STATUS.DONE`), para nenhum ponto de uso redigitar a string.

### Duas conversões que não contam como mudança de estrutura

1. **`Date` → string ISO 8601.** A Spec escreve `Date`; sobre JSON isso trafega como string.
   É serialização, não mudança de forma. No código: `type Timestamp = string`.
2. **Omitir segredo de servidor no cliente.** `User.passwordHash` existe na entidade
   persistida e **nunca** é enviado ao front. O cliente usa `AuthenticatedUser`, que é
   `Omit<User, 'passwordHash'>`. Omitir no DTO é correto; remover da entidade não seria.

---

## Entidades

Campos marcados **`+`** são acréscimos do grupo. Todo o resto vem da Spec e é intocável.

### User

```ts
{
  id: string
  role: "professor" | "estudante"   // só "professor" autentica no escopo atual
  fullName: string
  email: string                // único
  passwordHash: string         // servidor apenas
  createdAt: Date
  anonymizedAt?: Date
  emailVerifiedAt?: Date       // +  servidor apenas: quando alguém provou ler a caixa do e-mail
}
```

`emailVerifiedAt` é preenchido pelo login com o Google e pela redefinição de senha, as duas
formas de provar que se lê aquele e-mail. Enquanto está vazio, a senha pode ter sido criada por
quem digitou o e-mail de outra pessoa no cadastro: por isso, quando a dona do e-mail entra com o
Google, essa senha deixa de valer e as sessões da conta terminam (#40).

### RefreshToken

```ts
{
  id: string
  userId: string
  tokenHash: string
  deviceInfo?: string
  issuedAt: Date
  expiresAt: Date
  revokedAt?: Date
}
```

Entidade de servidor. Não é modelada no front. O token em si mora num cookie `httpOnly`; o banco
guarda só o hash (`docs/Seguranca_e_LGPD.md`, seção 7).

### AuthCode `+`

```ts
{
  id: string
  userId: string
  purpose: "PASSWORD_RESET" | "GOOGLE_SIGN_IN"
  codeHash: string             // SHA-256 do código; o código nunca é gravado
  expiresAt: Date
  usedAt?: Date                // preenchido no uso: cada código vale uma vez
  createdAt: Date
}
```

Entidade de servidor, acrescentada pelo grupo na #40. Guarda os códigos de uso único dos fluxos
de entrada: o link de redefinição de senha (30 minutos) e o código que leva o login com o Google
de volta ao endereço de onde partiu (2 minutos). Os valores de `purpose` são do grupo, por isso em
`SCREAMING_SNAKE_CASE`.

### Class

```ts
{
  id: string
  teacherId: string
  name: string
  subject: string
  term: string
  status: "active" | "archived"
  inviteCode: string           // único, regenerável
}
```

> Arquivar é `status: "archived"`, **não** um campo `archivedAt`. A Spec define enum.

### ClassEnrollment

```ts
{
  id: string
  classId: string
  studentId: string
  status: "active" | "removed"
  enrolledVia: "teacher" | "invite_code"
}
```

**Preservada.** Não é usada no escopo atual, onde o aluno não tem conta e é guardado como
`Student`. Continua no contrato porque é exatamente a junção que uma área do aluno precisa —
ver [Arquitetura, seção 9](Arquitetura.md).

### Student `+`

Acréscimo do grupo, substituindo `ClassEnrollment` mais um `User` de aluno.

```ts
{
  id: string
  classId: string
  fullName: string
  registration: string         // única dentro da turma
  email?: string
  anonymizedAt?: Date
  userId?: string              // + costura para a área do aluno
  removedAt?: Date             // + removido da turma (RF09): sai da lista, o registro e as notas ficam
}
```

> `userId` é o ponto de extensão: preenchê-lo liga este registro a um `User` com
> `role: "estudante"`, sem migrar nada. Fica vazio no escopo atual.

### Question

```ts
{
  id: string
  teacherId: string
  type: "objetiva" | "discursiva"
  statement: string            // Markdown básico
  tags: string[]
  alternatives?: { id: string; text: string }[]   // type = "objetiva", 2 a 5
  correctAlternativeId?: string                    // type = "objetiva"
  maxScore?: number                                // type = "discursiva"
  deletedAt?: Date             // soft-delete
  allowShuffleAlternatives: boolean  // +
  createdAt?: Date                   // +  ordena a lista do mais recente para o mais antigo
}
```

> **A alternativa correta é um id à parte**, não um booleano dentro de cada alternativa.
> `{ id, text, correct }` seria mudança de estrutura.
>
> A variante é modelada com campos opcionais, e não com união discriminada, porque essa é a
> forma da Spec. Para estreitar com segurança, use os predicados `isMultipleChoice` e
> `isOpenEnded` em `types/domain.ts`.

### Exam

```ts
{
  id: string
  teacherId: string
  title: string
  questions: { questionId: string; order: number; score: number; allowShuffleAlternatives: boolean /* + */ }[]
  status: "draft" | "ready" | "closed"
  description: string                 // +
  defaultShuffleQuestions: boolean    // +
  defaultShuffleAlternatives: boolean // +
}
```

> `order` é obrigatório em cada questão da prova. O status arquivado chama-se **`closed`**,
> não `archived`.

### Application

```ts
{
  id: string
  examId: string
  classId: string
  teacherId: string
  status: "draft" | "generated" | "closed"
  pdfUrl?: string              // PDF único consolidado, sobrescrito a cada regeneração
  date: Date                   // +
  gradesReleased: boolean      // +  libera a consulta pública
}
```

**`pdfUrl` na API.** O PDF traz o nome dos alunos, então não tem endereço público. No banco, a coluna `pdfUrl` guarda a chave do arquivo no Storage (`docs/adr/ADR-004`). A API responde com o caminho da rota de download, `/applications/:id/pdf`, relativo à raiz da API, que só entrega o arquivo com o token do professor dono. O nome e a forma do campo são os da Spec; o que muda é o conteúdo, que é uma rota protegida e não um link aberto.

### ExamVersion

```ts
{
  id: string
  applicationId: string
  versionNumber: number
  shuffleQuestions: boolean
  shuffleAlternatives: boolean
  withStudentIdentification: boolean
  layout: {
    questionOrder: string[]
    alternativeOrder: { questionId: string; printedOrder: string[] }[]
  }
  answerKeyPublished: boolean
  answerKeyPublishedAt?: Date
  publicCode: string           // acesso público ao gabarito
  qrCodePayload: string
}
```

> **`layout` é o campo mais importante do sistema.** É a ordem efetivamente impressa,
> materializada na geração. Sem ela o sistema não sabe qual letra impressa corresponde a
> qual alternativa armazenada, e **a correção é impossível**. Não é opcional e não é
> derivável depois.

### ExamAssignment

```ts
{
  id: string
  examVersionId: string
  studentId: string
  qrCodePayload: string
}
```

Substituída por `AnswerSheet`, que cobre folha com e sem identificação. `ExamAssignment`
permanece no contrato porque uma área do aluno pode voltar a precisar do vínculo direto
entre versão e aluno.

### AnswerSheet `+`

Acréscimo do grupo, substituindo `ExamAssignment`. Existe para toda folha impressa, com ou
sem identificação.

```ts
{
  id: string
  applicationId: string
  examVersionId: string
  studentId?: string
  sheetNumber: number          // curto e legível, para o professor organizar papel
  code: string                 // token opaco de 26 caracteres (130 bits)
}
```

> `sheetNumber` e `code` **nunca se confundem**. O primeiro é para organizar papel; o
> segundo é a única chave da consulta pública. Usar um número curto como chave tornaria
> todas as notas varreduráveis.

### Correction

```ts
{
  id: string
  examVersionId: string
  studentId?: string
  reportedStudentName?: string          // lido da folha física, quando sem identificação
  reportedStudentRegistration?: string
  objectiveResults: { questionId: string; correct: boolean; score: number; selectedAlternativeId?: string /* + */ }[]
  discursiveScores: { questionId: string; score: number }[]
  totalScore: number
  notes?: string
  confirmedAt: Date
  correctedBy: string                   // teacherId
  isAutomaticallyAssigned: boolean
  clientCorrectionId: string            // obrigatório na Spec; o site gera no servidor
  syncStatus: "pending" | "synced" | "error"   // o site grava "synced"
  answerSheetId: string                 // +
  source: "IMAGE_UPLOAD" | "MANUAL"     // +
  status: "IN_PROGRESS" | "DONE"        // +  espera nota de discursiva
  imageUrl?: string                     // +
}
```

> `selectedAlternativeId` é o acréscimo que resolve a queixa central do cliente: guardar
> **qual** alternativa o aluno marcou, não só se acertou.

### ActivityLog `+`

Acréscimo do grupo: o log geral do sistema. Registra o que falhou ou aconteceu, como uma
foto cujo QR não foi lido, e no N3 a trilha de auditoria (RF40). **Nunca guarda o conteúdo de
dado pessoal.**

```ts
{
  id: string
  teacherId?: string           // ausente em evento do sistema
  type: string                 // valor do grupo em SCREAMING_SNAKE_CASE, ex.: "QR_NOT_RECOGNIZED"
  entity: string               // ex.: "answer_sheet"
  entityId?: string
  details?: object             // referência e motivo, sem dado pessoal
  createdAt: Date
}
```

---

## Reservado para escopo futuro

O grupo decidiu não construir a área do aluno neste projeto. A decisão é de **escopo, não de
modelo**: nada foi removido do contrato, para que quem herdar o projeto possa construí-la sem
migração de dados.

| Elemento | Situação | Para que serve depois |
|---|---|---|
| `User.role = "estudante"` | no contrato, sem uso | conta do aluno |
| `ClassEnrollment` | no contrato, sem uso | matrícula do aluno na turma, com a origem do vínculo |
| `Student.userId` | opcional, sempre vazio | liga o registro de aluno a uma conta |
| `Class.inviteCode` | gerado, sem uso | aluno entrar na turma por código |
| `ExamAssignment` | no contrato, sem uso | vínculo direto versão ↔ aluno |
| `Correction.studentId` | preenchido quando há identificação | o aluno consultar as próprias correções |
| `Application.gradesReleased` | em uso | também controla o que o aluno veria |

> ⚠️ **Não apague nenhum destes por parecerem sem uso.** São ponto de extensão deliberado, e
> removê-los transforma "adicionar a área do aluno" em "migrar o banco".

## Nenhuma divergência em aberto

Todas as chaves da Spec estão no contrato. Onde o grupo decidiu não construir uma
funcionalidade, o campo permanece: o site não o trata, mas ele existe.

Isso vale inclusive para `Correction.clientCorrectionId` e `syncStatus`, que a Spec define
como **obrigatórios** e que servem à fila offline do app mobile. O site os grava em toda
correção: o servidor gera o `clientCorrectionId`, e o `syncStatus` é `"synced"`, porque
correção feita online já nasce sincronizada. Se um app migrar para esta API, ele manda os
seus, e a API preserva.

**Regra:** um campo sem requisito não é um campo que pode sumir. Não tratar é aceitável;
apagar não.

## Como o modelo vira tabelas (MySQL)

As migrations ficam em `apps/api/src/db/migrations`. Um teste confere, contra um MySQL de
verdade, que toda tabela tem todos os campos deste documento.

- **Tabelas no plural em snake_case** (`exam_questions`), e **colunas com o nome exato do
  campo** (`teacherId`), para nenhuma camada renomear o contrato.
- **Lista dentro de entidade vira tabela filha** quando é referenciada ou entra em relatório:
  `question_alternatives`, `question_tags`, `exam_questions`, `correction_objective_results` e
  `correction_discursive_scores`. A API devolve a mesma forma deste documento.
- **`ExamVersion.layout` fica em JSON:** é um retrato gravado uma vez e lido inteiro.
- **`createdAt` e `updatedAt` técnicos** em toda tabela que muda. Só saem na API os que este
  documento lista.
- **Remoção é sempre soft**, pelo campo de cada entidade. Nenhuma chave estrangeira apaga em
  cascata.
- **`Student.email` guarda o texto criptografado** (AES-256-GCM), nunca o endereço.

---

## Atualização parcial: a regra que protege os campos sem uso

Um campo que o cliente não conhece só sobrevive se **nada no caminho o sobrescrever**. Dois
pontos são críticos.

### Leitura validada não pode descartar

A validação de schema descarta chaves não declaradas por padrão — no Zod, `z.object()` faz
exatamente isso. Ler um registro e gravá-lo de volta apagaria tudo que o schema não conhece.

Em `lib/storage/collection.ts` a leitura reanexa as chaves desconhecidas depois de validar:
os valores validados vencem para as chaves que o schema possui, e o resto passa intacto.
Há teste travando isso, inclusive um de ida e volta.

**Validação existe para conferir a forma conhecida. Nunca pode ser o motivo de um dado
desaparecer.**

### Atualização é mesclagem, nunca substituição

| | |
|---|---|
| ✅ | `PATCH` com mesclagem: `{ ...registroAtual, ...camposEnviados }` |
| ❌ | `PUT` que substitui o documento inteiro pelo que o cliente mandou |

O cliente envia só os campos do formulário. Se a rota trocar o registro inteiro por esse
payload, todo campo que o cliente não conhece é apagado — silenciosamente, sem erro.

Vale para os repositórios do front (já implementado assim, com teste) e **principalmente
para o Express da N2**:

- `UPDATE` explicitando as colunas alteradas, nunca um `UPDATE` de todas as colunas a partir
  de um objeto montado no cliente
- `SELECT` das colunas necessárias; se reescrever a linha, ler antes e mesclar
- nenhuma rota de escrita monta a entidade só com o que veio na requisição

---

## Como verificar conformidade

Os tipos ficam em [`apps/web/src/types/domain.ts`](../apps/web/src/types/domain.ts) e os
schemas de validação em [`apps/web/src/lib/schemas/index.ts`](../apps/web/src/lib/schemas/index.ts).
Os dois devem espelhar este documento campo a campo.

Ao mexer em qualquer entidade:

1. Confira a tabela desta página antes de escrever o tipo.
2. Campo novo entra marcado como acréscimo do grupo.
3. Se algo da Spec parecer atrapalhar, **não remova** — deixe o campo e simplesmente não o
   trate. Campos sem uso são ponto de extensão, não código morto.
4. Toda escrita mescla com o registro atual. Nenhuma rota reconstrói a entidade só com o que
   veio do cliente — ver "Atualização parcial" acima.
4. O schema Zod acompanha o tipo na mesma mudança; os dois são a mesma verdade.
