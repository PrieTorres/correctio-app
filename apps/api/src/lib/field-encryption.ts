import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Encrypts and decrypts one database field. The student repository depends on
 * this interface, so the app, the tests and the stand-in for a missing key all
 * plug into the same place.
 */
export interface FieldCipher {
  encrypt: (plain: string) => string
  decrypt: (stored: string) => string
}

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32

/** 96 bits is the IV size GCM is designed for; any other size is hashed into one first. */
const IV_BYTES = 12
const TAG_BYTES = 16

/** Lets a later change of key or algorithm tell the values written today from its own. */
const FORMAT_VERSION = 'v1'

/** Base64url never produces a dot, so a dot can separate the parts. */
const SEPARATOR = '.'

const NOT_WRITTEN_HERE = 'Not a value this field cipher wrote'

interface StoredParts {
  iv: Buffer
  tag: Buffer
  encrypted: Buffer
}

function splitStored(stored: string): StoredParts {
  const [version, iv, tag, encrypted, ...extra] = stored.split(SEPARATOR)
  if (version !== FORMAT_VERSION || iv === undefined || tag === undefined || encrypted === undefined || extra.length > 0) {
    throw new Error(NOT_WRITTEN_HERE)
  }
  return {
    iv: Buffer.from(iv, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
    encrypted: Buffer.from(encrypted, 'base64url'),
  }
}

/**
 * AES-256-GCM with the key of `DATA_ENCRYPTION_KEY` (`docs/Seguranca_e_LGPD.md`,
 * section 7). The stored text is `v1.<iv>.<tag>.<encrypted>`, in base64url.
 *
 * A fresh random IV for every value means the same address written twice is
 * stored as two different texts, so equal e-mails cannot be spotted in the
 * table. The authentication tag makes a value altered in the database fail to
 * decrypt, instead of turning into some other address.
 */
export function createFieldCipher(base64Key: string): FieldCipher {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== KEY_BYTES) throw new Error(`The field encryption key must be ${KEY_BYTES} bytes in base64`)

  return {
    encrypt(plain) {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES })
      const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
      const parts = [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url'))
      return [FORMAT_VERSION, ...parts].join(SEPARATOR)
    },

    decrypt(stored) {
      const { iv, tag, encrypted } = splitStored(stored)
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES })
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    },
  }
}

const MISSING_KEY = 'DATA_ENCRYPTION_KEY is not set'

/**
 * Stands in until a key is configured, and refuses instead of storing an
 * e-mail in plain text. `bootstrapApi` never starts without a key, so only an
 * app built by a test that never touches students ends up with this one.
 */
export const refuseWithoutKey: FieldCipher = {
  encrypt: () => {
    throw new Error(MISSING_KEY)
  },
  decrypt: () => {
    throw new Error(MISSING_KEY)
  },
}
