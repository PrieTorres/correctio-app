import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStudentRepository } from '../student-repository'
import { clearAllCollections } from '@/lib/storage/collection'

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

    await repository.anonymize(student.id)

    const [anonymized] = await repository.listByClass('c1')
    expect(anonymized?.fullName).not.toContain('Ana Beatriz')
    expect(anonymized?.email).toBeUndefined()
    expect(anonymized?.anonymizedAt).toBeDefined()
  })

  it('removes a student from the class without anonymizing', async () => {
    const repository = createLocalStudentRepository()
    const student = await repository.add('c1', ana)

    await repository.remove(student.id)

    expect(await repository.listByClass('c1')).toHaveLength(0)
  })
})
