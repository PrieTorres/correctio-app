import { randomBytes, randomUUID } from 'node:crypto'
import { classInputSchema, type Class, type ClassInput } from '@correctio/domain'
import { isDuplicateEntry } from '../db/errors'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { mergePatch } from '../lib/merge-patch'
import { parsePageRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ClassRepository } from '../repositories/class-repository'

/** The fields of the class form; the rest of a `Class` is decided by the server. */
const CLASS_FIELDS = ['name', 'subject', 'term'] as const satisfies readonly (keyof ClassInput)[]

const NOT_FOUND = 'Turma não encontrada.'

/** The same messages the web app shows today (`requireUnique` in `create-owned-repository.ts`). */
const DUPLICATE = 'Já existe uma turma com estes dados.'
const DUPLICATE_ARCHIVED = 'Já existe uma turma arquivada com estes dados. Restaure em vez de criar outra.'

/**
 * The alphabet and length of `createInviteCode` in the web app, so a code looks
 * the same whichever side created it. 256 is a multiple of 32, so taking each
 * random byte modulo 32 adds no bias toward any letter.
 */
const INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const INVITE_CODE_LENGTH = 8

/** The name of the unique index MySQL gives the `inviteCode` column. */
const INVITE_CODE_INDEX = 'inviteCode'

/**
 * A code drawn again after clashing with a stored one. Three clashes in a row
 * among 2^40 codes would mean a broken generator rather than bad luck, so the
 * error then reaches the log instead of looping.
 */
const INVITE_CODE_ATTEMPTS = 3

export interface ClassService {
  list: (teacherId: string, query: unknown) => Promise<Page<Class>>
  get: (teacherId: string, id: string) => Promise<Class>
  create: (teacherId: string, body: unknown) => Promise<Class>
  update: (teacherId: string, id: string, body: unknown) => Promise<Class>
  archive: (teacherId: string, id: string) => Promise<void>
  restore: (teacherId: string, id: string) => Promise<void>
}

export interface ClassServiceDependencies {
  repository: ClassRepository
  /** Injected so a test can make two classes draw the same code; the app uses `createInviteCode`. */
  newInviteCode?: () => string
}

/**
 * Fills the `Class.inviteCode` the specification requires and the table keeps
 * unique. It is random rather than derived from the class, and nothing reads it
 * in this scope: it is the seam a student area would use to join a class.
 */
function createInviteCode(): string {
  return Array.from(randomBytes(INVITE_CODE_LENGTH), (byte) => INVITE_CODE_ALPHABET.charAt(byte % INVITE_CODE_ALPHABET.length)).join('')
}

function pickForm(entity: Class): Pick<Class, (typeof CLASS_FIELDS)[number]> {
  return { name: entity.name, subject: entity.subject, term: entity.term }
}

/**
 * The rules of RF06 on the server: the owner comes from the token, `status`
 * starts `active` and only archive and restore change it, and a class is
 * archived, never deleted (RF42).
 */
export function createClassService({ repository, newInviteCode = createInviteCode }: ClassServiceDependencies): ClassService {
  async function requireClass(teacherId: string, id: string): Promise<Class> {
    const entity = await repository.findById(teacherId, id)
    if (entity === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
    return entity
  }

  /**
   * The same name in the same term is the same class typed twice, compared
   * without accents, case or the spaces around. An archived class counts: the
   * name is not free, and the message points at the restore instead.
   */
  async function requireUnique(teacherId: string, identity: ClassInput, exceptId?: string): Promise<void> {
    const clash = await repository.findClash(teacherId, identity, exceptId)
    if (clash === undefined) return
    throw new ApiError(API_ERROR_CODE.CONFLICT, clash.status === 'archived' ? DUPLICATE_ARCHIVED : DUPLICATE)
  }

  async function insertWithInviteCode(fields: Omit<Class, 'inviteCode'>): Promise<Class> {
    for (let attempt = 1; ; attempt += 1) {
      const entity: Class = { ...fields, inviteCode: newInviteCode() }
      try {
        await repository.insert(entity)
        return entity
      } catch (error) {
        if (attempt >= INVITE_CODE_ATTEMPTS || !isDuplicateEntry(error, INVITE_CODE_INDEX)) throw error
      }
    }
  }

  return {
    list: (teacherId, query) => repository.list(teacherId, parsePageRequest(query)),

    get: requireClass,

    async create(teacherId, body) {
      const input = parseRequest(classInputSchema, body)
      await requireUnique(teacherId, input)
      return insertWithInviteCode({ id: randomUUID(), teacherId, ...input, status: 'active' })
    },

    async update(teacherId, id, body) {
      const current = await requireClass(teacherId, id)
      const { merged, sent } = mergePatch(pickForm(current), body, CLASS_FIELDS)
      const input = parseRequest(classInputSchema, merged)
      await requireUnique(teacherId, input, id)

      const changes: Partial<ClassInput> = {}
      for (const field of sent) changes[field] = input[field]
      await repository.update(teacherId, id, changes)
      return { ...current, ...input }
    },

    async archive(teacherId, id) {
      await requireClass(teacherId, id)
      await repository.setStatus(teacherId, id, 'archived')
    },

    async restore(teacherId, id) {
      await requireClass(teacherId, id)
      await repository.setStatus(teacherId, id, 'active')
    },
  }
}
