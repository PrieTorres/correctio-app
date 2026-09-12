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
  useQuestionList,
  useQuestionTags,
  type QuestionFilters,
} from '../hooks/useQuestions';
import { QuestionTypeBadge } from '../components/QuestionTypeBadge';

type StatusFilter = 'active' | 'deleted';

const STATUS_SEGMENTS = [
  { value: 'active', label: 'Ativas' },
  { value: 'deleted', label: 'Excluídas' },
] as const satisfies readonly { value: StatusFilter; label: string }[];

const TYPE_SEGMENTS = [
  { value: 'all', label: 'Todas' },
  { value: 'objetiva', label: 'Objetivas' },
  { value: 'discursiva', label: 'Discursivas' },
] as const satisfies readonly { value: QuestionType | 'all'; label: string }[];

export function QuestionListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [type, setType] = useState<QuestionType | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  const filters: QuestionFilters = { search, type, tags, deleted: status === 'deleted' };
  const { data, isPending, isError } = useQuestionList(filters);
  const { data: knownTags = [] } = useQuestionTags();
  const deleteQuestion = useDeleteQuestion();

  const questions = data?.items ?? [];
  const filtering = search.trim() !== '' || type !== 'all' || tags.length > 0;

  const newQuestionButton = (
    <Button variant="primary" icon={<Plus size={18} aria-hidden />}>
      <Link to={ROUTES.newQuestion}>Nova questão</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Banco de questões"
        description="Escreva a questão uma vez e reaproveite em quantas provas quiser."
        actions={
          <>
            <Button icon={<Upload size={18} aria-hidden />}>Importar questões</Button>
            {newQuestionButton}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        </div>

        {knownTags.length > 0 && (
          <TagFilter available={knownTags} selected={tags} onChange={setTags} />
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
              }}
              createButton={newQuestionButton}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id}>
                <QuestionRow question={question} onDelete={() => setPendingDelete(question)} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      {pendingDelete !== null && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={
            pendingDelete.deletedAt === undefined ? 'Excluir esta questão?' : 'Restaurar esta questão?'
          }
          description={
            pendingDelete.deletedAt === undefined
              ? 'A questão sai do banco, mas continua nas provas que já a usam. Você pode restaurá-la depois.'
              : 'A questão volta para o banco e pode ser usada em novas provas.'
          }
          confirmLabel={pendingDelete.deletedAt === undefined ? 'Excluir' : 'Restaurar'}
          pending={deleteQuestion.isPending}
          onConfirm={() =>
            deleteQuestion.mutate(
              { id: pendingDelete.id, deleted: pendingDelete.deletedAt === undefined },
              { onSettled: () => setPendingDelete(null) },
            )
          }
        />
      )}

      <Tour screen="questions" ready={questions.length > 0} />
    </div>
  );
}

function TagFilter({
  available,
  selected,
  onChange,
}: Readonly<{ available: string[]; selected: string[]; onChange: (tags: string[]) => void }>) {
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-ink-subtle">Tags:</span>
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
}: Readonly<{ question: Question; onDelete: () => void }>) {
  const deleted = question.deletedAt !== undefined;

  return (
    <Card interactive className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
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
          className="line-clamp-2 text-body text-ink hover:text-primary hover:underline"
        >
          {question.statement}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">
          {isMultipleChoice(question)
            ? `${question.alternatives.length} alternativas`
            : `Nota máxima ${question.maxScore ?? 0}`}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        {!deleted && (
          <Button variant="ghost" icon={<Copy size={16} aria-hidden />}>
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
