import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classSchema,
  examSchema,
  questionSchema,
  recentActivitySchema,
  studentSchema,
} from '@/lib/schemas'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { clearDemoData, hasDemoData, resetDemoData, seedIfEmpty } from '../index'

const classes = () => createCollection('classes', classSchema).readAll()
const students = () => createCollection('students', studentSchema).readAll()
const questions = () => createCollection('questions', questionSchema).readAll()
const exams = () => createCollection('exams', examSchema).readAll()
const activity = () => createCollection('activity', recentActivitySchema).readAll()

describe('demo data', () => {
  beforeEach(() => window.localStorage.clear())

  it('seeds classes and students on a first visit', () => {
    seedIfEmpty()

    expect(classes().length).toBeGreaterThan(0)
    expect(students().length).toBeGreaterThan(0)
  })

  it('seeds enough recent activity for the dashboard list, no more than it shows', () => {
    seedIfEmpty()

    expect(activity().length).toBeGreaterThanOrEqual(5)
  })

  it('seeds both question types, since an exam may mix them', () => {
    seedIfEmpty()

    expect(questions().some((item) => item.type === 'objetiva')).toBe(true)
    expect(questions().some((item) => item.type === 'discursiva')).toBe(true)
  })

  it('seeds a question with shuffling switched off, which the list has to flag', () => {
    seedIfEmpty()

    expect(
      questions().some((item) => item.type === 'objetiva' && !item.allowShuffleAlternatives),
    ).toBe(true)
  })

  it('points every multiple-choice question at one of its own alternatives', () => {
    seedIfEmpty()

    for (const question of questions()) {
      if (question.type !== 'objetiva') continue
      const ids = (question.alternatives ?? []).map((alternative) => alternative.id)
      expect(ids).toContain(question.correctAlternativeId)
    }
  })

  it('seeds exams, including an archived one for the filter to show', () => {
    seedIfEmpty()

    expect(exams().length).toBeGreaterThan(0)
    expect(exams().some((item) => item.status === 'closed')).toBe(true)
  })

  it('builds every exam out of questions that are really in the bank', () => {
    seedIfEmpty()

    const bank = new Set(questions().map((item) => item.id))
    for (const exam of exams()) {
      for (const entry of exam.questions) {
        expect(bank).toContain(entry.questionId)
      }
    }
  })

  it('numbers the questions of an exam from zero, without gaps', () => {
    seedIfEmpty()

    for (const exam of exams()) {
      expect(exam.questions.map((entry) => entry.order)).toEqual(
        exam.questions.map((_, index) => index),
      )
    }
  })

  it('includes an archived class, so the filter and restore have something to show', () => {
    seedIfEmpty()

    expect(classes().some((item) => item.status === 'archived')).toBe(true)
  })

  it('gives every class a distinct invite code, as the specification requires', () => {
    seedIfEmpty()

    const codes = classes().map((item) => item.inviteCode)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('does not seed twice on a second visit', () => {
    seedIfEmpty()
    const collection = createCollection('classes', classSchema)
    collection.writeAll(collection.readAll().slice(0, 1))

    seedIfEmpty()

    expect(classes()).toHaveLength(1)
  })

  it('leaves the app standing when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => seedIfEmpty()).not.toThrow()
  })
})

describe('clearDemoData', () => {
  beforeEach(() => window.localStorage.clear())

  it('empties every collection', () => {
    seedIfEmpty()

    clearDemoData()

    expect(classes()).toHaveLength(0)
    expect(students()).toHaveLength(0)
    expect(questions()).toHaveLength(0)
    expect(exams()).toHaveLength(0)
    expect(activity()).toHaveLength(0)
  })

  it('keeps the next visit from silently seeding again', () => {
    seedIfEmpty()
    clearDemoData()

    seedIfEmpty()

    expect(classes()).toHaveLength(0)
  })
})

describe('resetDemoData', () => {
  beforeEach(() => window.localStorage.clear())

  it('brings the demo back after it was cleared', () => {
    seedIfEmpty()
    clearDemoData()

    resetDemoData()

    expect(classes().length).toBeGreaterThan(0)
  })

  it('discards records created on top of the demo', () => {
    seedIfEmpty()
    const collection = createCollection('classes', classSchema)
    collection.writeAll([
      ...collection.readAll(),
      {
        id: 'extra',
        teacherId: 'teacher-demo',
        name: 'Turma criada à mão',
        subject: 'Química',
        term: '2026/2',
        status: 'active',
        inviteCode: 'MANUAL01',
      },
    ])

    resetDemoData()

    expect(classes().some((item) => item.id === 'extra')).toBe(false)
  })
})

describe('hasDemoData', () => {
  beforeEach(() => window.localStorage.clear())

  it('is false before anything is seeded', () => {
    expect(hasDemoData()).toBe(false)
  })

  it('is true once the demo is loaded', () => {
    seedIfEmpty()

    expect(hasDemoData()).toBe(true)
  })

  it('is false again after clearing', () => {
    seedIfEmpty()
    clearDemoData()

    expect(hasDemoData()).toBe(false)
  })

  it('reports false instead of throwing when storage is unreadable', () => {
    clearAllCollections()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(hasDemoData()).toBe(false)
  })
})
