import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { normalize } from '@/lib/utils'
import { useQuestionTags } from '../hooks/useQuestions'

/**
 * Free-text tags with suggestions drawn from what the bank already uses.
 *
 * Tags are what the automatic exam builder filters on, so a typo creating a
 * near-duplicate quietly shrinks the pool it can draw from. Suggesting the
 * existing ones is cheaper than de-duplicating later.
 */
export function TagField({
  value,
  onChange,
}: Readonly<{ value: string[]; onChange: (tags: string[]) => void }>) {
  const [draft, setDraft] = useState('')
  const { data: known = [] } = useQuestionTags()

  /**
   * Typing a tag the bank already has adopts the existing spelling.
   *
   * "calculo" and "Cálculo" are the same topic to a teacher and two different
   * filters to the exam builder, which is how a pool quietly halves. Matching
   * before adding fixes it where it starts, rather than leaving both in the
   * bank for someone to reconcile later.
   */
  const add = (tag: string) => {
    const clean = tag.trim()
    if (clean === '') return

    const existing = known.find((item) => normalize(item) === normalize(clean)) ?? clean
    setDraft('')
    if (value.includes(existing)) return
    onChange([...value, existing])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
      return
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  /**
   * Typing narrows the list instead of scrolling past it.
   *
   * Showing a fixed handful was fine with six tags in the bank and useless with
   * thirty: the one being typed was rarely among them, so the teacher typed it
   * out again and created a near-duplicate — the exact thing suggesting tags is
   * meant to prevent. Matching is accent- and case-insensitive because "Cálculo"
   * typed as "calculo" is the same topic.
   */
  const query = normalize(draft)
  const matching = known.filter((tag) => !value.includes(tag) && normalize(tag).includes(query))
  const suggestions = query === '' ? matching.slice(0, 6) : matching.slice(0, 12)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="tag-input" className="text-label text-ink-muted">
        Tags de conteúdo
      </label>

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-primary-fixed px-2 py-1 text-caption text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Remover tag ${tag}`}
              className="rounded-full hover:bg-surface-hover"
            >
              <X size={13} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? 'Digite e pressione Enter' : ''}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-body focus:outline-none"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-caption text-ink-subtle">
            {query === '' ? 'Já usadas:' : 'Já usadas que combinam:'}
          </span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              /*
                Keeping focus on the input stops its blur handler from
                committing the half-typed draft on the way to this click, which
                would add "Cál" beside the "Cálculo" being chosen.
              */
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(tag)}
              className="rounded-[var(--radius-chip)] border border-line px-2 py-1 text-caption text-ink-muted hover:border-primary hover:bg-primary-fixed hover:text-primary"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
