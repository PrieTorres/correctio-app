import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button, Card, PageHeader, QueryBoundary, SegmentedControl, TextField } from '@/components/ui';
import { questionInputSchema, type QuestionInput } from '@/lib/schemas';
import { createId } from '@/lib/utils';
import { ROUTES } from '@/app/routes';
import type { QuestionType } from '@/types/domain';
import { useQuestion, useSaveQuestion } from '../hooks/useQuestions';
import { TagField } from '../components/TagField';

const MAX_ALTERNATIVES = 5;
const LETTERS = 'ABCDE';

const TYPE_SEGMENTS = [
  { value: 'objetiva', label: 'Objetiva' },
  { value: 'discursiva', label: 'Discursiva' },
] as const satisfies readonly { value: QuestionType; label: string }[];

function blankAlternative() {
  return { id: createId(), text: '' };
}

/**
 * Drops the fields belonging to the type that was not chosen.
 *
 * The form keeps both shapes alive so switching type does not throw away what
 * was already typed. What it submits has to be one of them: an open-ended
 * question kept carrying the two blank alternatives the form starts with, and
 * the stored schema refuses a blank alternative — so the record was written and
 * then never read back again.
 *
 * The unwanted fields are set to `undefined` rather than omitted, so that
 * editing a question into the other type clears them instead of leaving the
 * previous ones behind on the merge.
 */
function onlyFieldsOfItsType(input: QuestionInput): QuestionInput {
  return input.type === 'discursiva'
    ? { ...input, alternatives: undefined, correctAlternativeId: undefined }
    : { ...input, maxScore: undefined };
}

function emptyQuestion(): QuestionInput {
  const alternatives = [blankAlternative(), blankAlternative()];
  return {
    type: 'objetiva',
    statement: '',
    tags: [],
    alternatives,
    correctAlternativeId: alternatives[0]?.id,
    allowShuffleAlternatives: true,
  };
}

export function QuestionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const save = useSaveQuestion();
  const { data: existing, isPending, isError } = useQuestion(id);

  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionInputSchema),
    defaultValues: emptyQuestion(),
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  /**
   * `keyName` moves the array's React key off `id`.
   *
   * By default `useFieldArray` overwrites each item's `id` with its own
   * generated key, so the id bound to the radio stopped matching the one the
   * schema compares against `correctAlternativeId`, and no multiple-choice
   * question could be saved. The Spec owns `alternatives[].id`; the key is
   * react-hook-form's business and now has its own name.
   */
  const alternatives = useFieldArray({ control, name: 'alternatives', keyName: 'fieldKey' });
  const type = watch('type');
  const correctAlternativeId = watch('correctAlternativeId');
  const tags = watch('tags');

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const onSubmit = async (input: QuestionInput) => {
    await save.mutateAsync({ id, input: onlyFieldsOfItsType(input) });
    void navigate(ROUTES.questions);
  };

  return (
    <QueryBoundary
      isPending={id !== undefined && isPending}
      isError={isError}
      pendingLabel="Carregando questão…"
    >
      <div className="flex flex-col gap-6">
        <Link
          to={ROUTES.questions}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Banco de questões
        </Link>

        <PageHeader
          title={id === undefined ? 'Nova questão' : 'Editar questão'}
          description="A questão fica no banco e pode ser usada em quantas provas você quiser."
        />

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
          <Card className="flex flex-col gap-6 p-6">
            <SegmentedControl
              label="Tipo da questão"
              segments={TYPE_SEGMENTS}
              value={type}
              onChange={(next) => setValue('type', next, { shouldValidate: false })}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="statement" className="text-label text-ink-muted">
                Enunciado
              </label>
              <textarea
                id="statement"
                rows={5}
                aria-invalid={errors.statement ? true : undefined}
                className="rounded-[var(--radius-control)] border border-line bg-surface p-3 text-body focus:outline-none focus-visible:border-primary"
                {...register('statement')}
              />
              {errors.statement && (
                <p role="alert" className="text-caption text-danger">
                  {errors.statement.message}
                </p>
              )}
            </div>

            <TagField value={tags} onChange={(next) => setValue('tags', next)} />

            {type === 'objetiva' ? (
              <AlternativesField
                fields={alternatives.fields}
                correctAlternativeId={correctAlternativeId}
                error={errors.alternatives?.message ?? errors.correctAlternativeId?.message}
                register={register}
                onAdd={() => alternatives.append(blankAlternative())}
                onRemove={(index) => alternatives.remove(index)}
                onMarkCorrect={(alternativeId) => setValue('correctAlternativeId', alternativeId)}
              />
            ) : (
              <TextField
                label="Nota máxima"
                type="number"
                step="0.1"
                min="0"
                error={errors.maxScore?.message}
                {...register('maxScore', {
                  /**
                   * `valueAsNumber` turns an empty field into `NaN`, which is a
                   * number as far as the schema is concerned: the friendly
                   * message never fired and Zod's own "received nan" reached
                   * the screen in English. Empty means absent.
                   */
                  setValueAs: (value: string) => (value === '' ? undefined : Number(value)),
                })}
              />
            )}

            {type === 'objetiva' && <ShuffleToggle form={form} />}
          </Card>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => void navigate(ROUTES.questions)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar questão'}
            </Button>
          </div>
        </form>
      </div>
    </QueryBoundary>
  );
}

function AlternativesField({
  fields,
  correctAlternativeId,
  error,
  register,
  onAdd,
  onRemove,
  onMarkCorrect,
}: Readonly<{
  fields: { fieldKey: string; id: string }[];
  correctAlternativeId: string | undefined;
  error?: string;
  register: ReturnType<typeof useForm<QuestionInput>>['register'];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMarkCorrect: (alternativeId: string) => void;
}>) {
  const [groupName] = useState(() => `correct-${createId()}`);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-label text-ink-muted">
        Alternativas <span className="text-ink-subtle">— marque a correta</span>
      </legend>

      {fields.map((field, index) => (
        <div key={field.fieldKey} className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={groupName}
              value={field.id}
              checked={correctAlternativeId === field.id}
              onChange={() => onMarkCorrect(field.id)}
              aria-label={`Alternativa ${LETTERS[index]} é a correta`}
              className="size-4 accent-[var(--color-primary)]"
            />
            <span className="w-4 text-label text-ink-muted">{LETTERS[index]}</span>
          </label>

          <input
            aria-label={`Texto da alternativa ${LETTERS[index]}`}
            className="touch-target flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
            {...register(`alternatives.${index}.text`)}
          />

          {fields.length > 2 && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remover alternativa ${LETTERS[index]}`}
              className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      ))}

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}

      {fields.length < MAX_ALTERNATIVES && (
        <Button variant="ghost" icon={<Plus size={16} aria-hidden />} onClick={onAdd} className="self-start">
          Alternativa
        </Button>
      )}
    </fieldset>
  );
}

function ShuffleToggle({ form }: Readonly<{ form: ReturnType<typeof useForm<QuestionInput>> }>) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-[var(--color-primary)]"
        {...form.register('allowShuffleAlternatives')}
      />
      <span>
        <span className="block text-label text-ink">Permitir embaralhar as alternativas</span>
        <span className="block text-caption text-ink-subtle">
          Desligue em questões com &ldquo;todas as anteriores&rdquo; e semelhantes, onde a ordem
          faz parte do enunciado.
        </span>
      </span>
    </label>
  );
}
