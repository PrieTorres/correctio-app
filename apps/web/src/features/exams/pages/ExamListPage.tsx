import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, Copy, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  ArchiveIllustration,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ExamsIllustration,
  PageHeader,
  QueryBoundary,
  SearchIllustration,
  SearchInput,
  SegmentedControl,
  Tour,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { totalScore } from '@/lib/exams';
import type { Exam, ExamStatus } from '@/types/domain';
import { useArchiveExam, useDuplicateExam, useExamList } from '../hooks/useExams';

type Filter = 'active' | 'archived';

const FILTERS = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
] as const satisfies readonly { value: Filter; label: string }[];

const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: 'Rascunho',
  ready: 'Aplicada',
  closed: 'Arquivada',
};

export function ExamListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [pendingArchive, setPendingArchive] = useState<Exam | null>(null);

  const showingArchived = filter === 'archived';
  const { data, isPending, isError } = useExamList(showingArchived, search);
  const archiveExam = useArchiveExam();
  const duplicateExam = useDuplicateExam();

  const exams = data?.items ?? [];

  const newExamButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />} data-tour="create">
      <Link to={ROUTES.newExam}>Nova prova</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Provas"
        description="A prova é o conteúdo. Aplicá-la a uma turma é o passo seguinte, e a mesma prova serve para várias."
        actions={
          <>
            <Button icon={<Sparkles size={18} aria-hidden />} data-tour="generate">
              <Link to={ROUTES.generateExam}>Gerar automaticamente</Link>
            </Button>
            {newExamButton}
          </>
        }
      />

      <div data-tour="filters" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Buscar provas"
          placeholder="Buscar pelo título"
        />
        <SegmentedControl
          segments={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Filtrar por situação"
        />
      </div>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando provas…">
        {exams.length === 0 ? (
          <Card>
            <EmptyExamList
              searching={search.trim() !== ''}
              showingArchived={showingArchived}
              onClearSearch={() => setSearch('')}
              createButton={newExamButton}
            />
          </Card>
        ) : (
          <ul data-tour="list" className="flex flex-col gap-3">
            {exams.map((exam) => (
              <li key={exam.id}>
                <ExamRow
                  exam={exam}
                  onArchive={() => setPendingArchive(exam)}
                  onDuplicate={() =>
                    duplicateExam.mutate(exam.id, {
                      onSuccess: (copy) =>
                        void navigate(buildPath(ROUTES.editExam, { id: copy.id })),
                    })
                  }
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
          title={showingArchived ? 'Restaurar esta prova?' : 'Arquivar esta prova?'}
          description={
            showingArchived
              ? 'A prova volta como rascunho e pode receber novas aplicações.'
              : 'A prova deixa de receber novas aplicações. As que já existem seguem normalmente, e você pode restaurá-la depois.'
          }
          confirmLabel={showingArchived ? 'Restaurar' : 'Arquivar'}
          pending={archiveExam.isPending}
          onConfirm={() =>
            archiveExam.mutate(
              { id: pendingArchive.id, archive: !showingArchived },
              { onSettled: () => setPendingArchive(null) },
            )
          }
        />
      )}

      <Tour screen="exams" ready={exams.length > 0} />
    </div>
  );
}

function ExamRow({
  exam,
  onArchive,
  onDuplicate,
}: Readonly<{ exam: Exam; onArchive: () => void; onDuplicate: () => void }>) {
  const archived = exam.status === 'closed';

  return (
    <Card
      interactive
      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={exam.status === 'ready' ? 'success' : 'neutral'}>
            {STATUS_LABEL[exam.status]}
          </Badge>
        </div>

        <Link
          to={buildPath(ROUTES.examDetail, { id: exam.id })}
          className="text-title text-primary group-hover:underline"
        >
          {exam.title}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {exam.questions.length}/20 questões · pontuação total {totalScore(exam.questions)}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        {!archived && (
          <Button variant="ghost" icon={<Copy size={16} aria-hidden />} onClick={onDuplicate}>
            Duplicar
          </Button>
        )}
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

function EmptyExamList({
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
        title="Nenhuma prova encontrada"
        description="Nenhuma prova bate com o que você buscou. Tente outro título ou limpe a busca."
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
        title="Nenhuma prova arquivada"
        description="Arquivar impede novas aplicações sem afetar as que já existem, e é reversível a qualquer momento."
      />
    );
  }

  return (
    <EmptyState
      illustration={<ExamsIllustration />}
      title="Nenhuma prova ainda"
      description="Monte a prova escolhendo questões do banco, ou deixe o sistema montar a partir das suas tags. A mesma prova serve para várias turmas e vários semestres."
      action={createButton}
    />
  );
}
