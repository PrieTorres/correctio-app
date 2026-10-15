import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { Providers } from '@/app/providers'
import { DEMO_MODE } from '@/lib/app-mode'
import './styles/index.css'

function render(): void {
  const container = document.getElementById('root')
  if (container === null) throw new Error('Root element not found')

  createRoot(container).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
}

/**
 * The sample data of the Pages demo loads before the first render. Imported on
 * demand, so the Firebase bundle, where `DEMO_MODE` is false, leaves it out.
 */
if (DEMO_MODE) {
  const { seedIfEmpty } = await import('@/lib/seed')
  seedIfEmpty()
}

render()
