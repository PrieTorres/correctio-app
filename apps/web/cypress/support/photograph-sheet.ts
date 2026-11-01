import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { photographCard, type PrintedCard } from '@correctio/sheet-reader/testing'

/**
 * Draws the photo of a printed answer card and saves it as a PNG, for the
 * specs that send a sheet to the API to be read (#47, #48). Run by
 * `cy.photographSheet` through `cy.exec`, in Node, because the drawing comes
 * from the reader's own test kit: the same card the reader's tests read, with
 * the real QR Code of the sheet, so the photo goes through the real reading on
 * the API instead of a stubbed answer.
 *
 * Usage: `node --import tsx cypress/support/photograph-sheet.ts <out.png> '<PrintedCard as JSON>'`
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RGBA_8_BIT = Buffer.from([8, 6, 0, 0, 0])

function chunk(type: string, data: Buffer): Buffer {
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, checksum])
}

/** A PNG of RGBA pixels, written by hand so the spec needs no image library: each row starts with filter 0. */
function encodePng({ data, width, height }: { data: Uint8ClampedArray; width: number; height: number }): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  RGBA_8_BIT.copy(header, 8)

  const rowLength = width * 4
  const rows = Buffer.alloc((rowLength + 1) * height)
  for (let y = 0; y < height; y += 1) {
    Buffer.from(data.buffer, data.byteOffset + y * rowLength, rowLength).copy(rows, y * (rowLength + 1) + 1)
  }

  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

const [outPath, cardJson] = process.argv.slice(2)
if (outPath === undefined || cardJson === undefined) throw new Error('Uso: photograph-sheet.ts <saída.png> <cartão em JSON>')

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, encodePng(photographCard(JSON.parse(cardJson) as PrintedCard)))
