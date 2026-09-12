import { HelpCircle } from 'lucide-react'
import { requestTour } from '@/lib/tour'

/**
 * Reopens the tour of the screen it sits on.
 *
 * One per screen, beside the title, because that is where someone looks when
 * they do not know what a screen is for. A single button in the menu made the
 * tour feel like a setting rather than help with what is in front of them.
 */
export function HelpButton() {
  return (
    <button
      type="button"
      onClick={requestTour}
      aria-label="Ver o tour desta tela"
      title="Ver o tour desta tela"
      className="touch-target inline-flex items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-primary"
    >
      <HelpCircle size={20} aria-hidden />
    </button>
  )
}
