import { beforeEach, describe, expect, it } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type AnswerSheet, type CorrectionStatus } from '@/types/domain'
import { clearAllCollections } from '@/lib/storage/collection'
import { createTeacherRepositories } from '..'

const input = { examId: 'exam-1', classId: 'class-1', date: '2026-10-05T13:00:00.000Z' }

const SHUFFLE_BOTH = { shuffleQuestions: true, shuffleAlternatives: true }
const KEEP_ORDER = { shuffleQuestions: false, shuffleAlternatives: false }

/** The browser version with the other repositories behind it, as the app wires it without an API. */
const repositoriesOf = (teacherId: string) => createTeacherRepositories(teacherId)

/** An exam and a class with two students, so a generation has something to print. */
async function seedSitting(teacherId = 'ana') {
  const { questions, exams, classes, students, applications } = repositoriesOf(teacherId)
  const question = await questions.create({
    type: 'objetiva',
    statement: 'Quanto é 2 + 2?',
    tags: [],
    alternatives: [
      { id: 'alt-4', text: '4' },
      { id: 'alt-5', text: '5' },
    ],
    correctAlternativeId: 'alt-4',
    allowShuffleAlternatives: true,
  })
  const exam = await exams.create({
    title: 'Cálculo I — P1',
    description: '',
    questions: [{ questionId: question.id, order: 0, score: 10, allowShuffleAlternatives: true }],
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
  })
  const group = await classes.create({ name: 'Turma A', subject: 'Matemática', term: '2026/2' })
  await students.add(group.id, { fullName: 'Ana Ribeiro', registration: '1' })
  await students.add(group.id, { fullName: 'Bruno Lima', registration: '2' })

  const application = await applications.create({ examId: exam.id, classId: group.id, date: input.date })
  return { application, exam, group }
}

/** A correction of the sheet with only what the counts read; grading itself is tested with the grading hooks. */
async function correct(sheet: AnswerSheet, status: CorrectionStatus) {
  await repositoriesOf('ana').corrections.save({
    id: `correction-${sheet.id}`,
    examVersionId: sheet.examVersionId,
    answerSheetId: sheet.id,
    status,
    source: CORRECTION_SOURCE.MANUAL,
    objectiveResults: [],
    discursiveScores: [],
    totalScore: 0,
    confirmedAt: '2026-10-06T13:00:00.000Z',
    correctedBy: 'ana',
    isAutomaticallyAssigned: true,
    clientCorrectionId: `client-${sheet.id}`,
    syncStatus: 'synced',
  })
}

describe('application repository', () => {
  beforeEach(clearAllCollections)

  it('creates an application as a draft, with grades unreleased', async () => {
    const created = await repositoriesOf('ana').applications.create(input)

    expect(created.status).toBe('draft')
    expect(created.gradesReleased).toBe(false)
  })

  it('archives to closed and drops it from the default listing', async () => {
    const { applications } = repositoriesOf('ana')
    const created = await applications.create(input)

    await applications.archive(created.id)

    expect((await applications.list()).items).toHaveLength(0)
    expect((await applications.list({ archived: true })).items).toHaveLength(1)
  })

  it('restores to draft rather than to generated, since paper is not restored', async () => {
    const { applications } = repositoriesOf('ana')
    const created = await applications.create(input)
    await applications.update(created.id, {})
    await applications.archive(created.id)

    await applications.restore(created.id)

    expect((await applications.getById(created.id))?.status).toBe('draft')
  })

  it('keeps the date and the links through an update', async () => {
    const { applications } = repositoriesOf('ana')
    const created = await applications.create(input)

    await applications.update(created.id, { date: '2026-10-06T13:00:00.000Z' })
    const updated = await applications.getById(created.id)

    expect(updated?.date).toBe('2026-10-06T13:00:00.000Z')
    expect(updated?.examId).toBe('exam-1')
    expect(updated?.classId).toBe('class-1')
  })

  it('hides one teacher application from another', async () => {
    const created = await repositoriesOf('ana').applications.create(input)

    await expect(repositoriesOf('bruno').applications.getById(created.id)).resolves.toBeNull()
  })

  it('orders by date, the most recent first, since an application is an event', async () => {
    const { applications } = repositoriesOf('ana')
    await applications.create({ ...input, date: '2026-03-01T13:00:00.000Z' })
    await applications.create({ ...input, date: '2026-12-01T13:00:00.000Z' })

    const dates = (await applications.list()).items.map((item) => item.date)
    expect(dates).toEqual(['2026-12-01T13:00:00.000Z', '2026-03-01T13:00:00.000Z'])
  })

  it('finds an application by its day typed as the screen prints it, as the API does', async () => {
    const { applications } = repositoriesOf('ana')
    await applications.create(input)
    await applications.create({ ...input, date: '2026-11-20T13:00:00.000Z' })
    const search = async (term: string) => (await applications.list({ search: term })).items.map((item) => item.date)

    expect(await search('05/10/2026')).toEqual([input.date])
    expect(await search('05/10')).toEqual([input.date])
    expect(await search('2026-11')).toEqual(['2026-11-20T13:00:00.000Z'])
  })

  it('filters by class, exam and status before paging', async () => {
    const { applications } = repositoriesOf('ana')
    await applications.create(input)
    await applications.create({ ...input, classId: 'class-2', date: '2026-10-06T13:00:00.000Z' })
    await applications.create({ ...input, examId: 'exam-2', date: '2026-10-07T13:00:00.000Z' })
    const classesOf = async (params: object) => (await applications.list(params)).items.map((item) => `${item.examId}/${item.classId}`)

    expect(await classesOf({ classId: 'class-1' })).toEqual(['exam-2/class-1', 'exam-1/class-1'])
    expect(await classesOf({ examId: 'exam-1' })).toEqual(['exam-1/class-2', 'exam-1/class-1'])
    expect(await classesOf({ status: 'generated' })).toEqual([])
    expect((await applications.list({ classId: 'class-1', pageSize: 1, page: 2 })).total).toBe(2)
  })

  it('answers each application with the names of its exam and class, and what was printed and corrected', async () => {
    const { application } = await seedSitting()
    const { applications, printing } = repositoriesOf('ana')
    await applications.generate(application.id, { versions: [SHUFFLE_BOTH, KEEP_ORDER], withStudentIdentification: true })
    const [first] = await printing.listVersions(application.id)
    await printing.publishAnswerKey(application.id, first?.id ?? '', true)
    const [done, waiting] = await printing.listSheets(application.id)
    if (done !== undefined) await correct(done, CORRECTION_STATUS.DONE)
    if (waiting !== undefined) await correct(waiting, CORRECTION_STATUS.IN_PROGRESS)

    const read = await applications.getById(application.id)

    expect(read).toMatchObject({
      examTitle: 'Cálculo I — P1',
      className: 'Turma A',
      status: 'generated',
      progress: { versions: 2, publishedAnswerKeys: 1, sheets: 2, correctedSheets: 1, corrections: 2 },
    })
    expect((await applications.list()).items[0]?.progress).toEqual(read?.progress)
  })

  it('filters by where the correction stands, before paging', async () => {
    const { application: waiting } = await seedSitting()
    const { applications, printing } = repositoriesOf('ana')
    const untouched = await applications.create({ ...input, examId: waiting.examId, classId: waiting.classId, date: '2026-10-07T13:00:00.000Z' })
    await applications.generate(waiting.id, { versions: [KEEP_ORDER], withStudentIdentification: true })
    const [sheet] = await printing.listSheets(waiting.id)
    if (sheet !== undefined) await correct(sheet, CORRECTION_STATUS.IN_PROGRESS)
    const inStage = async (correction: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE') =>
      (await applications.list({ correction })).items.map((item) => item.id)

    expect(await inStage('NOT_STARTED')).toEqual([untouched.id])
    expect(await inStage('IN_PROGRESS')).toEqual([waiting.id])
    expect(await inStage('DONE')).toEqual([])
    expect((await applications.list({ correction: 'NOT_STARTED', pageSize: 1, page: 2 })).total).toBe(1)
  })

  it('prints each version with its own shuffle, marking the application generated and the exam ready', async () => {
    const { application, exam } = await seedSitting()
    const { applications, exams } = repositoriesOf('ana')

    const paper = await applications.generate(application.id, { versions: [SHUFFLE_BOTH, KEEP_ORDER], withStudentIdentification: false })

    expect(paper.versions.map(({ shuffleQuestions, shuffleAlternatives }) => ({ shuffleQuestions, shuffleAlternatives }))).toEqual([
      SHUFFLE_BOTH,
      KEEP_ORDER,
    ])
    expect(paper.sheets.map((sheet) => sheet.studentId)).toEqual([undefined, undefined])
    expect((await applications.getById(application.id))?.status).toBe('generated')
    expect((await exams.getById(exam.id))?.status).toBe('ready')
  })

  it('refuses printing again over a sheet already corrected, as the API does (RF24)', async () => {
    const { application } = await seedSitting()
    const { applications, printing } = repositoriesOf('ana')
    await applications.generate(application.id, { versions: [KEEP_ORDER], withStudentIdentification: true })
    const [sheet] = await printing.listSheets(application.id)
    if (sheet !== undefined) await correct(sheet, CORRECTION_STATUS.DONE)

    await expect(applications.generate(application.id, { versions: [KEEP_ORDER], withStudentIdentification: true })).rejects.toThrow(
      'Uma folha desta aplicação já foi corrigida.',
    )
  })

  it('releases the grades, answering the application as the screens read it', async () => {
    const { application } = await seedSitting()

    const released = await repositoriesOf('ana').applications.setGradesReleased(application.id, true)

    expect(released).toMatchObject({ gradesReleased: true, examTitle: 'Cálculo I — P1', className: 'Turma A' })
  })

  it('says what is missing when the application or its exam is not there', async () => {
    const { applications } = repositoriesOf('ana')
    const withoutExam = await applications.create(input)

    await expect(applications.generate('nope', { versions: [KEEP_ORDER], withStudentIdentification: true })).rejects.toThrow('Aplicação não encontrada.')
    await expect(applications.generate(withoutExam.id, { versions: [KEEP_ORDER], withStudentIdentification: true })).rejects.toThrow('Prova não encontrada.')
    await expect(applications.setGradesReleased('nope', true)).rejects.toThrow('Aplicação não encontrada.')
  })

  it('says the PDF does not exist without a server to draw it', async () => {
    const { application } = await seedSitting()

    await expect(repositoriesOf('ana').applications.downloadPdf(application.id)).rejects.toThrow(
      'O PDF é montado pelo servidor e não existe nesta demonstração.',
    )
  })
})
