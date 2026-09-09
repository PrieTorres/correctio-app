import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/**
 * Single-choice filter rendered as a row of segments.
 *
 * Built on native radio inputs inside a `fieldset` rather than on toggle
 * buttons: `aria-pressed` describes independent switches, while this control
 * picks exactly one option. Radios announce "1 of 2" and move with the arrow
 * keys without any handler of ours, and the generated `name` keeps two
 * controls on the same screen from capturing each other.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: Readonly<{
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}>) {
  const groupName = useId();

  return (
    <fieldset className="flex rounded-[var(--radius-control)] border border-line bg-surface p-1">
      <legend className="sr-only">{label}</legend>

      {segments.map((segment) => (
        <label key={segment.value} className="cursor-pointer">
          <input
            type="radio"
            name={groupName}
            value={segment.value}
            checked={value === segment.value}
            onChange={() => onChange(segment.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'touch-target flex items-center justify-center rounded-[var(--radius-chip)] px-4 text-label transition-colors',
              'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
              value === segment.value
                ? 'bg-primary-container text-on-primary'
                : 'text-ink-muted hover:bg-surface-muted',
            )}
          >
            {segment.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
