import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink, Badge, ButtonLink, Card, EmptyState, PageHeader, QueryBoundary, SearchIllustration } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import type { ApplicationReport, Distribution, ReportQuestion, ReportStudentRow, TagAccuracy } from '@/lib/reports';
import { Tour } from '@/components/ui/Tour';
import { ExportButtons } from '../components/ExportButtons';
import { useApplicationReport } from '../hooks/useApplicationReport';
import { REPORT_KIND } from '../hooks/useExportReport';

type SortKey = 'name' | 'score';

/** The tallest bar of the histogram, in pixels; the others are drawn in proportion. */
const BAR_HEIGHT_PX = 120;

/**
 * The report of one application (P18, RF34 and RF35). Every number comes
 * calculated from the server (#50), from the finished corrections only; the
 * screen draws what arrives and never counts on its own.
 */
export function ApplicationReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isPending, isError } = useApplicationReport(id);
  const finished = report?.summary.count ?? 0;

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Calculando o relatório…">
      <div className="flex flex-col gap-6">
        <BackLink to={id === undefined ? ROUTES.applications : buildPath(ROUTES.applicationDetail, { id })}>Aplicação</BackLink>

        <PageHeader
          help
          title="Relatório da aplicação"
          description={report === undefined ? '' : `${report.examTitle} · ${report.className}`}
          actions={<ExportButtons report={{ kind: REPORT_KIND.APPLICATION, applicationId: id ?? '' }} disabled={finished === 0} />}
        />

        {report !== undefined && <Progress report={report} />}

        {report === undefined || finished === 0 ? <NothingCorrected applicationId={id ?? ''} /> : <ReportSections report={report} />}
      </div>

      <Tour screen="applicationReport" ready={finished > 0} />
    </QueryBoundary>
  );
}

/**
 * How much of the class the numbers describe. The corrections still waiting
 * for an open-ended score are named apart (RF48): they are out of every number
 * until the teacher finishes them.
 */
function Progress({ report }: Readonly<{ report: ApplicationReport }>) {
  return (
    <p className="text-body text-ink-muted">
      {report.summary.count} de {report.sheets} folhas corrigidas
      {report.inProgress > 0 && (
        <>
          {' · '}
          {report.inProgress} em andamento, fora das contas até a correção terminar
        </>
      )}
    </p>
  );
}

function NothingCorrected({ applicationId }: Readonly<{ applicationId: string }>) {
  return (
    <Card>
      <EmptyState
        illustration={<SearchIllustration />}
        title="Nada corrigido ainda"
        description="As estatísticas aparecem assim que a primeira folha for corrigida. Uma correção já basta para ver a distribuição."
        action={
          <ButtonLink variant="secondary" to={buildPath(ROUTES.grading, { id: applicationId })}>
            Corrigir folhas
          </ButtonLink>
        }
      />
    </Card>
  );
}

function ReportSections({ report }: Readonly<{ report: ApplicationReport }>) {
  const { summary } = report;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Figure label="Corrigidas" value={summary.count} />
        <Figure label="Média" value={summary.mean} />
        <Figure label="Mediana" value={summary.median} />
        <Figure label="Desvio padrão" value={summary.standardDeviation} />
        <Figure label="Menor e maior" value={`${summary.lowest} – ${summary.highest}`} />
      </div>
      <DistributionCard bands={report.distribution} />
      <GradesCard students={report.students} />
      <QuestionsCard questions={report.questions} />
      <TagsCard tags={report.tags} />
    </>
  );
}

function DistributionCard({ bands }: Readonly<{ bands: readonly Distribution[] }>) {
  const tallest = Math.max(1, ...bands.map((band) => band.count));

  return (
    <Card data-tour="distribution" className="flex flex-col gap-4 p-6">
      <h2 className="text-title text-primary">Distribuição das notas</h2>
      <ul className="flex items-end gap-3">
        {bands.map((band) => (
          <li key={band.from} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-caption text-ink-muted">{band.count}</span>
            <div
              role="img"
              aria-label={`${band.count} notas entre ${band.from} e ${band.to}`}
              style={{ height: `${Math.max(4, (band.count / tallest) * BAR_HEIGHT_PX)}px` }}
              className="w-full rounded-t-[var(--radius-chip)] bg-primary-fixed"
            />
            <span className="text-caption text-ink-subtle">
              {band.from}–{band.to}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const byScore = (a: ReportStudentRow, b: ReportStudentRow) => b.totalScore - a.totalScore;

/** The server sends the rows in name order; sorting by grade is the only order worked out here. */
function GradesCard({ students }: Readonly<{ students: readonly ReportStudentRow[] }>) {
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const rows = sortBy === 'name' ? students : students.toSorted(byScore);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Notas por aluno</h2>
        <div className="flex gap-2">
          <SortButton active={sortBy === 'name'} onClick={() => setSortBy('name')}>
            Por nome
          </SortButton>
          <SortButton active={sortBy === 'score'} onClick={() => setSortBy('score')}>
            Por nota
          </SortButton>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">Notas de cada aluno nesta aplicação</caption>
          <thead className="text-label text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 text-left">Aluno</th>
              <th scope="col" className="px-5 py-3 text-left">Matrícula</th>
              <th scope="col" className="px-5 py-3 text-right">Versão</th>
              <th scope="col" className="px-5 py-3 text-right">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.correctionId}>
                <td className="px-5 py-3 text-ink">{row.name}</td>
                <td className="px-5 py-3 text-ink-muted">{row.registration === '' ? '—' : row.registration}</td>
                <td className="px-5 py-3 text-right text-ink-muted">{row.versionNumber ?? '—'}</td>
                <td className="px-5 py-3 text-right text-ink">{row.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function accuracyTone(percentage: number): 'success' | 'warning' | 'danger' {
  if (percentage >= 70) return 'success';
  return percentage >= 40 ? 'warning' : 'danger';
}

/** Only the multiple-choice questions: an open-ended one has no alternative to count. */
function QuestionsCard({ questions }: Readonly<{ questions: readonly ReportQuestion[] }>) {
  return (
    <Card data-tour="by-question">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Por questão</h2>
        <p className="mt-1 text-caption text-ink-subtle">
          A alternativa que mais atraiu costuma nomear o engano, não a dificuldade.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {questions.map((question) => (question.accuracy === undefined ? null : <QuestionItem key={question.questionId} question={question} accuracy={question.accuracy} />))}
      </ul>
    </Card>
  );
}

function QuestionItem({ question, accuracy }: Readonly<{ question: ReportQuestion; accuracy: NonNullable<ReportQuestion['accuracy']> }>) {
  return (
    <li className="flex flex-col gap-1 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-ink">
          <span className="text-ink-subtle">{question.number}.</span> {question.statement}
        </p>
        <Badge tone={accuracyTone(accuracy.percentage)}>{accuracy.percentage}% de acerto</Badge>
      </div>
      <p className="text-caption text-ink-subtle">
        {accuracy.correct} de {accuracy.answered} acertaram
        {accuracy.mostMarkedLetter !== undefined && <> · mais marcada: alternativa {accuracy.mostMarkedLetter}</>}
      </p>
    </li>
  );
}

function TagsCard({ tags }: Readonly<{ tags: readonly TagAccuracy[] }>) {
  return (
    <Card data-tour="by-tag">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Por conteúdo</h2>
        <p className="mt-1 text-caption text-ink-subtle">
          Do conteúdo menos aprendido para o mais. É por aqui que se decide o que retomar.
        </p>
      </div>
      {tags.length === 0 ? (
        <p className="px-5 py-6 text-body text-ink-muted">
          Nenhuma questão desta prova tem tag. Marcar as questões por conteúdo é o que faz esta seção existir.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {tags.map((tag) => (
            <li key={tag.tag} className="flex items-center justify-between gap-3 px-5 py-4">
              <span className="text-body text-ink">{tag.tag}</span>
              <span className="text-caption text-ink-subtle">
                {tag.correct} de {tag.answered} · {tag.percentage}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Figure({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="text-headline text-primary">{value}</span>
    </Card>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`touch-target rounded-[var(--radius-control)] px-3 text-label ${
        active ? 'bg-primary-container text-on-primary' : 'text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}
