/**
 * Domain schemas.
 *
 * Field names and shapes follow `docs/Modelo_de_Dados.md`. The same
 * definitions validate data read from `localStorage` today and the HTTP
 * responses, plus the Express request bodies, later.
 */
import { z } from 'zod';
import { CORRECTION_SOURCE, CORRECTION_STATUS } from '@/types/domain';

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

export const signInSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres'),
});

export const signUpSchema = z
  .object({
    fullName: z.string().min(1, 'Informe seu nome completo').max(160),
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
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

export const studentSchema = z.object({
  id,
  classId: id,
  fullName: z.string().min(1, 'Informe o nome do aluno').max(160),
  registration: z.string().min(1, 'Informe a matrícula').max(40),
  email: z.string().email('E-mail inválido').optional(),
  anonymizedAt: timestamp.optional(),
  userId: id.optional(),
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
 * What the question form submits. The identity and the soft-delete marker are
 * the repository's business, not the form's.
 */
export const questionInputSchema = z
  .object({
    type: questionTypeSchema,
    statement: z.string().min(1, 'Informe o enunciado'),
    tags: z.array(z.string().min(1)),
    alternatives: z.array(z.object({ id, text: z.string() })).optional(),
    correctAlternativeId: id.optional(),
    maxScore: z.number().positive('A nota máxima precisa ser maior que zero').optional(),
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

export const examSchema = z.object({
  id,
  teacherId: id,
  title: z.string().min(1, 'Informe o título da prova').max(200),
  questions: z.array(examQuestionSchema).max(20, 'Máximo de 20 questões por prova'),
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
  questions: z.array(examQuestionSchema).max(20, 'Máximo de 20 questões por prova'),
  defaultShuffleQuestions: z.boolean(),
  defaultShuffleAlternatives: z.boolean(),
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
});

export const correctionStatusSchema = z.nativeEnum(CORRECTION_STATUS);

export const objectiveResultSchema = z.object({
  questionId: id,
  correct: z.boolean(),
  score: z.number().nonnegative(),
  selectedAlternativeId: id.optional(),
});

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
  clientCorrectionId: z.string().optional(),
  syncStatus: z.enum(['pending', 'synced', 'error']).optional(),
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
export type ExamInput = z.infer<typeof examInputSchema>;
