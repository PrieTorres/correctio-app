import { beforeEach, describe, expect, it } from 'vitest'
import type { AnswerSheet, ExamVersion } from '@/types/domain'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalPrintingRepository } from '../printing-repository'

function version(id: string, applicationId: string, versionNumber: number): ExamVersion {
  return {
    id,
    applicationId,
    versionNumber,
    shuffleQuestions: true,
    shuffleAlternatives: true,
    withStudentIdentification: true,
    layout: { questionOrder: ['q1'], alternativeOrder: [] },
    answerKeyPublished: false,
    publicCode: `PUB${id.toUpperCase()}`,
    qrCodePayload: `PUB${id.toUpperCase()}`,
  }
}

/** The stored schema demands the 26 characters `createAnswerSheetCode` emits. */
function sheetCode(id: string): string {
  return id.toUpperCase().padEnd(26, 'A')
}

function sheet(id: string, applicationId: string, examVersionId: string, n: number): AnswerSheet {
  return { id, applicationId, examVersionId, sheetNumber: n, code: sheetCode(id), answerCardVersion: 1 }
}

describe('printing repository', () => {
  beforeEach(clearAllCollections)

  it('lists the versions of one application, in printed order', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('b', 'app-1', 2), version('a', 'app-1', 1)], [])

    expect((await repository.listVersions('app-1')).map((item) => item.versionNumber)).toEqual([1, 2])
  })

  it('keeps one application printing away from another', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('a', 'app-1', 1)], [])
    await repository.replaceForApplication('app-2', [version('b', 'app-2', 1)], [])

    expect(await repository.listVersions('app-1')).toHaveLength(1)
    expect(await repository.listVersions('app-2')).toHaveLength(1)
  })

  it('replaces what an application had printed, rather than adding beside it', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('a', 'app-1', 1)], [sheet('s1', 'app-1', 'a', 1)])

    await repository.replaceForApplication('app-1', [version('b', 'app-1', 1)], [sheet('s2', 'app-1', 'b', 1)])

    expect((await repository.listVersions('app-1')).map((item) => item.id)).toEqual(['b'])
    expect((await repository.listSheets('app-1')).map((item) => item.id)).toEqual(['s2'])
  })

  it('leaves another application printing alone while replacing one', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('a', 'app-1', 1)], [])
    await repository.replaceForApplication('app-2', [version('b', 'app-2', 1)], [])

    await repository.replaceForApplication('app-1', [version('c', 'app-1', 1)], [])

    expect((await repository.listVersions('app-2')).map((item) => item.id)).toEqual(['b'])
  })

  it('finds a sheet by its own code, which the public lookup resolves', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('a', 'app-1', 1)], [sheet('s1', 'app-1', 'a', 1)])

    expect((await repository.findSheetByCode(sheetCode('s1')))?.id).toBe('s1')
    expect(await repository.findSheetByCode('nope')).toBeNull()
  })

  it('publishes and unpublishes an answer key, stamping when it happened', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-1', [version('a', 'app-1', 1)], [])

    await repository.publishAnswerKey('app-1', 'a', true)
    const published = (await repository.listVersions('app-1'))[0]
    expect(published?.answerKeyPublished).toBe(true)
    expect(published?.answerKeyPublishedAt).toBeDefined()

    await repository.publishAnswerKey('app-1', 'a', false)
    const withdrawn = (await repository.listVersions('app-1'))[0]
    expect(withdrawn?.answerKeyPublished).toBe(false)
    expect(withdrawn?.answerKeyPublishedAt).toBeUndefined()
  })

  it('says so when asked to publish a version that is not there, or that belongs to another application', async () => {
    const repository = createLocalPrintingRepository()
    await repository.replaceForApplication('app-2', [version('b', 'app-2', 1)], [])

    await expect(repository.publishAnswerKey('app-1', 'nope', true)).rejects.toThrow(/não encontrada/i)
    await expect(repository.publishAnswerKey('app-1', 'b', true)).rejects.toThrow(/não encontrada/i)
  })

  it('publishes every answer key of one application at once, keeping when each was first published', async () => {
    const repository = createLocalPrintingRepository()
    const earlier = { ...version('a', 'app-1', 1), answerKeyPublished: true, answerKeyPublishedAt: '2026-10-01T12:00:00.000Z' }
    await repository.replaceForApplication('app-1', [earlier, version('b', 'app-1', 2)], [])
    await repository.replaceForApplication('app-2', [version('c', 'app-2', 1)], [])

    await repository.publishAll('app-1')

    const [first, second] = await repository.listVersions('app-1')
    expect(first?.answerKeyPublishedAt).toBe('2026-10-01T12:00:00.000Z')
    expect([first?.answerKeyPublished, second?.answerKeyPublished]).toEqual([true, true])
    expect(second?.answerKeyPublishedAt).toBeDefined()
    expect((await repository.listVersions('app-2'))[0]?.answerKeyPublished).toBe(false)
  })

  it('keeps the moment of the first publication when one key is published again', async () => {
    const repository = createLocalPrintingRepository()
    const earlier = { ...version('a', 'app-1', 1), answerKeyPublished: true, answerKeyPublishedAt: '2026-10-01T12:00:00.000Z' }
    await repository.replaceForApplication('app-1', [earlier], [])

    await repository.publishAnswerKey('app-1', 'a', true)

    expect((await repository.listVersions('app-1'))[0]?.answerKeyPublishedAt).toBe('2026-10-01T12:00:00.000Z')
  })
})
