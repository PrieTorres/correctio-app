import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge, Button, Card, NumberInput, PageHeader, QueryBoundary } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  pendingDiscursiveQuestionIds,
  totalCorrectionScore,
  type MarkedAnswer,
} from '@/lib/grading';
import { isMultipleChoice, type DiscursiveScore } from '@/types/domain';
import { useAssignStudent, useConfirmCorrection, useGradingOverview } from '../hooks/useGrading';

const DEMO_SHEET = '/demo-sheets/folha-01.svg';

export function GradingSheetPage() {
  const { id, sheetId } = useParams<{ id: string; sheetId: string }>();
  const navigate = useNavigate();
  const { data, isPending, isError } = useGradingOverview(id);
  const confirmCorrection = useConfirmCorrection();
  const assignStudent = useAssignStudent();

  const [answers, setAnswers] = useState<MarkedAnswer[] | null>(null);
  const [scores, setScores] = useState<DiscursiveScore[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const correction = data?.corrections.find((item) => item.answerSheetId === sheetId);
  const sheet = data?.sheets.find((item) => item.id === sheetId);
  const exam = data?.exam ?? null;
  const bank = useMemo(() => data?.bank ?? [], [data]);

  const byId = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank]);
  const version = data?.versions.find((item) => item.id === sheet?.examVersionId);

  /**
   * What is on screen starts from what was read and is edited here, so nothing
   * is written until the teacher confirms. Deriving the marks from the stored
   * correction on every render would throw away the edits.
   */
  const currentAnswers =
    answers ??
    (correction?.objectiveResults ?? []).map((result) => ({
      questionId: result.questionId,
      ...(result.selectedAlternativeId === undefined
        ? {}
        : { selectedAlternativeId: result.selectedAlternativeId }),
    }));
  const currentScores = scores ?? correction?.discursiveScores ?? [];

  const graded = exam === null ? null : gradeObjectives(exam, bank, currentAnswers);
  const discursiveIds = exam === null ? [] : discursiveQuestionIdsOf(exam, bank);
  const pendingIds = pendingDiscursiveQuestionIds(discursiveIds, currentScores);
  const total = totalCorrectionScore(graded?.results ?? [], currentScores);

  const setAnswer = (questionId: string, selectedAlternativeId: string | undefined) =>
    setAnswers(
      currentAnswers.map((answer) =>
        answer.questionId === questionId
          ? { questionId, ...(selectedAlternativeId === undefined ? {} : { selectedAlternativeId }) }
          : answer,
      ),
    );

  const setScore = (questionId: string, score: number) => {
    const maximum = byId.get(questionId)?.maxScore ?? 0;
    const next = { questionId, score: clampDiscursiveScore(score, maximum) };
    setScores([...currentScores.filter((item) => item.questionId !== questionId), next]);
  };

  const confirm = () => {
    if (correction === undefined || graded === null) return;

    confirmCorrection.mutate(
      {
        correction,
        answers: currentAnswers,
        discursiveScores: currentScores,
        objectiveResults: graded.results,
        discursiveQuestionIds: discursiveIds,
      },
      { onSuccess: () => void navigate(buildPath(ROUTES.grading, { id: id ?? '' })) },
    );
  };

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando correção…">
      {correction === undefined || sheet === undefined || exam === null ? (
        <Card className="p-6">
          <p className="text-body text-ink-muted">Correção não encontrada.</p>
          <Link
            to={buildPath(ROUTES.grading, { id: id ?? '' })}
            className="mt-3 inline-block text-label text-primary underline"
          >
            Voltar para as folhas
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Link
            to={buildPath(ROUTES.grading, { id: id ?? '' })}
            className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
          >
            <ArrowLeft size={16} aria-hidden />
            Folhas
          </Link>

          <PageHeader
            title={`Folha ${sheet.sheetNumber}`}
            description={`Versão ${version?.versionNumber ?? '—'} · leitura automática, revisada por você`}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-title text-primary">Folha lida</h2>
                <div className="flex gap-1">
                  <IconButton label="Diminuir o zoom" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                    <ZoomOut size={16} aria-hidden />
                  </IconButton>
                  <IconButton label="Aumentar o zoom" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                    <ZoomIn size={16} aria-hidden />
                  </IconButton>
                  <IconButton label="Girar a folha" onClick={() => setRotation((r) => (r + 90) % 360)}>
                    <RotateCw size={16} aria-hidden />
                  </IconButton>
                </div>
              </div>
              <div className="flex max-h-[32rem] items-start justify-center overflow-auto rounded-[var(--radius-control)] bg-surface-muted p-4">
                <img
                  src={DEMO_SHEET}
                  alt={`Folha de respostas número ${sheet.sheetNumber}`}
                  style={{ scale: String(zoom), rotate: `${rotation}deg` }}
                  className="max-w-full"
                />
              </div>
              <p className="text-caption text-ink-subtle">
                Imagem de demonstração. O envio real de fotos entra junto com o servidor.
              </p>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="flex items-center justify-between gap-3 p-5">
                <h2 className="text-title text-primary">Nota</h2>
                <p className="text-headline text-primary" aria-live="polite">
                  {total}
                </p>
              </Card>

              {sheet.studentId === undefined && (
                <AssignStudent
                  students={data?.students ?? []}
                  assignedTo={correction.studentId}
                  pending={assignStudent.isPending}
                  onAssign={(studentId) =>
                    assignStudent.mutate({ correctionId: correction.id, studentId })
                  }
                  error={assignStudent.error?.message}
                />
              )}

              {pendingIds.length > 0 && (
                <Card className="border-l-4 border-l-accent p-5">
                  <p role="status" className="text-body text-ink-muted">
                    {pendingIds.length === 1
                      ? 'Falta lançar a nota de 1 questão discursiva.'
                      : `Faltam lançar as notas de ${pendingIds.length} questões discursivas.`}{' '}
                    O sistema já corrigiu as objetivas.
                  </p>
                </Card>
              )}

              <Card>
                <div className="border-b border-line px-5 py-4">
                  <h2 className="text-title text-primary">Questões</h2>
                </div>
                <ol className="divide-y divide-line">
                  {exam.questions
                    .toSorted((a, b) => a.order - b.order)
                    .map((entry, index) => {
                      const question = byId.get(entry.questionId);
                      if (question === undefined) return null;

                      return (
                        <li key={entry.questionId} className="px-5 py-4">
                          {isMultipleChoice(question) ? (
                            <ObjectiveRow
                              index={index}
                              statement={question.statement}
                              alternatives={question.alternatives}
                              correctAlternativeId={question.correctAlternativeId}
                              selectedAlternativeId={
                                currentAnswers.find((a) => a.questionId === entry.questionId)
                                  ?.selectedAlternativeId
                              }
                              onSelect={(alternativeId) =>
                                setAnswer(entry.questionId, alternativeId)
                              }
                            />
                          ) : (
                            <DiscursiveRow
                              index={index}
                              statement={question.statement}
                              maxScore={question.maxScore ?? 0}
                              score={
                                currentScores.find((s) => s.questionId === entry.questionId)?.score
                              }
                              onScore={(score) => setScore(entry.questionId, score)}
                            />
                          )}
                        </li>
                      );
                    })}
                </ol>
              </Card>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => void navigate(buildPath(ROUTES.grading, { id: id ?? '' }))}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={confirmCorrection.isPending} onClick={confirm}>
              {confirmCorrection.isPending ? 'Confirmando…' : 'Confirmar correção'}
            </Button>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

function ObjectiveRow({
  index,
  statement,
  alternatives,
  correctAlternativeId,
  selectedAlternativeId,
  onSelect,
}: Readonly<{
  index: number;
  statement: string;
  alternatives: { id: string; text: string }[];
  correctAlternativeId: string;
  selectedAlternativeId: string | undefined;
  onSelect: (alternativeId: string | undefined) => void;
}>) {
  const right = selectedAlternativeId === correctAlternativeId;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-ink">
          <span className="text-ink-subtle">{index + 1}.</span> {statement}
        </p>
        {selectedAlternativeId === undefined ? (
          <Badge tone="warning">Em branco</Badge>
        ) : (
          <Badge tone={right ? 'success' : 'danger'}>{right ? 'Certa' : 'Errada'}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {alternatives.map((alternative, position) => {
          const letter = 'ABCDE'[position] ?? '?';
          const isCorrect = alternative.id === correctAlternativeId;
          const isSelected = alternative.id === selectedAlternativeId;

          return (
            <button
              key={alternative.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Questão ${index + 1}, alternativa ${letter}${isCorrect ? ', correta' : ''}`}
              onClick={() => onSelect(isSelected ? undefined : alternative.id)}
              className={`touch-target inline-flex size-11 items-center justify-center rounded-full border text-label ${
                isSelected
                  ? 'border-primary bg-primary text-on-primary'
                  : isCorrect
                    ? 'border-success bg-success-surface text-success'
                    : 'border-line text-ink-muted hover:bg-surface-muted'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <p className="text-caption text-ink-subtle">
        Cinza-esverdeado é a alternativa correta; a marcada aparece cheia. Clicar na marcada
        deixa a questão em branco.
      </p>
    </div>
  );
}

function DiscursiveRow({
  index,
  statement,
  maxScore,
  score,
  onScore,
}: Readonly<{
  index: number;
  statement: string;
  maxScore: number;
  score: number | undefined;
  onScore: (score: number) => void;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-ink">
          <span className="text-ink-subtle">{index + 1}.</span> {statement}
        </p>
        <Badge tone={score === undefined ? 'warning' : 'neutral'}>
          {score === undefined ? 'Sem nota' : 'Discursiva'}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span aria-hidden className="text-caption text-ink-muted">
          Nota
        </span>
        <NumberInput
          value={score ?? 0}
          onValueChange={onScore}
          max={maxScore}
          step="0.1"
          label={`Nota da questão ${index + 1}`}
          className={`w-24 ${score === undefined ? 'border-accent' : ''}`}
        />
        <span className="text-caption text-ink-subtle">de {maxScore}</span>
      </div>
    </div>
  );
}

function AssignStudent({
  students,
  assignedTo,
  pending,
  onAssign,
  error,
}: Readonly<{
  students: { id: string; fullName: string }[];
  assignedTo: string | undefined;
  pending: boolean;
  onAssign: (studentId: string) => void;
  error: string | undefined;
}>) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="text-title text-primary">De quem é esta folha?</h2>
      <p className="text-caption text-ink-subtle">
        A prova saiu sem identificação, então o aluno é associado aqui.
      </p>
      <select
        id="assign-student"
        aria-label="Associar esta folha a um aluno"
        value={assignedTo ?? ''}
        disabled={pending}
        onChange={(event) => onAssign(event.target.value)}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
      >
        <option value="">Ainda não associada</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </select>
      {error !== undefined && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}
