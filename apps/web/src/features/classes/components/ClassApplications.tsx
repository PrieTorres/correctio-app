import { Link } from 'react-router-dom'
import { Badge, Card, QueryBoundary } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { correctionBadgeOf, examTitleOf } from '@/features/applications/application-labels'
import { useApplicationList } from '@/features/applications/hooks/useApplications'
import { classApplicationsPath } from '@/features/applications/list-filters'
import { formatDate } from '@/lib/utils'
import type { ApplicationOverview } from '@/types/domain'

/** How many applications the class shows before sending the teacher to the full list. */
const SHOWN = 5

/**
 * "Aplicações desta turma" on P5 (#144): what was already applied to the
 * class, with the exam, the day and where the correction stands, each one
 * leading to P14. The server filters by the class (`classId`), so a class with
 * many applications reads one short page, and "Ver todas" opens P11 with the
 * same filter.
 */
export function ClassApplications({ classId }: Readonly<{ classId: string }>) {
  const { data, isPending, isError } = useApplicationList({ classId, pageSize: SHOWN })
  const total = data?.total ?? 0

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">
          Aplicações desta turma {data !== undefined && <span className="text-body text-ink-subtle">({total})</span>}
        </h2>
        {total > SHOWN && (
          <Link to={classApplicationsPath(classId)} className="inline-flex min-h-11 items-center text-label text-primary underline">
            Ver todas
          </Link>
        )}
      </div>

      <div className="px-5 py-4">
        <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicações…">
          {total === 0 ? (
            <p className="text-body text-ink-muted">
              Nenhuma prova aplicada a esta turma ainda. Aplique uma prova em{' '}
              <Link to={ROUTES.applications} className="text-primary underline">
                Aplicações
              </Link>
              .
            </p>
          ) : (
            <ul aria-label="Aplicações desta turma" className="-my-3 divide-y divide-line">
              {data?.items.map((application) => <ClassApplicationItem key={application.id} application={application} />)}
            </ul>
          )}
        </QueryBoundary>
      </div>
    </Card>
  )
}

function ClassApplicationItem({ application }: Readonly<{ application: ApplicationOverview }>) {
  const correction = correctionBadgeOf(application.progress)

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <Link
          to={buildPath(ROUTES.applicationDetail, { id: application.id })}
          className="inline-flex min-h-11 items-center text-label text-primary hover:underline"
        >
          {examTitleOf(application)}
        </Link>
        <p className="text-caption text-ink-subtle">{formatDate(application.date)}</p>
      </div>
      <Badge tone={correction.tone}>{correction.label}</Badge>
    </li>
  )
}
