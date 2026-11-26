import { describe, expect, it } from 'vitest'
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  matchTotp,
  totpCodeForStep,
  totpStepAt,
  totpUri,
  TOTP_STEP_SECONDS,
} from '../totp'

const RFC_6238_SECRET = base32Encode(Buffer.from('12345678901234567890'))

/** The SHA-1 rows of RFC 6238, Appendix B, whose 8-digit values end in the 6 digits this app uses. */
const RFC_6238_VECTORS: ReadonlyArray<readonly [seconds: number, code: string]> = [
  [59, '287082'],
  [1_111_111_109, '081804'],
  [1_111_111_111, '050471'],
  [1_234_567_890, '005924'],
  [2_000_000_000, '279037'],
  [20_000_000_000, '353130'],
]

describe('base32', () => {
  it('encodes the RFC 4648 test vectors without padding', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
    expect(base32Encode(Buffer.from('fooba'))).toBe('MZXW6YTB')
    expect(base32Encode(Buffer.from('f'))).toBe('MY')
  })

  it('round-trips a random secret', () => {
    const secret = generateTotpSecret()
    expect(base32Encode(base32Decode(secret))).toBe(secret)
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
  })

  it('refuses a character outside the alphabet', () => {
    expect(() => base32Decode('MZXW1')).toThrow()
  })
})

describe('totpCodeForStep', () => {
  it.each(RFC_6238_VECTORS)('matches RFC 6238 at %i seconds', (seconds, code) => {
    expect(totpCodeForStep(RFC_6238_SECRET, totpStepAt(seconds * 1000))).toBe(code)
  })
})

describe('matchTotp', () => {
  const now = 1_111_111_111_000
  const step = totpStepAt(now)

  it('answers the step of a code from the current step', () => {
    expect(matchTotp(RFC_6238_SECRET, totpCodeForStep(RFC_6238_SECRET, step), now)).toBe(step)
  })

  it('accepts the step before and the step after, and nothing farther', () => {
    expect(matchTotp(RFC_6238_SECRET, totpCodeForStep(RFC_6238_SECRET, step - 1), now)).toBe(step - 1)
    expect(matchTotp(RFC_6238_SECRET, totpCodeForStep(RFC_6238_SECRET, step + 1), now)).toBe(step + 1)
    expect(matchTotp(RFC_6238_SECRET, totpCodeForStep(RFC_6238_SECRET, step - 2), now)).toBeNull()
    expect(matchTotp(RFC_6238_SECRET, totpCodeForStep(RFC_6238_SECRET, step + 2), now)).toBeNull()
  })

  it('refuses anything that is not six digits', () => {
    const code = totpCodeForStep(RFC_6238_SECRET, step)
    expect(matchTotp(RFC_6238_SECRET, ` ${code}`, now)).toBeNull()
    expect(matchTotp(RFC_6238_SECRET, `${code}0`, now)).toBeNull()
    expect(matchTotp(RFC_6238_SECRET, '', now)).toBeNull()
    expect(matchTotp(RFC_6238_SECRET, 'abcdef', now)).toBeNull()
  })

  it('refuses the code of another secret', () => {
    expect(matchTotp(generateTotpSecret(), totpCodeForStep(RFC_6238_SECRET, step), now)).toBeNull()
  })
})

describe('totpStepAt', () => {
  it('changes every 30 seconds', () => {
    expect(totpStepAt(0)).toBe(0)
    expect(totpStepAt(TOTP_STEP_SECONDS * 1000 - 1)).toBe(0)
    expect(totpStepAt(TOTP_STEP_SECONDS * 1000)).toBe(1)
  })
})

describe('totpUri', () => {
  it('builds the otpauth address with the issuer and the encoded account', () => {
    const uri = new URL(totpUri('JBSWY3DPEHPK3PXP', 'ana+prova@exemplo.edu.br'))
    expect(uri.protocol).toBe('otpauth:')
    expect(uri.hostname).toBe('totp')
    expect(decodeURIComponent(uri.pathname)).toBe('/Correctio:ana+prova@exemplo.edu.br')
    expect(uri.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP')
    expect(uri.searchParams.get('issuer')).toBe('Correctio')
  })
})
