import { useLayoutEffect, useRef } from 'react'

/**
 * Gives back the focus a dialog took, to whatever element opened it.
 *
 * Radix returns focus to `Dialog.Trigger`, and none of these dialogs use one:
 * they are opened by whichever component holds the state, from a header button
 * to a row action. Its handler still calls `preventDefault`, which also cancels
 * the focus scope's own restore, so closing a dialog dropped focus onto `body`
 * and keyboard navigation restarted from the top of the page.
 *
 * A layout effect runs before the focus scope's effect moves focus into the
 * dialog, so what gets recorded is the opener rather than the dialog itself.
 *
 * Returns the handler to hand to `onCloseAutoFocus`, so every dialog built here
 * restores focus the same way and there is one place to get it right.
 */
export function useDialogFocusRestore(open: boolean): (event: Event) => void {
  const opener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null
  }, [open])

  return (event: Event) => {
    event.preventDefault()
    opener.current?.focus()
  }
}
