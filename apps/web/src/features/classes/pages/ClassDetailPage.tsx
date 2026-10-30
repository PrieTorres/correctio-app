import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Pencil, RotateCcw, ShieldOff, Trash2, Upload, UserPlus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ClassesIllustration,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchIllustration,
  SearchInput,
  Tour,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { matchesSearch } from '@/lib/utils'
import type { Class, Student } from '@/types/domain'
import { useArchiveClass, useClass, useStudentAction, useStudents, type StudentAction } from '../hooks/useClasses'
import { ArchiveClassDialog } from '../components/ArchiveClassDialog'
import { ClassFormModal } from '../components/ClassFormModal'
import { StudentFormModal } from '../components/StudentFormModal'
import { ImportStudentsDialog } from '../components/ImportStudentsDialog'

interface PendingAction {
  action: StudentAction
  student: Student
}

/**
 * The one dialog open over the screen, if any. A union rather than a flag per
 * dialog, because two of them open at once is not a state the screen has.
 */
type OpenDialog =
  | { kind: 'add-student' }
  | { kind: 'import' }
  | { kind: 'edit-class' }
  | { kind: 'archive-class' }
  | ({ kind: 'student-action' } & PendingAction)
  | null

/** Says what is blocked and what unblocks it, in the header and in the empty list alike. */
const ARCHIVED_REASON = 'Esta turma está arquivada e não recebe alunos novos. Restaure a turma para adicionar ou importar alunos.'

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

/**
 * An archived class keeps its students on screen and every action over them,
 * but takes no new one (#144). The two buttons that would add stay where they
 * are, disabled and pointing to the reason, so the teacher learns why instead
 * of wondering where they went.
 */
function ClassDetail({ schoolClass }: Readonly<{ schoolClass: Class }>) {
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const reasonId = useId()
  const archived = schoolClass.status === 'archived'

  const students = useStudents(schoolClass.id)
  const studentList = students.data ?? []
  const close = () => setDialog(null)

  const addButtons = (
    <AddStudentButtons
      blockedBy={archived ? reasonId : undefined}
      onAdd={() => setDialog({ kind: 'add-student' })}
      onImport={() => setDialog({ kind: 'import' })}
    />
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

      <PageHeader
        help
        title={schoolClass.name}
        description={`${schoolClass.subject} · ${schoolClass.term}`}
        status={archived ? <Badge>Arquivada</Badge> : <Badge tone="success">Ativa</Badge>}
        actions={
          <>
            <ClassActions
              archived={archived}
              onEdit={() => setDialog({ kind: 'edit-class' })}
              onToggleArchive={() => setDialog({ kind: 'archive-class' })}
            />
            {addButtons}
          </>
        }
      />

      {archived && (
        <p id={reasonId} role="note" className="text-body text-ink-muted">
          {ARCHIVED_REASON}
        </p>
      )}

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
          archived={archived}
          emptyAction={addButtons}
          onAction={(action, student) => setDialog({ kind: 'student-action', action, student })}
        />
      </Card>

      <ClassDialogs schoolClass={schoolClass} dialog={dialog} onClose={close} />

      <Tour screen="classDetail" ready={studentList.length > 0} />
    </div>
  )
}

/** Every dialog of the screen, each open only while `dialog` names it. */
function ClassDialogs({
  schoolClass,
  dialog,
  onClose,
}: Readonly<{ schoolClass: Class; dialog: OpenDialog; onClose: () => void }>) {
  const kind = dialog?.kind
  const onOpenChange = (open: boolean) => !open && onClose()

  return (
    <>
      <StudentFormModal open={kind === 'add-student'} onOpenChange={onOpenChange} classId={schoolClass.id} />
      <ImportStudentsDialog classId={schoolClass.id} open={kind === 'import'} onOpenChange={onOpenChange} />
      <ClassFormModal open={kind === 'edit-class'} onOpenChange={onOpenChange} editing={schoolClass} />
      <ArchiveClassFlow schoolClass={schoolClass} open={kind === 'archive-class'} onClose={onClose} />
      <StudentActionDialog
        classId={schoolClass.id}
        pending={dialog?.kind === 'student-action' ? dialog : null}
        onClose={onClose}
      />
    </>
  )
}

/** Edit always; archive or restore, whichever the class is not. */
function ClassActions({
  archived,
  onEdit,
  onToggleArchive,
}: Readonly<{ archived: boolean; onEdit: () => void; onToggleArchive: () => void }>) {
  return (
    <>
      <Button variant="ghost" icon={<Pencil size={18} aria-hidden />} onClick={onEdit}>
        Editar
      </Button>
      <Button
        variant="ghost"
        icon={archived ? <RotateCcw size={18} aria-hidden /> : <Archive size={18} aria-hidden />}
        onClick={onToggleArchive}
      >
        {archived ? 'Restaurar' : 'Arquivar'}
      </Button>
    </>
  )
}

/**
 * "Importar alunos" and "Adicionar aluno", in the header and in the empty
 * list. `blockedBy` is the id of the text that says why they are off, read out
 * with the button by a screen reader.
 */
function AddStudentButtons({
  blockedBy,
  onAdd,
  onImport,
}: Readonly<{ blockedBy: string | undefined; onAdd: () => void; onImport: () => void }>) {
  const blocked = blockedBy !== undefined

  return (
    <>
      <Button
        icon={<Upload size={18} aria-hidden />}
        data-tour="import"
        disabled={blocked}
        aria-describedby={blockedBy}
        onClick={onImport}
      >
        Importar alunos
      </Button>
      <Button
        variant="primary"
        icon={<UserPlus size={18} aria-hidden />}
        data-tour="create"
        disabled={blocked}
        aria-describedby={blockedBy}
        onClick={onAdd}
      >
        Adicionar aluno
      </Button>
    </>
  )
}

/**
 * Archiving from here leaves the screen for the list, as the spec asks
 * ("Arquivar → confirmação → P3"): the class is no longer among the active
 * ones the teacher came from. Restoring stays, since the teacher is likely here
 * to add students again.
 */
function ArchiveClassFlow({
  schoolClass,
  open,
  onClose,
}: Readonly<{ schoolClass: Class; open: boolean; onClose: () => void }>) {
  const archiveClass = useArchiveClass()
  const navigate = useNavigate()
  const archiving = schoolClass.status === 'active'

  const close = () => {
    archiveClass.reset()
    onClose()
  }

  const confirm = () =>
    archiveClass.mutate(
      { id: schoolClass.id, archive: archiving },
      {
        onSuccess: () => {
          close()
          if (archiving) void navigate(ROUTES.classes)
        },
      },
    )

  return (
    <ArchiveClassDialog
      item={open ? schoolClass : null}
      pending={archiveClass.isPending}
      error={archiveClass.error}
      onOpenChange={(isOpen) => !isOpen && close()}
      onConfirm={confirm}
    />
  )
}

/**
 * The students of the class, or why they are not here. A failed load is an
 * error with a way to try again, never "Nenhum aluno ainda": an empty
 * class and an unreachable server call for opposite actions.
 */
function StudentSection({
  isPending,
  error,
  onRetry,
  students,
  archived,
  emptyAction,
  onAction,
}: Readonly<{
  isPending: boolean
  error: Error | null
  onRetry: () => void
  students: Student[]
  archived: boolean
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
        title="Nenhum aluno ainda"
        description={
          archived
            ? ARCHIVED_REASON
            : 'Os alunos cadastrados aqui recebem a prova e a nota. Cadastre um a um, ou copie a lista da planilha e cole em "Importar alunos".'
        }
        action={archived ? undefined : <div className="flex flex-wrap justify-center gap-3">{emptyAction}</div>}
      />
    )
  }

  return <StudentList students={students} onAction={onAction} />
}

/**
 * Filtered in the render, from the class already loaded: a class is a few
 * dozen students, and the list on screen is the whole of it, so asking the
 * server again for each letter typed would only add waiting.
 */
function StudentList({
  students,
  onAction,
}: Readonly<{ students: Student[]; onAction: (action: StudentAction, student: Student) => void }>) {
  const [search, setSearch] = useState('')
  const found = students.filter((student) => matchesSearch(search, student.fullName, student.registration))

  return (
    <>
      <div className="border-b border-line px-5 py-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Buscar aluno por nome ou matrícula"
          placeholder="Buscar por nome ou matrícula"
        />
      </div>

      {found.length === 0 ? (
        <EmptyState
          illustration={<SearchIllustration />}
          title="Nenhum aluno encontrado"
          description="Nenhum aluno desta turma bate com o que você buscou. Tente outro nome ou matrícula, ou limpe a busca para ver todos."
          action={<Button onClick={() => setSearch('')}>Limpar busca</Button>}
        />
      ) : (
        <ul data-tour="list" className="divide-y divide-line">
          {found.map((student) => (
            <StudentRow key={student.id} student={student} onAction={(action) => onAction(action, student)} />
          ))}
        </ul>
      )}
    </>
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
