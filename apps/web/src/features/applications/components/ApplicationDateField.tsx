import { fromDateInputValue, toDateInputValue } from '@/lib/utils';

/**
 * The day of an application, picked with the date control of the browser.
 * It reads and writes the stored form, noon UTC of the day, so the day is the
 * same wherever the teacher is (`fromDateInputValue`). Shared by the creation
 * form (P12) and the change of date on the detail (P14).
 */
export function ApplicationDateField({
  id,
  value,
  onChange,
  error,
}: Readonly<{ id: string; value: string; onChange: (value: string) => void; error?: string }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink-muted">
        Data da aplicação
      </label>
      <input
        id={id}
        type="date"
        value={toDateInputValue(value)}
        aria-invalid={error === undefined ? undefined : true}
        onChange={(event) => onChange(fromDateInputValue(event.target.value))}
        className="touch-target w-full max-w-56 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
      />
      {error !== undefined && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
