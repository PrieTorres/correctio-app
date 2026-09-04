import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Plus, RotateCcw, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchInput,
  SegmentedControl,
  type Segment,
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <EmptyState
              icon={<Users size={24} aria-hidden />}
              title={showingArchived ? 'Nenhuma turma arquivada' : 'Nenhuma turma ainda'}
              description={
                showingArchived
                  ? 'Turmas arquivadas somem das listas mas continuam nos relatórios, e podem ser restauradas a qualquer momento.'
                  : 'Crie a primeira turma para começar a cadastrar alunos e aplicar provas.'
              }
              action={showingArchived ? undefined : newClassButton}
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
    </div>
  );
}

function ClassCard({
  item,
  onEdit,
  onToggleArchive,
}: {
  item: Class;
  onEdit: () => void;
  onToggleArchive: () => void;
}) {
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
}: {
  item: Class | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
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
