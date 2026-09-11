import { useEffect, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button, Modal, NumberInput } from '@/components/ui';
import { drawQuestions, redrawQuestion } from '@/lib/exams';
import type { Question } from '@/types/domain';

interface AutoFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: Question[];
  /** The bank is still on its way, so there is nothing to draw from yet. */
  bankPending: boolean;
  remainingSlots: number;
  onConfirm: (questions: Question[]) => void;
}

/**
 * Builds a selection from the bank by filter, previewed before it is committed.
 *
 * The draw is shown rather than applied straight away because a random
 * selection is a suggestion, not a decision: swapping one question out is far
 * more common than accepting all of them untouched.
 */
export function AutoFillDialog({
  open,
  onOpenChange,
  bank,
  bankPending,
  remainingSlots,
  onConfirm,
}: Readonly<AutoFillDialogProps>) {
  const [tags, setTags] = useState<string[]>([]);
  const [multipleChoiceCount, setMultipleChoiceCount] = useState(5);
  const [includeOpenEnded, setIncludeOpenEnded] = useState(false);
  const [openEndedCount, setOpenEndedCount] = useState(1);
  const [preview, setPreview] = useState<Question[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setNotice(null);
  }, [open]);

  const knownTags = [...new Set(bank.flatMap((item) => item.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );

  const available = bank.filter((item) => tags.every((tag) => item.tags.includes(tag)));

  const generate = () => {
    const result = drawQuestions(bank, {
      tags,
      multipleChoiceCount,
      openEndedCount: includeOpenEnded ? openEndedCount : 0,
    });

    setPreview(result.questions.slice(0, remainingSlots));
    setNotice(
      result.shortfall === null
        ? null
        : `O banco não tinha tudo que você pediu: faltaram ${result.shortfall.multipleChoice} objetivas e ${result.shortfall.openEnded} discursivas.`,
    );
  };

  const swap = (question: Question) => {
    if (preview === null) return;

    const replacement = redrawQuestion(
      bank,
      { tags },
      preview.map((item) => item.id),
      question,
    );

    if (replacement === null) {
      setNotice('Não há outra questão do mesmo tipo com esses filtros para colocar no lugar.');
      return;
    }

    setPreview(preview.map((item) => (item.id === question.id ? replacement : item)));
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Gerar prova automaticamente">
      <div className="flex flex-col gap-4">
        {knownTags.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label text-ink-muted">Tags de conteúdo</legend>
            <div className="flex flex-wrap gap-2">
              {knownTags.map((tag) => (
                <label key={tag} className="cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={() =>
                      setTags((current) =>
                        current.includes(tag)
                          ? current.filter((item) => item !== tag)
                          : [...current, tag],
                      )
                    }
                    className="peer sr-only"
                  />
                  <span className="block rounded-[var(--radius-chip)] border border-line px-2 py-1 text-caption text-ink-muted peer-checked:border-primary peer-checked:bg-primary-container peer-checked:text-on-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                    {tag}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <CountField
          label="Quantas objetivas"
          value={multipleChoiceCount}
          onChange={setMultipleChoiceCount}
        />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={includeOpenEnded}
            onChange={(event) => setIncludeOpenEnded(event.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          <span className="text-body text-ink">Incluir discursivas</span>
        </label>

        {includeOpenEnded && (
          <CountField
            label="Quantas discursivas"
            value={openEndedCount}
            onChange={setOpenEndedCount}
          />
        )}

        <p className="text-caption text-ink-subtle" aria-live="polite">
          {bankPending
            ? 'Carregando o banco de questões…'
            : `${available.length} questões disponíveis com estes filtros · cabem ${remainingSlots} nesta prova`}
        </p>

        {/*
          Drawing before the bank arrives finds nothing and then blames the
          bank for being short, which is the one thing that is not true. The
          screen opens straight into this dialog, so the race is the normal
          case rather than a corner of it.
        */}
        <Button variant="secondary" onClick={generate} disabled={bankPending}>
          Gerar seleção
        </Button>

        {notice !== null && (
          <p
            role="status"
            className="rounded-[var(--radius-control)] bg-warning-surface p-3 text-caption text-on-warning-surface"
          >
            {notice}
          </p>
        )}

        {preview !== null && (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {preview.map((question) => (
              <li
                key={question.id}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line p-2"
              >
                <span className="min-w-0 flex-1 truncate text-body text-ink">
                  {question.statement}
                </span>
                <IconButton
                  label={`Trocar a questão ${question.statement}`}
                  onClick={() => swap(question)}
                >
                  <RefreshCw size={15} aria-hidden />
                </IconButton>
                <IconButton
                  label={`Remover a questão ${question.statement}`}
                  onClick={() => setPreview(preview.filter((item) => item.id !== question.id))}
                >
                  <Trash2 size={15} aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={preview === null || preview.length === 0}
            onClick={() => {
              if (preview !== null) onConfirm(preview);
              onOpenChange(false);
            }}
          >
            Usar esta seleção
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}

function CountField({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: number; onChange: (value: number) => void }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span aria-hidden className="text-label text-ink-muted">
        {label}
      </span>
      <NumberInput value={value} onValueChange={onChange} max={20} label={label} className="w-24" />
    </div>
  );
}
