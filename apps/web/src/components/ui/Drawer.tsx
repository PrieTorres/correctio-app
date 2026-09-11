import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDialogFocusRestore } from './use-dialog-focus-restore'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Sits under the title, for saying what the panel is for. */
  description?: string
  children: ReactNode
  /** Pinned to the bottom, out of the scrolling area. */
  footer?: ReactNode
}

/**
 * Side panel for picking from a long list without leaving the screen behind.
 *
 * Same Radix primitive as `Modal`, and deliberately so: focus trapping, `Esc`,
 * ARIA wiring and the focus restoration all behave identically, so a side panel
 * is a matter of where it sits rather than a second dialog implementation to
 * keep accessible.
 *
 * A centred dialog would work here too. This exists because the list it holds
 * is long and the exam being built stays visible beside it, which is the point
 * of picking questions without losing sight of what is already in the exam.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: Readonly<DrawerProps>) {
  const restoreFocus = useDialogFocusRestore(open)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <Dialog.Content
          onCloseAutoFocus={restoreFocus}
          className="fixed inset-y-0 right-0 z-50 flex w-[min(30rem,100vw)] flex-col bg-surface shadow-[var(--shadow-overlay)] data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out"
        >
          <div className="flex items-start justify-between gap-4 border-b border-line p-6">
            <div className="min-w-0">
              <Dialog.Title className="text-title text-primary">{title}</Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="mt-1 text-caption text-ink-subtle">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="touch-target -mr-2 -mt-2 inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
              aria-label="Fechar"
            >
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>

          {footer !== undefined && (
            <div className="border-t border-line p-6">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
