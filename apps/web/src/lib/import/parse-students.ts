export interface ParsedStudent {
  fullName: string
  registration: string
  email?: string
}

export interface ParseResult {
  students: ParsedStudent[]
  /** One per line that could not be read, so the teacher can fix it. */
  problems: { line: number; reason: string }[]
}

const SEPARATORS = [',', ';', '\t'] as const

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
  const lines = raw.split('\n').map((line) => line.trim())
  const students: ParsedStudent[] = []
  const problems: ParseResult['problems'] = []
  const seen = new Set<string>()

  lines.forEach((line, index) => {
    if (line === '') return

    const separator = SEPARATORS.find((candidate) => line.includes(candidate))
    if (separator === undefined) {
      problems.push({ line: index + 1, reason: 'Faltou a matrícula nesta linha.' })
      return
    }

    const [fullName = '', registration = '', email = ''] = line
      .split(separator)
      .map((part) => part.trim())

    if (isHeader(fullName, registration)) return

    if (fullName === '') {
      problems.push({ line: index + 1, reason: 'Faltou o nome do aluno.' })
      return
    }
    if (registration === '') {
      problems.push({ line: index + 1, reason: 'Faltou a matrícula.' })
      return
    }
    if (seen.has(registration)) {
      problems.push({ line: index + 1, reason: `Matrícula ${registration} repetida na lista.` })
      return
    }

    seen.add(registration)
    students.push({ fullName, registration, ...(email === '' ? {} : { email }) })
  })

  return { students, problems }
}

/**
 * A spreadsheet exported with its header row is the normal case, so the header
 * is skipped rather than reported as a broken line.
 */
function isHeader(first: string, second: string): boolean {
  const normalised = `${first} ${second}`.toLocaleLowerCase('pt-BR')
  return normalised.includes('nome') && normalised.includes('matr')
}
