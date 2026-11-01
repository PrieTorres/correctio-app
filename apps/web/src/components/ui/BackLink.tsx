import { ArrowLeft } from 'lucide-react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * The way back to the screen above, at the top of a screen, named after where
 * it leads ("← Turmas").
 *
 * It was a strip of text 20 px tall, the hardest target on the screen to hit
 * with a finger, copied with the same classes into twelve screens (#145). It
 * now has the 44 px height of every other control, set once here.
 */
export function BackLink({ className, children, ...rest }: Readonly<LinkProps>) {
  return (
    <Link className={cn('link-target w-fit gap-2 text-label text-ink-muted hover:text-primary', className)} {...rest}>
      <ArrowLeft size={16} aria-hidden />
      {children}
    </Link>
  )
}
