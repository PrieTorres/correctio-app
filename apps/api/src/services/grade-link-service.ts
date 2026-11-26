import type { GradeLinkSummary } from '@correctio/domain'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { ApplicationRepository } from '../repositories/application-repository'
import type { GradeLinkRecipient, GradeLinkRepository } from '../repositories/grade-link-repository'
import { gradeLinkMessage } from './grade-link-messages'
import type { Mailer } from './mailer'

const NOT_FOUND = 'Aplicação não encontrada.'
const ARCHIVED = 'Esta aplicação está arquivada. Restaure a aplicação antes de enviar os links.'
const NOT_RELEASED = 'Libere as notas antes de enviar o link da consulta aos alunos.'

export interface GradeLinkService {
  /** E-mails each reachable student the link to their own grade page, and counts who was sent, who failed and who was skipped. */
  sendLinks: (teacherId: string, applicationId: string) => Promise<GradeLinkSummary>
}

export interface GradeLinkServiceDependencies {
  applications: Pick<ApplicationRepository, 'findOverview'>
  recipients: GradeLinkRepository
  mailer: Mailer
  /** The origin of the web app, where `/r/:code` is the public lookup. */
  publicAppUrl: string
}

type SkipReason = keyof GradeLinkSummary['skipped']

type Verdict = { skip: SkipReason } | { email: string; sheetCode: string }

/** Skipped for the first reason that applies, in the order a teacher would expect to read it. */
function verdictOf(recipient: GradeLinkRecipient): Verdict {
  if (recipient.removed) return { skip: 'removed' }
  if (recipient.anonymized) return { skip: 'anonymized' }
  if (recipient.sheetCode === undefined) return { skip: 'noSheet' }
  if (recipient.email === undefined) return { skip: 'noEmail' }
  return { email: recipient.email, sheetCode: recipient.sheetCode }
}

/**
 * Sends the link of the public lookup (`/r/:code`) to each student of a class
 * whose grades were released, one e-mail per student and sequentially, which a
 * class fits in. A failed send is counted and the batch goes on. Neither the
 * address nor the code is logged: a mail server's error text names the
 * recipient, so it is never kept.
 */
export function createGradeLinkService({ applications, recipients, mailer, publicAppUrl }: GradeLinkServiceDependencies): GradeLinkService {
  return {
    async sendLinks(teacherId, applicationId) {
      const application = await applications.findOverview(teacherId, applicationId)
      if (application === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
      if (application.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, ARCHIVED)
      if (!application.gradesReleased) throw new ApiError(API_ERROR_CODE.CONFLICT, NOT_RELEASED)

      const summary: GradeLinkSummary = { sent: 0, failed: 0, skipped: { noEmail: 0, anonymized: 0, removed: 0, noSheet: 0 } }
      for (const recipient of await recipients.findRecipients(applicationId, application.classId)) {
        const verdict = verdictOf(recipient)
        if ('skip' in verdict) {
          summary.skipped[verdict.skip] += 1
          continue
        }
        try {
          await mailer.send(
            gradeLinkMessage({
              to: verdict.email,
              fullName: recipient.fullName,
              examTitle: application.examTitle,
              className: application.className,
              link: `${publicAppUrl}/r/${verdict.sheetCode}`,
            }),
          )
          summary.sent += 1
        } catch {
          summary.failed += 1
        }
      }
      return summary
    },
  }
}
