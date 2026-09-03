import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldOff, Trash2, Upload, UserPlus, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { Student } from '@/types/domain'
import { useClass, useStudentAction, useStudents, type StudentAction } from '../hooks/useClasses'
import { StudentFormModal } from '../components/StudentFormModal'

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
  const [formOpen, setFormOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const { data: schoolClass, isPending, isError } = useClass(id)
  const { data: students = [] } = useStudents(id)
  const studentAction = useStudentAction(id ?? '')

  const addStudentButton = (
    <Button variant="primary" icon={<UserPlus size={18} aria-hidden />} onClick={() => setFormOpen(true)}>
      Adicionar aluno
    </Button>
  )

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando turma…">
      {schoolClass === null || schoolClass === undefined ? (
        <Card className="p-6">
          <p className="text-body text-ink-muted">Turma não encontrada.</p>
          <Link to={ROUTES.classes} className="mt-3 inline-block text-label text-primary underline">
            Voltar para turmas
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Link
            to={ROUTES.classes}
            className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
          >
            <ArrowLeft size={16} aria-hidden />
            Turmas
          </Link>

          <PageHeader
            title={schoolClass.name}
            description={`${schoolClass.subject} · ${schoolClass.term}`}
            actions={
              <>
                <Button icon={<Upload size={18} aria-hidden />}>Importar alunos</Button>
                {addStudentButton}
              </>
            }
          />

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-title text-primary">
                Alunos <span className="text-body text-ink-subtle">({students.length})</span>
              </h2>
            </div>

            {students.length === 0 ? (
              <EmptyState
                icon={<Users size={24} aria-hidden />}
                title="Nenhum aluno ainda"
                description="Cadastre um a um, ou importe a lista inteira de uma planilha Excel ou arquivo JSON."
                action={addStudentButton}
              />
            ) : (
              <ul className="divide-y divide-line">
                {students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    onAction={(action) => setPending({ action, student })}
                  />
                ))}
              </ul>
            )}
          </Card>

          <StudentFormModal open={formOpen} onOpenChange={setFormOpen} classId={schoolClass.id} />

          {pending !== null && (
            <ConfirmDialog
              open
              onOpenChange={(open) => !open && setPending(null)}
              destructive={pending.action === 'anonymize'}
              pending={studentAction.isPending}
              onConfirm={() =>
                studentAction.mutate(
                  { id: pending.student.id, action: pending.action },
                  { onSettled: () => setPending(null) },
                )
              }
              {...ACTION_COPY[pending.action](pending.student.name)}
            />
          )}
        </div>
      )}
    </QueryBoundary>
  )
}

function StudentRow({
  student,
  onAction,
}: {
  student: Student
  onAction: (action: StudentAction) => void
}) {
  const isAnonymized = student.anonymizedAt !== null

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink">{student.name}</span>
          {isAnonymized && <Badge>Anonimizado</Badge>}
        </div>
        <p className="text-caption text-ink-subtle">
          Matrícula {student.registration}
          {student.email !== null && ` · ${student.email}`}
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
