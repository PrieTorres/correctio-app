import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Plus, RotateCcw } from 'lucide-react';
import {
  ApplicationsIllustration,
  ArchiveIllustration,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchIllustration,
  SearchInput,
  SegmentedControl,
  Tour,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { formatDate } from '@/lib/utils';
import { useClassList } from '@/features/classes';
import { useExamList } from '@/features/exams';
import type { Application, ApplicationStatus } from '@/types/domain';
import { APPLICATION_FILTER, type ApplicationFilter } from '../application-filter';
import { ArchiveApplicationDialog } from '../components/ArchiveApplicationDialog';
import { useApplicationFilter } from '../hooks/useApplicationFilter';
import { useVisibleApplications } from '../hooks/useVisibleApplications';

const FILTERS = [
  { value: APPLICATION_FILTER.ACTIVE, label: 'Ativas' },
  { value: APPLICATION_FILTER.ARCHIVED, label: 'Arquivadas' },
  { value: APPLICATION_FILTER.IN_PROGRESS, label: 'Correção em andamento' },
] as const satisfies readonly { value: ApplicationFilter; label: string }[];

const STATUS: Record<ApplicationStatus, { label: string; tone: 'neutral' | 'success' }> = {
  draft: { label: 'A gerar', tone: 'neutral' },
  generated: { label: 'Gerada', tone: 'success' },
  closed: { label: 'Arquivada', tone: 'neutral' },
};

export function ApplicationListPage() {
  const [filter, setFilter] = useApplicationFilter();
  const [search, setSearch] = useState('');
  const [pendingArchive, setPendingArchive] = useState<Application | null>(null);

  const { applications, isPending, isError } = useVisibleApplications(filter, search);
  const { data: exams } = useExamList(false, '');
  const { data: classes } = useClassList(false, '');

  const examTitle = new Map((exams?.items ?? []).map((item) => [item.id, item.title]));
  const className = new Map((classes?.items ?? []).map((item) => [item.id, item.name]));

  const newApplicationButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />} data-tour="create">
      <Link to={ROUTES.newApplication}>Nova aplicação</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Aplicações"
        description="A aplicação é o encontro de uma prova com uma turma numa data. A mesma prova rende quantas aplicações você quiser."
        actions={newApplicationButton}
      />

      <div data-tour="filters" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
              filter={filter}
              onClearSearch={() => setSearch('')}
              createButton={newApplicationButton}
            />
          </Card>
        ) : (
          <ul data-tour="list" className="flex flex-col gap-3">
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
        <ArchiveApplicationDialog
          application={pendingArchive}
          restoring={filter === APPLICATION_FILTER.ARCHIVED}
          onClose={() => setPendingArchive(null)}
        />
      )}

      <Tour screen="applications" ready={applications.length > 0} />
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
          className="card-link text-title text-primary group-hover:underline"
        >
          {examTitle ?? 'Prova removida'}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {className ?? 'Turma removida'} · {formatDate(application.date)}
        </p>
      </div>

      <div className="above-card-link flex shrink-0 gap-1">
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
  filter,
  onClearSearch,
  createButton,
}: Readonly<{
  searching: boolean;
  filter: ApplicationFilter;
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

  if (filter === APPLICATION_FILTER.IN_PROGRESS) {
    return (
      <EmptyState
        illustration={<SearchIllustration />}
        title="Nenhuma correção em andamento"
        description="Quando uma folha for lida e ainda esperar a nota de uma questão discursiva, a aplicação aparece aqui."
      />
    );
  }

  if (filter === APPLICATION_FILTER.ARCHIVED) {
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
