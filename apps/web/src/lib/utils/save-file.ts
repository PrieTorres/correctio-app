/**
 * How long the browser keeps the file around after the click. Releasing it at
 * once can cancel the download in some browsers, and keeping it for as long as
 * the tab is open would hold a whole PDF in memory.
 */
export const SAVED_FILE_LIFETIME_MS = 40_000

/**
 * Hands a file to the browser to save, as a link with `download` does. The
 * file comes from the API with the teacher's token, so a plain link to its
 * address would arrive without the session.
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), SAVED_FILE_LIFETIME_MS)
}
