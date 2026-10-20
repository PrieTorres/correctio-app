import { useEffect, useState } from 'react'
import { Button, Drawer, SaveError } from '@/components/ui'
import {
  describeImport,
  describeReady,
  parseStudents,
  studentCount,
  type ParseProblem,
  type ParsedStudent,
} from '@/lib/import'
import type { ImportResult } from '@/lib/repositories/student-repository'
import { useImportStudents } from '../hooks/useClasses'
import { PrivacyNotice } from './PrivacyNotice'

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
 * with its line number, and the rest still comes in. Once the import is done,
 * the drawer stays open on what happened, since the skipped registrations are
 * news the teacher would otherwise never get.
 */
export function ImportStudentsDialog({
  classId,
  open,
  onOpenChange,
}: Readonly<ImportStudentsDialogProps>) {
  const importStudents = useImportStudents(classId)
  const { reset: resetImport } = importStudents
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (!open) return
    setRaw('')
    resetImport()
  }, [open, resetImport])

  const { students, problems } = parseStudents(raw)
  const result = importStudents.data
  const close = () => onOpenChange(false)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Importar alunos"
      description="Cole a lista da planilha. Uma linha por aluno."
      footer={
        result === undefined ? (
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={students.length === 0 || importStudents.isPending}
              onClick={() => importStudents.mutate(students)}
            >
              {importStudents.isPending ? 'Importando…' : `Importar ${studentCount(students.length)}`}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="primary" onClick={close}>
              Fechar
            </Button>
          </div>
        )
      }
    >
      {result === undefined ? (
        <div className="flex flex-col gap-4">
          <ImportPreview raw={raw} onRawChange={setRaw} students={students} problems={problems} />
          <PrivacyNotice />
          <SaveError error={importStudents.error} />
        </div>
      ) : (
        <ImportOutcome result={result} />
      )}
    </Drawer>
  )
}

function ImportPreview({
  raw,
  onRawChange,
  students,
  problems,
}: Readonly<{
  raw: string
  onRawChange: (raw: string) => void
  students: ParsedStudent[]
  problems: ParseProblem[]
}>) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-students" className="text-label text-ink-muted">
          Nome, matrícula e e-mail
        </label>
        <textarea
          id="import-students"
          rows={8}
          value={raw}
          onChange={(event) => onRawChange(event.target.value)}
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
            {describeReady(students.length)}
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
    </>
  )
}

function ImportOutcome({ result }: Readonly<{ result: ImportResult }>) {
  const summary = describeImport(result)

  return (
    <div role="status" className="flex flex-col gap-2">
      <h3 className="text-title text-primary">Importação concluída</h3>
      <p className="text-body text-ink">{summary.created}</p>
      {summary.skipped !== undefined && <p className="text-body text-ink-muted">{summary.skipped}</p>}
    </div>
  )
}
