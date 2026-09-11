import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';
import { NumberInput } from '@/components/ui';
import { isMultipleChoice, type ExamQuestion, type Question } from '@/types/domain';

interface SortableExamQuestionProps {
  entry: ExamQuestion;
  question: Question | undefined;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onScoreChange: (score: number) => void;
  onShuffleChange: (allow: boolean) => void;
}

/**
 * One question inside the exam being built.
 *
 * Dragging and the up/down buttons both reorder, and both are required rather
 * than redundant: dragging is the fastest way with a mouse, and the buttons are
 * the only way that works on a touch screen without a long press and the only
 * way that is obvious to someone reading the screen with a keyboard. dnd-kit
 * also makes the grip itself keyboard-operable, so the three paths agree.
 */
export function SortableExamQuestion({
  entry,
  question,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onScoreChange,
  onShuffleChange,
}: Readonly<SortableExamQuestionProps>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.questionId,
  });

  const position = `${index + 1} de ${total}`;
  const label = question?.statement ?? 'Questão removida do banco';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-surface p-3 sm:flex-row sm:items-center ${
        isDragging ? 'opacity-60 shadow-[var(--shadow-hover)]' : ''
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Arrastar a questão ${position}`}
          className="touch-target inline-flex cursor-grab items-center justify-center rounded-[var(--radius-control)] text-ink-subtle hover:bg-surface-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <IconButton
          label={`Mover para cima a questão ${position}`}
          disabled={index === 0}
          onClick={onMoveUp}
        >
          <ArrowUp size={16} aria-hidden />
        </IconButton>
        <IconButton
          label={`Mover para baixo a questão ${position}`}
          disabled={index === total - 1}
          onClick={onMoveDown}
        >
          <ArrowDown size={16} aria-hidden />
        </IconButton>
      </div>

      <p className="min-w-0 flex-1 truncate text-body text-ink">
        <span className="text-ink-subtle">{index + 1}.</span> {label}
      </p>

      {question !== undefined && isMultipleChoice(question) && (
        <label className="flex items-center gap-2 text-caption text-ink-muted">
          <input
            type="checkbox"
            checked={entry.allowShuffleAlternatives}
            onChange={(event) => onShuffleChange(event.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          embaralhar
        </label>
      )}

      <div className="flex items-center gap-2">
        {/*
          The visible word is decorative: the field's own name carries the
          position too, so a screen reader announces which question the score
          belongs to instead of "Pontos" five times over.
        */}
        <span aria-hidden className="text-caption text-ink-muted">
          Pontos
        </span>
        <NumberInput
          value={entry.score}
          onValueChange={onScoreChange}
          step="0.1"
          label={`Pontuação da questão ${position}`}
          className="w-20 px-2 py-1.5"
        />
      </div>

      <IconButton label={`Remover a questão ${position}`} onClick={onRemove}>
        <Trash2 size={16} aria-hidden />
      </IconButton>
    </li>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}
