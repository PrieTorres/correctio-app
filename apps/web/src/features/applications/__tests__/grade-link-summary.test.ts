import { describe, expect, it } from 'vitest'
import { describeGradeLinks } from '../grade-link-summary'

const NOTHING_SKIPPED = { noEmail: 0, anonymized: 0, removed: 0, noSheet: 0 }

describe('describeGradeLinks', () => {
  it('says only how many went out when nobody was left out', () => {
    expect(describeGradeLinks({ sent: 3, failed: 0, skipped: NOTHING_SKIPPED })).toBe('3 e-mails enviados.')
    expect(describeGradeLinks({ sent: 1, failed: 0, skipped: NOTHING_SKIPPED })).toBe('1 e-mail enviado.')
  })

  it('lists only the reasons that happened', () => {
    const message = describeGradeLinks({ sent: 2, failed: 0, skipped: { ...NOTHING_SKIPPED, noEmail: 4, noSheet: 1 } })

    expect(message).toBe('2 e-mails enviados. Alunos que ficaram de fora (sem e-mail: 4, sem folha: 1).')
  })

  it('warns that sending again repeats the e-mail to everyone when some failed', () => {
    const message = describeGradeLinks({ sent: 1, failed: 2, skipped: NOTHING_SKIPPED })

    expect(message).toContain('2 e-mails não puderam ser entregues')
    expect(message).toContain('Enviar de novo manda a mensagem outra vez a todos.')
  })
})
