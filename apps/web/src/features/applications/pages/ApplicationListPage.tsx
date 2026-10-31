import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  ApplicationsIllustration,
  ArchiveIllustration,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  QueryBoundary,
  SearchIllustration,
  Tour,
  useDebouncedValue,
} from '@/components/ui';
import { ROUTES } from '@/app/routes';
import type { ApplicationOverview } from '@/types/domain';
import { APPLICATION_FILTER, type ApplicationFilter } from '../application-filter';
import { ApplicationFiltersBar } from '../components/ApplicationFiltersBar';
import { ApplicationRow } from '../components/ApplicationRow';
import { ArchiveApplicationDialog } from '../components/ArchiveApplicationDialog';
import { useApplicationFilter } from '../hooks/useApplicationFilter';
import { useApplicationListFilters } from '../hooks/useApplicationListFilters';
import { useApplicationFilterChoices } from '../hooks/useApplications';
import { useVisibleApplications } from '../hooks/useVisibleApplications';
import { APPLICATION_PAGE_SIZE, effectiveFilters, hasApplicationListFilters } from '../list-filters';

const NO_CHOICES = { classes: [], exams: [] };

/**
 * What the list shows: the situation and the filters, kept in the URL, the
 * search, read once typing pauses, and the page.
 *
 * The page belongs to the filters and search it was chosen under, and goes
 * back to 1 as soon as any of them changes: page 3 of another search may not
 * exist. Keeping them together derives that without an effect, as the class
 * list does.
 */
function useApplicationListView() {
  const [filter, setFilter] = useApplicationFilter();
  const { filters, setFilter: setListFilter, clear } = useApplicationListFilters();
  const [search, setSearch] = useState('');
  const settledSearch = useDebouncedValue(search);
  const listKey = [filter, settledSearch, filters.classId, filters.examId, filters.pdf].join('|');
  const [paging, setPaging] = useState({ listKey, page: 1 });

  return {
    filter,
    setFilter,
    filters,
    setListFilter,
    clear,
    search,
    setSearch,
    settledSearch,
    page: paging.listKey === listKey ? paging.page : 1,
    setPage: (page: number) => setPaging({ listKey, page }),
  };
}

export function ApplicationListPage() {
  const view = useApplicationListView();
  const [pendingArchive, setPendingArchive] = useState<ApplicationOverview | null>(null);
  const { data: choices = NO_CHOICES } = useApplicationFilterChoices();

  const { applications, total, isPending, isError } = useVisibleApplications({
    filter: view.filter,
    filters: view.filters,
    search: view.settledSearch,
    page: view.page,
  });

  const newApplicationButton = (
    <ButtonLink variant="primary" icon={<Plus size={18} aria-hidden />} data-tour="create" to={ROUTES.newApplication}>
      Nova aplicação
    </ButtonLink>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Aplicações"
        description="A aplicação é o encontro de uma prova com uma turma numa data. A mesma prova rende quantas aplicações você quiser."
        actions={newApplicationButton}
      />

      <ApplicationFiltersBar
        filter={view.filter}
        onFilterChange={view.setFilter}
        search={view.search}
        onSearchChange={view.setSearch}
        filters={view.filters}
        onFiltersChange={view.setListFilter}
        onClear={view.clear}
        choices={choices}
      />

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicações…">
        {applications.length === 0 ? (
          <Card>
            <EmptyApplicationList
              searching={view.search.trim() !== ''}
              filtering={hasApplicationListFilters(effectiveFilters(view.filter, view.filters))}
              filter={view.filter}
              onClearSearch={() => view.setSearch('')}
              onClearFilters={view.clear}
              createButton={newApplicationButton}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <ul data-tour="list" className="flex flex-col gap-3">
              {applications.map((application) => (
                <li key={application.id}>
                  <ApplicationRow application={application} onArchive={() => setPendingArchive(application)} />
                </li>
              ))}
            </ul>
            <Pagination page={view.page} pageSize={APPLICATION_PAGE_SIZE} total={total} onPageChange={view.setPage} />
          </div>
        )}
      </QueryBoundary>

      {pendingArchive !== null && (
        <ArchiveApplicationDialog
          application={pendingArchive}
          restoring={view.filter === APPLICATION_FILTER.ARCHIVED}
          onClose={() => setPendingArchive(null)}
        />
      )}

      <Tour screen="applications" ready={applications.length > 0} />
    </div>
  );
}

function EmptyApplicationList({
  searching,
  filtering,
  filter,
  onClearSearch,
  onClearFilters,
  createButton,
}: Readonly<{
  searching: boolean;
  filtering: boolean;
  filter: ApplicationFilter;
  onClearSearch: () => void;
  onClearFilters: () => void;
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

  if (filtering) {
    return (
      <EmptyState
        illustration={<SearchIllustration />}
        title="Nenhuma aplicação com esses filtros"
        description="Nenhuma aplicação desta lista é da turma, da prova ou da situação do PDF escolhidas. Mude um filtro ou limpe todos."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Limpar filtros
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
