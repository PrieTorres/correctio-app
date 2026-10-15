import nodemailer from 'nodemailer'
import type { Logger } from 'pino'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
}

/** Sends one e-mail. The auth service depends on this, so tests and development swap in their own. */
export interface Mailer {
  send: (message: MailMessage) => Promise<void>
}

/**
 * The project's Gmail over SMTP with an app password: free, up to 500 e-mails a
 * day, and owned by the same account as the rest of the infrastructure.
 */
export function createGmailMailer({ from, appPassword }: { from: string; appPassword: string }): Mailer {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: from, pass: appPassword },
  })

  return {
    async send(message) {
      await transport.sendMail({ from: `Correctio <${from}>`, ...message })
    },
  }
}

/**
 * Without an app password the e-mail is written to the log instead. Fine on a
 * developer's machine, where reading the link in the terminal is the point; on
 * a deployed API it means the password reset cannot reach anyone, so the log
 * says it as an error and never prints the link.
 */
export function createLogMailer(logger: Logger, { production }: { production: boolean }): Mailer {
  return {
    send(message) {
      if (production) logger.error({ subject: message.subject }, 'GMAIL_APP_PASSWORD is not set: the e-mail was not sent')
      else logger.info({ to: message.to, subject: message.subject, text: message.text }, 'E-mail not sent (development)')
      return Promise.resolve()
    },
  }
}
