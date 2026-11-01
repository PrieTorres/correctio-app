import { CheckCircle2, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useBackgroundJobs, useDismissBackgroundJob, type BackgroundJobView } from '@/lib/background-jobs'
import { saveFile } from '@/lib/utils'

/**
 * The notice of the long operations (RF41; requirements, section 8.1): it
 * appears the moment a job starts, says it runs in the background, and offers
 * the file when it is ready, on whatever screen the teacher is by then. It
 * sits at the top of every screen of the layout, so finishing never depends
 * on staying where the job began.
 */
export function BackgroundJobsNotice() {
  const jobs = useBackgroundJobs()
  const dismiss = useDismissBackgroundJob()

  if (jobs.length === 0) return null

  return (
    <section aria-label="Operações em segundo plano" className="mb-6 flex flex-col gap-2">
      {jobs.map((job) => (
        <JobNotice key={job.id} job={job} onDismiss={() => dismiss(job.id)} />
      ))}
    </section>
  )
}

const NOTICE_CLASSES = 'flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border p-3 text-body'

function JobNotice({ job, onDismiss }: Readonly<{ job: BackgroundJobView; onDismiss: () => void }>) {
  if (job.status === 'RUNNING') {
    return (
      <div role="status" className={`${NOTICE_CLASSES} border-line bg-surface text-ink`}>
        <Loader2 size={18} aria-hidden className="animate-spin text-primary" />
        <p className="min-w-0 flex-1">
          {job.label}: em andamento. Você pode continuar usando o sistema; o aviso fica aqui quando terminar.
        </p>
      </div>
    )
  }

  if (job.status === 'FAILED') {
    return (
      <div role="alert" className={`${NOTICE_CLASSES} border-danger bg-danger-surface text-on-danger-surface`}>
        <p className="min-w-0 flex-1">
          {job.label}: não foi possível concluir. {job.error}
        </p>
        <DismissButton onDismiss={onDismiss} />
      </div>
    )
  }

  return (
    <div role="status" className={`${NOTICE_CLASSES} border-success bg-surface text-ink`}>
      <CheckCircle2 size={18} aria-hidden className="text-success" />
      <p className="min-w-0 flex-1">{job.label}: pronto.</p>
      {job.file !== undefined && <DownloadButton file={job.file} />}
      <DismissButton onDismiss={onDismiss} />
    </div>
  )
}

/** A click, not an automatic save: the browser lets a page save a file only when the person asked for it. */
function DownloadButton({ file }: Readonly<{ file: NonNullable<BackgroundJobView['file']> }>) {
  return (
    <Button variant="primary" icon={<Download size={18} aria-hidden />} onClick={() => saveFile(file.blob, file.filename)}>
      Baixar {file.filename}
    </Button>
  )
}

function DismissButton({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  return (
    <button
      type="button"
      aria-label="Fechar aviso"
      onClick={onDismiss}
      className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
    >
      <X size={18} aria-hidden />
    </button>
  )
}
