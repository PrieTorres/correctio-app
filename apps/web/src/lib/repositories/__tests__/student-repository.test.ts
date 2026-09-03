import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStudentRepository } from '../student-repository'
import { clearAllCollections } from '@/lib/storage/collection'

describe('student repository', () => {
  beforeEach(clearAllCollections)

  const ana = { name: 'Ana Beatriz', registration: '2026001', email: null }

  it('rejects a duplicate registration within the same class', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', ana)

    await expect(repository.add('c1', { ...ana, name: 'Outra Ana' })).rejects.toThrow(/já existe/i)
  })

  it('allows the same registration in a different class', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', ana)

    await expect(repository.add('c2', ana)).resolves.toBeDefined()
  })

  it('skips rows whose registration already exists when importing', async () => {
    const repository = createLocalStudentRepository()
    await repository.add('c1', { name: 'Ana', registration: '1', email: null })

    const result = await repository.importMany('c1', [
      { name: 'Ana again', registration: '1', email: null },
      { name: 'Bruno', registration: '2', email: null },
      { name: 'Carla', registration: '3', email: null },
    ])

    expect(result).toEqual({ created: 2, skipped: 1 })
    expect(await repository.listByClass('c1')).toHaveLength(3)
  })

  it('erases personal data but keeps the record when anonymizing', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', { ...ana, email: 'ana@example.br' })

    await repository.anonymize(student.id)

    const [anonymized] = await repository.listByClass('c1')
    expect(anonymized?.name).not.toContain('Ana Beatriz')
    expect(anonymized?.email).toBeNull()
    expect(anonymized?.anonymizedAt).not.toBeNull()
  })

  it('removes a student from the class without anonymizing', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', ana)

    await repository.remove(student.id)

    expect(await repository.listByClass('c1')).toHaveLength(0)
  })
})
