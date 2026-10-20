import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Plus, RotateCcw, Shuffle, Trash2, Upload } from 'lucide-react';
import {
  ArchiveIllustration,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Pagination,
  QueryBoundary,
  QuestionsIllustration,
  SearchIllustration,
  SearchInput,
  SegmentedControl,
  Tour,
  useDebouncedValue,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { isMultipleChoice, type Question, type QuestionType } from '@/types/domain';
import {
  QUESTION_PAGE_SIZE,
  useDeleteQuestion,
  useDuplicateQuestion,
  useQuestionList,
  useQuestionTags,
  type QuestionFilters,
  type QuestionSort,
} from '../hooks/useQuestions';
import { QuestionTypeBadge } from '../components/QuestionTypeBadge';

type StatusFilter = 'active' | 'deleted';

const STATUS_SEGMENTS = [
  { value: 'active', label: 'Ativas' },
  { value: 'deleted', label: 'Excluídas' },
] as const satisfies readonly { value: StatusFilter; label: string }[];

const SORT_SEGMENTS = [
  { value: 'newest', label: 'Recentes' },
  { value: 'statement', label: 'A–Z' },
] as const satisfies readonly { value: QuestionSort; label: string }[];

const TYPE_SEGMENTS = [
  { value: 'all', label: 'Todas' },
  { value: 'objetiva', label: 'Objetivas' },
  { value: 'discursiva', label: 'Discursivas' },
] as const satisfies readonly { value: QuestionType | 'all'; label: string }[];

/**
 * What the list shows: the filters, the search and the page. The query reads
 * the search only once typing pauses, so the server gets one request per term
 * instead of one per key.
 *
 * The page belongs to the filters it was chosen under, and goes back to 1 as
 * soon as any of them changes: page 3 of another search may not exist. Keeping
 * the two together derives that without an effect or an extra request.
 */
function useQuestionListView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [type, setType] = useState<QuestionType | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<QuestionSort>('newest');
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const settledSearch = useDebouncedValue(search);
  const listKey = JSON.stringify([settledSearch, status, type, tags, sort, onlyUntagged]);
  const [paging, setPaging] = useState({ listKey, page: 1 });
  const page = paging.listKey === listKey ? paging.page : 1;

  const filters: QuestionFilters = { search: settledSearch, type, tags, deleted: status === 'deleted', onlyUntagged, sort, page };
  return {
    search, setSearch, status, setStatus, type, setType, tags, setTags, sort, setSort, onlyUntagged, setOnlyUntagged,
    filters,
    page,
    setPage: (next: number) => setPaging({ listKey, page: next }),
  };
}

export function QuestionListPage() {
  const view = useQuestionListView();
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  const { data, isPending, isError } = useQuestionList(view.filters);
  const { data: knownTags = [] } = useQuestionTags();
  const duplicateQuestion = useDuplicateQuestion();

  const questions = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtering = view.filters.search.trim() !== '' || view.type !== 'all' || view.tags.length > 0 || view.onlyUntagged;

  const newQuestionButton = (
    <Link to={ROUTES.newQuestion}>
      <Button variant="primary" icon={<Plus size={18} aria-hidden />} data-tour="create">
        Nova questão
      </Button>
    </Link>
  );

  const clearFilters = () => {
    view.setSearch('');
    view.setType('all');
    view.setTags([]);
    view.setOnlyUntagged(false);
  };

  /** Deleting the last question of a page empties it; the list steps back instead of looking empty. */
  const stepBackIfEmptied = () => {
    if (questions.length === 1 && view.page > 1) view.setPage(view.page - 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Banco de questões"
        description="Escreva a questão uma vez e reaproveite em quantas provas quiser."
        actions={
          <>
            <Button
              icon={<Upload size={18} aria-hidden />}
              disabled
              title="A importação de questões em lote entra na próxima fase."
            >
              Importar questões
            </Button>
            {newQuestionButton}
          </>
        }
      />

      <QuestionFiltersBar
        search={view.search}
        onSearchChange={view.setSearch}
        type={view.type}
        onTypeChange={view.setType}
        status={view.status}
        onStatusChange={view.setStatus}
        sort={view.sort}
        onSortChange={view.setSort}
        knownTags={knownTags}
        tags={view.tags}
        onTagsChange={(next) => {
          view.setTags(next);
          view.setOnlyUntagged(false);
        }}
        onlyUntagged={view.onlyUntagged}
        onToggleUntagged={() => {
          view.setOnlyUntagged((current) => !current);
          view.setTags([]);
        }}
      />

      <QuestionListResults
        questions={questions}
        isPending={isPending}
        isError={isError}
        filtering={filtering}
        showingDeleted={view.status === 'deleted'}
        onClearFilters={clearFilters}
        createButton={newQuestionButton}
        page={view.page}
        total={total}
        onPageChange={view.setPage}
        onDelete={setPendingDelete}
        onDuplicate={(question) => duplicateQuestion.mutate(question.id)}
      />

      {pendingDelete !== null && (
        <DeleteQuestionDialog
          question={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDone={stepBackIfEmptied}
        />
      )}

      <Tour screen="questions" ready={questions.length > 0} />
    </div>
  );
}

function QuestionFiltersBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  knownTags,
  tags,
  onTagsChange,
  onlyUntagged,
  onToggleUntagged,
}: Readonly<{
  search: string;
  onSearchChange: (value: string) => void;
  type: QuestionType | 'all';
  onTypeChange: (value: QuestionType | 'all') => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  sort: QuestionSort;
  onSortChange: (value: QuestionSort) => void;
  knownTags: string[];
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  onlyUntagged: boolean;
  onToggleUntagged: () => void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      <div
        data-tour="filters"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <SearchInput
          value={search}
          onChange={onSearchChange}
          label="Buscar questões"
          placeholder="Buscar pelo enunciado"
        />
        <SegmentedControl
          segments={TYPE_SEGMENTS}
          value={type}
          onChange={onTypeChange}
          label="Filtrar por tipo"
        />
        <SegmentedControl
          segments={STATUS_SEGMENTS}
          value={status}
          onChange={onStatusChange}
          label="Filtrar por situação"
        />
        <SegmentedControl
          segments={SORT_SEGMENTS}
          value={sort}
          onChange={onSortChange}
          label="Ordenar"
        />
      </div>

      {knownTags.length > 0 && (
        <TagFilter
          available={knownTags}
          selected={tags}
          onChange={onTagsChange}
          onlyUntagged={onlyUntagged}
          onToggleUntagged={onToggleUntagged}
        />
      )}
    </div>
  );
}

function QuestionListResults({
  questions,
  isPending,
  isError,
  filtering,
  showingDeleted,
  onClearFilters,
  createButton,
  page,
  total,
  onPageChange,
  onDelete,
  onDuplicate,
}: Readonly<{
  questions: Question[];
  isPending: boolean;
  isError: boolean;
  filtering: boolean;
  showingDeleted: boolean;
  onClearFilters: () => void;
  createButton: ReactNode;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  onDelete: (question: Question) => void;
  onDuplicate: (question: Question) => void;
}>) {
  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando questões…">
      {questions.length === 0 ? (
        <Card>
          <EmptyQuestionList
            filtering={filtering}
            showingDeleted={showingDeleted}
            onClearFilters={onClearFilters}
            createButton={createButton}
          />
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id}>
                <QuestionRow
                  question={question}
                  onDelete={() => onDelete(question)}
                  onDuplicate={() => onDuplicate(question)}
                />
              </li>
            ))}
          </ul>

          <Pagination page={page} pageSize={QUESTION_PAGE_SIZE} total={total} onPageChange={onPageChange} />
        </>
      )}
    </QueryBoundary>
  );
}

/**
 * Deletes or restores a question. Closes only once the API accepted; a refusal
 * stays on screen with its reason, since closing would look exactly like
 * success.
 */
function DeleteQuestionDialog({
  question,
  onClose,
  onDone,
}: Readonly<{ question: Question; onClose: () => void; onDone: () => void }>) {
  const deleteQuestion = useDeleteQuestion();
  const isRestoring = question.deletedAt !== undefined;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={isRestoring ? 'Restaurar esta questão?' : 'Excluir esta questão?'}
      description={
        isRestoring
          ? 'A questão volta para o banco e pode ser usada em novas provas.'
          : 'A questão sai do banco, mas continua nas provas que já a usam. Você pode restaurá-la depois.'
      }
      confirmLabel={isRestoring ? 'Restaurar' : 'Excluir'}
      pending={deleteQuestion.isPending}
      error={deleteQuestion.error}
      onConfirm={() =>
        deleteQuestion.mutate(
          { id: question.id, deleted: !isRestoring },
          {
            onSuccess: () => {
              onDone();
              onClose();
            },
          },
        )
      }
    />
  );
}

function TagFilter({
  available,
  selected,
  onChange,
  onlyUntagged,
  onToggleUntagged,
}: Readonly<{
  available: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  onlyUntagged: boolean;
  onToggleUntagged: () => void;
}>) {
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]);

  return (
    <div data-tour="tags" className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-ink-subtle">Tags:</span>
      <button
        type="button"
        onClick={onToggleUntagged}
        aria-pressed={onlyUntagged}
        className={
          onlyUntagged
            ? 'rounded-[var(--radius-chip)] bg-warning-surface px-2 py-1 text-caption text-on-warning-surface'
            : 'rounded-[var(--radius-chip)] border border-line px-2 py-1 text-caption text-ink-muted hover:bg-surface-muted'
        }
      >
        Sem tag
      </button>
      {available.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          aria-pressed={selected.includes(tag)}
          className={
            selected.includes(tag)
              ? 'rounded-[var(--radius-chip)] bg-primary-container px-2 py-1 text-caption text-on-primary'
              : 'rounded-[var(--radius-chip)] border border-line px-2 py-1 text-caption text-ink-muted hover:bg-surface-muted'
          }
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

function QuestionRow({
  question,
  onDelete,
  onDuplicate,
}: Readonly<{ question: Question; onDelete: () => void; onDuplicate: () => void }>) {
  const deleted = question.deletedAt !== undefined;

  return (
    <Card
      interactive
      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <QuestionTags question={question} deleted={deleted} />

        <Link
          to={buildPath(ROUTES.questionDetail, { id: question.id })}
          className="card-link line-clamp-2 text-body text-ink group-hover:text-primary group-hover:underline"
        >
          {question.statement}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {isMultipleChoice(question)
            ? `${question.alternatives?.length ?? 0} alternativas`
            : `Nota máxima ${question.maxScore ?? 0}`}
        </p>
      </div>

      <div className="above-card-link flex shrink-0 gap-1">
        {!deleted && (
          <Button variant="ghost" icon={<Copy size={16} aria-hidden />} onClick={onDuplicate}>
            Duplicar
          </Button>
        )}
        <Button
          variant="ghost"
          icon={deleted ? <RotateCcw size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
          onClick={onDelete}
        >
          {deleted ? 'Restaurar' : 'Excluir'}
        </Button>
      </div>
    </Card>
  );
}

function QuestionTags({ question, deleted }: Readonly<{ question: Question; deleted: boolean }>) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <QuestionTypeBadge type={question.type} />
      {question.tags?.map((tag) => (
        <Badge key={tag} outline>
          {tag}
        </Badge>
      ))}
      {isMultipleChoice(question) && !question.allowShuffleAlternatives && (
        <span
          title="Alternativas não são embaralhadas nesta questão"
          className="inline-flex items-center gap-1 text-caption text-ink-subtle"
        >
          <Shuffle size={13} aria-hidden />
          ordem fixa
        </span>
      )}
      {deleted && <Badge tone="danger">Excluída</Badge>}
    </div>
  );
}

function EmptyQuestionList({
  filtering,
  showingDeleted,
  onClearFilters,
  createButton,
}: Readonly<{
  filtering: boolean;
  showingDeleted: boolean;
  onClearFilters: () => void;
  createButton: ReactNode;
}>) {
  if (filtering) {
    return (
      <EmptyState
        illustration={<SearchIllustration />}
        title="Nenhuma questão encontrada"
        description="Nenhuma questão bate com os filtros escolhidos. Tente outra busca, outro tipo ou outra tag."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    );
  }

  if (showingDeleted) {
    return (
      <EmptyState
        illustration={<ArchiveIllustration />}
        title="Nenhuma questão excluída"
        description="Questão excluída sai do banco mas continua nas provas que já a usam, e pode ser restaurada a qualquer momento."
      />
    );
  }

  return (
    <EmptyState
      illustration={<QuestionsIllustration />}
      title="Nenhuma questão ainda"
      description="O banco é o que faz a prova deixar de ser trabalho repetido: escreva a questão uma vez, use em quantas provas quiser, em qualquer semestre."
      action={createButton}
    />
  );
}