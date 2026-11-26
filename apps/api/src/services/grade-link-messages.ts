import { escapeHtml } from './auth-messages'
import type { MailMessage } from './mailer'

/**
 * The e-mail that gives one student the link to their own grade page. It names
 * the exam and the class so the student knows what the link is about, and it
 * carries neither the grade nor the answers: the page decides what to show once
 * the code is read. It is marked confidential, so the development mailer never
 * writes the address or the code to the log.
 */
export function gradeLinkMessage({
  to,
  fullName,
  examTitle,
  className,
  link,
}: {
  to: string
  fullName: string
  examTitle: string
  className: string
  link: string
}): MailMessage {
  const firstName = fullName.split(' ')[0] ?? fullName
  const lines = [
    `Olá, ${firstName}!`,
    `Seu professor liberou a consulta da sua nota na prova "${examTitle}", da turma ${className}.`,
    `Para ver o resultado, abra este link: ${link}`,
    'O link é só seu: não o compartilhe. Se você não esperava este e-mail, pode ignorá-lo.',
  ]
  const html = [
    `<p>Olá, ${escapeHtml(firstName)}!</p>`,
    `<p>Seu professor liberou a consulta da sua nota na prova &quot;${escapeHtml(examTitle)}&quot;, da turma ${escapeHtml(className)}.</p>`,
    `<p><a href="${escapeHtml(link)}">Ver o meu resultado</a></p>`,
    '<p>O link é só seu: não o compartilhe. Se você não esperava este e-mail, pode ignorá-lo.</p>',
  ]
  return { to, subject: `Sua nota da prova "${examTitle}" está disponível`, text: lines.join('\n\n'), html: html.join('\n'), confidential: true }
}
