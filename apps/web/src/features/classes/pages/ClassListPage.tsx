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
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchInput,
  SearchIllustration,
  SegmentedControl,
  type Segment,
  Tour,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import type { Class } from '@/types/domain';
import { useArchiveClass, useClassList } from '../hooks/useClasses';
import { ClassFormModal } from '../components/ClassFormModal';

type Filter = 'active' | 'archived';

const FILTERS: readonly Segment<Filter>[] = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
];

export function ClassListPage() {
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Class | null>(null);

  const showingArchived = filter === 'archived';
  const { data, isPending, isError } = useClassList(showingArchived, search);
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

  const newClassButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={openCreate}>
      Nova turma
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Turmas"
        description="Cada turma guarda seus alunos e as provas já aplicadas a eles."
        actions={newClassButton}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Buscar turmas"
          placeholder="Buscar por nome ou disciplina"
        />
        <SegmentedControl
          segments={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Filtrar por situação"
        />
      </div>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando turmas…">
        {classes.length === 0 ? (
          <Card>
            <EmptyClassList
              searching={search.trim() !== ''}
              showingArchived={showingArchived}
              onClearSearch={() => setSearch('')}
              createButton={newClassButton}
            />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        )}
      </QueryBoundary>

      <ClassFormModal open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <ArchiveConfirmDialog
        item={pendingArchive}
        pending={archiveClass.isPending}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive === null) return;
          archiveClass.mutate(
            { id: pendingArchive.id, archive: pendingArchive.status === 'active' },
            { onSettled: () => setPendingArchive(null) },
          );
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

  return (
    <Card interactive className="flex h-full flex-col justify-between p-5">
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link
            to={buildPath(ROUTES.classDetail, { id: item.id })}
            className="text-title text-primary hover:underline"
          >
            {item.name}
          </Link>
          {isArchived && <Badge>Arquivada</Badge>}
        </div>
        <p className="text-body text-ink-muted">{item.subject}</p>
        <p className="text-caption text-ink-subtle">{item.term}</p>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant="ghost"
          icon={isArchived ? <RotateCcw size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
          onClick={onToggleArchive}
        >
          {isArchived ? 'Restaurar' : 'Arquivar'}
        </Button>
      </div>
    </Card>
  );
}

function ArchiveConfirmDialog({
  item,
  pending,
  onOpenChange,
  onConfirm,
}: Readonly<{
  item: Class | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}>) {
  const isArchiving = item?.status === 'active';

  return (
    <ConfirmDialog
      open={item !== null}
      onOpenChange={onOpenChange}
      title={isArchiving ? 'Arquivar esta turma?' : 'Restaurar esta turma?'}
      description={
        isArchiving
          ? 'A turma sai das listas ativas, mas continua nos relatórios e nas aplicações já feitas. Você pode restaurá-la depois.'
          : 'A turma volta para a lista de ativas e pode receber novas aplicações.'
      }
      confirmLabel={isArchiving ? 'Arquivar' : 'Restaurar'}
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}
