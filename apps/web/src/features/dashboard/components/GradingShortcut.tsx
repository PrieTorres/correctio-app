import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ScanLine } from 'lucide-react'
import { Modal } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { formatDate } from '@/lib/utils'
import { GRADING_SHORTCUT, gradingShortcut } from '../grading-shortcut'
import type { DashboardActivity } from '@/lib/reports'

const LABEL = 'Corrigir folhas'

/** The gold action of the panel, the same whether it is a link or opens a choice. */
const ACTION_CLASSES =
  'touch-target mt-2 flex w-full items-center gap-3 rounded-[var(--radius-control)] bg-accent px-3 text-label text-on-accent hover:bg-accent-hover'

/** One application the photos may belong to, by exam, class and day, as the teacher tells them apart. */
function ApplicationChoice({ application }: Readonly<{ application: DashboardActivity }>) {
  return (
    <li>
      <Link
        to={buildPath(ROUTES.grading, { id: application.id })}
        className="touch-target flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2 hover:border-primary hover:bg-surface-muted"
      >
        <span className="min-w-0">
          <span className="block truncate text-body text-ink">{application.title}</span>
          <span className="block text-caption text-ink-subtle">{application.detail}</span>
        </span>
        <span className="shrink-0 text-caption text-ink-subtle">{formatDate(application.date)}</span>
      </Link>
    </li>
  )
}

/** Shown when nothing was printed yet: grading starts from an application with its sheets generated. */
function NothingToGrade() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">
        As folhas saem de uma aplicação gerada. Aplique uma prova a uma turma, gere as versões e volte
        aqui para enviar as fotos.
      </p>
      <Link to={ROUTES.newApplication} className={ACTION_CLASSES}>
        <ClipboardList size={18} aria-hidden />
        Nova aplicação
      </Link>
    </div>
  )
}

/**
 * "Corrigir folhas" on the panel. The upload screen (P15) is per application,
 * so with one application to grade the shortcut goes straight there; with
 * several, the teacher picks one first; with none, the panel explains where
 * sheets come from instead of opening an empty list.
 *
 * The list is the panel's own (`useDashboardSummary`), so choosing costs no
 * extra request.
 */
export function GradingShortcut({ gradable }: Readonly<{ gradable: readonly DashboardActivity[] }>) {
  const [open, setOpen] = useState(false)
  const shortcut = gradingShortcut(gradable)

  if (shortcut.kind === GRADING_SHORTCUT.ONE) {
    return (
      <Link to={buildPath(ROUTES.grading, { id: shortcut.application.id })} className={ACTION_CLASSES}>
        <ScanLine size={18} aria-hidden />
        {LABEL}
      </Link>
    )
  }

  return (
    <>
      <button type="button" className={ACTION_CLASSES} onClick={() => setOpen(true)}>
        <ScanLine size={18} aria-hidden />
        {LABEL}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={shortcut.kind === GRADING_SHORTCUT.CHOOSE ? 'De qual aplicação são as folhas?' : 'Nenhuma aplicação para corrigir'}
      >
        {shortcut.kind === GRADING_SHORTCUT.CHOOSE ? (
          <ul className="flex flex-col gap-2">
            {shortcut.applications.map((application) => (
              <ApplicationChoice key={application.id} application={application} />
            ))}
          </ul>
        ) : (
          <NothingToGrade />
        )}
      </Modal>
    </>
  )
}
