import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export interface MenuAction {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /**
   * Why the action is not available now. The item stays in the menu, disabled,
   * with the reason under it: an action that vanishes leaves the teacher
   * wondering where it went, and the reason says what to do first.
   */
  disabledReason?: string
}

/**
 * The secondary actions of a screen behind one button, such as the header of
 * P14. Built on Radix, which brings the keyboard of a menu (arrows, `Esc`,
 * typing the first letter) and its ARIA, as the dialogs do with Radix Dialog.
 *
 * `accessibleName` tells apart the menus of a list, where every button reads
 * the same "Ações"; it starts with the visible label, so a voice command that
 * says what is on screen still finds the button.
 */
export function ActionMenu({
  label,
  actions,
  accessibleName,
}: Readonly<{ label: string; actions: readonly MenuAction[]; accessibleName?: string }>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={accessibleName}
        className="touch-target inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-primary bg-surface px-4 text-label font-semibold text-primary transition-colors hover:bg-surface-muted"
      >
        {label}
        <ChevronDown size={16} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-56 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-overlay)]"
        >
          {actions.map((action) => (
            <MenuItem key={action.label} action={action} />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/**
 * A blocked item is marked `aria-disabled` rather than Radix's `disabled`:
 * Radix skips disabled items when the arrows move through the menu, and the
 * reason under the label would never reach someone using the keyboard or a
 * screen reader. Selecting it does nothing and keeps the menu open, so the
 * reason stays on screen.
 */
function MenuItem({ action }: Readonly<{ action: MenuAction }>) {
  const blocked = action.disabledReason !== undefined

  return (
    <DropdownMenu.Item
      aria-disabled={blocked || undefined}
      onSelect={(event) => {
        if (blocked) event.preventDefault()
        else action.onSelect()
      }}
      className="flex min-h-11 cursor-pointer items-start gap-2 rounded-[var(--radius-control)] px-3 py-2 text-body text-ink outline-none aria-disabled:cursor-not-allowed aria-disabled:text-ink-subtle data-[highlighted]:bg-surface-muted"
    >
      {action.icon !== undefined && <span className="mt-0.5 shrink-0">{action.icon}</span>}
      <span className="flex flex-col">
        <span>{action.label}</span>
        {blocked && <span className="text-caption text-ink-subtle">{action.disabledReason}</span>}
      </span>
    </DropdownMenu.Item>
  )
}
