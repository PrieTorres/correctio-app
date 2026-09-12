import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, PageHeader, QueryBoundary, SaveError } from '@/components/ui';
import { applicationInputSchema, type ApplicationInput } from '@/lib/schemas';
import { fromDateInputValue, toDateInputValue } from '@/lib/utils';
import { buildPath, ROUTES } from '@/app/routes';
import { useClassList } from '@/features/classes';
import { useExamList } from '@/features/exams';
import { useApplication, useSaveApplication } from '../hooks/useApplications';

/** Today, so a new application defaults to something plausible. */
function today(): string {
  return new Date().toISOString();
}

export function ApplicationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const save = useSaveApplication();

  const { data: existing, isPending, isError } = useApplication(id);
  const { data: exams, isPending: examsPending } = useExamList(false, '');
  const { data: classes, isPending: classesPending } = useClassList(false, '');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationInput>({
    resolver: zodResolver(applicationInputSchema),
    defaultValues: { examId: '', classId: '', date: today() },
  });

  useEffect(() => {
    if (existing) reset(existing);
  }, [existing, reset]);

  const date = watch('date');
  const availableExams = exams?.items ?? [];
  const availableClasses = classes?.items ?? [];
  const nothingToApply = !examsPending && availableExams.length === 0;
  const nobodyToApplyTo = !classesPending && availableClasses.length === 0;

  const onSubmit = (input: ApplicationInput) => {
    save.mutate(
      { id, input },
      { onSuccess: (saved) => void navigate(buildPath(ROUTES.applicationPdf, { id: saved.id })) },
    );
  };

  return (
    <QueryBoundary
      isPending={id !== undefined && isPending}
      isError={isError}
      pendingLabel="Carregando aplicação…"
    >
      <div className="flex flex-col gap-6">
        <Link
          to={ROUTES.applications}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Aplicações
        </Link>

        <PageHeader
          title={id === undefined ? 'Nova aplicação' : 'Editar aplicação'}
          description="Escolha a prova, a turma e a data. As versões e as folhas saem no passo seguinte."
        />

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-6" noValidate>
          <Card className="flex flex-col gap-4 p-6">
            <Select
              label="Prova"
              error={errors.examId?.message}
              disabled={nothingToApply}
              placeholder={nothingToApply ? 'Nenhuma prova disponível' : 'Escolha a prova'}
              options={availableExams.map((exam) => ({ value: exam.id, label: exam.title }))}
              {...register('examId')}
            />
            {nothingToApply && (
              <p className="text-caption text-ink-subtle">
                Você ainda não tem uma prova ativa.{' '}
                <Link to={ROUTES.newExam} className="text-primary underline">
                  Monte uma prova
                </Link>{' '}
                antes de aplicar.
              </p>
            )}

            <Select
              label="Turma"
              error={errors.classId?.message}
              disabled={nobodyToApplyTo}
              placeholder={nobodyToApplyTo ? 'Nenhuma turma disponível' : 'Escolha a turma'}
              options={availableClasses.map((item) => ({ value: item.id, label: item.name }))}
              {...register('classId')}
            />
            {nobodyToApplyTo && (
              <p className="text-caption text-ink-subtle">
                Você ainda não tem uma turma ativa.{' '}
                <Link to={ROUTES.classes} className="text-primary underline">
                  Crie uma turma
                </Link>{' '}
                antes de aplicar.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="application-date" className="text-label text-ink-muted">
                Data da aplicação
              </label>
              <input
                id="application-date"
                type="date"
                value={toDateInputValue(date)}
                onChange={(event) =>
                  setValue('date', fromDateInputValue(event.target.value), {
                    shouldValidate: true,
                  })
                }
                className="touch-target w-full max-w-56 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
              />
              {errors.date && (
                <p role="alert" className="text-caption text-danger">
                  {errors.date.message}
                </p>
              )}
            </div>
          </Card>

          <SaveError error={save.error} />

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => void navigate(ROUTES.applications)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar e gerar'}
            </Button>
          </div>
        </form>
      </div>
    </QueryBoundary>
  );
}

/**
 * A native select rather than a listbox of our own: it is one choice from a
 * short list, and the platform control already handles the keyboard, the screen
 * reader and the way a phone presents it.
 */
const Select = function Select({
  label,
  error,
  options,
  placeholder,
  ...rest
}: Readonly<{
  label: string;
  error?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}> &
  Record<string, unknown>) {
  const id = `select-${label.toLocaleLowerCase()}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
