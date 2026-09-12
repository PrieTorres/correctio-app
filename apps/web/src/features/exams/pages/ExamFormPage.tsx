import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { Button, Card, PageHeader, QueryBoundary, SaveError, TextField } from '@/components/ui';
import { examInputSchema, type ExamInput } from '@/lib/schemas';
import { totalScore } from '@/lib/exams';
import { fieldArrayMessage } from '@/lib/forms';
import { ROUTES, buildPath } from '@/app/routes';
import type { ExamQuestion, Question } from '@/types/domain';
import { useQuestionList } from '@/features/questions';
import { useExam, useSaveExam } from '../hooks/useExams';
import { QuestionPickerDrawer } from '../components/QuestionPickerDrawer';
import { AutoFillDialog } from '../components/AutoFillDialog';
import { SortableExamQuestion } from '../components/SortableExamQuestion';

const MAX_QUESTIONS = 20;

const EMPTY: ExamInput = {
  title: '',
  description: '',
  questions: [],
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: true,
};

export function ExamFormPage() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const save = useSaveExam();

  const { data: existing, isPending, isError } = useExam(id);
  const { data: bankPage, isPending: bankPending } = useQuestionList({
    search: '',
    type: 'all',
    tags: [],
    deleted: false,
  });
  const bank = useMemo(() => bankPage?.items ?? [], [bankPage]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [autoFillOpen, setAutoFillOpen] = useState(pathname === ROUTES.generateExam);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamInput>({ resolver: zodResolver(examInputSchema), defaultValues: EMPTY });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions' });
  const questions = watch('questions');

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const byId = useMemo(() => new Map(bank.map((item) => [item.id, item])), [bank]);

  /**
   * The total is computed while rendering, never held in state. A second copy
   * of a value derived from the questions is a copy that can disagree with
   * them, and the only way it can be wrong is by existing.
   */
  const total = totalScore(questions);

  /**
   * Pointer for the mouse, keyboard for everyone else. The keyboard sensor is
   * what makes the drag grip usable without a pointing device at all.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * `order` is rewritten from the array position on every change, so the field
   * the Spec defines always agrees with what is on screen.
   */
  const renumber = (list: ExamQuestion[]) =>
    setValue(
      'questions',
      list.map((item, index) => ({ ...item, order: index })),
      { shouldValidate: true },
    );

  const moveBy = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    move(from, to);
    renumber(arrayMove(questions, from, to));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;

    const from = questions.findIndex((item) => item.questionId === active.id);
    const to = questions.findIndex((item) => item.questionId === over.id);
    if (from === -1 || to === -1) return;

    moveBy(from, to);
  };

  const addFromBank = (picked: Question[]) => {
    const alreadyIn = new Set(questions.map((item) => item.questionId));
    const room = MAX_QUESTIONS - questions.length;

    picked
      .filter((question) => !alreadyIn.has(question.id))
      .slice(0, room)
      .forEach((question, offset) =>
        append({
          questionId: question.id,
          order: questions.length + offset,
          score: 1,
          allowShuffleAlternatives: question.allowShuffleAlternatives,
        }),
      );
  };

  const onSubmit = (input: ExamInput) => {
    save.mutate(
      { id, input },
      { onSuccess: (saved) => void navigate(buildPath(ROUTES.examDetail, { id: saved.id })) },
    );
  };

  return (
    <QueryBoundary
      isPending={id !== undefined && isPending}
      isError={isError}
      pendingLabel="Carregando prova…"
    >
      <div className="flex flex-col gap-6">
        <Link
          to={ROUTES.exams}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Provas
        </Link>

        <PageHeader title={id === undefined ? 'Nova prova' : 'Editar prova'} />

        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="flex flex-col gap-6"
          noValidate
        >
          <Card className="flex flex-col gap-4 p-6">
            <TextField label="Título" error={errors.title?.message} {...register('title')} />
            <TextField label="Descrição" {...register('description')} />
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <h2 className="text-title text-primary">Preferências padrão de aplicação</h2>
            <p className="text-caption text-ink-subtle">
              Cada aplicação herda estes valores e pode alterá-los por versão.
            </p>
            <Checkbox label="Embaralhar as questões" {...register('defaultShuffleQuestions')} />
            <Checkbox label="Embaralhar as alternativas" {...register('defaultShuffleAlternatives')} />
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-title text-primary">Questões</h2>
              <p className="text-label text-ink-muted" aria-live="polite">
                {questions.length}/{MAX_QUESTIONS} questões · pontuação total {total}
              </p>
            </div>

            {fieldArrayMessage(errors.questions) !== undefined && (
              <p role="alert" className="text-caption text-danger">
                {fieldArrayMessage(errors.questions)}
              </p>
            )}

            {questions.length === 0 ? (
              <p className="py-6 text-center text-body text-ink-muted">
                Nenhuma questão ainda. Adicione do banco ou deixe o sistema preencher.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={questions.map((item) => item.questionId)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="flex flex-col gap-2">
                    {fields.map((field, index) => {
                      const entry = questions[index];
                      if (entry === undefined) return null;

                      return (
                        <SortableExamQuestion
                          key={field.id}
                          entry={entry}
                          question={byId.get(entry.questionId)}
                          index={index}
                          total={questions.length}
                          onMoveUp={() => moveBy(index, index - 1)}
                          onMoveDown={() => moveBy(index, index + 1)}
                          onRemove={() => {
                            remove(index);
                            renumber(questions.filter((_, position) => position !== index));
                          }}
                          onScoreChange={(score) =>
                            setValue(`questions.${index}.score`, score, { shouldValidate: true })
                          }
                          onShuffleChange={(allow) =>
                            setValue(`questions.${index}.allowShuffleAlternatives`, allow)
                          }
                        />
                      );
                    })}
                  </ol>
                </SortableContext>
              </DndContext>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Plus size={18} aria-hidden />}
                onClick={() => setPickerOpen(true)}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                Adicionar do banco
              </Button>
              <Button
                icon={<Sparkles size={18} aria-hidden />}
                onClick={() => setAutoFillOpen(true)}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                Preencher automaticamente
              </Button>
            </div>
          </Card>

          <SaveError error={save.error} />

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => void navigate(ROUTES.exams)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar prova'}
            </Button>
          </div>
        </form>

        <QuestionPickerDrawer
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          alreadyIn={questions.map((item) => item.questionId)}
          remainingSlots={MAX_QUESTIONS - questions.length}
          onConfirm={addFromBank}
        />

        <AutoFillDialog
          open={autoFillOpen}
          onOpenChange={setAutoFillOpen}
          bank={bank}
          bankPending={bankPending}
          remainingSlots={MAX_QUESTIONS - questions.length}
          onConfirm={addFromBank}
        />
      </div>
    </QueryBoundary>
  );
}

/** Pure reorder, so the renumbering does not depend on the field array state. */
function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

function Checkbox({ label, ...rest }: Readonly<{ label: string }> & Record<string, unknown>) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" className="size-4 accent-[var(--color-primary)]" {...rest} />
      <span className="text-body text-ink">{label}</span>
    </label>
  );
}
