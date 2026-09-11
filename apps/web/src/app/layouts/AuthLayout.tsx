import type { ReactNode } from 'react'
import { Card } from '@/components/ui'

/** Shell for the screens reached before there is a session: sign in, sign up, password reset. */
export function AuthLayout({
  title,
  description,
  children,
}: Readonly<{
  title: string
  description?: string
  children: ReactNode
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-8 text-center font-[family-name:var(--font-heading)] text-headline text-primary">
          Correctio
        </p>
        <Card className="p-8">
          <h1 className="text-title text-primary">{title}</h1>
          {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  )
}
