# Dicionário de dados

Uma tabela por entidade do banco MySQL, com as colunas **como as migrations as criam**
(`apps/api/src/db/migrations`, da `0001` à `0004`). O desenho das mesmas tabelas está no
[diagrama entidade-relacionamento](er-diagram.md); o contrato que elas seguem é o
[Modelo de Dados](../Modelo_de_Dados.md).

## Como ler

- **Coluna:** o nome exato da coluna. As colunas usam o nome do campo do Modelo de Dados
  (`teacherId`, não `teacher_id`), então só aparece "corresponde a" quando a coluna não é um
  campo da entidade com o mesmo nome: nas tabelas filhas e nas colunas técnicas.
- **Tipo:** o tipo do MySQL, como o `INFORMATION_SCHEMA` o devolve. `TINYINT(1)` é booleano
  (`BOOLEAN` na migration; a API devolve `true` e `false`). `DATETIME(3)` guarda data e hora em
  UTC, com milissegundos. Os `id` são UUID, em `VARCHAR(36)`.
- **Chave:** `PK` (chave primária), `FK →` (chave estrangeira e a coluna que ela referencia) e
  `UK` (única). Unicidade de mais de uma coluna e índices ficam abaixo de cada tabela.
- **Nulo:** `sim` quando a coluna aceita `NULL`, que é como o banco guarda o campo opcional
  (`campo?`) do modelo.
- **`+`** marca o que o grupo acrescentou além da Spec SGP Católica. **Técnica** marca
  `createdAt` e `updatedAt` que o modelo não lista: o banco preenche, e a API não os devolve.
- **Arquivamento:** o campo que tira o registro de uso. Nenhuma linha de domínio é apagada e
  nenhuma chave estrangeira apaga em cascata.

O script `npm run docs:er-diagram` confere este dicionário contra o banco migrado e acusa coluna
que falta ou que sobra (ver [Como gerar de novo](er-diagram.md#como-gerar-de-novo)).

## Tabelas

| Tabela | Entidade do modelo | Origem | Arquivamento |
|---|---|---|---|
| [`users`](#users--user) | `User` | Spec | não arquiva; `anonymizedAt` anonimiza |
| [`refresh_tokens`](#refresh_tokens--refreshtoken) | `RefreshToken` | Spec | `revokedAt` |
| [`auth_codes`](#auth_codes--authcode) | `AuthCode` | **+** grupo (#40) | `usedAt` |
| [`classes`](#classes--class) | `Class` | Spec | `status = 'archived'` |
| [`students`](#students--student) | `Student` | **+** grupo | `removedAt` |
| [`class_enrollments`](#class_enrollments--classenrollment) | `ClassEnrollment` | Spec, **reservada para escopo futuro** | `status = 'removed'` |
| [`questions`](#questions--question) | `Question` | Spec | `deletedAt` |
| [`question_alternatives`](#question_alternatives--questionalternatives) | `Question.alternatives` | tabela filha | segue a questão |
| [`question_tags`](#question_tags--questiontags) | `Question.tags` | tabela filha | segue a questão |
| [`exams`](#exams--exam) | `Exam` | Spec | `status = 'closed'` |
| [`exam_questions`](#exam_questions--examquestions) | `Exam.questions` | tabela filha | segue a prova |
| [`applications`](#applications--application) | `Application` | Spec | `status = 'closed'` |
| [`exam_versions`](#exam_versions--examversion) | `ExamVersion` | Spec | segue a aplicação |
| [`exam_assignments`](#exam_assignments--examassignment) | `ExamAssignment` | Spec, **reservada para escopo futuro** | — |
| [`answer_sheets`](#answer_sheets--answersheet) | `AnswerSheet` | **+** grupo | segue a aplicação |
| [`corrections`](#corrections--correction) | `Correction` | Spec | não arquiva |
| [`correction_objective_results`](#correction_objective_results--correctionobjectiveresults) | `Correction.objectiveResults` | tabela filha | segue a correção |
| [`correction_discursive_scores`](#correction_discursive_scores--correctiondiscursivescores) | `Correction.discursiveScores` | tabela filha | segue a correção |
| [`activity_logs`](#activity_logs--activitylog) | `ActivityLog` | **+** grupo | não arquiva: só recebe inserção |
| [`sheet_images`](#sheet_images--sheetimage) | `SheetImage` | **+** grupo (#47) | não arquiva: só recebe inserção |

As tabelas internas do Kysely (`kysely_migration` e `kysely_migration_lock`), que registram quais
migrations já rodaram, não fazem parte do modelo e ficam fora daqui e do diagrama.

---

### `users` — User

A conta de quem entra no sistema. No escopo atual, só professor.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da conta (UUID). |
| `role` | `ENUM('professor','estudante')` | | não | Papel da conta. Só `professor` autentica; `estudante` está reservado para escopo futuro. |
| `fullName` | `VARCHAR(160)` | | não | Nome completo, mostrado no painel e no perfil. |
| `email` | `VARCHAR(254)` | UK | não | E-mail de login, único no sistema. |
| `passwordHash` | `VARCHAR(255)` | | não | Hash da senha. Nunca sai do servidor. |
| `createdAt` | `DATETIME(3)` | | não | Quando a conta foi criada. Padrão: a hora da inserção. |
| `anonymizedAt` | `DATETIME(3)` | | sim | Quando a conta foi anonimizada (LGPD). Conta anonimizada não abre sessão. |
| `emailVerifiedAt` | `DATETIME(3)` | | sim | **+** (migration `0002`). Quando alguém provou ler a caixa do e-mail, pelo Google ou pela redefinição de senha. Só no servidor. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha, atualizada pelo próprio MySQL. |

**Arquivamento:** a conta não é arquivada; `anonymizedAt` a anonimiza.

### `refresh_tokens` — RefreshToken

As sessões abertas. O token mora num cookie `httpOnly`; o banco guarda só o hash.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da sessão (UUID). |
| `userId` | `VARCHAR(36)` | FK → `users.id` | não | Dono da sessão. |
| `tokenHash` | `CHAR(64)` | UK | não | SHA-256 do token, em hexadecimal. Ler a tabela não dá um token utilizável. |
| `deviceInfo` | `VARCHAR(255)` | | sim | O navegador (user agent) que abriu a sessão, para o professor distinguir as sessões. |
| `issuedAt` | `DATETIME(3)` | | não | Quando a sessão foi emitida. |
| `expiresAt` | `DATETIME(3)` | | não | Quando a sessão deixa de valer. |
| `revokedAt` | `DATETIME(3)` | | sim | Quando o token foi revogado: na renovação, em que o token usado dá lugar a um novo, no logout ou quando todas as sessões da conta são encerradas. |

**Arquivamento:** `revokedAt` encerra o token; `expiresAt` o encerra sozinho.

### `auth_codes` — AuthCode

**+** Tabela do grupo (migration `0002`, #40): os códigos de uso único do login.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador do código (UUID). |
| `userId` | `VARCHAR(36)` | FK → `users.id` | não | Conta a que o código dá acesso. |
| `purpose` | `ENUM('PASSWORD_RESET','GOOGLE_SIGN_IN')` | | não | Para que serve: o link de redefinição de senha (30 minutos) ou o retorno do login com o Google (2 minutos). |
| `codeHash` | `CHAR(64)` | UK | não | SHA-256 do código. O código em si nunca é gravado. |
| `expiresAt` | `DATETIME(3)` | | não | Quando o código deixa de valer. |
| `usedAt` | `DATETIME(3)` | | sim | Quando o código foi usado. Preenchido, o código não vale de novo. |
| `createdAt` | `DATETIME(3)` | | não | Quando o código foi emitido. Padrão: a hora da inserção. |

**Arquivamento:** `usedAt`; o código vencido (`expiresAt`) também não vale.

### `classes` — Class

As turmas do professor.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da turma (UUID). |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | não | Professor dono da turma. |
| `name` | `VARCHAR(120)` | | não | Nome da turma. |
| `subject` | `VARCHAR(120)` | | não | Disciplina. |
| `term` | `VARCHAR(40)` | | não | Período letivo, como `2026/2`. |
| `status` | `ENUM('active','archived')` | | não | Situação da turma. Padrão: `active`. |
| `inviteCode` | `VARCHAR(32)` | UK | não | Código de convite, gerado na criação. Reservado para escopo futuro: o aluno entrar na turma por código. |
| `createdAt` | `DATETIME(3)` | | não | **Técnica.** Quando a turma foi criada. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

**Índice:** `idx_classes_teacher_status (teacherId, status)`, a lista de turmas do professor por
situação.<br>
**Arquivamento:** `status = 'archived'`.

### `students` — Student

**+** Entidade do grupo: o aluno guardado na turma, sem conta, no lugar de `ClassEnrollment` mais
um `User` de aluno.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador do aluno (UUID). |
| `classId` | `VARCHAR(36)` | FK → `classes.id` | não | Turma do aluno. |
| `fullName` | `VARCHAR(160)` | | não | Nome completo. Substituído na anonimização. |
| `registration` | `VARCHAR(40)` | | não | Matrícula, única dentro da turma. Substituída na anonimização. |
| `email` | `VARCHAR(512)` | | sim | E-mail **criptografado** (AES-256-GCM); a coluna nunca guarda o endereço em texto. |
| `anonymizedAt` | `DATETIME(3)` | | sim | Quando o aluno foi anonimizado (RF38, irreversível). |
| `userId` | `VARCHAR(36)` | FK → `users.id` | sim | **+** Reservado para escopo futuro: liga o aluno a uma conta com `role = 'estudante'`. Sempre vazio hoje. |
| `removedAt` | `DATETIME(3)` | | sim | **+** Quando o aluno saiu da turma (RF09). O registro e as notas ficam. |
| `createdAt` | `DATETIME(3)` | | não | **Técnica.** Quando o aluno foi cadastrado. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

**Unicidade:** `uq_students_class_registration (classId, registration)`, a matrícula não se
repete na turma.<br>
**Arquivamento:** `removedAt`; `anonymizedAt` apaga os dados pessoais e mantém as notas.

### `class_enrollments` — ClassEnrollment

**Reservada para escopo futuro.** A matrícula de um aluno com conta numa turma. Existe no banco
sem uso, para a área do aluno não precisar de migração.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da matrícula (UUID). |
| `classId` | `VARCHAR(36)` | FK → `classes.id` | não | Turma. |
| `studentId` | `VARCHAR(36)` | FK → `users.id` | não | Conta do aluno. Aponta para `users`, como na Spec, em que o aluno com conta é um `User`. |
| `status` | `ENUM('active','removed')` | | não | Situação da matrícula. |
| `enrolledVia` | `ENUM('teacher','invite_code')` | | não | Como o aluno entrou: pelo professor ou pelo código de convite. |

**Arquivamento:** `status = 'removed'`.

### `questions` — Question

O banco de questões do professor.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da questão (UUID). |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | não | Professor dono da questão. |
| `type` | `ENUM('objetiva','discursiva')` | | não | Tipo da questão. |
| `statement` | `TEXT` | | não | Enunciado, em Markdown básico. |
| `correctAlternativeId` | `VARCHAR(36)` | | sim | Objetiva: o `id` da alternativa correta em `question_alternatives`. Vazio na discursiva. |
| `maxScore` | `DECIMAL(6,2)` | | sim | Discursiva: a nota máxima. Vazio na objetiva. |
| `deletedAt` | `DATETIME(3)` | | sim | Quando a questão foi excluída (exclusão lógica). |
| `allowShuffleAlternatives` | `TINYINT(1)` | | não | **+** Se as alternativas podem ser embaralhadas. Padrão: verdadeiro. |
| `createdAt` | `DATETIME(3)` | | não | **+** Quando a questão foi criada; ordena a lista do mais recente para o mais antigo. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

`Question.alternatives` e `Question.tags` não são colunas: viraram as tabelas filhas
`question_alternatives` e `question_tags`.<br>
**Índice:** `idx_questions_teacher_deleted (teacherId, deletedAt)`, o banco do professor sem as
excluídas.<br>
**Arquivamento:** `deletedAt`.

### `question_alternatives` — Question.alternatives

Tabela filha: cada linha é um item de `Question.alternatives` (`{ id, text }`), de 2 a 5 por
questão objetiva. Editar a questão regrava as alternativas dela.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `questionId` | `VARCHAR(36)` | PK, FK → `questions.id` | não | A questão. Corresponde ao `Question.id` dono da lista. |
| `id` | `VARCHAR(36)` | PK | não | Corresponde a `alternatives[].id`: o identificador que `correctAlternativeId` e o `layout` citam. |
| `text` | `TEXT` | | não | Corresponde a `alternatives[].text`: o texto da alternativa. |
| `position` | `TINYINT UNSIGNED` | | não | **Técnica.** A posição na lista, a partir de 0, para devolver as alternativas na ordem cadastrada. |

**Chave primária:** `(questionId, id)`.<br>
**Arquivamento:** segue a questão.

### `question_tags` — Question.tags

Tabela filha: cada linha é uma etiqueta de `Question.tags`. Editar a questão regrava as
etiquetas dela.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `questionId` | `VARCHAR(36)` | PK, FK → `questions.id` | não | A questão. Corresponde ao `Question.id` dono da lista. |
| `tag` | `VARCHAR(80)` | PK | não | Corresponde a um item de `tags[]`: a etiqueta. |

**Chave primária:** `(questionId, tag)`, a mesma etiqueta não se repete na questão.<br>
**Índice:** `idx_question_tags_tag (tag)`, o filtro do banco de questões por etiqueta.<br>
**Arquivamento:** segue a questão.

### `exams` — Exam

As provas montadas a partir do banco de questões.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da prova (UUID). |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | não | Professor dono da prova. |
| `title` | `VARCHAR(200)` | | não | Título da prova. |
| `status` | `ENUM('draft','ready','closed')` | | não | Situação da prova. Padrão: `draft`. |
| `description` | `TEXT` | | não | **+** Descrição livre da prova. |
| `defaultShuffleQuestions` | `TINYINT(1)` | | não | **+** Sugestão de embaralhar as questões ao aplicar. Padrão: verdadeiro. |
| `defaultShuffleAlternatives` | `TINYINT(1)` | | não | **+** Sugestão de embaralhar as alternativas ao aplicar. Padrão: verdadeiro. |
| `createdAt` | `DATETIME(3)` | | não | **Técnica.** Quando a prova foi criada. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

`Exam.questions` não é coluna: virou a tabela filha `exam_questions`.<br>
**Índice:** `idx_exams_teacher_status (teacherId, status)`.<br>
**Arquivamento:** `status = 'closed'` (não `archived`).

### `exam_questions` — Exam.questions

Tabela filha: cada linha é um item de `Exam.questions`. Editar a prova regrava a lista.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `examId` | `VARCHAR(36)` | PK, FK → `exams.id` | não | A prova. Corresponde ao `Exam.id` dono da lista. |
| `questionId` | `VARCHAR(36)` | PK, FK → `questions.id` | não | Corresponde a `questions[].questionId`: a questão do banco. |
| `order` | `SMALLINT UNSIGNED` | | não | Corresponde a `questions[].order`: a posição da questão na prova, obrigatória. |
| `score` | `DECIMAL(6,2)` | | não | Corresponde a `questions[].score`: quanto a questão vale nesta prova. |
| `allowShuffleAlternatives` | `TINYINT(1)` | | não | **+** Corresponde a `questions[].allowShuffleAlternatives`: se as alternativas podem ser embaralhadas nesta prova. Padrão: verdadeiro. |

**Chave primária:** `(examId, questionId)`, a questão entra uma vez na prova.<br>
**Unicidade:** `uq_exam_questions_order (examId, order)`, duas questões não ocupam a mesma
posição.<br>
**Arquivamento:** segue a prova.

### `applications` — Application

A aplicação de uma prova a uma turma, numa data.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da aplicação (UUID). |
| `examId` | `VARCHAR(36)` | FK → `exams.id` | não | Prova aplicada. |
| `classId` | `VARCHAR(36)` | FK → `classes.id` | não | Turma que faz a prova. |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | não | Professor dono da aplicação. |
| `status` | `ENUM('draft','generated','closed')` | | não | Situação: rascunho, PDF gerado ou encerrada. Padrão: `draft`. |
| `pdfUrl` | `VARCHAR(2048)` | | sim | A chave do PDF consolidado no Storage (ADR-004), sobrescrita a cada regeneração. A API devolve a rota protegida de download, não um link aberto. |
| `date` | `DATETIME(3)` | | não | **+** Data da aplicação. |
| `gradesReleased` | `TINYINT(1)` | | não | **+** Se as notas estão liberadas na consulta pública. Padrão: falso. |
| `createdAt` | `DATETIME(3)` | | não | **Técnica.** Quando a aplicação foi criada. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

**Índice:** `idx_applications_teacher_status (teacherId, status)`.<br>
**Arquivamento:** `status = 'closed'`.

### `exam_versions` — ExamVersion

As versões impressas de uma aplicação, materializadas na geração do PDF. Regenerar a aplicação,
enquanto ela não tem correção, troca as versões e as folhas.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da versão (UUID). |
| `applicationId` | `VARCHAR(36)` | FK → `applications.id` | não | Aplicação a que a versão pertence. |
| `versionNumber` | `SMALLINT UNSIGNED` | | não | Número da versão na aplicação, a partir de 1. |
| `shuffleQuestions` | `TINYINT(1)` | | não | Se esta versão embaralhou as questões. |
| `shuffleAlternatives` | `TINYINT(1)` | | não | Se esta versão embaralhou as alternativas. |
| `withStudentIdentification` | `TINYINT(1)` | | não | Se as folhas saem com o nome do aluno. |
| `layout` | `JSON` | | não | A ordem efetivamente impressa: `{ questionOrder: string[], alternativeOrder: { questionId: string, printedOrder: string[] }[] }`. `questionOrder` lista os `questionId` na ordem do papel; `printedOrder` lista os `id` de alternativa na ordem das letras. Sem ele, a correção é impossível. |
| `answerKeyPublished` | `TINYINT(1)` | | não | Se o gabarito está publicado na consulta pública. Padrão: falso. |
| `answerKeyPublishedAt` | `DATETIME(3)` | | sim | Quando o gabarito foi publicado. |
| `publicCode` | `VARCHAR(64)` | UK | não | Código de acesso público ao gabarito da versão. |
| `qrCodePayload` | `VARCHAR(512)` | | não | O conteúdo do QR Code da versão. |

**Unicidade:** `uq_exam_versions_number (applicationId, versionNumber)`.<br>
**Arquivamento:** segue a aplicação.

### `exam_assignments` — ExamAssignment

**Reservada para escopo futuro.** O vínculo direto entre uma versão e um aluno com conta.
Substituída por `answer_sheets` no escopo atual e mantida sem uso para a área do aluno.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador do vínculo (UUID). |
| `examVersionId` | `VARCHAR(36)` | FK → `exam_versions.id` | não | Versão entregue ao aluno. |
| `studentId` | `VARCHAR(36)` | FK → `users.id` | não | Conta do aluno. Aponta para `users`, como na Spec. |
| `qrCodePayload` | `VARCHAR(512)` | | não | O conteúdo do QR Code do vínculo. |

**Arquivamento:** não se aplica; a tabela não tem uso.

### `answer_sheets` — AnswerSheet

**+** Entidade do grupo: uma linha por folha impressa, com ou sem identificação do aluno.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da folha (UUID). |
| `applicationId` | `VARCHAR(36)` | FK → `applications.id` | não | Aplicação da folha. |
| `examVersionId` | `VARCHAR(36)` | FK → `exam_versions.id` | não | Versão impressa nesta folha. |
| `studentId` | `VARCHAR(36)` | FK → `students.id` | sim | Aluno da folha identificada. Vazio na folha sem identificação. |
| `sheetNumber` | `INT UNSIGNED` | | não | Número curto e legível, para o professor organizar o papel. Nunca serve de chave de consulta. |
| `code` | `VARCHAR(32)` | UK | não | Token opaco de 26 caracteres (130 bits): a única chave da consulta pública da nota. |
| `answerCardVersion` | `SMALLINT UNSIGNED` | | não | **+** (migration `0003`). A geometria do cartão-resposta com que a folha foi impressa (`ANSWER_CARD.version`). Padrão: 1, a primeira geometria. |

**Unicidade:** `uq_answer_sheets_number (applicationId, sheetNumber)`.<br>
**Arquivamento:** segue a aplicação.

### `corrections` — Correction

A correção de uma folha, automática pela foto ou manual.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da correção (UUID). |
| `examVersionId` | `VARCHAR(36)` | FK → `exam_versions.id` | não | Versão corrigida, cujo `layout` traduz as marcações. |
| `studentId` | `VARCHAR(36)` | FK → `students.id` | sim | Aluno da correção. Vazio enquanto a folha sem identificação não for atribuída. |
| `reportedStudentName` | `VARCHAR(160)` | | sim | Nome escrito na folha física, quando ela não tem identificação. |
| `reportedStudentRegistration` | `VARCHAR(40)` | | sim | Matrícula escrita na folha física, quando ela não tem identificação. |
| `totalScore` | `DECIMAL(7,2)` | | não | Nota total da folha. |
| `notes` | `TEXT` | | sim | Observações do professor. |
| `confirmedAt` | `DATETIME(3)` | | não | Quando a correção foi confirmada. |
| `correctedBy` | `VARCHAR(36)` | FK → `users.id` | não | Professor que corrigiu (o `teacherId`). |
| `isAutomaticallyAssigned` | `TINYINT(1)` | | não | Se o aluno veio da própria folha identificada (verdadeiro) ou foi atribuído pelo professor (falso). |
| `clientCorrectionId` | `VARCHAR(64)` | UK | não | Identificador da correção no cliente, obrigatório na Spec. O site gera no servidor; um app preserva o seu. |
| `syncStatus` | `ENUM('pending','synced','error')` | | não | Situação da sincronização, obrigatória na Spec. O site grava `synced`. |
| `answerSheetId` | `VARCHAR(36)` | FK → `answer_sheets.id`, UK | não | **+** A folha corrigida. Única: cada folha tem no máximo uma correção. |
| `source` | `ENUM('IMAGE_UPLOAD','MANUAL')` | | não | **+** Origem da correção: foto da folha ou lançamento manual. |
| `status` | `ENUM('IN_PROGRESS','DONE')` | | não | **+** `IN_PROGRESS` enquanto falta a nota de alguma discursiva; `DONE` quando completa. |
| `imageUrl` | `VARCHAR(2048)` | | sim | **+** Referência à foto da folha, guardada fora do banco (ADR-004), quando a correção veio de foto. |
| `createdAt` | `DATETIME(3)` | | não | **Técnica.** Quando a correção foi criada. |
| `updatedAt` | `DATETIME(3)` | | não | **Técnica.** Última alteração da linha. |

`Correction.objectiveResults` e `Correction.discursiveScores` não são colunas: viraram as
tabelas filhas `correction_objective_results` e `correction_discursive_scores`.<br>
**Arquivamento:** não arquiva; a correção fica com a folha.

### `correction_objective_results` — Correction.objectiveResults

Tabela filha: cada linha é um item de `Correction.objectiveResults`, o resultado de uma questão
objetiva. É daqui que sai a estatística de qual alternativa foi mais marcada. Regravar a correção
regrava as linhas dela.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `correctionId` | `VARCHAR(36)` | PK, FK → `corrections.id` | não | A correção. Corresponde ao `Correction.id` dono da lista. |
| `questionId` | `VARCHAR(36)` | PK, FK → `questions.id` | não | Corresponde a `objectiveResults[].questionId`: a questão. |
| `correct` | `TINYINT(1)` | | não | Corresponde a `objectiveResults[].correct`: se o aluno acertou. |
| `score` | `DECIMAL(6,2)` | | não | Corresponde a `objectiveResults[].score`: a nota obtida na questão. |
| `selectedAlternativeId` | `VARCHAR(36)` | | sim | **+** Corresponde a `objectiveResults[].selectedAlternativeId`: qual alternativa o aluno marcou. Vazio quando não marcou nenhuma. |

**Chave primária:** `(correctionId, questionId)`.<br>
**Índice:** `idx_objective_results_question (questionId, selectedAlternativeId)`, a contagem de
marcações por alternativa.<br>
**Arquivamento:** segue a correção.

### `correction_discursive_scores` — Correction.discursiveScores

Tabela filha: cada linha é um item de `Correction.discursiveScores`, a nota que o professor deu a
uma questão discursiva.

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `correctionId` | `VARCHAR(36)` | PK, FK → `corrections.id` | não | A correção. Corresponde ao `Correction.id` dono da lista. |
| `questionId` | `VARCHAR(36)` | PK, FK → `questions.id` | não | Corresponde a `discursiveScores[].questionId`: a questão. |
| `score` | `DECIMAL(6,2)` | | não | Corresponde a `discursiveScores[].score`: a nota dada. |

**Chave primária:** `(correctionId, questionId)`.<br>
**Arquivamento:** segue a correção.

### `activity_logs` — ActivityLog

**+** Entidade do grupo: o log geral do sistema, como uma foto cujo QR não foi lido. **Nunca
guarda o conteúdo de dado pessoal.**

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador do evento (UUID). |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | sim | Professor envolvido. Vazio em evento do sistema. |
| `type` | `VARCHAR(64)` | | não | Tipo do evento, em `SCREAMING_SNAKE_CASE`, como `SHEET_READ_FAILED` (a leitura de uma foto que falhou, #47). |
| `entity` | `VARCHAR(64)` | | não | Registro envolvido, como `application`. |
| `entityId` | `VARCHAR(36)` | | sim | Identificador do registro envolvido. |
| `details` | `JSON` | | sim | Referência e motivo do evento, sem dado pessoal. Objeto livre. |
| `createdAt` | `DATETIME(3)` | | não | Quando o evento aconteceu. Padrão: a hora da inserção. |

**Índice:** `idx_activity_logs_teacher_created (teacherId, createdAt)`, os eventos do professor
em ordem de tempo.<br>
**Arquivamento:** não arquiva; o log só recebe inserção.

---

### `sheet_images` — SheetImage

**+** Entidade do grupo (#47): uma linha por foto de folha enviada para correção. O arquivo fica
no Cloud Storage ([ADR-004](../adr/ADR-004-answer-sheet-image-storage.md)), e a linha guarda onde
ele está e como a leitura terminou. É ela que deixa a foto ser servida só ao professor dono, a
correção apontar a foto de que foi confirmada (`corrections.imageUrl`) e o limite diário de envios
ser contado mesmo depois de a API reiniciar ([Seguranca_e_LGPD.md](../Seguranca_e_LGPD.md)).

| Coluna | Tipo | Chave | Nulo | Descrição |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | não | Identificador da foto (UUID), o `imageId` que a API devolve na leitura. |
| `applicationId` | `VARCHAR(36)` | FK → `applications.id` | não | Aplicação para a qual a foto foi enviada. |
| `teacherId` | `VARCHAR(36)` | FK → `users.id` | não | Professor que enviou; só ele recebe a foto de volta. |
| `storageKey` | `VARCHAR(255)` | | não | Caminho do arquivo no Storage: `answer-sheets/<aplicação>/<foto>.<extensão>`. |
| `contentType` | `VARCHAR(32)` | | não | Tipo do arquivo, conferido pelos primeiros bytes: `image/jpeg`, `image/png` ou `image/webp`. |
| `byteSize` | `INT UNSIGNED` | | não | Tamanho do arquivo em bytes, até 10 MB. Soma no limite diário. |
| `status` | `VARCHAR(24)` | | não | Como a leitura terminou: `READ`, `QR_NOT_RECOGNIZED` ou `READ_FAILED` (`SHEET_READING`). |
| `answerSheetId` | `VARCHAR(36)` | | sim | Folha reconhecida pelo QR Code. Vazio quando o QR não foi lido: o professor escolhe a folha na revisão (RF30). |
| `createdAt` | `DATETIME(3)` | | não | Quando a foto chegou. Padrão: a hora da inserção. |

**Índices:** `idx_sheet_images_teacher_created (teacherId, createdAt)`, que conta o limite diário
do professor, e `idx_sheet_images_application (applicationId, createdAt)`, as fotos da aplicação
em ordem de tempo.<br>
**Arquivamento:** não arquiva; a linha só recebe inserção, e a leitura não vira nota até o
professor confirmar a revisão (RF28).
