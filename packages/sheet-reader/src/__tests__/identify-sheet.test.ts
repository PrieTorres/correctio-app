import { beforeAll, describe, expect, it } from 'vitest'
import { identifySheet } from '../identify-sheet'
import { decodeQrTexts, useQrDecoderBinary } from '../qr-decoder'
import { localDecoderBinary, photographSheet } from './synthetic-photo'

const SHEETS = [
  { id: 'sheet-1', code: 'ABCDEFGHJKLMNPQRSTUVWXYZ27' },
  { id: 'sheet-2', code: 'QWERTYUPASDFGHJKLZXCVBNM34' },
] as const
const OTHER_APPLICATION = 'MNBVCXZLKJHGFDSAPUYTREWQ56'
const lookup = (code: string) => `https://correctio-app.web.app/r/${code}`

beforeAll(() => {
  useQrDecoderBinary(localDecoderBinary())
})

describe('decodeQrTexts', () => {
  it('reads what the QR Code of the sheet holds', async () => {
    expect(await decodeQrTexts(photographSheet(lookup(SHEETS[0].code)))).toEqual([lookup(SHEETS[0].code)])
  })

  it('finds nothing on blank paper', async () => {
    expect(await decodeQrTexts(photographSheet(null))).toEqual([])
  })
})

describe('identifySheet', () => {
  it('identifies the sheet of this application by the code in its QR Code', async () => {
    expect(await identifySheet(photographSheet(lookup(SHEETS[1].code)), SHEETS)).toBe(SHEETS[1])
  })

  it('also reads a QR Code that holds the bare code', async () => {
    expect(await identifySheet(photographSheet(SHEETS[0].code), SHEETS)).toBe(SHEETS[0])
  })

  /** A sheet of another application, or of a PDF regenerated since (RF24), is a QR not recognized. */
  it('does not recognize the code of a sheet that is not in this application', async () => {
    expect(await identifySheet(photographSheet(lookup(OTHER_APPLICATION)), SHEETS)).toBeNull()
  })

  it('does not recognize a QR Code that holds anything else', async () => {
    expect(await identifySheet(photographSheet('https://correctio-app.web.app/turmas'), SHEETS)).toBeNull()
  })

  it('does not recognize a photo without a QR Code', async () => {
    expect(await identifySheet(photographSheet(null), SHEETS)).toBeNull()
  })

  /** Feature 8.7 of the Spec: tolerant to light, rotation and perspective. */
  it.each([
    ['turned on the table', { angle: 23 }],
    ['upside down', { angle: 180 }],
    ['photographed at a slant', { tilt: 0.6, angle: 8 }],
    ['with heavy sensor noise', { noise: 35 }],
    ['under a lamp to one side', { shade: 0.65 }],
    ['out of focus', { blur: 2 }],
    ['all of it at once, from further away', { angle: 12, tilt: 0.4, noise: 25, shade: 0.5, blur: 1, modulePx: 4 }],
  ])('identifies a sheet %s', async (_case, shot) => {
    expect(await identifySheet(photographSheet(lookup(SHEETS[0].code), shot), SHEETS)).toBe(SHEETS[0])
  })
})
