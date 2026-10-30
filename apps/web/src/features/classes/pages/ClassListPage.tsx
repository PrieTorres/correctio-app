import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Plus, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ArchiveIllustration,
  Badge,
  Button,
  Card,
  ClassesIllustration,
  EmptyState,
  PageHeader,
  Pagination,
  QueryBoundary,
  SearchInput,
  SearchIllustration,
  SegmentedControl,
  type Segment,
  Tour,
  useDebouncedValue,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import type { Class } from '@/types/domain';
import { CLASS_PAGE_SIZE, useArchiveClass, useClassList } from '../hooks/useClasses';
import { ArchiveClassDialog } from '../components/ArchiveClassDialog';
import { ClassFormModal } from '../components/ClassFormModal';

type Filter = 'active' | 'archived';

const FILTERS: readonly Segment<Filter>[] = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
];

/**
 * What the list shows: the filter, the search and the page. The query reads
 * the search only once typing pauses, so the server gets one request per term
 * instead of one per key.
 *
 * The page belongs to the filter and search it was chosen under, and goes back
 * to 1 as soon as either changes: page 3 of another search may not exist.
 * Keeping the two together derives that without an effect or an extra request.
 */
function useClassListView() {
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const settledSearch = useDebouncedValue(search);
  const listKey = `${filter}|${settledSearch}`;
  const [paging, setPaging] = useState({ listKey, page: 1 });

  return {
    filter,
    setFilter,
    search,
    setSearch,
    settledSearch,
    page: paging.listKey === listKey ? paging.page : 1,
    setPage: (page: number) => setPaging({ listKey, page }),
  };
}

export function ClassListPage() {
  const view = useClassListView();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Class | null>(null);

  const showingArchived = view.filter === 'archived';
  const { data, isPending, isError } = useClassList(showingArchived, view.settledSearch, view.page);
  const archiveClass = useArchiveClass();

  const classes = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: Class) => {
    setEditing(item);
    setFormOpen(true);
  };

  const closeArchive = () => {
    archiveClass.reset();
    setPendingArchive(null);
  };

  /** Archiving the last class of a page empties it; the list steps back instead of looking empty. */
  const confirmArchive = (item: Class) => {
    archiveClass.mutate(
      { id: item.id, archive: item.status === 'active' },
      {
        onSuccess: () => {
          if (classes.length === 1 && view.page > 1) view.setPage(view.page - 1);
          closeArchive();
        },
      },
    );
  };

  const newClassButton = (
    <Button
      variant="primary"
      icon={<Plus size={18} aria-hidden />}
      data-tour="create"
      onClick={openCreate}
    >
      Nova turma
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Turmas"
        description="Cada turma guarda seus alunos e as provas já aplicadas a eles."
        actions={newClassButton}
      />

      <div data-tour="filters" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={view.search}
          onChange={view.setSearch}
          label="Buscar turmas"
          placeholder="Buscar por nome ou disciplina"
        />
        <SegmentedControl
          segments={FILTERS}
          value={view.filter}
          onChange={view.setFilter}
          label="Filtrar por situação"
        />
      </div>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando turmas…">
        {classes.length === 0 ? (
          <Card>
            <EmptyClassList
              searching={view.settledSearch.trim() !== ''}
              showingArchived={showingArchived}
              onClearSearch={() => view.setSearch('')}
              createButton={newClassButton}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <ul data-tour="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((item) => (
                <li key={item.id}>
                  <ClassCard
                    item={item}
                    onEdit={() => openEdit(item)}
                    onToggleArchive={() => setPendingArchive(item)}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              page={view.page}
              pageSize={CLASS_PAGE_SIZE}
              total={data?.total ?? 0}
              onPageChange={view.setPage}
            />
          </div>
        )}
      </QueryBoundary>

      <ClassFormModal open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <ArchiveClassDialog
        item={pendingArchive}
        pending={archiveClass.isPending}
        error={archiveClass.error}
        onOpenChange={(open) => !open && closeArchive()}
        onConfirm={() => {
          if (pendingArchive !== null) confirmArchive(pendingArchive);
        }}
      />

      <Tour screen="classes" ready={classes.length > 0} />
    </div>
  );
}

/**
 * Three different situations look identical without this split: a system with
 * no classes at all, a search that matched nothing, and an archive that is
 * empty. Offering "Nova turma" to someone whose search simply missed would be
 * answering a question they did not ask.
 */
function EmptyClassList({
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
        title="Nenhuma turma encontrada"
        description="Nenhuma turma bate com o que você buscou. Tente outro nome ou disciplina, ou limpe a busca para ver todas."
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
        title="Nenhuma turma arquivada"
        description="Ao arquivar uma turma, ela sai desta lista mas continua nos relatórios e nas aplicações já feitas. Nada é apagado, e você pode restaurá-la quando quiser."
      />
    );
  }

  return (
    <EmptyState
      illustration={<ClassesIllustration />}
      title="Nenhuma turma ainda"
      description="Turma é onde ficam seus alunos. É a partir dela que você aplica uma prova e acompanha as notas — comece criando a primeira."
      action={createButton}
    />
  );
}

/**
 * One class of P3. Its buttons repeat on every card, so each one's accessible
 * name starts with the visible word and then names the class: a screen
 * reader's list of buttons otherwise reads "Editar, Editar, Editar…" (#145).
 */
function ClassCard({
  item,
  onEdit,
  onToggleArchive,
}: Readonly<{
  item: Class;
  onEdit: () => void;
  onToggleArchive: () => void;
}>) {
  const isArchived = item.status === 'archived';
  const archiveLabel = isArchived ? 'Restaurar' : 'Arquivar';

  return (
    <Card interactive className="flex h-full flex-col justify-between p-5">
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link
            to={buildPath(ROUTES.classDetail, { id: item.id })}
            className="card-link text-title text-primary group-hover:underline"
          >
            {item.name}
          </Link>
          {isArchived && <Badge>Arquivada</Badge>}
        </div>
        <p className="text-body text-ink-muted">{item.subject}</p>
        <p className="text-caption text-ink-subtle">{item.term}</p>
      </div>

      <div className="above-card-link mt-5 flex gap-2">
        <Button variant="ghost" aria-label={`Editar a turma ${item.name}`} onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant="ghost"
          icon={isArchived ? <RotateCcw size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
          aria-label={`${archiveLabel} a turma ${item.name}`}
          onClick={onToggleArchive}
        >
          {archiveLabel}
        </Button>
      </div>
    </Card>
  );
}
