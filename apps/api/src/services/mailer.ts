import nodemailer from 'nodemailer'
import type { Logger } from 'pino'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
  /** The address and the body stay out of every log, even where the log mailer would print them. */
  confidential?: boolean
}

/** Sends one e-mail. The auth and grade-link services depend on this, so tests and development swap in their own. */
export interface Mailer {
  send: (message: MailMessage) => Promise<void>
}

/** What an app built without a mailer uses: every send fails, so nothing looks delivered that was not. */
export const unavailableMailer: Mailer = {
  send: () => Promise.reject(new Error('No mailer is configured')),
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
      const { confidential: _confidential, ...content } = message
      await transport.sendMail({ from: `Correctio <${from}>`, ...content })
    },
  }
}

/**
 * Without an app password the e-mail is written to the log instead. Fine on a
 * developer's machine, where reading the link in the terminal is the point; on
 * a deployed API it means the password reset cannot reach anyone, so the log
 * says it as an error and never prints the link. A confidential message logs
 * only its subject, in development too.
 */
export function createLogMailer(logger: Logger, { production }: { production: boolean }): Mailer {
  return {
    send(message) {
      if (production) logger.error({ subject: message.subject }, 'GMAIL_APP_PASSWORD is not set: the e-mail was not sent')
      else if (message.confidential === true) logger.info({ subject: message.subject }, 'Confidential e-mail not sent (development)')
      else logger.info({ to: message.to, subject: message.subject, text: message.text }, 'E-mail not sent (development)')
      return Promise.resolve()
    },
  }
}
