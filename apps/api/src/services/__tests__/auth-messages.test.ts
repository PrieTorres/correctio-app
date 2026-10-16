import { describe, expect, it } from 'vitest'
import { passwordResetMessage } from '../auth-messages'

const LINK = 'https://correctio-app.web.app/redefinir-senha?codigo=abc'

describe('passwordResetMessage', () => {
  it('greets by first name and carries the link in both versions', () => {
    const message = passwordResetMessage({ to: 'ana@exemplo.edu.br', fullName: 'Ana Lima', link: LINK })

    expect(message).toMatchObject({ to: 'ana@exemplo.edu.br', subject: 'Redefinição de senha do Correctio' })
    expect(message.text).toContain('Olá, Ana!')
    expect(message.text).toContain(LINK)
    expect(message.html).toContain(`href="${LINK}"`)
  })

  it('never lets a typed name put markup into the e-mail', () => {
    const message = passwordResetMessage({ to: 'x@exemplo.edu.br', fullName: '<img src=x onerror=alert(1)>', link: LINK })

    expect(message.html).not.toContain('<img')
    expect(message.html).toContain('&lt;img')
  })
})
