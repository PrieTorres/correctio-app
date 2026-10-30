import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  answerSheetSchema,
  applicationOverviewSchema,
  classInputSchema,
  classSchema,
  correctionProgressSchema,
  examInputSchema,
  generationRequestSchema,
  MAX_SCORE,
  MAX_TAG_LENGTH,
  MAX_VERSIONS,
  questionInputSchema,
  questionSchema,
  resetPasswordSchema,
  signInSchema,
  signUpRequestSchema,
  signUpSchema,
} from '../schemas'

function messagesOf(result: z.SafeParseReturnType<unknown, unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const storedMultipleChoice = {
  id: 'q1',
  teacherId: 't1',
  type: 'objetiva',
  statement: 'Quanto é 2 + 2?',
  tags: ['Aritmética'],
  alternatives: [
    { id: 'a', text: '4' },
    { id: 'b', text: '5' },
  ],
  correctAlternativeId: 'a',
  allowShuffleAlternatives: true,
} as const

const submittedMultipleChoice = {
  type: 'objetiva',
  statement: 'Quanto é 2 + 2?',
  tags: [],
  alternatives: [
    { id: 'a', text: '4' },
    { id: 'b', text: '5' },
  ],
  correctAlternativeId: 'a',
  allowShuffleAlternatives: true,
} as const

/** #146: the list of classes carries how many students each one has; the other answers leave it out. */
describe('classSchema', () => {
  const stored = {
    id: 'c1',
    teacherId: 't1',
    name: 'Cálculo I',
    subject: 'Matemática',
    term: '2026/2',
    status: 'active',
    inviteCode: 'ABCDEFGH',
  }

  it('takes a class with or without the student count', () => {
    expect(classSchema.safeParse(stored).success).toBe(true)
    expect(classSchema.safeParse({ ...stored, studentCount: 0 }).success).toBe(true)
  })

  it('refuses a count that is not a whole number of students', () => {
    expect(classSchema.safeParse({ ...stored, studentCount: -1 }).success).toBe(false)
    expect(classSchema.safeParse({ ...stored, studentCount: 1.5 }).success).toBe(false)
  })

  it('leaves the count out of the form, since the server computes it', () => {
    expect(classInputSchema.parse({ name: 'Cálculo I', subject: 'Matemática', term: '2026/2', studentCount: 9 })).toEqual({
      name: 'Cálculo I',
      subject: 'Matemática',
      term: '2026/2',
    })
  })
})

describe('signUpSchema', () => {
  const account = { fullName: 'Ana Lima', email: 'ana@exemplo.edu.br', password: 'segredo1' }

  it('accepts a confirmation that matches the password', () => {
    expect(signUpSchema.safeParse({ ...account, confirmPassword: 'segredo1' }).success).toBe(true)
  })

  it('points a mismatch at the confirmation field', () => {
    const result = signUpSchema.safeParse({ ...account, confirmPassword: 'outro' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('requires at least 8 characters (RF01), in the form and in the API body', () => {
    const short = { ...account, password: 'curta12' }

    expect(messagesOf(signUpSchema.safeParse({ ...short, confirmPassword: 'curta12' }))).toContain(
      'A senha precisa ter ao menos 8 caracteres',
    )
    expect(messagesOf(signUpRequestSchema.safeParse(short))).toContain('A senha precisa ter ao menos 8 caracteres')
  })
})

describe('signInSchema', () => {
  it('asks only that a password was typed, never for the length rule', () => {
    expect(signInSchema.safeParse({ email: 'ana@exemplo.edu.br', password: 'curta' }).success).toBe(true)
    expect(messagesOf(signInSchema.safeParse({ email: 'ana@exemplo.edu.br', password: '' }))).toEqual(['Informe a senha'])
  })
})

describe('resetPasswordSchema', () => {
  it('applies the sign-up rules to the new password', () => {
    expect(resetPasswordSchema.safeParse({ password: 'senha-nova-1', confirmPassword: 'senha-nova-1' }).success).toBe(true)
    expect(messagesOf(resetPasswordSchema.safeParse({ password: 'senha-nova-1', confirmPassword: 'outra' }))).toEqual([
      'As senhas não coincidem',
    ])
  })
})

describe('questionSchema', () => {
  it('accepts a stored multiple-choice question whose answer is one of its alternatives', () => {
    expect(questionSchema.safeParse(storedMultipleChoice).success).toBe(true)
  })

  it('refuses a multiple-choice question without alternatives or answer', () => {
    const { alternatives: _alternatives, ...withoutAlternatives } = storedMultipleChoice

    expect(messagesOf(questionSchema.safeParse(withoutAlternatives))).toEqual([
      'Questão objetiva exige alternativas e uma alternativa correta',
    ])
  })

  it('refuses an answer that is not one of the alternatives', () => {
    const result = questionSchema.safeParse({ ...storedMultipleChoice, correctAlternativeId: 'z' })

    expect(result.error?.issues[0]?.path).toEqual(['correctAlternativeId'])
  })

  it('requires a maximum score on an open-ended question', () => {
    const openEnded = { ...storedMultipleChoice, type: 'discursiva', alternatives: undefined, correctAlternativeId: undefined }

    expect(messagesOf(questionSchema.safeParse(openEnded))).toEqual(['Questão discursiva exige nota máxima'])
    expect(questionSchema.safeParse({ ...openEnded, maxScore: 2 }).success).toBe(true)
  })
})

describe('questionInputSchema', () => {
  it('accepts what a complete multiple-choice form submits', () => {
    expect(questionInputSchema.safeParse(submittedMultipleChoice).success).toBe(true)
  })

  it('requires a maximum score on an open-ended question', () => {
    const openEnded = { type: 'discursiva', statement: 'Explique.', tags: [], allowShuffleAlternatives: true }

    expect(messagesOf(questionInputSchema.safeParse(openEnded))).toEqual([
      'Informe a nota máxima da questão discursiva',
    ])
    expect(questionInputSchema.safeParse({ ...openEnded, maxScore: 2 }).success).toBe(true)
  })

  it('asks for at least two alternatives', () => {
    const single = { ...submittedMultipleChoice, alternatives: [{ id: 'a', text: '4' }] }

    expect(messagesOf(questionInputSchema.safeParse(single))).toContain(
      'Uma questão objetiva precisa de ao menos 2 alternativas',
    )
  })

  it('allows at most five alternatives', () => {
    const alternatives = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, text: id }))

    expect(messagesOf(questionInputSchema.safeParse({ ...submittedMultipleChoice, alternatives }))).toContain(
      'Máximo de 5 alternativas',
    )
  })

  it('refuses an alternative left blank', () => {
    const alternatives = [
      { id: 'a', text: '4' },
      { id: 'b', text: '   ' },
    ]

    expect(messagesOf(questionInputSchema.safeParse({ ...submittedMultipleChoice, alternatives }))).toContain(
      'Preencha o texto de todas as alternativas',
    )
  })

  it('asks which alternative is correct', () => {
    const unanswered = { ...submittedMultipleChoice, correctAlternativeId: undefined }

    expect(messagesOf(questionInputSchema.safeParse(unanswered))).toContain('Marque qual alternativa é a correta')
  })
})

/** Each case of #184: an input the database could not store as typed, which failed the save or the bank. */
describe('questionInputSchema, against the limits of the database', () => {
  const openEnded = { type: 'discursiva', statement: 'Explique.', tags: [], allowShuffleAlternatives: true }
  const withScore = (maxScore: number) => questionInputSchema.safeParse({ ...openEnded, maxScore })
  const withTags = (tags: string[]) => questionInputSchema.safeParse({ ...submittedMultipleChoice, tags })

  it('refuses a max score with a third decimal, which the column rounded to zero', () => {
    expect(messagesOf(withScore(0.001))).toEqual(['A nota máxima aceita no máximo 2 casas decimais'])
    expect(messagesOf(withScore(2.555))).toEqual(['A nota máxima aceita no máximo 2 casas decimais'])
  })

  it('accepts two decimals, including values binary floating point cannot write exactly', () => {
    expect(withScore(0.01).success).toBe(true)
    expect(withScore(0.29).success).toBe(true)
    expect(withScore(2.5).success).toBe(true)
  })

  it('refuses a max score above what the column holds, saying the ceiling', () => {
    expect(messagesOf(withScore(10000))).toEqual(['A nota máxima pode ser no máximo 9999,99'])
    expect(withScore(MAX_SCORE).success).toBe(true)
  })

  it('still refuses zero and negative scores with their own message', () => {
    expect(messagesOf(withScore(0))).toEqual(['A nota máxima precisa ser maior que zero'])
    expect(messagesOf(withScore(-2))).toEqual(['A nota máxima precisa ser maior que zero'])
  })

  it('refuses a statement of only spaces, like an empty one', () => {
    expect(messagesOf(questionInputSchema.safeParse({ ...submittedMultipleChoice, statement: '   \n ' }))).toEqual([
      'Informe o enunciado',
    ])
  })

  it('stores the statement without the spaces around it', () => {
    const parsed = questionInputSchema.parse({ ...submittedMultipleChoice, statement: '  Quanto é 2 + 2?  ' })

    expect(parsed.statement).toBe('Quanto é 2 + 2?')
  })

  it('refuses two tags that differ only in case or accents, which the database keeps as one', () => {
    expect(messagesOf(withTags(['Integrais', 'integrais']))).toEqual([
      '"Integrais" e "integrais" são a mesma tag: deixe só uma',
    ])
    expect(messagesOf(withTags(['Função', 'Funcao']))).toEqual(['"Função" e "Funcao" são a mesma tag: deixe só uma'])
  })

  it('compares tags after trimming them, as they are stored', () => {
    expect(messagesOf(withTags(['Limites', ' Limites ']))).toEqual(['"Limites" e "Limites" são a mesma tag: deixe só uma'])
    expect(questionInputSchema.parse({ ...submittedMultipleChoice, tags: [' Limites '] }).tags).toEqual(['Limites'])
  })

  it('keeps tags that are really different', () => {
    expect(withTags(['Integrais', 'Derivadas', 'Integrais duplas']).success).toBe(true)
  })

  it('refuses a tag longer than its column, and takes one exactly as long', () => {
    expect(messagesOf(withTags(['a'.repeat(MAX_TAG_LENGTH + 1)]))).toEqual(['Cada tag pode ter no máximo 80 caracteres'])
    expect(withTags(['a'.repeat(MAX_TAG_LENGTH)]).success).toBe(true)
  })

  it('refuses a tag of only spaces', () => {
    expect(messagesOf(withTags(['  ']))).toEqual(['A tag não pode ficar vazia'])
  })
})

describe('examInputSchema', () => {
  const exam = { title: 'Prova 1', description: '', defaultShuffleQuestions: true, defaultShuffleAlternatives: true }
  const questions = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      questionId: `q${index}`,
      order: index,
      score: 0.5,
      allowShuffleAlternatives: true,
    }))

  it('accepts up to twenty questions', () => {
    expect(examInputSchema.safeParse({ ...exam, questions: questions(20) }).success).toBe(true)
  })

  it('refuses a twenty-first question', () => {
    expect(messagesOf(examInputSchema.safeParse({ ...exam, questions: questions(21) }))).toEqual([
      'Máximo de 20 questões por prova',
    ])
  })
})

describe('generationRequestSchema', () => {
  const version = { shuffleQuestions: true, shuffleAlternatives: false }
  const request = (count: number) => ({ versions: Array.from({ length: count }, () => version), withStudentIdentification: true })

  it('accepts from one to six versions, each with its own shuffle', () => {
    expect(generationRequestSchema.safeParse(request(1)).success).toBe(true)
    expect(generationRequestSchema.safeParse(request(MAX_VERSIONS)).success).toBe(true)
  })

  it('refuses no version at all and a seventh one', () => {
    expect(messagesOf(generationRequestSchema.safeParse(request(0)))).toEqual(['Gere pelo menos uma versão'])
    expect(messagesOf(generationRequestSchema.safeParse(request(MAX_VERSIONS + 1)))).toEqual(['Máximo de 6 versões por aplicação'])
  })

  it('asks how each version shuffles and whether the sheets carry the name, in words the screen can show', () => {
    expect(messagesOf(generationRequestSchema.safeParse({ versions: [{ shuffleQuestions: true }] }))).toEqual([
      'Informe se a versão embaralha as alternativas',
      'Informe se as folhas saem com o nome do aluno',
    ])
    expect(messagesOf(generationRequestSchema.safeParse({ withStudentIdentification: false }))).toEqual(['Informe as versões a gerar'])
    expect(messagesOf(generationRequestSchema.safeParse('3 versões'))).toEqual(['Dados inválidos'])
  })
})

describe('answerSheetSchema', () => {
  const sheet = { id: 's1', applicationId: 'a1', examVersionId: 'v1', sheetNumber: 1, code: 'ABCDEFGHJKLMNPQRSTUVWXYZ27' }

  it('keeps the geometry of the answer card the sheet was printed with', () => {
    expect(answerSheetSchema.parse({ ...sheet, answerCardVersion: 2 }).answerCardVersion).toBe(2)
  })

  it('reads a sheet stored before the geometry was recorded as one of the first geometry', () => {
    expect(answerSheetSchema.parse(sheet).answerCardVersion).toBe(1)
  })
})

describe('applicationOverviewSchema', () => {
  const overview = {
    id: 'a1',
    examId: 'e1',
    classId: 'c1',
    teacherId: 't1',
    status: 'generated',
    date: '2026-10-05T12:00:00.000Z',
    gradesReleased: false,
    examTitle: 'Cálculo I — P1',
    className: 'Turma A',
    progress: { versions: 2, publishedAnswerKeys: 1, sheets: 30, correctedSheets: 12, corrections: 14 },
  }

  it('reads an application with the names the screens show and its progress', () => {
    expect(applicationOverviewSchema.parse(overview)).toEqual(overview)
  })

  it('refuses an application without its progress, or with a count that is not a whole number of things', () => {
    expect(applicationOverviewSchema.safeParse({ ...overview, progress: undefined }).success).toBe(false)
    expect(applicationOverviewSchema.safeParse({ ...overview, progress: { ...overview.progress, sheets: -1 } }).success).toBe(false)
    expect(applicationOverviewSchema.safeParse({ ...overview, progress: { ...overview.progress, corrections: 1.5 } }).success).toBe(false)
  })
})

describe('correctionProgressSchema', () => {
  it('takes the three stages of the correction of an application, written as the contract writes them', () => {
    expect(['NOT_STARTED', 'IN_PROGRESS', 'DONE'].map((stage) => correctionProgressSchema.safeParse(stage).success)).toEqual([true, true, true])
    expect(correctionProgressSchema.safeParse('in-progress').success).toBe(false)
  })
})
