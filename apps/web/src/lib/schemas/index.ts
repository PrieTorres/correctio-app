/**
 * Domain schemas.
 *
 * The same definitions validate data read from `localStorage` today and the
 * HTTP responses (plus the Express request bodies) later, so nothing here is
 * throwaway.
 */
import { z } from 'zod';

const id = z.string().min(1);
const timestamp = z.string().datetime();
const nullableTimestamp = timestamp.nullable();

const archivable = { archivedAt: nullableTimestamp };
const owned = { ownerId: id };

export const classSchema = z.object({
  id,
  ...owned,
  ...archivable,
  name: z.string().min(1, 'Informe o nome da turma').max(120),
  subject: z.string().min(1, 'Informe a disciplina').max(120),
  term: z.string().min(1, 'Informe o período').max(40),
});

export const classInputSchema = classSchema.pick({ name: true, subject: true, term: true });

export const studentSchema = z.object({
  id,
  classId: id,
  name: z.string().min(1, 'Informe o nome do aluno').max(160),
  registration: z.string().min(1, 'Informe a matrícula').max(40),
  email: z.string().email('E-mail inválido').nullable(),
  anonymizedAt: nullableTimestamp,
});

export const studentInputSchema = studentSchema.pick({
  name: true,
  registration: true,
  email: true,
});

export const alternativeSchema = z.object({
  id,
  text: z.string().min(1, 'A alternativa não pode ficar vazia'),
  correct: z.boolean(),
});

const questionBase = {
  id,
  ...owned,
  ...archivable,
  statement: z.string().min(1, 'Informe o enunciado'),
  tags: z.array(z.string().min(1)),
};

export const multipleChoiceQuestionSchema = z.object({
  ...questionBase,
  kind: z.literal('multiple-choice'),
  alternatives: z
    .array(alternativeSchema)
    .min(2, 'Uma questão objetiva precisa de ao menos 2 alternativas')
    .max(5, 'Máximo de 5 alternativas')
    .refine(
      (list) => list.filter((item) => item.correct).length === 1,
      'Marque exatamente uma alternativa como correta',
    ),
  shuffleAlternatives: z.boolean(),
});

export const openEndedQuestionSchema = z.object({
  ...questionBase,
  kind: z.literal('open-ended'),
  maxScore: z.number().positive('A nota máxima precisa ser maior que zero'),
});

export const questionSchema = z.discriminatedUnion('kind', [
  multipleChoiceQuestionSchema,
  openEndedQuestionSchema,
]);

export const examStatusSchema = z.enum(['draft', 'ready', 'archived']);

export const examQuestionSchema = z.object({
  questionId: id,
  score: z.number().nonnegative(),
  shuffleAlternatives: z.boolean(),
});

export const examSchema = z.object({
  id,
  ...owned,
  ...archivable,
  title: z.string().min(1, 'Informe o título da prova').max(200),
  description: z.string(),
  status: examStatusSchema,
  questions: z.array(examQuestionSchema).max(20, 'Máximo de 20 questões por prova'),
  defaultShuffleQuestions: z.boolean(),
  defaultShuffleAlternatives: z.boolean(),
});

export const applicationSchema = z.object({
  id,
  ...owned,
  ...archivable,
  examId: id,
  classId: id,
  date: timestamp,
  identified: z.boolean(),
  gradesReleased: z.boolean(),
  pdfGeneratedAt: nullableTimestamp,
});

export const examVersionSchema = z.object({
  id,
  applicationId: id,
  number: z.number().int().positive(),
  shuffleQuestions: z.boolean(),
  shuffleAlternatives: z.boolean(),
  answerKeyPublishedAt: nullableTimestamp,
});

export const answerSheetSchema = z.object({
  id,
  applicationId: id,
  versionId: id,
  studentId: id.nullable(),
  sheetNumber: z.number().int().positive(),
  code: z.string().length(26),
});

export const correctionSchema = z.object({
  id,
  answerSheetId: id,
  source: z.enum(['image-upload', 'manual']),
  multipleChoiceAnswers: z.array(
    z.object({
      questionId: id,
      markedAlternativeId: id.nullable(),
      correctAlternativeId: id,
      correct: z.boolean(),
    }),
  ),
  openEndedScores: z.array(z.object({ questionId: id, score: z.number().nonnegative() })),
  totalScore: z.number().nonnegative(),
  notes: z.string(),
  confirmedAt: nullableTimestamp,
  imageUrl: z.string().nullable(),
});

export type ClassInput = z.infer<typeof classInputSchema>;
export type StudentInput = z.infer<typeof studentInputSchema>;
