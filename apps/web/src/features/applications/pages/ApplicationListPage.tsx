import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Plus, RotateCcw } from 'lucide-react';
import {
  ApplicationsIllustration,
  ArchiveIllustration,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchIllustration,
  SearchInput,
  SegmentedControl,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { formatDate } from '@/lib/utils';
import { useClassList } from '@/features/classes';
import { useExamList } from '@/features/exams';
import type { Application, ApplicationStatus } from '@/types/domain';
import { useApplicationList, useArchiveApplication } from '../hooks/useApplications';

type Filter = 'active' | 'archived';

const FILTERS = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
] as const satisfies readonly { value: Filter; label: string }[];

const STATUS: Record<ApplicationStatus, { label: string; tone: 'neutral' | 'success' }> = {
  draft: { label: 'A gerar', tone: 'neutral' },
  generated: { label: 'Gerada', tone: 'success' },
  closed: { label: 'Arquivada', tone: 'neutral' },
};

export function ApplicationListPage() {
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [pendingArchive, setPendingArchive] = useState<Application | null>(null);

  const showingArchived = filter === 'archived';
  const { data, isPending, isError } = useApplicationList(showingArchived, search);
  const { data: exams } = useExamList(false, '');
  const { data: classes } = useClassList(false, '');
  const archiveApplication = useArchiveApplication();

  const applications = data?.items ?? [];
  const examTitle = new Map((exams?.items ?? []).map((item) => [item.id, item.title]));
  const className = new Map((classes?.items ?? []).map((item) => [item.id, item.name]));

  const newApplicationButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />}>
      <Link to={ROUTES.newApplication}>Nova aplicação</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aplicações"
        description="A aplicação é o encontro de uma prova com uma turma numa data. A mesma prova rende quantas aplicações você quiser."
        actions={newApplicationButton}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Buscar aplicações"
          placeholder="Buscar pela data"
        />
        <SegmentedControl
          segments={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Filtrar por situação"
        />
      </div>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicações…">
        {applications.length === 0 ? (
          <Card>
            <EmptyApplicationList
              searching={search.trim() !== ''}
              showingArchived={showingArchived}
              onClearSearch={() => setSearch('')}
              createButton={newApplicationButton}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((application) => (
              <li key={application.id}>
                <ApplicationRow
                  application={application}
                  examTitle={examTitle.get(application.examId)}
                  className={className.get(application.classId)}
                  onArchive={() => setPendingArchive(application)}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      {pendingArchive !== null && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingArchive(null)}
          title={showingArchived ? 'Restaurar esta aplicação?' : 'Arquivar esta aplicação?'}
          description={
            showingArchived
              ? 'A aplicação volta para a lista e pode ser gerada de novo.'
              : 'A aplicação sai da lista. As folhas já impressas e as correções continuam como estão, e você pode restaurá-la depois.'
          }
          confirmLabel={showingArchived ? 'Restaurar' : 'Arquivar'}
          pending={archiveApplication.isPending}
          onConfirm={() =>
            archiveApplication.mutate(
              { id: pendingArchive.id, archive: !showingArchived },
              { onSettled: () => setPendingArchive(null) },
            )
          }
        />
      )}
    </div>
  );
}

function ApplicationRow({
  application,
  examTitle,
  className,
  onArchive,
}: Readonly<{
  application: Application;
  examTitle: string | undefined;
  className: string | undefined;
  onArchive: () => void;
}>) {
  const archived = application.status === 'closed';
  const status = STATUS[application.status];

  return (
    <Card
      interactive
      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {application.gradesReleased && <Badge tone="info">Notas liberadas</Badge>}
        </div>

        <Link
          to={buildPath(ROUTES.applicationDetail, { id: application.id })}
          className="text-title text-primary hover:underline"
        >
          {examTitle ?? 'Prova removida'}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {className ?? 'Turma removida'} · {formatDate(application.date)}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          icon={archived ? <RotateCcw size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
          onClick={onArchive}
        >
          {archived ? 'Restaurar' : 'Arquivar'}
        </Button>
      </div>
    </Card>
  );
}

function EmptyApplicationList({
  searching,
  showingArchived,
  onClearSearch,
  createButton,
}: Readonly<{
  searching: boolean;
  showingArchived: boolean;
  onClearSearch: () => void;
  createButton: ReactNode;
}>) {
  if (searching) {
    return (
      <EmptyState
        illustration={<SearchIllustration />}
        title="Nenhuma aplicação encontrada"
        description="Nenhuma aplicação bate com o que você buscou. Tente outra data ou limpe a busca."
        action={
          <Button variant="secondary" onClick={onClearSearch}>
            Limpar busca
          </Button>
        }
      />
    );
  }

  if (showingArchived) {
    return (
      <EmptyState
        illustration={<ArchiveIllustration />}
        title="Nenhuma aplicação arquivada"
        description="Arquivar tira a aplicação da lista sem apagar as folhas impressas nem as correções, e é reversível."
      />
    );
  }

  return (
    <EmptyState
      illustration={<ApplicationsIllustration />}
      title="Nenhuma aplicação ainda"
      description="Aplicar é levar uma prova a uma turma numa data. É aqui que saem as versões embaralhadas e as folhas com código, uma por aluno."
      action={createButton}
    />
  );
}
