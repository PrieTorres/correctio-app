import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldOff, Trash2, Upload, UserPlus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ClassesIllustration,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Tour,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { Class, Student } from '@/types/domain'
import { useClass, useStudentAction, useStudents, type StudentAction } from '../hooks/useClasses'
import { StudentFormModal } from '../components/StudentFormModal'
import { ImportStudentsDialog } from '../components/ImportStudentsDialog'

interface PendingAction {
  action: StudentAction
  student: Student
}

/**
 * Remove and anonymize are deliberately distinct: removing a student from a
 * class preserves their grades but keeps the personal data, while anonymizing
 * erases the personal data and keeps the grade. Only the latter satisfies a
 * deletion request.
 */
const ACTION_COPY: Record<StudentAction, (name: string) => { title: string; description: string; confirmLabel: string }> = {
  anonymize: (name) => ({
    title: `Anonimizar ${name}?`,
    description:
      'Nome, matrícula e e-mail serão apagados de forma irreversível. As notas já registradas são preservadas, sem vínculo com a identidade.',
    confirmLabel: 'Anonimizar',
  }),
  remove: (name) => ({
    title: `Remover ${name} da turma?`,
    description:
      'O aluno sai desta turma. As notas já lançadas para ele são preservadas — isto não apaga dados pessoais. Para isso, use Anonimizar.',
    confirmLabel: 'Remover',
  }),
}

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: schoolClass, isPending, isError } = useClass(id)

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando turma…">
      {schoolClass === null || schoolClass === undefined ? <ClassNotFound /> : <ClassDetail schoolClass={schoolClass} />}
    </QueryBoundary>
  )
}

/** Also what a class of another teacher looks like: the API answers 404, never 403, and the screen does not tell them apart. */
function ClassNotFound() {
  return (
    <Card className="p-6">
      <p className="text-body text-ink-muted">Turma não encontrada.</p>
      <Link to={ROUTES.classes} className="mt-3 inline-block text-label text-primary underline">
        Voltar para turmas
      </Link>
    </Card>
  )
}

function ClassDetail({ schoolClass }: Readonly<{ schoolClass: Class }>) {
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const students = useStudents(schoolClass.id)
  const studentList = students.data ?? []

  const addStudentButton = (
    <Button
      variant="primary"
      icon={<UserPlus size={18} aria-hidden />}
      data-tour="create"
      onClick={() => setFormOpen(true)}
    >
      Adicionar aluno
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.classes}
        className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Turmas
      </Link>

      <PageHeader help
        title={schoolClass.name}
        description={`${schoolClass.subject} · ${schoolClass.term}`}
        actions={
          <>
            <Button icon={<Upload size={18} aria-hidden />} data-tour="import" onClick={() => setImportOpen(true)}>
              Importar alunos
            </Button>
            {addStudentButton}
          </>
        }
      />

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-title text-primary">
            Alunos {students.isSuccess && <span className="text-body text-ink-subtle">({studentList.length})</span>}
          </h2>
        </div>

        <StudentSection
          isPending={students.isPending}
          error={students.error}
          onRetry={() => void students.refetch()}
          students={studentList}
          emptyAction={addStudentButton}
          onAction={(action, student) => setPending({ action, student })}
        />
      </Card>

      <StudentFormModal open={formOpen} onOpenChange={setFormOpen} classId={schoolClass.id} />

      <ImportStudentsDialog
        classId={schoolClass.id}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <Tour screen="classDetail" ready={studentList.length > 0} />

      <StudentActionDialog classId={schoolClass.id} pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}

/**
 * The students of the class, or why they are not here. A failed load is an
 * error with a way to try again, never "Nenhum aluno nesta turma": an empty
 * class and an unreachable server call for opposite actions.
 */
function StudentSection({
  isPending,
  error,
  onRetry,
  students,
  emptyAction,
  onAction,
}: Readonly<{
  isPending: boolean
  error: Error | null
  onRetry: () => void
  students: Student[]
  emptyAction: ReactNode
  onAction: (action: StudentAction, student: Student) => void
}>) {
  if (error !== null) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-5 py-6">
        <p className="text-body text-danger">Não foi possível carregar os alunos.</p>
        <p className="text-caption text-ink-muted">{error.message}</p>
        <Button onClick={onRetry}>Tentar de novo</Button>
      </div>
    )
  }

  if (isPending) return <p className="px-5 py-6 text-body text-ink-muted">Carregando alunos…</p>

  if (students.length === 0) {
    return (
      <EmptyState
        illustration={<ClassesIllustration />}
        title="Nenhum aluno nesta turma"
        description="Os alunos cadastrados aqui recebem a prova e a nota. Cadastre um a um, ou importe a lista inteira de uma planilha Excel ou arquivo JSON."
        action={emptyAction}
      />
    )
  }

  return (
    <ul data-tour="list" className="divide-y divide-line">
      {students.map((student) => (
        <StudentRow key={student.id} student={student} onAction={(action) => onAction(action, student)} />
      ))}
    </ul>
  )
}

/**
 * Confirms a removal or an anonymization. The dialog closes only once the API
 * accepted; a refusal stays on screen with its reason, since closing would
 * look exactly like success.
 */
function StudentActionDialog({
  classId,
  pending,
  onClose,
}: Readonly<{
  classId: string
  pending: PendingAction | null
  onClose: () => void
}>) {
  const studentAction = useStudentAction(classId)
  if (pending === null) return null

  const close = () => {
    studentAction.reset()
    onClose()
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && close()}
      destructive={pending.action === 'anonymize'}
      pending={studentAction.isPending}
      error={studentAction.error}
      onConfirm={() =>
        studentAction.mutate({ id: pending.student.id, action: pending.action }, { onSuccess: close })
      }
      {...ACTION_COPY[pending.action](pending.student.fullName)}
    />
  )
}

function StudentRow({
  student,
  onAction,
}: Readonly<{
  student: Student
  onAction: (action: StudentAction) => void
}>) {
  const isAnonymized = student.anonymizedAt !== undefined

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink">{student.fullName}</span>
          {isAnonymized && <Badge>Anonimizado</Badge>}
        </div>
        <p className="text-caption text-ink-subtle">
          Matrícula {student.registration}
          {student.email !== undefined && ` · ${student.email}`}
        </p>
      </div>

      {!isAnonymized && (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            icon={<ShieldOff size={16} aria-hidden />}
            onClick={() => onAction('anonymize')}
          >
            Anonimizar
          </Button>
          <Button
            variant="ghost"
            icon={<Trash2 size={16} aria-hidden />}
            onClick={() => onAction('remove')}
          >
            Remover
          </Button>
        </div>
      )}
    </li>
  )
}
