import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImageOff, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge, Button, Card, NumberInput, PageHeader, QueryBoundary, SaveError, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  totalCorrectionScore,
  withDefaultDiscursiveScores,
  type MarkedAnswer,
} from '@/lib/grading';
import { sheetImageIdOf } from '@/lib/repositories/correction-repository';
import type { AnswerSheet, Correction, DiscursiveScore, Exam, ExamVersion, Question, Student } from '@/types/domain';
import { useAssignStudent, useGradingOverview, useSaveReview, useSheetPhoto, useUploadedReading } from '../hooks/useGrading';
import { initialAnswersOf, PHOTO_PARAM, printedQuestionsOf, type PrintedAlternative, type PrintedQuestion } from '../review-model';

interface ReviewSources {
  applicationId: string;
  sheet: AnswerSheet;
  version: ExamVersion;
  exam: Exam;
  bank: Question[];
  students: Student[];
  correction: Correction | undefined;
  photoId: string | undefined;
}

/**
 * Reviewing one sheet (P16): the photo beside the questions in the order the
 * paper printed them, read or typed by the teacher, and nothing stored until
 * the teacher saves. A sheet with no correction yet opens blank, ready to type
 * (RF30), whether no photo was sent or its marks could not be read.
 */
export function GradingSheetPage() {
  const { id = '', sheetId = '' } = useParams<{ id: string; sheetId: string }>();
  const [params] = useSearchParams();
  const { data, isPending, isError } = useGradingOverview(id);
  const sources = reviewSourcesOf(data, sheetId, params.get(PHOTO_PARAM) ?? undefined);

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando folha…">
      {sources === null ? <SheetNotFound applicationId={id} /> : <SheetReview {...sources} />}
    </QueryBoundary>
  );
}

/** Everything the review of one sheet needs, or `null` when the sheet, its version or its exam is gone. */
function reviewSourcesOf(data: ReturnType<typeof useGradingOverview>['data'], sheetId: string, photoId: string | undefined): ReviewSources | null {
  const sheet = data?.sheets.find((item) => item.id === sheetId);
  const version = data?.versions.find((item) => item.id === sheet?.examVersionId);
  if (data?.exam == null || sheet === undefined || version === undefined) return null;

  return {
    applicationId: data.application.id,
    sheet,
    version,
    exam: data.exam,
    bank: data.bank,
    students: data.students,
    correction: data.corrections.find((item) => item.answerSheetId === sheet.id),
    photoId,
  };
}

function SheetNotFound({ applicationId }: Readonly<{ applicationId: string }>) {
  return (
    <Card className="p-6">
      <p className="text-body text-ink-muted">Folha não encontrada.</p>
      <Link to={buildPath(ROUTES.grading, { id: applicationId })} className="mt-3 inline-block text-label text-primary underline">
        Voltar para as folhas
      </Link>
    </Card>
  );
}

/**
 * What the teacher has on screen, edited here: it starts from the photo's
 * reading or the stored correction, and is graded with the same rules the
 * server applies, so the total shown is the one that will be stored.
 */
function useReviewDraft({ applicationId, sheet, exam, bank, correction, photoId }: ReviewSources) {
  const reading = useUploadedReading(applicationId, photoId);
  const [answers, setAnswers] = useState<MarkedAnswer[] | null>(null);
  const [scores, setScores] = useState<DiscursiveScore[] | null>(null);

  const discursiveIds = discursiveQuestionIdsOf(exam, bank);
  const currentAnswers = answers ?? initialAnswersOf(reading, sheet.id, correction);
  const currentScores = scores ?? withDefaultDiscursiveScores(discursiveIds, correction?.discursiveScores ?? []);
  const graded = gradeObjectives(exam, bank, currentAnswers);

  const setAnswer = (questionId: string, selectedAlternativeId: string | undefined) =>
    setAnswers([
      ...currentAnswers.filter((answer) => answer.questionId !== questionId),
      { questionId, ...(selectedAlternativeId !== undefined && { selectedAlternativeId }) },
    ]);

  const setScore = (questionId: string, score: number, maximum: number) =>
    setScores([...currentScores.filter((item) => item.questionId !== questionId), { questionId, score: clampDiscursiveScore(score, maximum) }]);

  return {
    answers: currentAnswers,
    scores: currentScores,
    discursiveCount: discursiveIds.length,
    total: totalCorrectionScore(graded.results, currentScores),
    setAnswer,
    setScore,
  };
}

function SheetReview(sources: Readonly<ReviewSources>) {
  const { applicationId, sheet, version, bank, students, correction, photoId } = sources;
  const navigate = useNavigate();
  const saveReview = useSaveReview();
  const draft = useReviewDraft(sources);
  const [chosenStudent, setChosenStudent] = useState<string | undefined>(undefined);
  const printed = useMemo(() => printedQuestionsOf(version.layout, bank), [version.layout, bank]);
  const shownPhotoId = photoId ?? sheetImageIdOf(correction?.imageUrl);
  const backToList = buildPath(ROUTES.grading, { id: applicationId });

  const save = (finalize: boolean) =>
    saveReview.mutate(
      {
        applicationId,
        ...(correction !== undefined && { correctionId: correction.id }),
        review: {
          answerSheetId: sheet.id,
          answers: draft.answers,
          discursiveScores: draft.scores,
          finalize,
          ...(correction === undefined && photoId !== undefined && { imageId: photoId }),
          ...(chosenStudent !== undefined && { studentId: chosenStudent }),
        },
      },
      { onSuccess: () => void navigate(backToList) },
    );

  return (
    <div className="flex flex-col gap-6">
      <Link to={backToList} className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary">
        <ArrowLeft size={16} aria-hidden />
        Folhas
      </Link>

      <PageHeader
        help
        title={`Folha ${sheet.sheetNumber}`}
        description={`Versão ${version.versionNumber} · ${shownPhotoId === undefined ? 'correção digitada' : 'leitura da foto'}, revisada por você`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SheetPhotoCard applicationId={applicationId} photoId={shownPhotoId} sheetNumber={sheet.sheetNumber} />

        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between gap-3 p-5">
            <h2 className="text-title text-primary">Nota</h2>
            <p className="text-headline text-primary" aria-live="polite">
              {draft.total}
            </p>
          </Card>

          {sheet.studentId === undefined && (
            <StudentCard applicationId={applicationId} students={students} correction={correction} chosen={chosenStudent} onChoose={setChosenStudent} />
          )}

          {draft.discursiveCount > 0 && <DiscursiveNotice count={draft.discursiveCount} />}

          <QuestionsCard printed={printed} draft={draft} />
        </div>
      </div>

      <SaveError error={saveReview.error} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={() => void navigate(backToList)}>
          Cancelar
        </Button>
        <Button disabled={saveReview.isPending} onClick={() => save(false)}>
          Salvar sem finalizar
        </Button>
        <Button variant="primary" data-tour="confirm" disabled={saveReview.isPending} onClick={() => save(true)}>
          {saveReview.isPending ? 'Salvando…' : 'Confirmar correção'}
        </Button>
      </div>

      <Tour screen="gradingSheet" ready />
    </div>
  );
}

function DiscursiveNotice({ count }: Readonly<{ count: number }>) {
  return (
    <Card className="border-l-4 border-l-accent p-5">
      <p role="status" className="text-body text-ink-muted">
        {count === 1 ? 'A questão discursiva começa valendo 0' : `As ${count} questões discursivas começam valendo 0`}, então
        confira cada uma antes de confirmar. Se preferir parar no meio, salve sem finalizar e volte depois.
      </p>
    </Card>
  );
}

/**
 * The photo the review is made from, fetched with the token (it carries a
 * student's handwriting) and shown from a local address the browser forgets
 * when the screen closes. A sheet typed by hand has no photo.
 */
function SheetPhotoCard({ applicationId, photoId, sheetNumber }: Readonly<{ applicationId: string; photoId: string | undefined; sheetNumber: number }>) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const photo = useSheetPhoto(applicationId, photoId);

  return (
    <Card data-tour="image" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title text-primary">Foto da folha</h2>
        <div className="flex gap-1">
          <IconButton label="Diminuir o zoom" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut size={16} aria-hidden />
          </IconButton>
          <IconButton label="Aumentar o zoom" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
            <ZoomIn size={16} aria-hidden />
          </IconButton>
          <IconButton label="Girar a foto" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw size={16} aria-hidden />
          </IconButton>
        </div>
      </div>
      <div className="flex max-h-[32rem] min-h-48 items-center justify-center overflow-auto rounded-[var(--radius-control)] bg-surface-muted p-4">
        <PhotoContent photoId={photoId} photo={photo} alt={`Foto da folha ${sheetNumber}`} transform={{ scale: String(zoom), rotate: `${rotation}deg` }} />
      </div>
    </Card>
  );
}

function PhotoContent({
  photoId,
  photo,
  alt,
  transform,
}: Readonly<{ photoId: string | undefined; photo: ReturnType<typeof useSheetPhoto>; alt: string; transform: { scale: string; rotate: string } }>) {
  if (photoId === undefined) return <NoPhoto text="Correção digitada, sem foto." />;
  if (photo.isError) return <NoPhoto text="A foto não pôde ser carregada. A correção continua valendo." />;
  if (photo.data === undefined) return <p className="text-caption text-ink-subtle">Carregando a foto…</p>;
  return <BlobImage blob={photo.data} alt={alt} style={transform} />;
}

function NoPhoto({ text }: Readonly<{ text: string }>) {
  return (
    <p className="flex items-center gap-2 text-caption text-ink-subtle">
      <ImageOff size={16} aria-hidden />
      {text}
    </p>
  );
}

/** An image from a blob, whose local address is released when it leaves the screen. */
function BlobImage({ blob, alt, style }: Readonly<{ blob: Blob; alt: string; style: { scale: string; rotate: string } }>) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt={alt} style={style} className="max-w-full" />;
}

/**
 * Who a sheet printed without a name belongs to (RF31). On a correction
 * already stored the choice is saved at once; on a new one it goes with the
 * review. A student who already has a sheet of this version comes back as a
 * conflict, shown here.
 */
function StudentCard({
  applicationId,
  students,
  correction,
  chosen,
  onChoose,
}: Readonly<{ applicationId: string; students: Student[]; correction: Correction | undefined; chosen: string | undefined; onChoose: (studentId: string | undefined) => void }>) {
  const assignStudent = useAssignStudent();
  const value = correction?.studentId ?? chosen ?? '';

  const choose = (studentId: string) => {
    if (correction === undefined) onChoose(studentId === '' ? undefined : studentId);
    else if (studentId !== '') assignStudent.mutate({ applicationId, correctionId: correction.id, studentId });
  };

  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="text-title text-primary">De quem é esta folha?</h2>
      <p className="text-caption text-ink-subtle">A prova saiu sem identificação, então o aluno é associado aqui.</p>
      <select
        aria-label="Associar esta folha a um aluno"
        value={value}
        disabled={assignStudent.isPending}
        onChange={(event) => choose(event.target.value)}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
      >
        <option value="">Ainda não associada</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </select>
      {assignStudent.error !== null && (
        <p role="alert" className="text-caption text-danger">
          {assignStudent.error.message}
        </p>
      )}
    </Card>
  );
}

type Draft = ReturnType<typeof useReviewDraft>;

function QuestionsCard({ printed, draft }: Readonly<{ printed: PrintedQuestion[]; draft: Draft }>) {
  return (
    <Card data-tour="questions">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Questões</h2>
        <p className="mt-1 text-caption text-ink-subtle">Na ordem e com as letras desta versão, como estão no papel.</p>
      </div>
      <ol className="divide-y divide-line">
        {printed.map((entry) => (
          <li key={entry.question.id} className="px-5 py-4">
            {entry.kind === 'objective' ? (
              <ObjectiveRow
                number={entry.number}
                statement={entry.question.statement}
                alternatives={entry.alternatives}
                correctAlternativeId={entry.question.correctAlternativeId}
                selectedAlternativeId={draft.answers.find((answer) => answer.questionId === entry.question.id)?.selectedAlternativeId}
                onSelect={(alternativeId) => draft.setAnswer(entry.question.id, alternativeId)}
              />
            ) : (
              <DiscursiveRow
                number={entry.number}
                statement={entry.question.statement}
                maxScore={entry.maxScore}
                score={draft.scores.find((score) => score.questionId === entry.question.id)?.score ?? 0}
                onScore={(score) => draft.setScore(entry.question.id, score, entry.maxScore)}
              />
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ObjectiveRow({
  number,
  statement,
  alternatives,
  correctAlternativeId,
  selectedAlternativeId,
  onSelect,
}: Readonly<{
  number: number;
  statement: string;
  alternatives: PrintedAlternative[];
  correctAlternativeId: string;
  selectedAlternativeId: string | undefined;
  onSelect: (alternativeId: string | undefined) => void;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-ink">
          <span className="text-ink-subtle">{number}.</span> {statement}
        </p>
        <AnswerBadge selected={selectedAlternativeId} correct={correctAlternativeId} />
      </div>

      <div className="flex flex-wrap gap-2">
        {alternatives.map((alternative) => (
          <AlternativeBubble
            key={alternative.id}
            number={number}
            alternative={alternative}
            isCorrect={alternative.id === correctAlternativeId}
            isSelected={alternative.id === selectedAlternativeId}
            onToggle={(selected) => onSelect(selected ? alternative.id : undefined)}
          />
        ))}
      </div>
      <p className="text-caption text-ink-subtle">
        Verde é a alternativa correta; a marcada aparece cheia. Clicar na marcada deixa a questão em branco.
      </p>
    </div>
  );
}

function AnswerBadge({ selected, correct }: Readonly<{ selected: string | undefined; correct: string }>) {
  if (selected === undefined) return <Badge tone="warning">Em branco</Badge>;
  return <Badge tone={selected === correct ? 'success' : 'danger'}>{selected === correct ? 'Certa' : 'Errada'}</Badge>;
}

const BUBBLE_STYLE = {
  selected: 'border-primary bg-primary text-on-primary',
  correct: 'border-success bg-success-surface text-success',
  other: 'border-line text-ink-muted hover:bg-surface-muted',
};

/** The marked bubble shows as marked even when it is the right one, so the teacher sees what the student did. */
function bubbleStyle(isSelected: boolean, isCorrect: boolean): string {
  if (isSelected) return BUBBLE_STYLE.selected;
  return isCorrect ? BUBBLE_STYLE.correct : BUBBLE_STYLE.other;
}

function AlternativeBubble({
  number,
  alternative,
  isCorrect,
  isSelected,
  onToggle,
}: Readonly<{ number: number; alternative: PrintedAlternative; isCorrect: boolean; isSelected: boolean; onToggle: (selected: boolean) => void }>) {
  const style = bubbleStyle(isSelected, isCorrect);

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`Questão ${number}, alternativa ${alternative.letter}${isCorrect ? ', correta' : ''}`}
      title={alternative.text}
      onClick={() => onToggle(!isSelected)}
      className={`touch-target inline-flex size-11 items-center justify-center rounded-full border text-label ${style}`}
    >
      {alternative.letter}
    </button>
  );
}

function DiscursiveRow({
  number,
  statement,
  maxScore,
  score,
  onScore,
}: Readonly<{ number: number; statement: string; maxScore: number; score: number; onScore: (score: number) => void }>) {
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
          <span className="text-ink-subtle">{number}.</span> {statement}
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
          label={`Nota da questão ${number}`}
          className={`w-24 ${atZero ? 'border-accent' : ''}`}
        />
        <span className="text-caption text-ink-subtle">de {maxScore}</span>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
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
