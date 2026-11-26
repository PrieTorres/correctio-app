import { describe, expect, it } from 'vitest'
import { gradeLinkMessage } from '../grade-link-messages'

const LINK = 'https://correctio.example/r/ABCDEFGH'
const SOURCES = { to: 'ana@aluno.edu.br', fullName: 'Ana Lima', examTitle: 'Prova de Limites', className: 'Turma 9A', link: LINK }

describe('gradeLinkMessage', () => {
  it('goes to one student, names the exam and the class and carries the link in both versions', () => {
    const message = gradeLinkMessage(SOURCES)

    expect(message.to).toBe('ana@aluno.edu.br')
    expect(message.subject).toContain('Prova de Limites')
    expect(message.text).toContain('Olá, Ana!')
    expect(message.text).toContain('Turma 9A')
    expect(message.text).toContain(LINK)
    expect(message.html).toContain(`href="${LINK}"`)
  })

  it('is confidential, so no mailer writes the address or the code to a log', () => {
    expect(gradeLinkMessage(SOURCES).confidential).toBe(true)
  })

  it('never lets a typed exam title or class name put markup into the e-mail', () => {
    const message = gradeLinkMessage({ ...SOURCES, examTitle: '<img src=x onerror=alert(1)>', className: '<b>9A</b>' })

    expect(message.html).not.toContain('<img')
    expect(message.html).not.toContain('<b>')
    expect(message.html).toContain('&lt;img')
  })
})
