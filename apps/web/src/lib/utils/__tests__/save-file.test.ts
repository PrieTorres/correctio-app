import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVED_FILE_LIFETIME_MS, saveFile } from '../save-file'

describe('saveFile', () => {
  const createObjectURL = vi.fn(() => 'blob:prova')
  const revokeObjectURL = vi.fn()

  /** jsdom has no object URLs, so the test supplies the two the browser would. */
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    revokeObjectURL.mockClear()
  })

  it('clicks a link that saves the file under its name, and leaves nothing on the page', () => {
    const clicked: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download })
    })

    saveFile(new Blob(['%PDF-1.7']), 'prova-2026-10-05.pdf')

    expect(clicked).toEqual([{ href: 'blob:prova', download: 'prova-2026-10-05.pdf' }])
    expect(document.querySelector('a')).toBeNull()
  })

  it('releases the file only after the browser had time to save it', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    saveFile(new Blob(['%PDF-1.7']), 'prova.pdf')

    vi.advanceTimersByTime(SAVED_FILE_LIFETIME_MS - 1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:prova')
  })
})
