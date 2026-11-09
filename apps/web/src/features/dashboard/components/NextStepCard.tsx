import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Camera, ClipboardList, Download, FileText, GraduationCap, Library, PenLine, ScanLine, Send, Unlock, UserPlus } from 'lucide-react'
import { Button, ButtonLink, Card, PhotoButton, SaveError } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { applicationDetailPath, DETAIL_SECTION, newApplicationPath, useDownloadApplicationPdf } from '@/features/applications'
import { ClassFormModal } from '@/features/classes'
import { useUploadSheetPhoto } from '@/features/grading'
import { formatDate, todayAsStored } from '@/lib/utils'
import type { DashboardActivity, DashboardClass, DashboardOpenApplication, DashboardSummary } from '@/lib/reports'
import { NEXT_STEP, nextStepOf, type ApplicationStep, type ApplicationStepKind } from '../next-step'

const ICON = { size: 18, 'aria-hidden': true } as const

const gradingPath = (id: string) => buildPath(ROUTES.grading, { id })

/** What each step of an application is called on its button, and the screen where it is done. */
const APPLICATION_STEP: Readonly<Record<ApplicationStepKind, { label: string; icon: ReactNode; pathOf: (id: string) => string }>> = {
  [NEXT_STEP.GENERATE_PDF]: { label: 'Gerar o PDF', icon: <FileText {...ICON} />, pathOf: (id) => buildPath(ROUTES.applicationPdf, { id }) },
  [NEXT_STEP.GRADE_SHEETS]: { label: 'Corrigir folhas', icon: <ScanLine {...ICON} />, pathOf: gradingPath },
  [NEXT_STEP.SCORE_OPEN_ENDED]: { label: 'Dar nota às discursivas', icon: <PenLine {...ICON} />, pathOf: gradingPath },
  [NEXT_STEP.PUBLISH_ANSWER_KEY]: {
    label: 'Publicar o gabarito',
    icon: <Send {...ICON} />,
    pathOf: (id) => applicationDetailPath(id, DETAIL_SECTION.VERSIONS),
  },
  [NEXT_STEP.RELEASE_GRADES]: { label: 'Liberar as notas', icon: <Unlock {...ICON} />, pathOf: (id) => applicationDetailPath(id, DETAIL_SECTION.GRADES) },
  [NEXT_STEP.PRINT_SHEETS]: { label: 'Baixar o PDF', icon: <Download {...ICON} />, pathOf: (id) => applicationDetailPath(id) },
}

/** The way out when the step the panel guessed is not the one: the sitting already happened, or grading is over. */
const SECOND_CHOICE: Readonly<Partial<Record<ApplicationStepKind, { label: string; pathOf: (id: string) => string }>>> = {
  [NEXT_STEP.GRADE_SHEETS]: { label: 'Terminou? Liberar as notas', pathOf: (id) => applicationDetailPath(id, DETAIL_SECTION.GRADES) },
  [NEXT_STEP.PRINT_SHEETS]: { label: 'Já aplicou? Corrigir folhas', pathOf: gradingPath },
}

/** The steps of a teacher still setting up that are plain links. */
const SETUP_STEP = {
  [NEXT_STEP.WRITE_QUESTIONS]: {
    label: 'Escrever questões',
    icon: <Library {...ICON} />,
    to: ROUTES.newQuestion,
    context: 'As provas são montadas com as questões do seu banco.',
  },
  [NEXT_STEP.BUILD_EXAM]: {
    label: 'Montar uma prova',
    icon: <FileText {...ICON} />,
    to: ROUTES.newExam,
    context: 'Junte questões do banco numa prova, ou deixe o sistema sortear por conteúdo.',
  },
  [NEXT_STEP.APPLY_EXAM]: {
    label: 'Aplicar uma prova',
    icon: <ClipboardList {...ICON} />,
    to: newApplicationPath(),
    context: 'Escolha a prova, a turma e o dia: as folhas com QR Code saem em seguida.',
  },
} as const

type SetupKind = keyof typeof SETUP_STEP

const LINK_CLASSES = 'link-target text-label text-primary underline'

function Context({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-body text-ink-muted">{children}</p>
}

/** Where the application stands, in the words of the list (P11). */
function progressLineOf(application: DashboardOpenApplication): string {
  if (application.status === 'draft') return 'PDF ainda não gerado'
  return `${application.progress.correctedSheets} de ${application.progress.sheets} folhas corrigidas`
}

/**
 * Sends the photo straight from the panel and opens the upload screen (P15),
 * which shows its reading: the photo's request lives in the query cache, not
 * in this card, so it goes on while the screen changes. On a phone the field
 * itself is the button, since only a tap on it opens the camera; on a computer
 * the link leads to P15, where several files are chosen at once.
 */
function GradeSheetsAction({ application }: Readonly<{ application: DashboardOpenApplication }>) {
  const navigate = useNavigate()
  const upload = useUploadSheetPhoto(application.id)

  const send = (photos: File[]) => {
    if (photos.length === 0) return
    for (const photo of photos) upload.mutate(photo)
    void navigate(gradingPath(application.id))
  }

  return (
    <>
      <span className="md:hidden">
        <PhotoButton camera label="Fotografar folhas" icon={<Camera {...ICON} />} className="bg-accent text-on-accent hover:bg-accent-hover" onPhotos={send} />
      </span>
      <span className="hidden md:inline">
        <ButtonLink variant="primary" icon={<ScanLine {...ICON} />} to={gradingPath(application.id)}>
          Corrigir folhas
        </ButtonLink>
      </span>
    </>
  )
}

/** The PDF of an exam about to be sat, saved right here instead of one screen further. */
function PrintSheetsAction({ application }: Readonly<{ application: DashboardOpenApplication }>) {
  const download = useDownloadApplicationPdf()

  return (
    <>
      <Button variant="primary" icon={<Download {...ICON} />} disabled={download.isPending} onClick={() => download.mutate(application.id)}>
        {download.isPending ? 'Baixando…' : 'Baixar o PDF'}
      </Button>
      <SaveError error={download.error} />
    </>
  )
}

const SPECIAL_ACTION: Readonly<Partial<Record<ApplicationStepKind, (props: { application: DashboardOpenApplication }) => ReactNode>>> = {
  [NEXT_STEP.GRADE_SHEETS]: GradeSheetsAction,
  [NEXT_STEP.PRINT_SHEETS]: PrintSheetsAction,
}

function ApplicationAction({ kind, application }: Readonly<ApplicationStep>) {
  const Special = SPECIAL_ACTION[kind]
  if (Special !== undefined) return <Special application={application} />
  const { label, icon, pathOf } = APPLICATION_STEP[kind]
  return (
    <ButtonLink variant="primary" icon={icon} to={pathOf(application.id)}>
      {label}
    </ButtonLink>
  )
}

/** The other open applications, each with its own step, folded so the one button stays the one thing to do. */
function OtherSteps({ others }: Readonly<{ others: readonly ApplicationStep[] }>) {
  return (
    <details className="rounded-[var(--radius-control)] border border-line">
      <summary className="touch-target flex cursor-pointer items-center px-3 text-label text-primary">Outras pendências ({others.length})</summary>
      <ul className="divide-y divide-line border-t border-line">
        {others.map(({ kind, application }) => (
          <li key={application.id}>
            <Link
              to={APPLICATION_STEP[kind].pathOf(application.id)}
              className="touch-target flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-surface-muted"
            >
              <span className="min-w-0 text-body text-ink">
                {application.title} · {application.detail} · {formatDate(application.date)}
              </span>
              <span className="text-label text-primary">{APPLICATION_STEP[kind].label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}

function ApplicationStepBody({ step }: Readonly<{ step: ApplicationStep & { others: readonly ApplicationStep[] } }>) {
  const { kind, application } = step
  const second = SECOND_CHOICE[kind]

  return (
    <>
      <Context>
        <strong className="text-ink">{application.title}</strong> · {application.detail} · {formatDate(application.date)} ·{' '}
        {progressLineOf(application)}
      </Context>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ApplicationAction kind={kind} application={application} />
        {second !== undefined && (
          <Link to={second.pathOf(application.id)} className={LINK_CLASSES}>
            {second.label}
          </Link>
        )}
      </div>
      {step.others.length > 0 && <OtherSteps others={step.others} />}
    </>
  )
}

/** The class is created right here; saving opens it (P5), ready for its first student. */
function CreateClassBody() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Context>Tudo começa pela turma: depois vêm os alunos, as questões e a prova.</Context>
      <div>
        <Button variant="primary" icon={<GraduationCap {...ICON} />} onClick={() => setOpen(true)}>
          Criar uma turma
        </Button>
      </div>
      <ClassFormModal open={open} onOpenChange={setOpen} editing={null} />
    </>
  )
}

function AddStudentsBody({ schoolClass }: Readonly<{ schoolClass: DashboardClass }>) {
  return (
    <>
      <Context>
        A turma <strong className="text-ink">{schoolClass.name}</strong> ainda não tem alunos para receber a folha.
      </Context>
      <div>
        <ButtonLink variant="primary" icon={<UserPlus {...ICON} />} to={buildPath(ROUTES.classDetail, { id: schoolClass.id })}>
          Cadastrar os alunos
        </ButtonLink>
      </div>
    </>
  )
}

function ReportBody({ application }: Readonly<{ application: DashboardActivity }>) {
  return (
    <>
      <Context>
        As notas de todas as aplicações já foram liberadas. A mais recente: <strong className="text-ink">{application.title}</strong> ·{' '}
        {application.detail} · {formatDate(application.date)}.
      </Context>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonLink variant="primary" icon={<BarChart3 {...ICON} />} to={buildPath(ROUTES.applicationReport, { id: application.id })}>
          Ver o relatório
        </ButtonLink>
        <Link to={newApplicationPath()} className={LINK_CLASSES}>
          Aplicar outra prova
        </Link>
      </div>
    </>
  )
}

function SetupBody({ kind }: Readonly<{ kind: SetupKind }>) {
  const { label, icon, to, context } = SETUP_STEP[kind]

  return (
    <>
      <Context>{context}</Context>
      <div>
        <ButtonLink variant="primary" icon={icon} to={to}>
          {label}
        </ButtonLink>
      </div>
    </>
  )
}

function StepBody({ summary }: Readonly<{ summary: DashboardSummary }>) {
  const step = nextStepOf(summary, todayAsStored())
  if ('others' in step) return <ApplicationStepBody step={step} />
  if (step.kind === NEXT_STEP.VIEW_REPORT) return <ReportBody application={step.application} />
  if (step.kind === NEXT_STEP.ADD_STUDENTS) return <AddStudentsBody schoolClass={step.schoolClass} />
  if (step.kind === NEXT_STEP.CREATE_CLASS) return <CreateClassBody />
  return <SetupBody kind={step.kind} />
}

/**
 * "Próximo passo" (#202): the one action that moves the teacher's work on,
 * first on the panel, with the gold button of the screen. A teacher with
 * sheets in hand grades them from here, the camera included on a phone; one
 * still setting up is taken to what is missing. Built only once the summary
 * has arrived, or it would tell every teacher to create a class while loading.
 */
export function NextStepCard({ summary }: Readonly<{ summary: DashboardSummary }>) {
  const headingId = useId()

  return (
    <Card data-tour="next-step" className="p-5">
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-title text-primary">
          Próximo passo
        </h2>
        <StepBody summary={summary} />
      </section>
    </Card>
  )
}
