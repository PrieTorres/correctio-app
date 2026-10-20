import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import { clearAllCollections } from '@/lib/storage/collection'
import type { Student } from '@/types/domain'
import type { ApiClient, HttpMethod, RequestOptions } from '../http/api-client'
import { createHttpStudentRepository, createLocalStudentRepository, STUDENTS_PER_PAGE } from '../student-repository'

describe('student repository', () => {
  beforeEach(clearAllCollections)

  const ana = { fullName: 'Ana Beatriz', registration: '2026001' }

  it('rejects a duplicate registration within the same class', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', ana)

    await expect(repository.add('c1', { ...ana, fullName: 'Outra Ana' })).rejects.toThrow(/já existe/i)
  })

  it('allows the same registration in a different class', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', ana)

    await expect(repository.add('c2', ana)).resolves.toBeDefined()
  })

  it('skips rows whose registration already exists when importing', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', { fullName: 'Ana', registration: '1' })

    const result = await repository.importMany('c1', [
      { fullName: 'Ana again', registration: '1' },
      { fullName: 'Bruno', registration: '2' },
      { fullName: 'Carla', registration: '3' },
    ])

    expect(result).toEqual({ created: 2, skipped: 1 })
    expect(await repository.listByClass('c1')).toHaveLength(3)
  })

  it('erases personal data but keeps the record when anonymizing', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', { ...ana, email: 'ana@example.br' })

    await repository.anonymize('c1', student.id)

    const [anonymized] = await repository.listByClass('c1')
    expect(anonymized?.fullName).not.toContain('Ana Beatriz')
    expect(anonymized?.email).toBeUndefined()
    expect(anonymized?.anonymizedAt).toBeDefined()
  })

  it('removes a student from the class without anonymizing', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', ana)

    await repository.remove('c1', student.id)

    expect(await repository.listByClass('c1')).toHaveLength(0)
  })

  /** The API reaches a student only through its class; the local version keeps the same rule. */
  it('leaves a student alone when the class named is another one', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', ana)

    await repository.remove('c2', student.id)
    await expect(repository.anonymize('c2', student.id)).rejects.toMatchObject({ code: 'not-found' })

    expect(await repository.listByClass('c1')).toEqual([student])
  })
})

const STUDENT: Student = { id: 's1', classId: 'c1', fullName: 'Ana Beatriz', registration: '2026001' }

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function httpRepository(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { repository: createHttpStudentRepository({ request }), request }
}

function studentsNamed(count: number, from = 0): Student[] {
  return Array.from({ length: count }, (_, index) => ({ ...STUDENT, id: `s${from + index}`, registration: String(from + index) }))
}

describe('HTTP student repository', () => {
  it('reads the class in one request when it fits a page', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve({ items: [STUDENT], total: 1 }))

    await expect(repository.listByClass('c1')).resolves.toEqual([STUDENT])
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('GET', '/classes/c1/students', { query: { page: 1, pageSize: STUDENTS_PER_PAGE } })
  })

  /** A class longer than a page is read whole: a student missing here is a sheet missing from the PDF. */
  it('asks for the remaining pages when the total does not fit the first', async () => {
    const total = STUDENTS_PER_PAGE * 2 + 1
    const { repository, request } = httpRepository((_method, _path, options) => {
      const page = Number(options?.query?.page)
      const size = page === 3 ? 1 : STUDENTS_PER_PAGE
      return Promise.resolve({ items: studentsNamed(size, (page - 1) * STUDENTS_PER_PAGE), total })
    })

    const students = await repository.listByClass('c1')

    expect(students).toHaveLength(total)
    expect(request).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenLastCalledWith('GET', '/classes/c1/students', { query: { page: 3, pageSize: STUDENTS_PER_PAGE } })
  })

  it('reads an empty class without asking twice', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve({ items: [], total: 0 }))

    await expect(repository.listByClass('c1')).resolves.toEqual([])
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('refuses a student out of shape instead of dropping it silently', async () => {
    const { repository } = httpRepository(() => Promise.resolve({ items: [{ ...STUDENT, registration: '' }], total: 1 }))

    await expect(repository.listByClass('c1')).rejects.toMatchObject({ code: 'failure' })
  })

  it('escapes the ids it puts in the path', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve(undefined))

    await repository.remove('c/1', 's 1')

    expect(request).toHaveBeenCalledWith('DELETE', '/classes/c%2F1/students/s%201')
  })

  it('adds a student under the class and reads back what the API stored', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve(STUDENT))

    await expect(repository.add('c1', { fullName: 'Ana Beatriz', registration: '2026001' })).resolves.toEqual(STUDENT)
    expect(request).toHaveBeenCalledWith('POST', '/classes/c1/students', {
      body: { fullName: 'Ana Beatriz', registration: '2026001' },
    })
  })

  it('sends the import as rows and returns what came in and what was skipped', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve({ created: 2, skipped: 1 }))
    const rows = [
      { fullName: 'Ana', registration: '1' },
      { fullName: 'Bruno', registration: '2', email: 'bruno@exemplo.edu.br' },
    ]

    await expect(repository.importMany('c1', rows)).resolves.toEqual({ created: 2, skipped: 1 })
    expect(request).toHaveBeenCalledWith('POST', '/classes/c1/students/import', { body: { rows } })
  })

  it('refuses an import answer that does not count what happened', async () => {
    const { repository } = httpRepository(() => Promise.resolve({ created: 'all' }))

    await expect(repository.importMany('c1', [])).rejects.toMatchObject({ code: 'failure' })
  })

  it('removes and anonymizes through the routes of the class', async () => {
    const { repository, request } = httpRepository(() => Promise.resolve(undefined))

    await repository.remove('c1', 's1')
    await repository.anonymize('c1', 's1')

    expect(request).toHaveBeenNthCalledWith(1, 'DELETE', '/classes/c1/students/s1')
    expect(request).toHaveBeenNthCalledWith(2, 'POST', '/classes/c1/students/s1/anonymize')
  })

  it('passes on the error the API answers, for the screen to show', async () => {
    const { repository } = httpRepository(() => Promise.reject(new StorageError('A matrícula 1 já existe nesta turma.', 'conflict')))

    await expect(repository.add('c1', { fullName: 'Ana', registration: '1' })).rejects.toMatchObject({ code: 'conflict' })
  })
})
