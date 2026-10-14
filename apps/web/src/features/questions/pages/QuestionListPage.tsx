import { useEffect, useState, type ReactNode } from 'react';
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
  QueryBoundary,
  QuestionsIllustration,
  SearchIllustration,
  SearchInput,
  SegmentedControl,
  Tour,
} from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { isMultipleChoice, type Question, type QuestionType } from '@/types/domain';
import {
  useDeleteQuestion,
  useDuplicateQuestion,
  useQuestionList,
  useQuestionTags,
  type QuestionFilters,
  type QuestionSort,
} from '../hooks/useQuestions';
import { QuestionTypeBadge } from '../components/QuestionTypeBadge';

type StatusFilter = 'active' | 'deleted';

const PAGE_SIZE = 50;

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
 * The page number resets whenever any filter changes: staying on page 3 of a
 * new filter shows an empty list that has nothing to do with the records.
 *
 * The confirmation dialog is a component of its own so the delete mutation
 * lives next to the button that triggers it, and the page keeps only the
 * state it actually reads.
 */
export function QuestionListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [type, setType] = useState<QuestionType | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<QuestionSort>('newest');
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, status, type, tags, sort, onlyUntagged]);

  const filters: QuestionFilters = {
    search,
    type,
    tags,
    deleted: status === 'deleted',
    onlyUntagged,
    sort,
    page,
  };
  const { data, isPending, isError } = useQuestionList(filters);
  const { data: knownTags = [] } = useQuestionTags();
  const duplicateQuestion = useDuplicateQuestion();

  const questions = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtering = search.trim() !== '' || type !== 'all' || tags.length > 0 || onlyUntagged;

  const newQuestionButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />} data-tour="create">
      <Link to={ROUTES.newQuestion}>Nova questão</Link>
    </Button>
  );

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

      <div className="flex flex-col gap-3">
        <div
          data-tour="filters"
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Buscar questões"
            placeholder="Buscar pelo enunciado"
          />
          <SegmentedControl
            segments={TYPE_SEGMENTS}
            value={type}
            onChange={setType}
            label="Filtrar por tipo"
          />
          <SegmentedControl
            segments={STATUS_SEGMENTS}
            value={status}
            onChange={setStatus}
            label="Filtrar por situação"
          />
          <SegmentedControl
            segments={SORT_SEGMENTS}
            value={sort}
            onChange={setSort}
            label="Ordenar"
          />
        </div>

        {knownTags.length > 0 && (
          <TagFilter
            available={knownTags}
            selected={tags}
            onChange={setTags}
            onlyUntagged={onlyUntagged}
            onToggleUntagged={() => {
              setOnlyUntagged((current) => !current);
              setTags([]);
            }}
          />
        )}
      </div>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando questões…">
        {questions.length === 0 ? (
          <Card>
            <EmptyQuestionList
              filtering={filtering}
              showingDeleted={status === 'deleted'}
              onClearFilters={() => {
                setSearch('');
                setType('all');
                setTags([]);
                setOnlyUntagged(false);
              }}
              createButton={newQuestionButton}
            />
          </Card>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {questions.map((question) => (
                <li key={question.id}>
                  <QuestionRow
                    question={question}
                    onDelete={() => setPendingDelete(question)}
                    onDuplicate={() => duplicateQuestion.mutate(question.id)}
                  />
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </>
        )}
      </QueryBoundary>

      {pendingDelete !== null && (
        <DeleteQuestionDialog
          question={pendingDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      <Tour screen="questions" ready={questions.length > 0} />
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: Readonly<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}>) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const canGoBack = page > 1;
  const canGoForward = page < pageCount;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-caption text-ink-subtle">
        Mostrando {first}–{last} de {total} {total === 1 ? 'questão' : 'questões'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!canGoBack} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className="flex items-center px-2 text-caption text-ink-muted">
          Página {page} de {pageCount}
        </span>
        <Button
          variant="secondary"
          disabled={!canGoForward}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

/**
 * The dialog owns the delete/restore mutation so the page keeps only the state
 * that decides whether it is open.
 */
function DeleteQuestionDialog({
  question,
  onClose,
}: Readonly<{ question: Question; onClose: () => void }>) {
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
      onConfirm={() =>
        deleteQuestion.mutate({ id: question.id, deleted: !isRestoring }, { onSettled: onClose })
      }
    />
  );
}

/**
 * A question with no tag never reaches an automatic draw, and there is no other
 * way to notice it: every tag filter hides it by definition.
 */
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
    <div className="flex flex-wrap items-center gap-2">
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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <QuestionTypeBadge type={question.type} />
          {question.tags.map((tag) => (
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

        <Link
          to={buildPath(ROUTES.questionDetail, { id: question.id })}
          className="card-link line-clamp-2 text-body text-ink group-hover:text-primary group-hover:underline"
        >
          {question.statement}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {isMultipleChoice(question)
            ? `${question.alternatives.length} alternativas`
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