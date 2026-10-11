import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { examInputSchema, questionInputSchema, questionSchema, signUpSchema } from '../schemas'

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
