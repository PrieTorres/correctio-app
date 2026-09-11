import { useEffect, useState } from 'react';
import { Button, Drawer, SearchInput } from '@/components/ui';
import { useQuestionList } from '@/features/questions';
import type { Question } from '@/types/domain';

interface QuestionPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadyIn: string[];
  remainingSlots: number;
  onConfirm: (questions: Question[]) => void;
}

/**
 * Picks questions from the bank without leaving the exam being built.
 *
 * The cap on how many still fit is enforced while ticking rather than after
 * confirming: letting someone tick eight when two slots remain and then
 * silently dropping six is worse than not letting them tick at all.
 */
export function QuestionPickerDrawer({
  open,
  onOpenChange,
  alreadyIn,
  remainingSlots,
  onConfirm,
}: Readonly<QuestionPickerDrawerProps>) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Question[]>([]);
  const { data } = useQuestionList({ search, type: 'all', tags: [], deleted: false });

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const available = (data?.items ?? []).filter((item) => !alreadyIn.includes(item.id));
  const isSelected = (question: Question) => selected.some((item) => item.id === question.id);
  const atCap = selected.length >= remainingSlots;

  const toggle = (question: Question) =>
    setSelected((current) =>
      isSelected(question)
        ? current.filter((item) => item.id !== question.id)
        : [...current, question],
    );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar do banco"
      description="A prova em construção continua visível ao lado."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={selected.length === 0}
            onClick={() => {
              onConfirm(selected);
              onOpenChange(false);
            }}
          >
            Adicionar selecionadas
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Buscar questões do banco"
          placeholder="Buscar pelo enunciado"
        />

        <p className="text-caption text-ink-subtle" aria-live="polite">
          {selected.length} selecionadas · cabem mais {remainingSlots} nesta prova
        </p>

        {available.length === 0 ? (
          <p className="py-6 text-center text-body text-ink-muted">
            Nenhuma questão disponível. Todas as que batem com a busca já estão nesta prova.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {available.map((question) => (
              <li key={question.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] p-2 hover:bg-surface-muted">
                  {/*
                    Naming the control explicitly beats letting a screen reader
                    stitch the statement, the type and the tags into one
                    run-on sentence.
                  */}
                  <input
                    type="checkbox"
                    aria-label={question.statement}
                    checked={isSelected(question)}
                    disabled={!isSelected(question) && atCap}
                    onChange={() => toggle(question)}
                    className="mt-1 size-4 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{question.statement}</span>
                    <span className="block text-caption text-ink-subtle">
                      {question.type === 'objetiva' ? 'Objetiva' : 'Discursiva'}
                      {question.tags.length > 0 && ` · ${question.tags.join(', ')}`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
