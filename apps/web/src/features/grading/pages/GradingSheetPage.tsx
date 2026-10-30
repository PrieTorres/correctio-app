import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { BackLink, Badge, Button, Card, NumberInput, PageHeader, QueryBoundary, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  totalCorrectionScore,
  withDefaultDiscursiveScores,
  type MarkedAnswer,
} from '@/lib/grading';
import { isMultipleChoice, type DiscursiveScore } from '@/types/domain';
import { useAssignStudent, useConfirmCorrection, useGradingOverview } from '../hooks/useGrading';

const DEMO_SHEET = '/demo-sheets/folha-01.svg';

type Overview = NonNullable<ReturnType<typeof useGradingOverview>['data']>;

type Correction = Overview['corrections'][number];

type Sheet = Overview['sheets'][number];

type Exam = NonNullable<Overview['exam']>;

type Question = Overview['bank'][number];

export function GradingSheetPage() {
  const { id, sheetId } = useParams<{ id: string; sheetId: string }>();
  const { data, isPending, isError } = useGradingOverview(id);
  const applicationId = id ?? '';

  const correction = data?.corrections.find((item) => item.answerSheetId === sheetId);
  const sheet = data?.sheets.find((item) => item.id === sheetId);
  const exam = data?.exam ?? null;

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando correção…">
      {data == null || correction === undefined || sheet === undefined || exam === null ? (
        <CorrectionNotFound applicationId={applicationId} />
      ) : (
        <SheetReview applicationId={applicationId} overview={data} correction={correction} sheet={sheet} exam={exam} />
      )}
    </QueryBoundary>
  );
}

function CorrectionNotFound({ applicationId }: Readonly<{ applicationId: string }>) {
  return (
    <Card className="p-6">
      <p className="text-body text-ink-muted">Correção não encontrada.</p>
      <Link
        to={buildPath(ROUTES.grading, { id: applicationId })}
        className="mt-3 link-target text-label text-primary underline"
      >
        Voltar para as folhas
      </Link>
    </Card>
  );
}

/** The marks as they were read, before the teacher changed any of them. */
function answersReadOn(correction: Correction): MarkedAnswer[] {
  return correction.objectiveResults.map((result) => ({
    questionId: result.questionId,
    ...(result.selectedAlternativeId === undefined ? {} : { selectedAlternativeId: result.selectedAlternativeId }),
  }));
}

/**
 * Two ways out, because stopping halfway is a real thing to do and leaving the
 * screen used to throw the review away.
 *
 * What is on screen starts from what was read and is edited here, so nothing
 * is written until the teacher confirms. Deriving the marks from the stored
 * correction on every render would throw away the edits.
 */
function SheetReview({
  applicationId,
  overview,
  correction,
  sheet,
  exam,
}: Readonly<{ applicationId: string; overview: Overview; correction: Correction; sheet: Sheet; exam: Exam }>) {
  const navigate = useNavigate();
  const confirmCorrection = useConfirmCorrection();
  const assignStudent = useAssignStudent();

  const [answers, setAnswers] = useState<MarkedAnswer[] | null>(null);
  const [scores, setScores] = useState<DiscursiveScore[] | null>(null);

  const { bank } = overview;
  const byId = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank]);
  const version = overview.versions.find((item) => item.id === sheet.examVersionId);
  const backToSheets = buildPath(ROUTES.grading, { id: applicationId });

  const currentAnswers = answers ?? answersReadOn(correction);
  const discursiveIds = discursiveQuestionIdsOf(exam, bank);
  const currentScores = scores ?? withDefaultDiscursiveScores(discursiveIds, correction.discursiveScores);
  const graded = gradeObjectives(exam, bank, currentAnswers);

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

  const save = (finalize: boolean) =>
    confirmCorrection.mutate(
      {
        correction,
        answers: currentAnswers,
        discursiveScores: currentScores,
        objectiveResults: graded.results,
        discursiveQuestionIds: discursiveIds,
        finalize,
      },
      { onSuccess: () => void navigate(backToSheets) },
    );

  return (
    <div className="flex flex-col gap-6">
      <BackLink to={backToSheets}>Folhas</BackLink>

      <PageHeader help
        title={`Folha ${sheet.sheetNumber}`}
        description={`Versão ${version?.versionNumber ?? '—'} · leitura automática, revisada por você`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SheetImage sheetNumber={sheet.sheetNumber} />

        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between gap-3 p-5">
            <h2 className="text-title text-primary">Nota</h2>
            <p className="text-headline text-primary" aria-live="polite">
              {totalCorrectionScore(graded.results, currentScores)}
            </p>
          </Card>

          {sheet.studentId === undefined && (
            <AssignStudent
              students={overview.students}
              assignedTo={correction.studentId}
              pending={assignStudent.isPending}
              onAssign={(studentId) => assignStudent.mutate({ correctionId: correction.id, studentId })}
              error={assignStudent.error?.message}
            />
          )}

          {discursiveIds.length > 0 && <DiscursiveNotice count={discursiveIds.length} />}

          <QuestionsCard
            exam={exam}
            byId={byId}
            answers={currentAnswers}
            scores={currentScores}
            onAnswer={setAnswer}
            onScore={setScore}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={() => void navigate(backToSheets)}>
          Cancelar
        </Button>
        <Button disabled={confirmCorrection.isPending} onClick={() => save(false)}>
          Salvar sem finalizar
        </Button>
        <Button variant="primary" disabled={confirmCorrection.isPending} onClick={() => save(true)}>
          {confirmCorrection.isPending ? 'Salvando…' : 'Confirmar correção'}
        </Button>
      </div>

      <Tour screen="gradingSheet" ready />
    </div>
  );
}

/** The photo of the sheet, which the teacher may zoom and turn to read a faint mark. */
function SheetImage({ sheetNumber }: Readonly<{ sheetNumber: number }>) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <Card data-tour="image" className="flex flex-col gap-3 p-4">
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
          alt={`Folha de respostas número ${sheetNumber}`}
          style={{ scale: String(zoom), rotate: `${rotation}deg` }}
          className="max-w-full"
        />
      </div>
      <p className="text-caption text-ink-subtle">
        Imagem de demonstração. O envio real de fotos entra junto com o servidor.
      </p>
    </Card>
  );
}

function DiscursiveNotice({ count }: Readonly<{ count: number }>) {
  return (
    <Card className="border-l-4 border-l-accent p-5">
      <p role="status" className="text-body text-ink-muted">
        O sistema já corrigiu as objetivas.{' '}
        {count === 1 ? 'A questão discursiva começa valendo 0' : `As ${count} questões discursivas começam valendo 0`}
        , então confira cada uma antes de confirmar. Se preferir parar no meio, salve
        sem finalizar e volte depois.
      </p>
    </Card>
  );
}

/** Every question of the exam, in its order: the marks of the objectives, and a score for each open-ended one. */
function QuestionsCard({
  exam,
  byId,
  answers,
  scores,
  onAnswer,
  onScore,
}: Readonly<{
  exam: Exam;
  byId: ReadonlyMap<string, Question>;
  answers: MarkedAnswer[];
  scores: DiscursiveScore[];
  onAnswer: (questionId: string, alternativeId: string | undefined) => void;
  onScore: (questionId: string, score: number) => void;
}>) {
  return (
    <Card data-tour="questions">
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
                    selectedAlternativeId={answers.find((a) => a.questionId === entry.questionId)?.selectedAlternativeId}
                    onSelect={(alternativeId) => onAnswer(entry.questionId, alternativeId)}
                  />
                ) : (
                  <DiscursiveRow
                    index={index}
                    statement={question.statement}
                    maxScore={question.maxScore ?? 0}
                    score={scores.find((s) => s.questionId === entry.questionId)?.score ?? 0}
                    onScore={(score) => onScore(entry.questionId, score)}
                  />
                )}
              </li>
            );
          })}
      </ol>
    </Card>
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
  score: number;
  onScore: (score: number) => void;
}>) {
  /**
   * A question still worth nothing is marked, and the mark says exactly that
   * rather than "sem nota": the zero is real, it counts in the total, and it
   * closes the correction if the teacher agrees with it.
   */
  const atZero = score === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-ink">
          <span className="text-ink-subtle">{index + 1}.</span> {statement}
        </p>
        <Badge tone={atZero ? 'warning' : 'neutral'}>{atZero ? 'Valendo 0' : 'Discursiva'}</Badge>
      </div>

      <div data-tour="score" className="flex items-center gap-2">
        <span aria-hidden className="text-caption text-ink-muted">
          Nota
        </span>
        <NumberInput
          value={score}
          onValueChange={onScore}
          max={maxScore}
          step="0.1"
          label={`Nota da questão ${index + 1}`}
          className={`w-24 ${atZero ? 'border-accent' : ''}`}
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
