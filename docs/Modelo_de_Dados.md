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
silêncio**: entra na seção "Divergências em aberto" no fim deste documento e vai para
validação com a professora.

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
  role: "professor"            // Spec prevê "estudante"; fora de escopo (ver divergências)
  fullName: string
  email: string                // único
  passwordHash: string         // servidor apenas
  createdAt: Date
  anonymizedAt?: Date
}
```

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

Entidade de servidor. Não é modelada no front — mas existe no contrato e o back-end da N2
deve implementá-la, mesmo se a autenticação passar a ser Firebase.

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

Substituída por `Student` no escopo do grupo — ver divergências.

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
}
```

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

Substituída por `AnswerSheet` — ver divergências.

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
  answerSheetId: string                 // +
  source: "upload_imagem" | "manual"    // +
  imageUrl?: string                     // +
}
```

> `selectedAlternativeId` é o acréscimo que resolve a queixa central do cliente: guardar
> **qual** alternativa o aluno marcou, não só se acertou.

---

## Divergências em aberto

Estas decisões do grupo removem elementos da Spec. Foram tomadas deliberadamente e estão
registradas na seção 9 do documento de requisitos, mas **não foram validadas explicitamente
com a professora**. Precisam ser confirmadas antes da N2.

| # | Divergência | Justificativa do grupo | Situação |
|---|---|---|---|
| 1 | `User.role` perdeu `"estudante"` | Sem área do aluno; o professor é o único usuário autenticado | Decisão de escopo de 28/08 |
| 2 | `ClassEnrollment` substituída por `Student` | Aluno não faz login, então não há matrícula de usuário em turma | Decisão de escopo de 28/08 |
| 3 | `ExamAssignment` substituída por `AnswerSheet` | Código por folha, não por aluno, para funcionar também sem identificação | Seção 6.1 do documento de requisitos |
| 4 | `Correction` sem `clientCorrectionId` e `syncStatus` | Não há app mobile nem fila offline | Decisão de escopo de 28/08 |
| 5 | `Class.inviteCode` mantido mas **sem uso** | O código de convite servia para o aluno se matricular sozinho, o que saiu do escopo | Campo preservado por exigência da Spec; confirmar se pode sair |

Nenhuma dessas remoções deve ser ampliada sem nova decisão registrada.

---

## Como verificar conformidade

Os tipos ficam em [`apps/web/src/types/domain.ts`](../apps/web/src/types/domain.ts) e os
schemas de validação em [`apps/web/src/lib/schemas/index.ts`](../apps/web/src/lib/schemas/index.ts).
Os dois devem espelhar este documento campo a campo.

Ao mexer em qualquer entidade:

1. Confira a tabela desta página antes de escrever o tipo.
2. Campo novo entra marcado como acréscimo do grupo.
3. Se algo da Spec parecer atrapalhar, **não remova** — registre em "Divergências em aberto".
4. O schema Zod acompanha o tipo na mesma mudança; os dois são a mesma verdade.
