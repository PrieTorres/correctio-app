/**
 * Line illustrations for empty states.
 *
 * Inline SVG rather than image files: nothing to fetch, nothing to miss the
 * cache, no layout shift while it loads, and the shapes read the design tokens
 * so they follow the palette instead of freezing a colour at export time.
 *
 * Each one is decorative. The surrounding empty state already carries the
 * heading and the explanation, so repeating that in a title would make screen
 * readers announce the same sentence twice.
 */

const STROKE = 'var(--color-primary)';
const FILL_SOFT = 'var(--color-primary-fixed)';
const ACCENT = 'var(--color-accent)';

type IllustrationProps = Readonly<{ className?: string }>;

function Frame({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="presentation"
      aria-hidden
      className={className ?? 'h-36 w-auto'}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Two people beside a roster card: a class with nobody in it yet. */
export function ClassesIllustration({ className }: IllustrationProps) {
  return (
    <Frame className={className}>
      <rect x="18" y="26" width="76" height="68" rx="8" fill={FILL_SOFT} />
      <rect x="18" y="26" width="76" height="68" rx="8" stroke={STROKE} strokeWidth="2.5" />
      <path d="M32 48h48M32 60h48M32 72h30" stroke={STROKE} strokeWidth="2.5" opacity="0.45" />
      <circle cx="116" cy="46" r="13" fill={ACCENT} />
      <circle cx="116" cy="46" r="13" stroke={STROKE} strokeWidth="2.5" />
      <path d="M98 84c0-10 8-17 18-17s18 7 18 17" stroke={STROKE} strokeWidth="2.5" />
      <path d="M116 40v12M110 46h12" stroke={STROKE} strokeWidth="2.5" />
    </Frame>
  );
}

/** An open folder with nothing filed in it. */
export function ArchiveIllustration({ className }: IllustrationProps) {
  return (
    <Frame className={className}>
      <path
        d="M24 40a6 6 0 0 1 6-6h24l8 10h44a6 6 0 0 1 6 6v38a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z"
        fill={FILL_SOFT}
        stroke={STROKE}
        strokeWidth="2.5"
      />
      <path d="M24 60h112" stroke={STROKE} strokeWidth="2.5" opacity="0.45" />
      <path d="M62 78h36" stroke={STROKE} strokeWidth="2.5" opacity="0.45" />
    </Frame>
  );
}

/** A blank answer sheet: questions written, nothing answered. */
export function QuestionsIllustration({ className }: IllustrationProps) {
  return (
    <Frame className={className}>
      <rect x="34" y="18" width="92" height="86" rx="8" fill={FILL_SOFT} />
      <rect x="34" y="18" width="92" height="86" rx="8" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="50" cy="40" r="5" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="50" cy="60" r="5" fill={ACCENT} stroke={STROKE} strokeWidth="2.5" />
      <circle cx="50" cy="80" r="5" stroke={STROKE} strokeWidth="2.5" />
      <path d="M64 40h48M64 60h48M64 80h30" stroke={STROKE} strokeWidth="2.5" opacity="0.45" />
    </Frame>
  );
}

/** A magnifier over a list: the search matched nothing. */
export function SearchIllustration({ className }: IllustrationProps) {
  return (
    <Frame className={className}>
      <rect x="22" y="26" width="76" height="68" rx="8" fill={FILL_SOFT} />
      <rect x="22" y="26" width="76" height="68" rx="8" stroke={STROKE} strokeWidth="2.5" />
      <path d="M36 46h34M36 60h48M36 74h24" stroke={STROKE} strokeWidth="2.5" opacity="0.4" />
      <circle cx="110" cy="62" r="22" fill="var(--color-surface)" />
      <circle cx="110" cy="62" r="22" stroke={STROKE} strokeWidth="3" />
      <path d="M126 78l12 12" stroke={STROKE} strokeWidth="4" />
    </Frame>
  );
}
