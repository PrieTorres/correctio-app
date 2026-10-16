import type { MailMessage } from './mailer'

const HTML_ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** The name is whatever someone typed at sign-up; unescaped, it could put markup into the e-mail. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character] ?? character)
}

/**
 * The password reset e-mail (RF03, screen C3). It says how long the link lasts
 * and that it works once, and tells someone who did not ask that nothing
 * changes unless the link is opened.
 */
export function passwordResetMessage({ to, fullName, link }: { to: string; fullName: string; link: string }): MailMessage {
  const firstName = fullName.split(' ')[0] ?? fullName
  const lines = [
    `Olá, ${firstName}!`,
    'Recebemos um pedido para redefinir a senha da sua conta no Correctio.',
    `Para escolher uma senha nova, abra este link em até 30 minutos: ${link}`,
    'O link funciona uma única vez. Se não foi você quem pediu, ignore este e-mail: sua senha continua a mesma.',
  ]
  const html = [
    `<p>Olá, ${escapeHtml(firstName)}!</p>`,
    '<p>Recebemos um pedido para redefinir a senha da sua conta no Correctio.</p>',
    `<p><a href="${escapeHtml(link)}">Escolher uma senha nova</a> (válido por 30 minutos e uma única vez).</p>`,
    '<p>Se não foi você quem pediu, ignore este e-mail: sua senha continua a mesma.</p>',
  ]
  return { to, subject: 'Redefinição de senha do Correctio', text: lines.join('\n\n'), html: html.join('\n') }
}
