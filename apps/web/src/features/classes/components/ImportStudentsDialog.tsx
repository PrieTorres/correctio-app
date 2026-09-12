import { useEffect, useState } from 'react'
import { Button, Drawer } from '@/components/ui'
import { parseStudents } from '@/lib/import'
import { useServices } from '@/app/services'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface ImportStudentsDialogProps {
  classId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EXAMPLE = 'Ana Ribeiro,202601\nBruno Lima,202602,bruno@exemplo.edu.br'

/**
 * Brings a whole class in from a spreadsheet, previewed before anything is
 * written.
 *
 * The preview is the point: a list of forty names pasted blind is forty chances
 * to discover a mistake one student at a time. What cannot be read is shown
 * with its line number, and the rest still comes in.
 */
export function ImportStudentsDialog({
  classId,
  open,
  onOpenChange,
}: Readonly<ImportStudentsDialogProps>) {
  const { repositories } = useServices()
  const queryClient = useQueryClient()
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (open) setRaw('')
  }, [open])

  const { students, problems } = parseStudents(raw)

  const importMany = useMutation({
    mutationFn: () => repositories.students.importMany(classId, students),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] })
      onOpenChange(false)
    },
  })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Importar alunos"
      description="Cole a lista da planilha. Uma linha por aluno."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={students.length === 0 || importMany.isPending}
            onClick={() => importMany.mutate()}
          >
            {importMany.isPending ? 'Importando…' : `Importar ${students.length} alunos`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-students" className="text-label text-ink-muted">
            Nome, matrícula e e-mail
          </label>
          <textarea
            id="import-students"
            rows={8}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder={EXAMPLE}
            className="rounded-[var(--radius-control)] border border-line bg-surface p-3 font-mono text-caption focus:outline-none focus-visible:border-primary"
          />
          <p className="text-caption text-ink-subtle">
            Aceita vírgula, ponto e vírgula ou tabulação. O e-mail é opcional, e a linha de
            cabeçalho da planilha é ignorada.
          </p>
        </div>

        {students.length > 0 && (
          <div>
            <h3 className="text-label text-ink-muted" aria-live="polite">
              {students.length} alunos prontos para importar
            </h3>
            <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
              {students.map((student) => (
                <li
                  key={student.registration}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2 text-caption"
                >
                  <span className="min-w-0 truncate text-ink">{student.fullName}</span>
                  <span className="shrink-0 text-ink-subtle">{student.registration}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {problems.length > 0 && (
          <div role="alert">
            <h3 className="text-label text-danger">
              {problems.length === 1 ? '1 linha não pôde ser lida' : `${problems.length} linhas não puderam ser lidas`}
            </h3>
            <p className="mt-1 text-caption text-ink-subtle">
              As demais serão importadas normalmente.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {problems.map((problem) => (
                <li key={problem.line} className="text-caption text-ink-muted">
                  Linha {problem.line}: {problem.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importMany.isError && (
          <p role="alert" className="text-caption text-danger">
            {importMany.error.message}
          </p>
        )}
      </div>
    </Drawer>
  )
}
