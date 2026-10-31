import { describe, expect, it } from 'vitest'
import { sheetPhotoTypeOf } from '../image-type'

const bytes = (...values: number[]) => Uint8Array.from(values)
const text = (value: string) => Uint8Array.from([...value].map((char) => char.charCodeAt(0)))

describe('sheetPhotoTypeOf', () => {
  it('recognizes a JPEG, a PNG and a WebP by their first bytes', () => {
    expect(sheetPhotoTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('image/jpeg')
    expect(sheetPhotoTypeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('image/png')
    expect(sheetPhotoTypeOf(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp')
  })

  /** A PDF renamed to `.jpg` is still a PDF: the extension and the header the client sent are not looked at. */
  it('refuses anything else, whatever it claims to be', () => {
    expect(sheetPhotoTypeOf(text('%PDF-1.7'))).toBeUndefined()
    expect(sheetPhotoTypeOf(text('\u0000\u0000\u0000\u0018ftypheic'))).toBeUndefined()
    expect(sheetPhotoTypeOf(text('RIFF\u0000\u0000\u0000\u0000WAVE'))).toBeUndefined()
    expect(sheetPhotoTypeOf(bytes())).toBeUndefined()
  })
})
