import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createPhotoCleaner } from '../clean-photo'
import { SHEET_PHOTO_TYPES } from '../image-type'

/** EXIF orientation 6: the phone stored the pixels sideways and asks the viewer to turn them a quarter clockwise. */
const TURN_A_QUARTER_CLOCKWISE = 6
const STORED_WIDTH = 40
const STORED_HEIGHT = 20

/** A JPEG as a phone writes it: sideways pixels, the orientation to fix them, and where and with what it was taken. */
function phonePhoto(): Promise<Buffer> {
  return sharp({ create: { width: STORED_WIDTH, height: STORED_HEIGHT, channels: 3, background: '#ffffff' } })
    .withMetadata({ orientation: TURN_A_QUARTER_CLOCKWISE })
    .withExifMerge({
      IFD0: { Make: 'Apple', Model: 'iPhone 13' },
      IFD2: { DateTimeOriginal: '2026:11:26 10:15:00' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '26/1 29/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '49/1 4/1 0/1' },
    })
    .jpeg()
    .toBuffer()
}

describe('createPhotoCleaner', () => {
  /** RNF16: a phone photo carries the GPS position, the date and the phone model. */
  it('stores no EXIF and turns the photo upright', async () => {
    const original = await phonePhoto()
    expect((await sharp(original).metadata()).exif).toBeDefined()

    const cleaned = await createPhotoCleaner()(original, SHEET_PHOTO_TYPES.JPEG)

    const metadata = await sharp(cleaned ?? Buffer.alloc(0)).metadata()
    expect(metadata.exif).toBeUndefined()
    expect(metadata.orientation).toBeUndefined()
    expect(metadata).toMatchObject({ format: 'jpeg', width: STORED_HEIGHT, height: STORED_WIDTH })
  })

  /** The stored file keeps the extension it was named with (`EXTENSION_OF`). */
  it('keeps the format the photo came in', async () => {
    const blank = sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } })
    const clean = createPhotoCleaner()

    const png = await clean(await blank.clone().png().toBuffer(), SHEET_PHOTO_TYPES.PNG)
    const webp = await clean(await blank.clone().webp().toBuffer(), SHEET_PHOTO_TYPES.WEBP)

    expect((await sharp(png ?? Buffer.alloc(0)).metadata()).format).toBe('png')
    expect((await sharp(webp ?? Buffer.alloc(0)).metadata()).format).toBe('webp')
  })

  /** The first bytes say JPEG, but nothing after them decodes: there is no photo to store or read. */
  it('answers null for a file that does not decode', async () => {
    const broken = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

    await expect(createPhotoCleaner()(broken, SHEET_PHOTO_TYPES.JPEG)).resolves.toBeNull()
  })

  /** Decoding a 12 MP photo takes 90 to 140 MB, so photos sent together are decoded one after another. */
  it('cleans one photo at a time, in the order they arrive, and goes on after a failure', async () => {
    let held = 0
    const heldWhileCleaning: number[] = []
    const encode = async (photo: Buffer) => {
      held += 1
      heldWhileCleaning.push(held)
      await new Promise((resolve) => setTimeout(resolve, 5))
      held -= 1
      if (photo[0] === 0) throw new Error('does not decode')
      return photo
    }
    const clean = createPhotoCleaner(encode)

    const results = await Promise.all([1, 0, 3].map((byte) => clean(Buffer.of(byte), SHEET_PHOTO_TYPES.PNG)))

    expect(heldWhileCleaning).toEqual([1, 1, 1])
    expect(results).toEqual([Buffer.of(1), null, Buffer.of(3)])
  })
})
