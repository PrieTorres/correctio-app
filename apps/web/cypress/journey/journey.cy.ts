import { slowCypressDown } from 'cypress-slow-down'
import { uniqueEmail } from '../support/commands'

slowCypressDown(800)

interface Student {
  fullName: string
  registration: string
  email?: string
}

interface MultipleChoiceQuestion {
  statement: string
  tags: readonly string[]
  alternatives: readonly string[]
  correctLetter: string
}

interface OpenEndedQuestion {
  statement: string
  tags: readonly string[]
  maxScore: number
}

/** A new address on every run: the API keeps the accounts of earlier runs. */
const TEACHER = {
  fullName: 'Marina Albuquerque',
  email: uniqueEmail('marina.albuquerque'),
  password: 'senha-da-jornada',
} as const

const SCHOOL_CLASS = {
  name: 'Estatística Aplicada — Noturno',
  subject: 'Matemática',
  term: '2026/2',
} as const

/** The student whose sheet is graded by hand and then looked up through the QR code. */
const GRADED_STUDENT: Student = {
  fullName: 'Ana Clara Ribeiro',
  registration: '2026101',
  email: 'ana.ribeiro@exemplo.edu.br',
}

const SECOND_STUDENT: Student = { fullName: 'Bruno Henrique Lima', registration: '2026102' }

/**
 * Pasted the way a spreadsheet exports it, header row included, with semicolons,
 * one student without an e-mail and one whose e-mail is malformed: the four
 * things the import has to cope with on a real list. The preview points at the
 * malformed line and leaves it out, since the API would refuse the whole list.
 */
const SPREADSHEET_ROWS = [
  'Nome;Matrícula;E-mail',
  'Carla Mendes Rocha;2026103;carla.rocha@exemplo.edu.br',
  'Diego Fernandes Alves;2026104',
  'Elisa Prado Nunes;2026105',
  'Fábio Souza Lima;2026106;fabio.lima@',
] as const

/** Its line number in the pasted list, as the preview reports it. */
const MALFORMED_LINE = SPREADSHEET_ROWS.length

/** Every line but the header and the malformed one. */
const IMPORTED_COUNT = SPREADSHEET_ROWS.length - 2
const STUDENT_COUNT = 2 + IMPORTED_COUNT

/**
 * Only this question carries the tag, so the automatic draw filtered by it has
 * exactly one candidate and the video shows the same draw on every run.
 */
const DRAW_TAG = 'Desvio padrão'

const MEAN: MultipleChoiceQuestion = {
  statement: 'Qual é a média aritmética de 4, 8 e 12?',
  tags: ['Estatística', 'Média'],
  alternatives: ['6', '8', '10', '12'],
  correctLetter: 'B',
}

const MEDIAN: MultipleChoiceQuestion = {
  statement: 'Qual é a mediana do conjunto 3, 5, 7, 9 e 11?',
  tags: ['Estatística', 'Mediana'],
  alternatives: ['5', '7', '9'],
  correctLetter: 'B',
}

const DISPERSION: MultipleChoiceQuestion = {
  statement: 'O que o desvio padrão de um conjunto de dados mede?',
  tags: ['Estatística', DRAW_TAG],
  alternatives: ['A dispersão dos valores em torno da média', 'O valor mais frequente', 'O valor central'],
  correctLetter: 'A',
}

const ESSAY: OpenEndedQuestion = {
  statement: 'Explique a diferença entre média e mediana e dê um exemplo em que as duas são diferentes.',
  tags: ['Estatística', 'Média', 'Mediana'],
  maxScore: 4,
}

const EXAM = {
  title: 'Estatística — Prova 1',
  description: 'Medidas de tendência central e de dispersão',
} as const

/** The day the application moves to in step 9, typed as the date control takes it and shown as the screens print it. */
const APPLICATION_DAY = { typed: '2026-11-30', shown: '30/11/2026' } as const

/** Three objectives worth 2 and the essay worth 4, so the exam closes at 10. */
const SCORES: readonly (readonly [statement: string, score: number])[] = [
  [MEAN.statement, 2],
  [MEDIAN.statement, 2],
  [DISPERSION.statement, 2],
  [ESSAY.statement, ESSAY.maxScore],
]

const TOUR = '[aria-label^="Tour desta tela"]'
const tour = () => cy.get(TOUR)

/**
 * Dismisses the tour that opens on the first visit to a screen with content.
 *
 * Called only where the tour is known to open, so a tour that stops showing up
 * fails here instead of being skipped in silence. Two tours are read to the
 * end instead, which is enough for the video to show what one looks like.
 */
function skipTour(): void {
  tour().contains('button', 'Pular').click()
  tour().should('not.exist')
}

/** Reads a tour to the end, so the video shows what each step points at. */
function walkThroughTour(steps: number): void {
  for (let step = 1; step < steps; step += 1) {
    tour().should('contain', `Passo ${step} de ${steps}`).contains('button', 'Próximo').click()
  }
  tour().contains('button', 'Entendi').click()
  tour().should('not.exist')
}

/** Scoped to the menu: a page often repeats the name of its own entry as a heading or link. */
function openFromMenu(entry: string): void {
  cy.get('[aria-label="Navegação principal"]').contains('a', entry).click()
}

/**
 * The journey is about a teacher who has nothing yet, so it leaves the account
 * the support file prepared and starts where a newcomer does: signed out, on
 * the sign-in page.
 */
function startSignedOut(): void {
  cy.clearCookies()
  cy.clearLocalStorage()
  cy.visit('/painel')

  cy.location('pathname').should('eq', '/entrar')
  cy.contains('h1', 'Entrar').should('be.visible')
}

/** A real account on the API; the empty dashboard is the proof the rest of the journey starts from zero. */
function createAccount(): void {
  cy.contains('a', 'Criar conta').click()

  cy.contains('h1', 'Criar conta').should('be.visible')
  cy.findByLabel('Nome completo').type(TEACHER.fullName)
  cy.findByLabel('E-mail').type(TEACHER.email)
  cy.findByLabel('Senha').type(TEACHER.password)
  cy.findByLabel('Confirmar senha').type(TEACHER.password)
  cy.contains('button', 'Criar conta').click()

  cy.location('pathname').should('eq', '/painel')
  cy.get('[aria-label="Navegação principal"]').should('contain', TEACHER.fullName)
  cy.contains('h3', 'Nada aconteceu ainda').should('be.visible')
}

function createClass(): void {
  openFromMenu('Turmas')
  cy.contains('h3', 'Nenhuma turma ainda').should('be.visible')

  cy.contains('button', 'Nova turma').click()
  cy.findByLabel('Nome da turma').type(SCHOOL_CLASS.name)
  cy.findByLabel('Disciplina').type(SCHOOL_CLASS.subject)
  cy.findByLabel('Período').type(SCHOOL_CLASS.term)
  cy.findInDialog('button', 'Salvar').click()
  cy.get('[role="dialog"]').should('not.exist')

  skipTour()
  cy.contains('a', SCHOOL_CLASS.name).click()
  cy.contains('h1', SCHOOL_CLASS.name).should('be.visible')
}

function addStudentByHand({ fullName, registration, email }: Student): void {
  cy.contains('button', 'Adicionar aluno').click()
  cy.findByLabel('Nome completo').type(fullName)
  cy.findByLabel('Matrícula').type(registration)
  if (email !== undefined) cy.findByLabel('E-mail (opcional)').type(email)
  cy.findInDialog('button', 'Adicionar').click()

  cy.get('[role="dialog"]').should('not.exist')
  cy.contains('li', fullName).should('be.visible')
}

/** The result stays on screen until the teacher closes it, so the video shows what came in. */
function importStudents(): void {
  cy.contains('button', 'Importar alunos').click()
  cy.findByLabel('Nome, matrícula e e-mail').type(SPREADSHEET_ROWS.join('{enter}'))

  cy.findInDialog('li', `Linha ${MALFORMED_LINE}: E-mail inválido.`).should('be.visible')
  cy.findInDialog('h3', `${IMPORTED_COUNT} alunos prontos para importar`).should('be.visible')
  cy.findInDialog('a', 'Aviso de privacidade').should('be.visible')
  cy.findInDialog('button', `Importar ${IMPORTED_COUNT} alunos`).click()

  cy.findInDialog('h3', 'Importação concluída').should('be.visible')
  cy.get('[role="dialog"]').should('contain', `${IMPORTED_COUNT} alunos entraram na turma.`)
  cy.findInDialog('button', 'Fechar').click()
  cy.get('[role="dialog"]').should('not.exist')
}

function addStudents(): void {
  cy.contains('h3', 'Nenhum aluno nesta turma').should('be.visible')

  addStudentByHand(GRADED_STUDENT)
  skipTour()
  addStudentByHand(SECOND_STUDENT)
  importStudents()

  cy.contains('h2', `Alunos (${STUDENT_COUNT})`).should('be.visible')
  cy.contains('li', 'Elisa Prado Nunes').should('be.visible')
}

/** Enter commits each tag, which is how a teacher types them one after another. */
function addTags(tags: readonly string[]): void {
  tags.forEach((tag) => {
    cy.findByLabel('Tags de conteúdo').type(`${tag}{enter}`)
    cy.get(`[aria-label="Remover tag ${tag}"]`).should('exist')
  })
}

function saveQuestion(statement: string): void {
  cy.contains('button', 'Salvar questão').click()
  cy.contains('h1', 'Banco de questões').should('be.visible')
  cy.contains('li', statement).should('be.visible')
}

function letterOf(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index)
}

/** The form opens with two blank alternatives; any beyond that are added on the way. */
function writeMultipleChoice({ statement, tags, alternatives, correctLetter }: MultipleChoiceQuestion): void {
  cy.contains('a', 'Nova questão').click()
  cy.contains('h1', 'Nova questão').should('be.visible')
  cy.findByLabel('Enunciado').type(statement)
  addTags(tags)

  alternatives.forEach((text, index) => {
    if (index >= 2) cy.contains('button', 'Alternativa').click()
    cy.get(`[aria-label="Texto da alternativa ${letterOf(index)}"]`).type(text)
  })
  cy.get(`[aria-label="Alternativa ${correctLetter} é a correta"]`).check()

  saveQuestion(statement)
}

function writeOpenEnded({ statement, tags, maxScore }: OpenEndedQuestion): void {
  cy.contains('a', 'Nova questão').click()
  cy.chooseSegment('Discursiva')
  cy.findByLabel('Enunciado').type(statement)
  addTags(tags)
  cy.findByLabel('Nota máxima').type(String(maxScore))

  saveQuestion(statement)
}

function writeQuestions(): void {
  openFromMenu('Banco de Questões')
  cy.contains('h3', 'Nenhuma questão ainda').should('be.visible')

  writeMultipleChoice(MEAN)
  skipTour()
  writeMultipleChoice(MEDIAN)
  writeMultipleChoice(DISPERSION)
  writeOpenEnded(ESSAY)

  cy.chooseSegment('Discursivas')
  cy.contains('li', ESSAY.statement).should('be.visible')
  cy.contains('li', MEAN.statement).should('not.exist')
  cy.chooseSegment('Todas')
  cy.contains('li', MEAN.statement).should('be.visible')
}

/** Ticks the named questions in the side panel, which keeps the exam in view. */
function pickFromBank(statements: readonly string[]): void {
  cy.contains('button', 'Adicionar do banco').click()
  cy.get('[role="dialog"]').within(() => {
    statements.forEach((statement) => {
      cy.get(`[aria-label="${statement}"]`).check()
    })
    cy.contains('button', 'Adicionar selecionadas').click()
  })
  cy.get('[role="dialog"]').should('not.exist')
}

/**
 * Waits for the count of available questions before filtering: drawing while
 * the bank is still loading finds nothing and blames the bank.
 */
function drawByTag(tag: string, expected: string): void {
  cy.contains('button', 'Preencher automaticamente').click()
  cy.findInDialog('h2', 'Gerar prova automaticamente').should('be.visible')
  cy.contains('com estes filtros').should('be.visible')

  cy.get('[role="dialog"]').contains('label', tag).click()
  cy.contains('1 objetiva disponível com estes filtros').should('be.visible')
  cy.get('[role="dialog"] [aria-label="Quantas objetivas"]').clear().type('1')
  cy.findInDialog('button', 'Gerar seleção').click()
  cy.get('[role="dialog"]').should('contain', expected)

  cy.findInDialog('button', 'Usar esta seleção').click()
  cy.get('[role="dialog"]').should('not.exist')
}

/** Rows are found by statement, never by position, because reordering is part of the stage. */
function examRow(statement: string) {
  return cy.contains('li', statement)
}

function buildExam(): void {
  openFromMenu('Provas')
  cy.contains('h3', 'Nenhuma prova ainda').should('be.visible')
  cy.contains('a', 'Nova prova').click()

  cy.findByLabel('Título').type(EXAM.title)
  cy.findByLabel('Descrição').type(EXAM.description)
  pickFromBank([MEAN.statement, MEDIAN.statement, ESSAY.statement])
  drawByTag(DRAW_TAG, DISPERSION.statement)

  examRow(ESSAY.statement).find('[aria-label^="Mover para baixo"]').click()
  examRow(ESSAY.statement).find('[aria-label="Mover para baixo a questão 4 de 4"]').should('be.disabled')

  SCORES.forEach(([statement, score]) => {
    examRow(statement).find('[aria-label^="Pontuação da questão"]').clear().type(String(score))
  })
  cy.contains('4/20 questões · pontuação total 10').should('be.visible')

  cy.contains('button', 'Salvar prova').click()
  cy.contains('h1', EXAM.title).should('be.visible')
  cy.contains('Embaralhar questões: sim').should('be.visible')
}

function applyExam(): void {
  cy.contains('a', 'Nova aplicação com esta prova').click()
  cy.contains('h1', 'Nova aplicação').should('be.visible')

  cy.findByLabel('Prova').should('contain', EXAM.title).select(EXAM.title)
  cy.findByLabel('Turma').should('contain', SCHOOL_CLASS.name).select(SCHOOL_CLASS.name)
  cy.contains('button', 'Salvar e gerar').click()

  cy.contains('h1', `Gerar PDF — ${EXAM.title}`).should('be.visible')
}

/**
 * The PDF is drawn by the server for this application. The recording shows the
 * download, and the response proves a PDF came back for it.
 */
function downloadPdf(): void {
  cy.intercept({ method: 'GET', pathname: /^\/api\/applications\/[^/]+\/pdf$/ }).as('pdf')
  cy.contains('button', 'Baixar PDF').click()

  cy.wait('@pdf').its('response.headers.content-type').should('contain', 'application/pdf')
}

/**
 * Two versions, each with its own shuffle (RF22): both start from the
 * preferences of the exam, and the second keeps the alternatives in order,
 * which the detail then says version by version.
 */
function generateVersions(): void {
  cy.get('[aria-label="Embaralhar questões da versão 1"]').should('be.checked')
  cy.get('[aria-label="Quantas versões"]').clear().type('2')
  cy.get('[aria-label="Embaralhar alternativas da versão 2"]').uncheck()
  cy.contains('button', 'Gerar PDF').click()

  cy.contains(`${STUDENT_COUNT} folhas prontas para imprimir`, { timeout: 20000 }).should('be.visible')
  cy.contains('h1', EXAM.title).should('be.visible')
  cy.contains('li', 'Versão 1').should('contain', 'alternativas embaralhadas')
  cy.contains('li', 'Versão 2').should('contain', 'alternativas na ordem')
  cy.contains('tr', GRADED_STUDENT.fullName).should('be.visible')

  downloadPdf()
}

/**
 * Every version at once, whichever one the graded student happened to get. The
 * confirmation says what the students start to see before anything changes.
 */
function publishAllAnswerKeys(): void {
  cy.contains('button', 'Publicar todos').click()
  cy.findInDialog('h2', 'Publicar o gabarito de todas as versões?').should('be.visible')
  cy.findInDialog('button', 'Publicar todos').click()

  cy.contains('li', 'Versão 1').should('contain', 'Gabarito publicado')
  cy.contains('li', 'Versão 2').should('contain', 'Gabarito publicado')
}

/** After printing, the day is the only part of the application that changes (#163). */
function moveTheDate(): void {
  cy.contains('button', 'Ações').click()
  cy.contains('[role="menuitem"]', 'Editar data').click()
  cy.findInDialog('h2', 'Editar a data').should('be.visible')
  cy.findByLabel('Data da aplicação').clear().type(APPLICATION_DAY.typed)
  cy.findInDialog('button', 'Salvar data').click()

  cy.contains(`${SCHOOL_CLASS.name} · ${APPLICATION_DAY.shown}`).should('be.visible')
}

function reviewSheetOf(fullName: string): void {
  cy.contains('li', fullName).contains('a', 'Revisar').click()
  cy.contains('h1', 'Folha').should('be.visible')

  cy.get('[aria-label="Aumentar o zoom"]').click()
  cy.get('[aria-label="Girar a folha"]').click()

  cy.contains('Valendo 0').should('be.visible')
  cy.get('[aria-label^="Nota da questão"]').clear().type('3.5')
  cy.contains('Valendo 0').should('not.exist')

  cy.contains('button', 'Confirmar correção').click()
  cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
  cy.contains('li', fullName).should('contain', 'Corrigida')
}

/**
 * Reading is simulated in this phase: the demonstration sheets stand in for the
 * photographs, and everything after the reading is real.
 *
 * Grading starts from the panel's shortcut, as on a test day. With this the
 * only application generated, it goes straight to the upload screen. The
 * panel's tour is left open, not dismissed, so step 14 can still walk it.
 */
function gradeSheets(): void {
  openFromMenu('Painel')
  cy.contains('h1', 'Painel').should('be.visible')
  cy.get('main').contains('a', 'Corrigir folhas').click()
  cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
  skipTour()

  cy.contains(`0 de ${STUDENT_COUNT} lidas`).should('be.visible')
  cy.contains('button', 'Selecionar todas as não lidas').click()
  cy.contains('button', `Ler ${STUDENT_COUNT} folhas`).click()
  cy.contains(`${STUDENT_COUNT} de ${STUDENT_COUNT} lidas`, { timeout: 10000 }).should('be.visible')
  cy.contains('li', GRADED_STUDENT.fullName).should('contain', 'Em andamento')

  reviewSheetOf(GRADED_STUDENT.fullName)
}

/**
 * The release asks first and says what each student starts to see. It is then
 * confirmed on the list, reached through the app's own link and narrowed by
 * the class filter: the write is asynchronous, and the badges there prove it
 * landed before the next stage leaves the app.
 */
function releaseGrades(): void {
  cy.get('main').contains('a', 'Aplicação').click()
  cy.contains('h2', 'Notas para os alunos').should('be.visible')

  cy.contains('button', 'Liberar notas').click()
  cy.findInDialog('h2', 'Liberar as notas?').should('be.visible')
  cy.findInDialog('button', 'Liberar notas').click()
  cy.contains('button', 'Recolher notas').should('be.visible')

  cy.get('main').contains('a', 'Aplicações').click()
  skipTour()
  cy.findByLabel('Turma').should('contain', SCHOOL_CLASS.name).select(SCHOOL_CLASS.name)
  cy.contains('a', EXAM.title).closest('li').should('contain', 'Notas liberadas').and('contain', 'Gabarito publicado')
}

/**
 * The one visit after a write, and on purpose: a student reaches this page by
 * scanning the code printed on the sheet, from outside the app, and nothing
 * links to it from inside. The release was already confirmed on the list, so
 * nothing is in flight when the page is replaced.
 *
 * The page reads the sheet from the API, and the corrections still live in
 * the browser that graded them, so the server has no grade to show yet: the
 * student sees the answer key. Issue #48 moves the corrections to the API, and
 * then this stage checks the grade too.
 */
function lookUpByQrCode(): void {
  cy.contains('a', EXAM.title).click()
  cy.contains('h2', 'Folhas').should('be.visible')

  cy.contains('tr', GRADED_STUDENT.fullName)
    .find('td:last-child')
    .invoke('text')
    .then((code) => {
      cy.visit(`/r/${code.trim()}`)
    })

  cy.contains('h1', EXAM.title).should('be.visible')
  cy.contains(GRADED_STUDENT.fullName).should('be.visible')
  cy.contains('h2', 'Gabarito').should('be.visible')

  cy.go('back')
  cy.contains('h2', 'Versões').should('be.visible')
}

/** The tag row is matched with its capital letter, which keeps it apart from the statement. */
function readReport(): void {
  openFromMenu('Relatórios')
  cy.contains('h1', 'Relatório consolidado').should('be.visible')
  cy.contains('tr', EXAM.title).should('contain', SCHOOL_CLASS.name)
  cy.contains('a', EXAM.title).click()

  cy.contains('h1', 'Relatório da aplicação').should('be.visible')
  walkThroughTour(3)

  cy.contains('h2', 'Distribuição das notas').should('be.visible')
  cy.contains('button', 'Por nota').click()
  cy.contains('button', 'Por nota').should('have.attr', 'aria-pressed', 'true')
  cy.contains('tr', GRADED_STUDENT.fullName).should('be.visible')
  cy.contains('h2', 'Por questão').should('be.visible')
  cy.contains('h2', 'Por conteúdo').should('be.visible')
  cy.contains('li', DRAW_TAG).should('be.visible')
}

function summaryCard(label: string) {
  return cy.get('main').contains('a', label)
}

function readDashboard(): void {
  openFromMenu('Painel')
  cy.contains('h1', 'Painel').should('be.visible')
  walkThroughTour(4)

  summaryCard('Turmas').should('contain', '1')
  summaryCard('Questões').should('contain', '4')
  summaryCard('Provas').should('contain', '1')
  summaryCard('Aplicações').should('contain', '1')
  cy.contains('h2', 'Atividade recente').should('be.visible')
  cy.get('main').contains('a', EXAM.title).should('be.visible')

  greetsByFirstName()
  followPendingCorrections()
}

/** The greeting is the first name of the account created in step 2. */
function greetsByFirstName(): void {
  const [first = ''] = TEACHER.fullName.split(' ')
  cy.contains(`Olá, ${first}!`).should('be.visible')
}

/**
 * Every sheet was read in step 10 and only the graded student's was confirmed,
 * so the rest still wait for the open-ended score. The card leads to the list
 * of applications already filtered by that, with the filter in the address.
 */
function followPendingCorrections(): void {
  summaryCard('Correções pendentes').should('contain', String(STUDENT_COUNT - 1))
  summaryCard('Correções pendentes').click()

  cy.contains('h1', 'Aplicações').should('be.visible')
  cy.location('search').should('eq', '?status=correction-in-progress')
  cy.contains('label', 'Correção em andamento').find('input[type="radio"]').should('be.checked')
  cy.get('main').contains('a', EXAM.title).should('be.visible')
}

describe('jornada completa', () => {
  /**
   * The whole system walked from an empty browser to the last screen, the way
   * a teacher meets it. It is recorded, slowed down, on every pull request, and
   * that video is the evidence the product still works end to end.
   *
   * Every new feature adds its step here. A screen this journey never visits is
   * a screen nobody sees break, and the stage titles in the command log are
   * what someone watching the video navigates by.
   */
  it('leva uma professora nova do cadastro ao relatório, passando por cada etapa', () => {
    cy.log('**1. Chegar sem sessão**')
    startSignedOut()

    cy.log('**2. Criar a conta**')
    createAccount()

    cy.log('**3. Criar a turma**')
    createClass()

    cy.log('**4. Cadastrar os alunos, um a um e pela planilha**')
    addStudents()

    cy.log('**5. Escrever as questões**')
    writeQuestions()

    cy.log('**6. Montar a prova**')
    buildExam()

    cy.log('**7. Aplicar a prova à turma**')
    applyExam()

    cy.log('**8. Gerar as versões e o PDF**')
    generateVersions()

    cy.log('**9. Publicar o gabarito e mudar a data**')
    publishAllAnswerKeys()
    moveTheDate()

    cy.log('**10. Corrigir as folhas**')
    gradeSheets()

    cy.log('**11. Liberar as notas**')
    releaseGrades()

    cy.log('**12. Consultar a nota pelo QR Code**')
    lookUpByQrCode()

    cy.log('**13. Ler o relatório da aplicação**')
    readReport()

    cy.log('**14. Conferir o painel: saudação e correções pendentes**')
    readDashboard()
  })
})
