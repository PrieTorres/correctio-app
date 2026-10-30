import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, PageHeader, QueryBoundary, SaveError } from '@/components/ui';
import { applicationInputSchema, type ApplicationInput } from '@/lib/schemas';
import { buildPath, ROUTES } from '@/app/routes';
import { todayAsStored } from '@/lib/utils';
import { ApplicationDateField } from '../components/ApplicationDateField';
import { useSaveApplication, useSittingChoices } from '../hooks/useApplications';

/**
 * Creating an application (P12): an active exam, an active class and a day.
 * The choices hold every active exam and class, not the first page of their
 * lists, and the server refuses an archived one or the same sitting twice,
 * with the message shown above the buttons. The day changes later on the
 * detail (P14); the exam and the class, once printed, do not.
 */
export function ApplicationFormPage() {
  const navigate = useNavigate();
  const save = useSaveApplication();
  const { data: choices, isPending, isError } = useSittingChoices();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationInput>({
    resolver: zodResolver(applicationInputSchema),
    defaultValues: { examId: '', classId: '', date: todayAsStored() },
  });

  const onSubmit = (input: ApplicationInput) => {
    save.mutate({ input }, { onSuccess: (saved) => void navigate(buildPath(ROUTES.applicationPdf, { id: saved.id })) });
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to={ROUTES.applications} className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary">
        <ArrowLeft size={16} aria-hidden />
        Aplicações
      </Link>

      <PageHeader
        title="Nova aplicação"
        description="Escolha a prova, a turma e a data. As versões e as folhas saem no passo seguinte."
      />

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando provas e turmas…">
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-6" noValidate>
          <Card className="flex flex-col gap-4 p-6">
            <Select
              label="Prova"
              error={errors.examId?.message}
              placeholder="Escolha a prova"
              options={(choices?.exams ?? []).map((exam) => ({ value: exam.id, label: exam.title }))}
              missing={
                <MissingChoice to={ROUTES.newExam} action="Monte uma prova">
                  Você ainda não tem uma prova ativa.
                </MissingChoice>
              }
              {...register('examId')}
            />

            <Select
              label="Turma"
              error={errors.classId?.message}
              placeholder="Escolha a turma"
              options={(choices?.classes ?? []).map((item) => ({ value: item.id, label: item.name }))}
              missing={
                <MissingChoice to={ROUTES.classes} action="Crie uma turma">
                  Você ainda não tem uma turma ativa.
                </MissingChoice>
              }
              {...register('classId')}
            />

            <ApplicationDateField
              id="application-date"
              value={watch('date')}
              onChange={(date) => setValue('date', date, { shouldValidate: true })}
              error={errors.date?.message}
            />
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
      </QueryBoundary>
    </div>
  );
}

/** What to do first when a choice has nothing to offer. */
function MissingChoice({ to, action, children }: Readonly<{ to: string; action: string; children: string }>) {
  return (
    <p className="text-caption text-ink-subtle">
      {children}{' '}
      <Link to={to} className="text-primary underline">
        {action}
      </Link>{' '}
      antes de aplicar.
    </p>
  );
}

/**
 * A native select rather than a listbox of our own: it is one choice from a
 * short list, and the platform control already handles the keyboard, the screen
 * reader and the way a phone presents it. With nothing to choose from, it is
 * disabled and says what to do first (`missing`).
 */
const Select = function Select({
  label,
  error,
  options,
  placeholder,
  missing,
  ...rest
}: Readonly<{
  label: string;
  error?: string;
  placeholder: string;
  options: { value: string; label: string }[];
  missing: ReactNode;
}> &
  Record<string, unknown>) {
  const id = `select-${label.toLocaleLowerCase()}`;
  const empty = options.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        disabled={empty}
        className="touch-target w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
        {...rest}
      >
        <option value="">{empty ? `Nenhuma ${label.toLocaleLowerCase('pt-BR')} disponível` : placeholder}</option>
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
      {empty && missing}
    </div>
  );
};
