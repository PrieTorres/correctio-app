import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, PageHeader, QueryBoundary } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { formatDate } from '@/lib/utils';
import { useStudents } from '@/features/classes';
import { useExam } from '@/features/exams';
import type { AnswerSheet, ExamVersion } from '@/types/domain';
import {
  useApplication,
  useApplicationPrinting,
  useCorrectionsOfApplication,
  usePublishAnswerKey,
  useReleaseGrades,
} from '../hooks/useApplications';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: application, isPending, isError } = useApplication(id);
  const { data: exam } = useExam(application?.examId);
  const { data: printing } = useApplicationPrinting(id);
  const { data: corrections = [] } = useCorrectionsOfApplication(id);
  const { data: students = [] } = useStudents(application?.classId);
  const publishAnswerKey = usePublishAnswerKey();
  const releaseGrades = useReleaseGrades();

  const versions = printing?.versions ?? [];
  const sheets = printing?.sheets ?? [];
  const studentName = new Map(students.map((student) => [student.id, student.fullName]));

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicação…">
      {application === null || application === undefined ? (
        <Card className="p-6">
          <p className="text-body text-ink-muted">Aplicação não encontrada.</p>
          <Link to={ROUTES.applications} className="mt-3 inline-block text-label text-primary underline">
            Voltar para aplicações
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Link
            to={ROUTES.applications}
            className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
          >
            <ArrowLeft size={16} aria-hidden />
            Aplicações
          </Link>

          <PageHeader
            title={exam?.title ?? 'Prova removida'}
            description={`Aplicada em ${formatDate(application.date)}`}
            actions={
              <Button icon={<RefreshCw size={18} aria-hidden />}>
                <Link to={buildPath(ROUTES.applicationPdf, { id: application.id })}>
                  {versions.length > 0 ? 'Gerar de novo' : 'Gerar'}
                </Link>
              </Button>
            }
          />

          <PdfCard hasPaper={versions.length > 0} sheetCount={sheets.length} />

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-title text-primary">Versões</h2>
            </div>
            {versions.length === 0 ? (
              <p className="px-5 py-6 text-body text-ink-muted">
                Nada foi gerado ainda. As versões aparecem aqui depois de gerar.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {versions.map((version) => (
                  <li key={version.id}>
                    <VersionRow
                      version={version}
                      pending={publishAnswerKey.isPending}
                      onTogglePublish={() =>
                        publishAnswerKey.mutate({
                          versionId: version.id,
                          published: !version.answerKeyPublished,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-title text-primary">Folhas</h2>
              <p className="mt-1 text-caption text-ink-subtle">
                Uma por aluno, com o código que a consulta pública de nota resolve.
              </p>
            </div>
            {sheets.length === 0 ? (
              <p className="px-5 py-6 text-body text-ink-muted">
                Nenhuma folha ainda.
              </p>
            ) : (
              <SheetTable sheets={sheets} versions={versions} studentName={studentName} />
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <h2 className="text-title text-primary">Correção</h2>
            <p className="text-body text-ink-muted" aria-live="polite">
              {corrections.length} de {sheets.length} folhas corrigidas
            </p>
            <Button variant="secondary" className="self-start">
              <Link to={buildPath(ROUTES.grading, { id: application.id })}>Corrigir folhas</Link>
            </Button>
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <h2 className="text-title text-primary">Notas para os alunos</h2>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={application.gradesReleased}
                disabled={releaseGrades.isPending}
                onChange={(event) =>
                  releaseGrades.mutate({ id: application.id, released: event.target.checked })
                }
                className="size-4 accent-[var(--color-primary)]"
              />
              <span className="text-body text-ink">Liberar a consulta de nota por QR Code</span>
            </label>
            <p className="text-caption text-ink-subtle">
              Enquanto estiver desligado, quem ler o QR vê que a nota ainda não foi liberada. É
              opcional: nem toda turma usa.
            </p>
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
}

/**
 * The PDF is a fixed sample in this phase.
 *
 * Rendering a real one is server work and belongs to the next phase; what has
 * to exist now are the sheets and their codes, because the public lookup reads
 * them. Saying so on the screen beats a download that quietly produces the
 * wrong paper.
 */
function PdfCard({ hasPaper, sheetCount }: Readonly<{ hasPaper: boolean; sheetCount: number }>) {
  return (
    <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FileText size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <div>
          <h2 className="text-title text-primary">PDF para impressão</h2>
          <p className="mt-1 text-body text-ink-muted">
            {hasPaper
              ? `${sheetCount} folhas prontas para imprimir.`
              : 'Gere a aplicação para produzir o PDF.'}
          </p>
          <p className="mt-1 text-caption text-ink-subtle">
            Nesta fase o arquivo é um exemplo fixo. A montagem real do PDF, com a paginação que
            não quebra questão, entra junto com o servidor.
          </p>
        </div>
      </div>
      <Button icon={<Download size={18} aria-hidden />} disabled={!hasPaper}>
        Baixar PDF de exemplo
      </Button>
    </Card>
  );
}

function VersionRow({
  version,
  pending,
  onTogglePublish,
}: Readonly<{ version: ExamVersion; pending: boolean; onTogglePublish: () => void }>) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label text-ink">Versão {version.versionNumber}</span>
          {version.answerKeyPublished && <Badge tone="success">Gabarito publicado</Badge>}
          {!version.withStudentIdentification && <Badge>Sem identificação</Badge>}
        </div>
        <p className="mt-1 text-caption text-ink-subtle">
          {version.layout.questionOrder.length} questões · código {version.publicCode.slice(0, 8)}
        </p>
      </div>
      <Button variant="ghost" disabled={pending} onClick={onTogglePublish}>
        {version.answerKeyPublished ? 'Despublicar gabarito' : 'Publicar gabarito'}
      </Button>
    </div>
  );
}

function SheetTable({
  sheets,
  versions,
  studentName,
}: Readonly<{
  sheets: AnswerSheet[];
  versions: ExamVersion[];
  studentName: Map<string, string>;
}>) {
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
                {sheet.studentId === undefined
                  ? 'Sem identificação'
                  : (studentName.get(sheet.studentId) ?? 'Aluno removido')}
              </td>
              <td className="px-5 py-3 text-ink-muted">
                {versionNumber.get(sheet.examVersionId) ?? '—'}
              </td>
              <td className="px-5 py-3 font-mono text-caption text-ink-subtle">{sheet.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
