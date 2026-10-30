import { Card } from '@/components/ui';
import type { AnswerSheet, ExamVersion } from '@/types/domain';

/**
 * The sheets handed out, one per student, with the code the public lookup of
 * the grade resolves (and the QR Code of the sheet carries).
 */
export function SheetsCard({
  sheets,
  versions,
  studentName,
}: Readonly<{ sheets: readonly AnswerSheet[]; versions: readonly ExamVersion[]; studentName: ReadonlyMap<string, string> }>) {
  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Folhas</h2>
        <p className="mt-1 text-caption text-ink-subtle">Uma por aluno, com o código que a consulta pública de nota resolve.</p>
      </div>
      {sheets.length === 0 ? (
        <p className="px-5 py-6 text-body text-ink-muted">Nada foi gerado ainda. As folhas aparecem aqui depois de gerar.</p>
      ) : (
        <SheetTable sheets={sheets} versions={versions} studentName={studentName} />
      )}
    </Card>
  );
}

function SheetTable({
  sheets,
  versions,
  studentName,
}: Readonly<{ sheets: readonly AnswerSheet[]; versions: readonly ExamVersion[]; studentName: ReadonlyMap<string, string> }>) {
  const versionNumber = new Map(versions.map((version) => [version.id, version.versionNumber]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <caption className="sr-only">Folhas geradas para esta aplicação</caption>
        <thead className="text-label text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 text-left">
              Nº
            </th>
            <th scope="col" className="px-5 py-3 text-left">
              Aluno
            </th>
            <th scope="col" className="px-5 py-3 text-left">
              Versão
            </th>
            <th scope="col" className="px-5 py-3 text-left">
              Código
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sheets.map((sheet) => (
            <tr key={sheet.id}>
              <td className="px-5 py-3 text-ink-subtle">{sheet.sheetNumber}</td>
              <td className="px-5 py-3 text-ink">
                {sheet.studentId === undefined ? 'Sem identificação' : (studentName.get(sheet.studentId) ?? 'Aluno removido')}
              </td>
              <td className="px-5 py-3 text-ink-muted">{versionNumber.get(sheet.examVersionId) ?? '—'}</td>
              <td className="px-5 py-3 font-mono text-caption text-ink-subtle">{sheet.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
