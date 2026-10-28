import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  answerSheetSchema,
  applicationSchema,
  classSchema,
  examSchema,
  examVersionSchema,
  questionSchema,
  studentSchema,
} from '@/lib/schemas'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import {
  clearDemoData,
  hasDemoData,
  resetDemoData,
  sampleClasses,
  sampleExams,
  sampleQuestions,
  seedIfEmpty,
  writeDemoData,
  type RemoteRoster,
} from '../demo-data'

const classes = () => createCollection('classes', classSchema).readAll()
const students = () => createCollection('students', studentSchema).readAll()
const questions = () => createCollection('questions', questionSchema).readAll()
const exams = () => createCollection('exams', examSchema).readAll()
const applications = () => createCollection('applications', applicationSchema).readAll()
const versions = () => createCollection('exam-versions', examVersionSchema).readAll()
const sheets = () => createCollection('answer-sheets', answerSheetSchema).readAll()

describe('demo data', () => {
  beforeEach(() => window.localStorage.clear())

  it('seeds classes and students on a first visit', () => {
    seedIfEmpty()

    expect(classes().length).toBeGreaterThan(0)
    expect(students().length).toBeGreaterThan(0)
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

  it('seeds one application already generated and one still to generate', () => {
    seedIfEmpty()

    expect(applications().some((item) => item.status === 'generated')).toBe(true)
    expect(applications().some((item) => item.status === 'draft')).toBe(true)
  })

  it('points every application at an exam and a class that exist', () => {
    seedIfEmpty()

    const examIds = new Set(exams().map((item) => item.id))
    const classIds = new Set(classes().map((item) => item.id))
    for (const application of applications()) {
      expect(examIds).toContain(application.examId)
      expect(classIds).toContain(application.classId)
    }
  })

  it('gives the generated application real paper to show', () => {
    seedIfEmpty()

    expect(versions().length).toBeGreaterThan(0)
    expect(sheets().length).toBeGreaterThan(0)
  })

  it('gives every seeded sheet a code of its own', () => {
    seedIfEmpty()

    const codes = sheets().map((item) => item.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('prints one sheet per student of the applied class', () => {
    seedIfEmpty()

    const generated = applications().find((item) => item.status === 'generated')
    const enrolled = students().filter((item) => item.classId === generated?.classId)
    expect(sheets()).toHaveLength(enrolled.length)
  })

  it('points every sheet at a version that was actually printed', () => {
    seedIfEmpty()

    const printed = new Set(versions().map((item) => item.id))
    for (const sheet of sheets()) {
      expect(printed).toContain(sheet.examVersionId)
    }
  })

  it('leaves the application still to generate without any paper', () => {
    seedIfEmpty()

    const draft = applications().find((item) => item.status === 'draft')
    expect(sheets().some((item) => item.applicationId === draft?.id)).toBe(false)
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
    expect(applications()).toHaveLength(0)
    expect(versions()).toHaveLength(0)
    expect(sheets()).toHaveLength(0)
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

describe('clearing the demo', () => {
  beforeEach(() => window.localStorage.clear())

  /** The demo has a session guard now, so wiping the session along with the data would throw the visitor out. */
  it('keeps the demo teacher signed in', () => {
    seedIfEmpty()

    clearDemoData()

    expect(window.localStorage.getItem('correctio:demo-session')).not.toBeNull()
  })
})

describe('sampleClasses', () => {
  /** The API decides ids, owner, status and invite code; the suite sends only what the class form sends. */
  it('describes each sample class with the fields of the class form only', () => {
    for (const sample of sampleClasses()) {
      expect(Object.keys(sample.input).sort()).toEqual(['name', 'subject', 'term'])
      for (const student of sample.students) {
        expect(Object.keys(student).sort()).toEqual(['fullName', 'registration'])
      }
    }
  })

  it('flags the archived class, which the API creates active and then archives', () => {
    expect(sampleClasses().filter((sample) => sample.archived).map((sample) => sample.sampleId)).toEqual([
      'class-calculus-1-2025',
    ])
  })

  it('carries the students of every class that has them', () => {
    const counts = Object.fromEntries(sampleClasses().map((sample) => [sample.sampleId, sample.students.length]))

    expect(counts).toEqual({
      'class-calculus-1': 12,
      'class-linear-algebra': 8,
      'class-physics-2': 10,
      'class-calculus-1-2025': 0,
    })
  })
})

/** The roster the suite builds after creating the sample on the API, with ids the API would give. */
function rosterFromApi(): RemoteRoster {
  const samples = sampleClasses()
  const classIds = Object.fromEntries(samples.map((sample) => [sample.sampleId, `api-${sample.sampleId}`]))
  const remoteStudents = samples.flatMap((sample) =>
    sample.students.map((student) => ({ ...student, id: `api-student-${student.registration}`, classId: `api-${sample.sampleId}` })),
  )
  const questionIds = Object.fromEntries(sampleQuestions().map((sample) => [sample.sampleId, `api-${sample.sampleId}`]))
  const examIds = Object.fromEntries(sampleExams(questionIds).map((sample) => [sample.sampleId, `api-${sample.sampleId}`]))
  return { classIds, students: remoteStudents, questionIds, examIds }
}

describe('sampleQuestions', () => {
  /** The API gives the question its id; the input carries everything else, alternatives with their own ids included. */
  it('hands every sample question over in the shape the API takes, without its id or owner', () => {
    const samples = sampleQuestions()
    const limits = samples.find((sample) => sample.sampleId === 'question-limits')

    expect(samples.map((sample) => sample.sampleId)).toContain('question-essay-vectors')
    expect(samples.every((sample) => !('id' in sample.input) && !('teacherId' in sample.input))).toBe(true)
    expect(limits?.input).toMatchObject({
      type: 'objetiva',
      correctAlternativeId: 'question-limits-alt-1',
      alternatives: expect.arrayContaining([{ id: 'question-limits-alt-1', text: '1' }]),
    })
  })
})

describe('sampleExams', () => {
  const questionIds = Object.fromEntries(sampleQuestions().map((sample) => [sample.sampleId, `api-${sample.sampleId}`]))

  /** The API gives the exam its id and its owner; the questions have to point at the ids the API gave them. */
  it('hands every sample exam over in the shape the API takes, pointing at the questions on the API', () => {
    const samples = sampleExams(questionIds)
    const entries = samples.flatMap((sample) => sample.input.questions)

    expect(samples.every((sample) => !('id' in sample.input) && !('teacherId' in sample.input) && !('status' in sample.input))).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((entry) => entry.questionId.startsWith('api-question-'))).toBe(true)
  })

  /** The API creates drafts only, so the suite needs to know which ones to mark ready or archive afterwards. */
  it('says which status each exam has to reach, including a ready and an archived one', () => {
    const statuses = sampleExams(questionIds).map((sample) => sample.status)

    expect(statuses).toContain('ready')
    expect(statuses).toContain('closed')
    expect(statuses).toContain('draft')
  })

  it('stops when a question is missing from the API ids, instead of pointing at nothing', () => {
    expect(() => sampleExams({})).toThrow('question-')
  })
})

describe('writeDemoData with the classes, questions and exams on the API', () => {
  beforeEach(() => window.localStorage.clear())

  it('writes no class, student, question or exam to this browser, since they live on the API', () => {
    writeDemoData('teacher-from-the-api', rosterFromApi())

    expect(classes()).toEqual([])
    expect(students()).toEqual([])
    expect(questions()).toEqual([])
    expect(exams()).toEqual([])
    expect(applications().length).toBeGreaterThan(0)
  })

  /** A printed version pointing at a sample id would show none of its questions, since the API knows them by its own ids. */
  it('points every printed version at the ids the API gave the questions', () => {
    writeDemoData('teacher-from-the-api', rosterFromApi())

    const printedIds = versions().flatMap((version) => version.layout.questionOrder)
    expect(printedIds.length).toBeGreaterThan(0)
    expect(printedIds.every((id) => id.startsWith('api-question-'))).toBe(true)
  })

  it('points every application at the ids the API gave its class and its exam', () => {
    writeDemoData('teacher-from-the-api', rosterFromApi())

    expect(applications().map((item) => item.classId).sort()).toEqual(['api-class-calculus-1', 'api-class-physics-2'])
    expect(applications().map((item) => item.examId).sort()).toEqual(['api-exam-calculus-midterm', 'api-exam-physics-quiz'])
  })

  it('stops when a sample exam is missing from the roster, instead of pointing at nothing', () => {
    expect(() => writeDemoData('teacher-from-the-api', { ...rosterFromApi(), examIds: {} })).toThrow('exam-')
  })

  /** A sheet that names a student the API does not have would show a blank name on every grading screen. */
  it('prints one sheet per student the API holds for the applied class', () => {
    writeDemoData('teacher-from-the-api', rosterFromApi())

    const sheetStudents = sheets().map((item) => item.studentId).sort()
    const enrolled = rosterFromApi()
      .students.filter((item) => item.classId === 'api-class-calculus-1')
      .map((item) => item.id)
      .sort()
    expect(sheetStudents).toEqual(enrolled)
  })

  it('stops when a sample class is missing from the roster, instead of pointing at nothing', () => {
    const { students: remoteStudents } = rosterFromApi()

    expect(() => writeDemoData('teacher-from-the-api', { ...rosterFromApi(), classIds: {}, students: remoteStudents })).toThrow(
      'class-calculus-1',
    )
  })

  it('stops when a sample question is missing from the roster, instead of pointing at nothing', () => {
    expect(() => writeDemoData('teacher-from-the-api', { ...rosterFromApi(), questionIds: {} })).toThrow('question-')
  })
})

describe('writeDemoData', () => {
  beforeEach(() => window.localStorage.clear())

  /** What the demo writes, and what a suite without the API would write for the teacher it signs up. */
  it('writes the sample data as owned by the given teacher, without signing anyone in', () => {
    writeDemoData('teacher-from-the-api')

    const owners = [
      ...classes(),
      ...createCollection('questions', questionSchema).readAll(),
      ...createCollection('exams', examSchema).readAll(),
      ...createCollection('applications', applicationSchema).readAll(),
    ].map((record) => record.teacherId)
    expect(new Set(owners)).toEqual(new Set(['teacher-from-the-api']))
    expect(students().length).toBeGreaterThan(0)
    expect(window.localStorage.getItem('correctio:demo-session')).toBeNull()
  })
})
