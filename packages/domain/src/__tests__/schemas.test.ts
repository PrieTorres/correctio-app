import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  examInputSchema,
  generationRequestSchema,
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
