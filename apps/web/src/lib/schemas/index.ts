/**
 * Domain schemas.
 *
 * Field names and shapes follow `docs/Modelo_de_Dados.md`. The same
 * definitions validate data read from `localStorage` today and the HTTP
 * responses, plus the Express request bodies, later.
 */
import { z } from 'zod';

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
  answerSheetId: id,
  source: z.enum(['upload_imagem', 'manual']),
  imageUrl: z.string().optional(),
});

export type ClassInput = z.infer<typeof classInputSchema>;
export type StudentInput = z.infer<typeof studentInputSchema>;
