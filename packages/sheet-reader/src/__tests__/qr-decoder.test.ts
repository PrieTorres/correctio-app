import { beforeEach, describe, expect, it, vi } from 'vitest'

const prepareZXingModule = vi.fn()
vi.mock('zxing-wasm/reader', () => ({ prepareZXingModule, readBarcodes: vi.fn() }))

const { useQrDecoderBinary } = await import('../qr-decoder')

describe('useQrDecoderBinary', () => {
  beforeEach(() => prepareZXingModule.mockClear())

  it('hands the bytes to the decoder in Node', () => {
    const wasmBinary = new ArrayBuffer(8)
    useQrDecoderBinary({ wasmBinary })

    expect(prepareZXingModule).toHaveBeenCalledWith({ overrides: { wasmBinary } })
  })

  /** In the browser, the file Vite bundled: the public CDN the library defaults to is never reached. */
  it('points the decoder at the bundled file in the browser', () => {
    useQrDecoderBinary({ wasmUrl: '/assets/zxing_reader-abc123.wasm' })

    const { overrides } = prepareZXingModule.mock.calls[0]?.[0] as { overrides: { locateFile: () => string } }
    expect(overrides.locateFile()).toBe('/assets/zxing_reader-abc123.wasm')
  })
})
