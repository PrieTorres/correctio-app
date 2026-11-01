import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { collationKey } from '@correctio/domain'
import { questionTagSchema } from '@/lib/schemas'
import { normalize } from '@/lib/utils'
import { useQuestionTags } from '../hooks/useQuestions'

/**
 * The spelling a typed tag is added with: the one already chosen in this
 * form, else the one the bank already has, else the one typed.
 *
 * "calculo" and "Cálculo" are the same topic to a teacher and two different
 * filters to the exam builder, which is how a pool quietly halves. Matching
 * before adding fixes it where it starts. The chosen tags count too, because
 * the database keys a question's tags ignoring case and accents, and
 * "Integrais" beside "integrais" failed the save (#184). The comparison is the
 * one the API refuses with, so the field never adds what the save would refuse.
 */
function spellingOf(tag: string, chosen: readonly string[], known: readonly string[]): string {
  const sameTag = (item: string) => collationKey(item) === collationKey(tag)
  return chosen.find(sameTag) ?? known.find(sameTag) ?? tag
}

/**
 * Free-text tags with suggestions drawn from what the bank already uses.
 *
 * Tags are what the automatic exam builder filters on, so a typo creating a
 * near-duplicate quietly shrinks the pool it can draw from. Suggesting the
 * existing ones is cheaper than de-duplicating later.
 *
 * Keeping focus on the input stops its blur handler from committing the half-
 * typed draft on the way to this click, which would add "Cál" beside the
 * "Cálculo" being chosen.
 *
 * A tag the column cannot hold stays in the input with the reason under it,
 * so the teacher shortens it instead of losing it. `error` is what the form
 * refused about the tags already chosen.
 */
export function TagField({
  value,
  onChange,
  error,
}: Readonly<{ value: string[]; onChange: (tags: string[]) => void; error?: string }>) {
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string>()
  const { data: known = [] } = useQuestionTags()

  const add = (typed: string) => {
    if (typed.trim() === '') return

    const checked = questionTagSchema.safeParse(typed)
    if (!checked.success) {
      setDraftError(checked.error.issues[0]?.message)
      return
    }

    const tag = spellingOf(checked.data, value, known)
    setDraft('')
    if (!value.includes(tag)) onChange([...value, tag])
  }

  const changeDraft = (next: string) => {
    setDraft(next)
    setDraftError(undefined)
  }

  const message = draftError ?? error

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
          onChange={(event) => changeDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          aria-invalid={message === undefined ? undefined : true}
          aria-describedby={message === undefined ? undefined : 'tag-error'}
          placeholder={value.length === 0 ? 'Digite e pressione Enter' : ''}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-body focus:outline-none"
        />
      </div>

      {message !== undefined && (
        <p id="tag-error" role="alert" className="text-caption text-danger">
          {message}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-caption text-ink-subtle">
            {query === '' ? 'Já usadas:' : 'Já usadas que combinam:'}
          </span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
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
