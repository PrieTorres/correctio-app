import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
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

  const add = (tag: string) => {
    const clean = tag.trim()
    if (clean === '' || value.includes(clean)) return
    onChange([...value, clean])
    setDraft('')
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

  const suggestions = known.filter((tag) => !value.includes(tag)).slice(0, 6)

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-subtle">Já usadas:</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="rounded-[var(--radius-chip)] border border-line px-2 py-1 text-caption text-ink-muted hover:bg-surface-muted"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
