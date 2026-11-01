import { registrationKey } from '@correctio/domain'
import { studentInputSchema } from '@/lib/schemas'

export interface ParsedStudent {
  fullName: string
  registration: string
  email?: string
}

export interface ParseProblem {
  line: number
  reason: string
}

export interface ParseResult {
  students: ParsedStudent[]
  /** One per line that could not be read, so the teacher can fix it. */
  problems: ParseProblem[]
}

/** What one pasted line holds: a student, the reason it cannot be read, or nothing to report (a blank line, the header). */
type LineReading = { student: ParsedStudent } | { reason: string } | null

const SEPARATORS = [',', ';', '\t'] as const

const problem = (reason: string): LineReading => ({ reason })

/**
 * Reads a pasted or uploaded student list.
 *
 * Accepts comma, semicolon and tab because a list arrives from a spreadsheet
 * that was saved in whatever the person's locale defaults to, and asking a
 * teacher to convert a file is asking them not to use the feature.
 *
 * Every problem is reported with its line number rather than failing the whole
 * import: a list of forty students with one bad row should bring in
 * thirty-nine, not nothing.
 */
export function parseStudents(raw: string): ParseResult {
  const students: ParsedStudent[] = []
  const problems: ParseProblem[] = []
  const seen = new Set<string>()

  raw.split('\n').forEach((text, index) => {
    const reading = readLine(text.trim(), seen)
    if (reading === null) return
    if ('reason' in reading) {
      problems.push({ line: index + 1, reason: reading.reason })
      return
    }
    seen.add(registrationKey(reading.student.registration))
    students.push(reading.student)
  })

  return { students, problems }
}

function readLine(line: string, seen: ReadonlySet<string>): LineReading {
  if (line === '') return null

  const separator = SEPARATORS.find((candidate) => line.includes(candidate))
  if (separator === undefined) return problem('Faltou a matrícula nesta linha.')

  const [fullName = '', registration = '', email = ''] = line.split(separator).map((part) => part.trim())
  if (isHeader(fullName, registration)) return null

  return checkStudent({ fullName, registration, ...(email === '' ? {} : { email }) }, seen)
}

/**
 * The same rules the API applies to every row (`studentInputSchema`): a
 * malformed e-mail or a name too long is caught here, on its own line, because
 * the API refuses the whole list over a single row it cannot store. The
 * friendlier wording for a missing name or registration comes first.
 */
function checkStudent(student: ParsedStudent, seen: ReadonlySet<string>): LineReading {
  if (student.fullName === '') return problem('Faltou o nome do aluno.')
  if (student.registration === '') return problem('Faltou a matrícula.')

  const result = studentInputSchema.safeParse(student)
  if (!result.success) return problem(`${result.error.issues[0]?.message ?? 'Linha inválida'}.`)

  if (seen.has(registrationKey(student.registration))) return problem(`Matrícula ${student.registration} repetida na lista.`)
  return { student }
}

/**
 * A spreadsheet exported with its header row is the normal case, so the header
 * is skipped rather than reported as a broken line.
 */
function isHeader(first: string, second: string): boolean {
  const normalised = `${first} ${second}`.toLocaleLowerCase('pt-BR')
  return normalised.includes('nome') && normalised.includes('matr')
}
