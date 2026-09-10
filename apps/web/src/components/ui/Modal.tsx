import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  /** Wider variant for content-heavy dialogs such as import previews. */
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'w-[min(28rem,calc(100vw-2rem))]',
  md: 'w-[min(34rem,calc(100vw-2rem))]',
} as const

/**
 * Base dialog for every modal in the app.
 *
 * Built on Radix so focus trapping, `Esc`, focus restoration and ARIA wiring
 * come for free; hand-rolling those is the usual way an interface fails an
 * accessibility audit.
 */
export function Modal({ open, onOpenChange, title, children, size = 'md' }: Readonly<ModalProps>) {
  const opener = useRef<HTMLElement | null>(null)

  /**
   * Radix returns focus to `Dialog.Trigger`, and these dialogs have none —
   * they are opened by whatever component holds the state, from a header
   * button to a row action. Its handler still calls `preventDefault`, which
   * also cancels the focus scope's own restore, so closing any modal dropped
   * focus onto `body` and keyboard navigation restarted from the top.
   *
   * A layout effect runs before the focus scope's effect moves focus into the
   * dialog, so this records who was focused rather than the dialog itself.
   */
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] ${SIZE_CLASSES[size]} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-overlay)] data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-title text-primary">{title}</Dialog.Title>
            <Dialog.Close
              className="touch-target -mr-2 -mt-2 inline-flex items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
              aria-label="Fechar"
            >
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
