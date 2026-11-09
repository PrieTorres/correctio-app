import { useId, type ChangeEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A label drawn as a button, with the focus ring of the hidden field it stands for. */
const FILE_BUTTON =
  'touch-target inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-label font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary'

interface PhotoButtonProps {
  label: string
  icon: ReactNode
  /** On a phone, opens the back camera instead of the gallery. */
  camera?: boolean
  multiple?: boolean
  /** The look of the button: the fill and the text colour. */
  className?: string
  /** The chosen photos, once per choice. */
  onPhotos: (photos: File[]) => void
}

/**
 * A real file field behind a label that looks like a button. The browser only
 * opens the camera from a tap on the field itself, so a link that leads to a
 * screen with a camera button cannot do it in one step: the field has to be
 * where the teacher taps. It is cleared after each choice, since the iPhone
 * names every photo `image.jpg`, and the same name twice would not fire the
 * next change.
 */
export function PhotoButton({ label, icon, camera = false, multiple = false, className, onPhotos }: Readonly<PhotoButtonProps>) {
  const id = useId()

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    onPhotos(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  return (
    <span>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture={camera ? 'environment' : undefined}
        multiple={multiple}
        className="peer sr-only"
        onChange={choose}
      />
      <label htmlFor={id} className={cn(FILE_BUTTON, className)}>
        {icon}
        {label}
      </label>
    </span>
  )
}
