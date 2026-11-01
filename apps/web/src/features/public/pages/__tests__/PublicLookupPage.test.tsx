import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import { renderWithProviders } from '@/test-utils'
import { PublicLookupPage } from '../PublicLookupPage'

function renderPage(findByCode: () => Promise<never>) {
  return renderWithProviders(
    <Routes>
      <Route path="/r/:code" element={<PublicLookupPage />} />
    </Routes>,
    { path: '/r/ABC', services: { publicLookup: { findByCode } } },
  )
}

describe('PublicLookupPage', () => {
  /** The generic message asks for a reload, which spends more of the limit that ran out. */
  it('asks to wait after a 429, and does not ask to reload', async () => {
    renderPage(vi.fn().mockRejectedValue(new StorageError('x', 'rate-limited')))

    expect(await screen.findByText(/Aguarde um minuto/)).toBeVisible()
    expect(screen.queryByText(/Recarregue a página/)).toBeNull()
  })

  it('keeps the generic message for any other failure', async () => {
    renderPage(vi.fn().mockRejectedValue(new StorageError('x', 'failure')))

    expect(await screen.findByText(/Recarregue a página/)).toBeVisible()
  })
})
