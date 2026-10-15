import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { SaveError } from './SaveError'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  pending?: boolean
  /**
   * Why the confirmed action failed. Shown inside the dialog, which the caller
   * keeps open, so a refused archive or removal never looks like it worked.
   */
  error?: Error | null
}

/** Shared confirmation for archive, restore, remove, anonymize and regenerate. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  pending = false,
  error = null,
}: Readonly<ConfirmDialogProps>) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="sm">
      <div className="text-body text-ink-muted">{description}</div>
      {error !== null && (
        <div className="mt-4">
          <SaveError error={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Aguarde…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
