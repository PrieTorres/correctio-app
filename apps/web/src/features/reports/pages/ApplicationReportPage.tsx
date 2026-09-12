import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, QueryBoundary, SearchIllustration } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { accuracyByTag, accuracyOf, distribute, summarise } from '@/lib/reports';
import { totalScore } from '@/lib/exams';
import { useGradingOverview } from '@/features/grading';
import { Tour } from '@/components/ui/Tour';

type SortKey = 'name' | 'score';

export function ApplicationReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError } = useGradingOverview(id);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [exporting, setExporting] = useState(false);

  const corrections = data?.corrections ?? [];
  const exam = data?.exam ?? null;
  const bank = data?.bank ?? [];
  const studentName = new Map((data?.students ?? []).map((s) => [s.id, s.fullName]));
  const sheetNumber = new Map((data?.sheets ?? []).map((s) => [s.id, s.sheetNumber]));

  const maximum = exam === null ? 0 : totalScore(exam.questions);
  const summary = summarise(corrections.map((correction) => correction.totalScore));
  const bands = distribute(
    corrections.map((correction) => correction.totalScore),
    maximum,
  );
  const tallest = Math.max(1, ...bands.map((band) => band.count));

  const objectiveResults = corrections.flatMap((correction) => correction.objectiveResults);
  const byId = new Map(bank.map((question) => [question.id, question]));
  const byTag = accuracyByTag(objectiveResults, (questionId) => byId.get(questionId)?.tags ?? []);

  const rows = corrections
    .map((correction) => ({
      id: correction.id,
      name:
        correction.studentId === undefined
          ? `Folha ${sheetNumber.get(correction.answerSheetId) ?? '—'}`
          : (studentName.get(correction.studentId) ?? 'Aluno removido'),
      score: correction.totalScore,
    }))
    .toSorted((a, b) => (sortBy === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : b.score - a.score));

  /** RF41: a long operation confirms at once and runs out of the way. */
  const exportReport = () => {
    setExporting(true);
    window.setTimeout(() => setExporting(false), 1200);
  };

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Calculando o relatório…">
      <div className="flex flex-col gap-6">
        <Link
          to={id === undefined ? ROUTES.applications : buildPath(ROUTES.applicationDetail, { id })}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Aplicação
        </Link>

        <PageHeader help
          title="Relatório da aplicação"
          description={exam?.title ?? 'Prova removida'}
          actions={
            <Button
              icon={
                exporting ? (
                  <Loader2 size={18} aria-hidden className="animate-spin" />
                ) : (
                  <Download size={18} aria-hidden />
                )
              }
              disabled={exporting || corrections.length === 0}
              onClick={exportReport}
            >
              {exporting ? 'Exportando…' : 'Exportar'}
            </Button>
          }
        />

        {exporting && (
          <p role="status" className="text-caption text-ink-subtle">
            A exportação roda em segundo plano. Você pode continuar usando a tela.
          </p>
        )}

        {corrections.length === 0 ? (
          <Card>
            <EmptyState
              illustration={<SearchIllustration />}
              title="Nada corrigido ainda"
              description="As estatísticas aparecem assim que a primeira folha for corrigida. Uma correção já basta para ver a distribuição."
              action={
                <Button variant="secondary">
                  <Link to={buildPath(ROUTES.grading, { id: id ?? '' })}>Corrigir folhas</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Figure label="Corrigidas" value={summary.count} />
              <Figure label="Média" value={summary.mean} />
              <Figure label="Mediana" value={summary.median} />
              <Figure label="Desvio padrão" value={summary.standardDeviation} />
              <Figure label="Menor e maior" value={`${summary.lowest} – ${summary.highest}`} />
            </div>

            <Card data-tour="distribution" className="flex flex-col gap-4 p-6">
              <h2 className="text-title text-primary">Distribuição das notas</h2>
              <ul className="flex items-end gap-3">
                {bands.map((band) => (
                  <li key={band.from} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-caption text-ink-muted">{band.count}</span>
                    <div
                      role="img"
                      aria-label={`${band.count} notas entre ${band.from} e ${band.to}`}
                      style={{ height: `${Math.max(4, (band.count / tallest) * 120)}px` }}
                      className="w-full rounded-t-[var(--radius-chip)] bg-primary-fixed"
                    />
                    <span className="text-caption text-ink-subtle">
                      {band.from}–{band.to}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

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
                      <th scope="col" className="px-5 py-3 text-left">
                        Aluno
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Nota
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-3 text-ink">{row.name}</td>
                        <td className="px-5 py-3 text-right text-ink">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-title text-primary">Por questão</h2>
                <p className="mt-1 text-caption text-ink-subtle">
                  A alternativa que mais atraiu costuma nomear o engano, não a dificuldade.
                </p>
              </div>
              <ul className="divide-y divide-line">
                {(exam?.questions ?? [])
                  .toSorted((a, b) => a.order - b.order)
                  .flatMap((entry, index) => {
                    const question = byId.get(entry.questionId);
                    if (question === undefined || question.type !== 'objetiva') return [];

                    const accuracy = accuracyOf(entry.questionId, objectiveResults);
                    const marked = question.alternatives?.findIndex(
                      (alternative) => alternative.id === accuracy.mostMarkedAlternativeId,
                    );

                    return [
                      <li key={entry.questionId} className="flex flex-col gap-1 px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-body text-ink">
                            <span className="text-ink-subtle">{index + 1}.</span> {question.statement}
                          </p>
                          <Badge
                            tone={
                              accuracy.percentage >= 70
                                ? 'success'
                                : accuracy.percentage >= 40
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {accuracy.percentage}% de acerto
                          </Badge>
                        </div>
                        <p className="text-caption text-ink-subtle">
                          {accuracy.correct} de {accuracy.answered} acertaram
                          {marked !== undefined && marked >= 0 && (
                            <> · mais marcada: alternativa {'ABCDE'[marked] ?? '?'}</>
                          )}
                        </p>
                      </li>,
                    ];
                  })}
              </ul>
            </Card>

            <Card>
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-title text-primary">Por conteúdo</h2>
                <p className="mt-1 text-caption text-ink-subtle">
                  Do conteúdo menos aprendido para o mais. É por aqui que se decide o que
                  retomar.
                </p>
              </div>
              {byTag.length === 0 ? (
                <p className="px-5 py-6 text-body text-ink-muted">
                  Nenhuma questão desta prova tem tag. Marcar as questões por conteúdo é o que
                  faz esta seção existir.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {byTag.map((tag) => (
                    <li
                      key={tag.tag}
                      className="flex items-center justify-between gap-3 px-5 py-4"
                    >
                      <span className="text-body text-ink">{tag.tag}</span>
                      <span className="text-caption text-ink-subtle">
                        {tag.correct} de {tag.answered} · {tag.percentage}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      <Tour screen="applicationReport" ready={corrections.length > 0} />
    </QueryBoundary>
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
