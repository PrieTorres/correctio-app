import { cn } from '@/lib/utils'

/**
 * A spinning ring in the brand colour. Decorative: the label next to it is
 * what assistive technology announces. It stands still for whoever asked the
 * system to reduce motion, and the label still says what is happening.
 */
export function Spinner({ size = 'md', className }: Readonly<{ size?: 'sm' | 'md'; className?: string }>) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full border-primary/20 border-t-primary motion-safe:animate-spin',
        size === 'sm' ? 'size-4 border-2' : 'size-10 border-4',
        className,
      )}
    />
  )
}

/**
 * What an area shows while its data arrives: an animation in the middle of
 * it, never a sentence in a corner of an empty page. The sentence stays for
 * screen readers (`role="status"`), which hear what is loading. `compact` is
 * for a card or a section; without it the loading takes the page's space.
 */
export function LoadingState({ label = 'Carregando…', compact = false }: Readonly<{ label?: string; compact?: boolean }>) {
  return (
    <div role="status" className={cn('flex w-full items-center justify-center', compact ? 'py-8' : 'min-h-[40vh] py-16')}>
      <Spinner />
      <span className="sr-only">{label}</span>
    </div>
  )
}
