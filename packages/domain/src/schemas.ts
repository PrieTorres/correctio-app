/**
 * Domain schemas.
 *
 * Field names and shapes follow `docs/Modelo_de_Dados.md`. The same
 * definitions validate data read from `localStorage` today and the HTTP
 * responses, plus the Express request bodies, later.
 */
import { z } from 'zod';
import { collationKey } from './collation';
import { CORRECTION_PROGRESS, CORRECTION_SOURCE, CORRECTION_STATUS } from './domain';

const id = z.string().min(1);
const timestamp = z.string().datetime();

export const userRoleSchema = z.enum(['professor', 'estudante']);

export const authenticatedUserSchema = z.object({
  id,
  role: userRoleSchema,
  fullName: z.string().min(1).max(160),
  email: z.string().email(),
  createdAt: timestamp,
  anonymizedAt: timestamp.optional(),
});

/**
 * The longest address the e-mail standards allow, for teachers and students
 * alike. The API stores the student e-mail encrypted, and the encrypted text of
 * a longer one would not fit its column, so the limit is part of the contract
 * rather than a server detail.
 */
const MAX_EMAIL_LENGTH = 254;

const email = z.string().trim().email('Informe um e-mail válido').max(MAX_EMAIL_LENGTH);

/**
 * At least 8 characters (RF01 and the specification, Feature 1). The ceiling
 * keeps a megabyte "password" from tying up the hash function.
 */
const newPassword = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres')
  .max(128, 'A senha pode ter no máximo 128 caracteres');

/**
 * Sign-in checks only that a password was typed: the length rule belongs to
 * choosing a password, and repeating it here would tell a guesser the policy.
 */
export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha').max(128),
});

/** What `POST /auth/register` receives; the confirmation is a concern of the form only. */
export const signUpRequestSchema = z.object({
  fullName: z.string().trim().min(1, 'Informe seu nome completo').max(160),
  email,
  password: newPassword,
});

const confirmPassword = z.string().min(1, 'Confirme a senha');

function passwordsMatch(data: { password: string; confirmPassword: string }): boolean {
  return data.password === data.confirmPassword;
}

const PASSWORDS_DIFFER = { message: 'As senhas não coincidem', path: ['confirmPassword'] };

export const signUpSchema = signUpRequestSchema
  .extend({ confirmPassword })
  .refine(passwordsMatch, PASSWORDS_DIFFER);

export const forgotPasswordSchema = z.object({ email });

/** What `POST /auth/reset-password` receives: the code of the e-mail link and the new password. */
export const resetPasswordRequestSchema = z.object({
  code: z.string().min(1).max(100),
  password: newPassword,
});

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword })
  .refine(passwordsMatch, PASSWORDS_DIFFER);

/**
 * What `POST /auth/google/exchange` receives: the one-time code Google sign-in
 * left in the address, and the value only the browser that started it holds.
 */
export const googleExchangeSchema = z.object({
  code: z.string().min(1).max(100),
  binding: z.string().min(1).max(100),
});

/** The answer of every route that signs someone in. */
export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: authenticatedUserSchema,
});

export const classStatusSchema = z.enum(['active', 'archived']);

export const classSchema = z.object({
  id,
  teacherId: id,
  name: z.string().min(1, 'Informe o nome da turma').max(120),
  subject: z.string().min(1, 'Informe a disciplina').max(120),
  term: z.string().min(1, 'Informe o período').max(40),
  status: classStatusSchema,
  inviteCode: z.string().min(1),
});

export const classInputSchema = classSchema.pick({ name: true, subject: true, term: true });

/**
 * An e-mail the teacher may leave out.
 *
 * `.optional()` on its own admits `undefined` and nothing else, so the empty
 * string that a blank field submits reached the address check and came back as
 * "E-mail inválido" — on the one field the form calls optional. Here an empty
 * field means absent, said once instead of at every call site.
 */
const optionalEmail = z
  .union([
    z.literal(''),
    z
      .string()
      .email('E-mail inválido')
      .max(MAX_EMAIL_LENGTH, `O e-mail pode ter no máximo ${MAX_EMAIL_LENGTH} caracteres`),
  ])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/**
 * The limits of a student's name and registration, with the message the
 * screens show. The import preview checks every pasted line against this
 * schema, and the API refuses the whole list over one line beyond either
 * limit, so the preview has to say it in Portuguese before anything is sent.
 */
const MAX_STUDENT_NAME_LENGTH = 160;
const MAX_REGISTRATION_LENGTH = 40;

export const studentSchema = z.object({
  id,
  classId: id,
  fullName: z
    .string()
    .min(1, 'Informe o nome do aluno')
    .max(MAX_STUDENT_NAME_LENGTH, `O nome pode ter no máximo ${MAX_STUDENT_NAME_LENGTH} caracteres`),
  registration: z
    .string()
    .min(1, 'Informe a matrícula')
    .max(MAX_REGISTRATION_LENGTH, `A matrícula pode ter no máximo ${MAX_REGISTRATION_LENGTH} caracteres`),
  email: optionalEmail,
  anonymizedAt: timestamp.optional(),
  userId: id.optional(),
  removedAt: timestamp.optional(),
});

export const enrollmentStatusSchema = z.enum(['active', 'removed']);

export const classEnrollmentSchema = z.object({
  id,
  classId: id,
  studentId: id,
  status: enrollmentStatusSchema,
  enrolledVia: z.enum(['teacher', 'invite_code']),
});

export const studentInputSchema = studentSchema.pick({
  fullName: true,
  registration: true,
  email: true,
});

export const questionTypeSchema = z.enum(['objetiva', 'discursiva']);

export const alternativeSchema = z.object({
  id,
  text: z.string().min(1, 'A alternativa não pode ficar vazia'),
});

export const questionSchema = z
  .object({
    id,
    teacherId: id,
    type: questionTypeSchema,
    statement: z.string().min(1, 'Informe o enunciado'),
    tags: z.array(z.string().min(1)),
    alternatives: z
      .array(alternativeSchema)
      .min(2, 'Uma questão objetiva precisa de ao menos 2 alternativas')
      .max(5, 'Máximo de 5 alternativas')
      .optional(),
    correctAlternativeId: id.optional(),
    maxScore: z.number().positive('A nota máxima precisa ser maior que zero').optional(),
    deletedAt: timestamp.optional(),
    allowShuffleAlternatives: z.boolean(),
    createdAt: timestamp.optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === 'objetiva') {
      if (question.alternatives === undefined || question.correctAlternativeId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Questão objetiva exige alternativas e uma alternativa correta',
        });
        return;
      }
      const known = question.alternatives.some((item) => item.id === question.correctAlternativeId);
      if (!known) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['correctAlternativeId'],
          message: 'A alternativa correta precisa ser uma das alternativas da questão',
        });
      }
      return;
    }

    if (question.maxScore === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxScore'],
        message: 'Questão discursiva exige nota máxima',
      });
    }
  });

/**
 * The largest score `DECIMAL(6, 2)` holds, the column of every score in the
 * database. Past it the save failed with a 500 (#184).
 */
export const MAX_SCORE = 9999.99;

/** The length of `question_tags.tag`, a `VARCHAR(80)`: a longer tag failed the save with a 500 (#184). */
export const MAX_TAG_LENGTH = 80;

/**
 * Whether a score fits the two decimals of its column. MySQL rounds a third
 * decimal away without an error, so 0.001 was stored as 0, a maximum score
 * the bank then refused to read back, and the whole list stopped loading
 * (#184). The tolerance absorbs the binary error of values such as 0.29.
 */
function hasAtMostTwoDecimals(value: number): boolean {
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

const questionMaxScore = z
  .number()
  .positive('A nota máxima precisa ser maior que zero')
  .max(MAX_SCORE, 'A nota máxima pode ser no máximo 9999,99')
  .refine(hasAtMostTwoDecimals, 'A nota máxima aceita no máximo 2 casas decimais');

/**
 * One tag of a question, trimmed. Shared with the tag field, so it refuses a
 * long tag with the message the API answers.
 */
export const questionTagSchema = z
  .string()
  .trim()
  .min(1, 'A tag não pode ficar vazia')
  .max(MAX_TAG_LENGTH, `Cada tag pode ter no máximo ${MAX_TAG_LENGTH} caracteres`);

/**
 * Refuses two tags the database stores as one. `question_tags` keys on the
 * question and the tag under a collation that ignores case and accents, so
 * "Integrais" beside "integrais" broke the key and the save with a 500 (#184).
 */
function refuseRepeatedTags(tags: readonly string[], ctx: z.RefinementCtx): void {
  const firstSpelling = new Map<string, string>();
  for (const tag of tags) {
    const earlier = firstSpelling.get(collationKey(tag));
    if (earlier !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${earlier}" e "${tag}" são a mesma tag: deixe só uma` });
      return;
    }
    firstSpelling.set(collationKey(tag), tag);
  }
}

/**
 * What the question form submits. The identity and the soft-delete marker are
 * the repository's business, not the form's.
 *
 * Stricter than `questionSchema` on purpose: the limits of the columns are
 * checked on the way in, and a record already stored keeps being read.
 */
export const questionInputSchema = z
  .object({
    type: questionTypeSchema,
    statement: z.string().trim().min(1, 'Informe o enunciado'),
    tags: z.array(questionTagSchema).superRefine(refuseRepeatedTags),
    alternatives: z.array(z.object({ id, text: z.string() })).optional(),
    correctAlternativeId: id.optional(),
    maxScore: questionMaxScore.optional(),
    allowShuffleAlternatives: z.boolean(),
  })
  .superRefine((question, ctx) => {
    if (question.type === 'discursiva') {
      if (question.maxScore === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxScore'],
          message: 'Informe a nota máxima da questão discursiva',
        })
      }
      return
    }

    const alternatives = question.alternatives ?? []
    if (alternatives.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['alternatives'],
        message: 'Uma questão objetiva precisa de ao menos 2 alternativas',
      })
    }
    if (alternatives.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['alternatives'],
        message: 'Máximo de 5 alternativas',
      })
    }
    if (alternatives.some((item) => item.text.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['alternatives'],
        message: 'Preencha o texto de todas as alternativas',
      })
    }
    if (!alternatives.some((item) => item.id === question.correctAlternativeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctAlternativeId'],
        message: 'Marque qual alternativa é a correta',
      })
    }
  })

export const examQuestionSchema = z.object({
  questionId: id,
  order: z.number().int().nonnegative(),
  score: z.number().nonnegative(),
  allowShuffleAlternatives: z.boolean(),
});

export const examStatusSchema = z.enum(['draft', 'ready', 'closed']);

/** The most questions an exam takes (RF15), which is also the most the automatic draw hands back. */
export const MAX_EXAM_QUESTIONS = 20;
const TOO_MANY_QUESTIONS = `Máximo de ${MAX_EXAM_QUESTIONS} questões por prova`;

export const examSchema = z.object({
  id,
  teacherId: id,
  title: z.string().min(1, 'Informe o título da prova').max(200),
  questions: z.array(examQuestionSchema).max(MAX_EXAM_QUESTIONS, TOO_MANY_QUESTIONS),
  status: examStatusSchema,
  description: z.string(),
  defaultShuffleQuestions: z.boolean(),
  defaultShuffleAlternatives: z.boolean(),
});

/**
 * What the exam form submits. Identity and status are the repository's
 * business, and the score total is deliberately unchecked: closing the exam on
 * ten points is the teacher's call, not a rule the system enforces.
 */
export const examInputSchema = z.object({
  title: z.string().min(1, 'Informe o título da prova').max(200),
  description: z.string(),
  questions: z.array(examQuestionSchema).max(MAX_EXAM_QUESTIONS, TOO_MANY_QUESTIONS),
  defaultShuffleQuestions: z.boolean(),
  defaultShuffleAlternatives: z.boolean(),
});

/**
 * What the automatic exam asks the server for (RF16): how many questions of
 * each kind, carrying every tag listed, leaving out the ones already in the
 * exam or on screen. Asking for more than the bank has is not an error; asking
 * for more than an exam takes is.
 */
export const drawRequestSchema = z
  .object({
    tags: z.array(z.string().min(1)).max(MAX_EXAM_QUESTIONS).default([]),
    multipleChoiceCount: z.number().int().nonnegative(),
    openEndedCount: z.number().int().nonnegative(),
    excludeIds: z.array(id).max(MAX_EXAM_QUESTIONS * 2).default([]),
  })
  .refine((request) => request.multipleChoiceCount + request.openEndedCount <= MAX_EXAM_QUESTIONS, {
    message: TOO_MANY_QUESTIONS,
    path: ['multipleChoiceCount'],
  });

export const applicationStatusSchema = z.enum(['draft', 'generated', 'closed']);

export const applicationSchema = z.object({
  id,
  examId: id,
  classId: id,
  teacherId: id,
  status: applicationStatusSchema,
  pdfUrl: z.string().optional(),
  date: timestamp,
  gradesReleased: z.boolean(),
});

const count = z.number().int().nonnegative();

export const applicationProgressSchema = z.object({
  versions: count,
  publishedAnswerKeys: count,
  sheets: count,
  correctedSheets: count,
  corrections: count,
});

/** How the API answers an application: the entity, the names the screens show and its progress. */
export const applicationOverviewSchema = applicationSchema.extend({
  examTitle: z.string(),
  className: z.string(),
  progress: applicationProgressSchema,
});

export const correctionProgressSchema = z.nativeEnum(CORRECTION_PROGRESS);

/**
 * What the application form submits. The teacher picks an exam, a class and a
 * date; the status, the PDF and the release of grades belong to what happens
 * afterwards. The API answers with these same messages, so they are written
 * for the screen.
 */
export const applicationInputSchema = z.object({
  examId: z.string({ message: 'Escolha a prova' }).min(1, 'Escolha a prova'),
  classId: z.string({ message: 'Escolha a turma' }).min(1, 'Escolha a turma'),
  date: z.string({ message: 'Informe a data da aplicação' }).datetime('Informe a data da aplicação'),
});

/**
 * The most versions one application prints, the most P13 has always offered.
 * Here rather than in the screen, so the API refuses what the screen would
 * never send.
 */
export const MAX_VERSIONS = 6;

export const versionShuffleSchema = z.object({
  shuffleQuestions: z.boolean({ message: 'Informe se a versão embaralha as questões' }),
  shuffleAlternatives: z.boolean({ message: 'Informe se a versão embaralha as alternativas' }),
});

/**
 * What generating an application asks for (RF22): how each version shuffles,
 * which P13 pre-fills with the preferences of the exam (RF17) and the teacher
 * may change version by version, and whether the sheets carry the name of the
 * student, which holds for the whole application. The number of versions is
 * the length of `versions`.
 */
export const generationRequestSchema = z.object(
  {
    versions: z
      .array(versionShuffleSchema, { message: 'Informe as versões a gerar' })
      .min(1, 'Gere pelo menos uma versão')
      .max(MAX_VERSIONS, `Máximo de ${MAX_VERSIONS} versões por aplicação`),
    withStudentIdentification: z.boolean({ message: 'Informe se as folhas saem com o nome do aluno' }),
  },
  { message: 'Dados inválidos' },
);

export const examVersionLayoutSchema = z.object({
  questionOrder: z.array(id),
  alternativeOrder: z.array(z.object({ questionId: id, printedOrder: z.array(id) })),
});

export const examVersionSchema = z.object({
  id,
  applicationId: id,
  versionNumber: z.number().int().positive(),
  shuffleQuestions: z.boolean(),
  shuffleAlternatives: z.boolean(),
  withStudentIdentification: z.boolean(),
  layout: examVersionLayoutSchema,
  answerKeyPublished: z.boolean(),
  answerKeyPublishedAt: timestamp.optional(),
  publicCode: z.string().min(1),
  qrCodePayload: z.string().min(1),
});

export const answerSheetSchema = z.object({
  id,
  applicationId: id,
  examVersionId: id,
  studentId: id.optional(),
  sheetNumber: z.number().int().positive(),
  code: z.string().length(26),
  /**
   * A sheet kept in a browser before this field existed was made for the
   * first geometry, which is the only one there has been until then, so it
   * is read as that one instead of being dropped as invalid.
   */
  answerCardVersion: z.number().int().positive().default(1),
});

export const correctionStatusSchema = z.nativeEnum(CORRECTION_STATUS);

export const objectiveResultSchema = z.object({
  questionId: id,
  correct: z.boolean(),
  score: z.number().nonnegative(),
  selectedAlternativeId: id.optional(),
});

const publicLookupHeaderSchema = z.object({
  examTitle: z.string(),
  subject: z.string(),
  className: z.string(),
  date: z.string(),
  identity: z.discriminatedUnion('type', [
    z.object({ type: z.literal('STUDENT'), fullName: z.string() }),
    z.object({ type: z.literal('SHEET'), sheetNumber: z.number(), versionNumber: z.number() }),
  ]),
});

const answerKeySchema = z.array(z.object({ questionId: id, correctAlternativeId: id }));

/**
 * The answer of the public lookup, one object per state. `z.object` drops any
 * key it does not declare, which is the right default for the one response
 * that reaches strangers: a field the server added by mistake never gets to
 * the screen.
 */
export const publicLookupSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('INVALID_CODE') }),
  z.object({ status: z.literal('NOTHING_RELEASED'), header: publicLookupHeaderSchema }),
  z.object({ status: z.literal('ANSWER_KEY_ONLY'), header: publicLookupHeaderSchema, answerKey: answerKeySchema }),
  z.object({
    status: z.literal('ANSWER_KEY_AND_SCORE'),
    header: publicLookupHeaderSchema,
    answerKey: answerKeySchema,
    totalScore: z.number(),
    objectiveResults: z.array(objectiveResultSchema),
  }),
]);

export const correctionSchema = z.object({
  id,
  examVersionId: id,
  studentId: id.optional(),
  reportedStudentName: z.string().optional(),
  reportedStudentRegistration: z.string().optional(),
  objectiveResults: z.array(objectiveResultSchema),
  discursiveScores: z.array(z.object({ questionId: id, score: z.number().nonnegative() })),
  totalScore: z.number().nonnegative(),
  notes: z.string().optional(),
  confirmedAt: timestamp,
  correctedBy: id,
  isAutomaticallyAssigned: z.boolean(),
  /**
   * Required by the Spec. A record kept in a browser before the two became
   * required is read with the values the site writes, instead of being
   * dropped as invalid.
   */
  clientCorrectionId: z
    .string()
    .min(1)
    .max(64)
    .default(() => globalThis.crypto.randomUUID()),
  syncStatus: z.enum(['pending', 'synced', 'error']).default('synced'),
  status: correctionStatusSchema,
  answerSheetId: id,
  source: z.nativeEnum(CORRECTION_SOURCE),
  imageUrl: z.string().optional(),
});

export type ClassInput = z.infer<typeof classInputSchema>;
export type StudentInput = z.infer<typeof studentInputSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GoogleExchange = z.infer<typeof googleExchangeSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type ExamInput = z.infer<typeof examInputSchema>;
export type DrawRequest = z.infer<typeof drawRequestSchema>;
export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type VersionShuffle = z.infer<typeof versionShuffleSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
