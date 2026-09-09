import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { Providers } from '@/app/providers'
import { seedIfEmpty } from '@/lib/seed'
import './styles/index.css'

seedIfEmpty()

const container = document.getElementById('root')
if (container === null) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
