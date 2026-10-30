import { photoOf, printedPaperOf, printForTheTeacher, type PrintedApplication, type SignedInTeacher } from '../support/commands'

/**
 * Correction, P15 to P17 (#47, #48): the photo of a printed sheet goes to the
 * API, which reads its QR Code and marks; the teacher reviews what was read and
 * confirms it, and only then is there a grade.
 *
 * The photos are drawn by the reader's own test kit with the sheet's real QR
 * Code (`cy.photographSheet`), so what the screen shows is the API's reading,
 * not a stubbed answer.
 */
const CALCULUS = 'Cálculo I — Prova 1'

type Printed = PrintedApplication & { accessToken: string }

/** The one sheet `printApplication` prints, photographed with the given marks on its one question. */
function photographPrinted(printed: Printed, marks: Record<number, number[]>): Cypress.Chainable<string> {
  return printedPaperOf(printed.accessToken, printed.applicationId).then(({ versions }) => {
    const [version] = versions
    if (version === undefined) throw new Error('A geração não devolveu nenhuma versão.')
    return cy.photographSheet(photoOf(printed.sheet, version, marks))
  })
}

/** The grade P16 shows while the teacher reviews, next to the "Nota" heading. */
function totalShown(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.contains('h2', 'Nota').next()
}

function openGrading(printed: Printed): void {
  cy.visit(`/aplicacoes/${printed.applicationId}`)
  cy.contains('a', 'Corrigir folhas').click()
  cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
}

/** Prints a sitting, sends the photo of its sheet with the right answer marked, and waits for the reading. */
function sendRightAnswer(): Cypress.Chainable<Printed> {
  return printForTheTeacher().then((printed) => {
    photographPrinted(printed, { 0: [0] }).then((photo) => {
      openGrading(printed)
      cy.sendSheetPhoto(photo)
    })
    cy.contains('Lido · nota prévia 10', { timeout: 30000 }).should('be.visible')
    return cy.wrap(printed)
  })
}

describe('enviar folhas', () => {
  it('lê a foto e mostra a folha, o aluno e a nota prévia', () => {
    sendRightAnswer().then((printed) => {
      cy.contains(`Folha 1 · ${printed.studentName}`).should('be.visible')
    })
  })

  /** A reading is not a grade (RF28): nothing is stored until the teacher confirms the review. */
  it('não grava nota antes da confirmação', () => {
    sendRightAnswer()

    cy.contains('0 de 1 corrigidas').should('be.visible')
    cy.contains('Não corrigida').should('be.visible')
  })

  it('pede a folha quando o QR não é reconhecido, e a falha continua na lista', () => {
    printForTheTeacher().then((printed) => {
      printedPaperOf(printed.accessToken, printed.applicationId).then(({ versions }) => {
        const [version] = versions
        if (version === undefined) throw new Error('A geração não devolveu nenhuma versão.')
        cy.photographSheet({ ...photoOf(printed.sheet, version), qrText: null }).then((photo) => {
          openGrading(printed)
          cy.sendSheetPhoto(photo)
        })
      })

      cy.contains('QR não reconhecido', { timeout: 30000 }).should('be.visible')

      cy.reload()
      cy.contains('h2', 'Fotos que não foram lidas').should('be.visible')
      cy.findByLabel('Qual folha é esta foto?').select(`Folha 1 · ${printed.studentName}`)
      cy.findByLabel('Qual folha é esta foto?').parent().contains('button', 'Revisar').click()

      cy.contains('h1', 'Folha 1').should('be.visible')
      cy.get('img[alt="Foto da folha 1"]').should('be.visible')
    })
  })

  it('recusa o que não é foto e diz o motivo', () => {
    printForTheTeacher().then((printed) => {
      openGrading(printed)
      cy.findByLabel('Escolher arquivos').selectFile(
        { contents: Cypress.Buffer.from('não é uma foto'), fileName: 'notas.txt', mimeType: 'text/plain' },
        { force: true },
      )

      cy.contains('[role="alert"]', 'Envie a foto em JPG, PNG ou WebP.', { timeout: 10000 }).should('be.visible')
    })
  })

  /** RF30: a sheet never photographed is graded by typing what is on it. */
  it('lança a correção à mão, sem foto', () => {
    printForTheTeacher().then((printed) => {
      openGrading(printed)
      cy.findByLabel('Escolha a folha').select(`Folha 1 · ${printed.studentName}`)
      cy.findByLabel('Escolha a folha').parent().contains('button', 'Revisar').click()

      cy.contains('h1', 'Folha 1').should('be.visible')
      cy.contains('Correção digitada, sem foto.').should('be.visible')
      cy.get('[aria-label="Questão 1, alternativa A, correta"]').click()
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
      cy.contains('1 de 1 corrigidas').should('be.visible')
      cy.contains('Corrigida · 10').should('be.visible')
    })
  })
})

describe('revisar e confirmar', () => {
  beforeEach(() => {
    sendRightAnswer()
    cy.get('[aria-label="Revisar a folha 1"]').click()
    cy.contains('h1', 'Folha 1').should('be.visible')
  })

  it('mostra a foto ao lado do que foi lido', () => {
    cy.get('img[alt="Foto da folha 1"]').should('be.visible')
    cy.get('[aria-label="Questão 1, alternativa A, correta"]').should('have.attr', 'aria-pressed', 'true')
    totalShown().should('have.text', '10')
  })

  it('confirma, e a correção entra na lista com a nota', () => {
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('h1', 'Enviar folhas de respostas', { timeout: 10000 }).should('be.visible')
    cy.contains('1 de 1 corrigidas').should('be.visible')
    cy.contains('Corrigida · 10').should('be.visible')
  })

  it('corrige a marcação lida, recalcula a nota e guarda a mudança', () => {
    cy.get('[aria-label="Questão 1, alternativa B"]').click()
    totalShown().should('have.text', '0')
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('Corrigida · 0', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label^="Revisar a folha 1, "]').click()
    cy.get('[aria-label="Questão 1, alternativa B"]').should('have.attr', 'aria-pressed', 'true')
  })

  it('salva sem finalizar e a correção fica em andamento', () => {
    cy.contains('button', 'Salvar sem finalizar').click()

    cy.contains('Em andamento · 10', { timeout: 10000 }).should('be.visible')
  })

  it('permite girar e ampliar a foto', () => {
    cy.get('button[aria-label="Girar a foto"]').click()
    cy.get('button[aria-label="Aumentar o zoom"]').click()

    cy.get('img[alt="Foto da folha 1"]').should('have.attr', 'style').and('contain', 'rotate: 90deg')
  })
})

/**
 * A mixed exam (the sample calculus midterm): the photo grades the
 * multiple-choice questions and the open-ended one waits for the teacher,
 * starting at zero (RF47, RF48).
 */
describe('discursivas', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', CALCULUS).click()
    cy.contains('h1', CALCULUS).should('be.visible')
    cy.location('pathname').then((pathname) => {
      const applicationId = pathname.split('/').pop() ?? ''
      cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) =>
        printedPaperOf(accessToken, applicationId).then(({ sheets, versions }) => {
          const sheet = sheets.find((item) => item.sheetNumber === 1)
          const version = versions.find((item) => item.id === sheet?.examVersionId)
          if (sheet === undefined || version === undefined) throw new Error('A prova de exemplo não tem a folha 1.')
          cy.photographSheet(photoOf(sheet, version)).as('photo')
        }),
      )
    })
    cy.contains('a', 'Corrigir folhas').click()
    cy.get<string>('@photo').then((photo) => cy.sendSheetPhoto(photo))
    cy.contains('Em andamento', { timeout: 30000 }).should('be.visible')
    cy.get('[aria-label="Revisar a folha 1"]').click()
  })

  it('avisa que a discursiva começa valendo 0 e finaliza ao confirmar', () => {
    cy.get('[role="status"]').should('contain', 'A questão discursiva começa valendo 0')
    cy.contains('Valendo 0').should('be.visible')
    cy.contains('button', 'Confirmar correção').click()

    cy.contains('1 de 12 corrigidas', { timeout: 10000 }).should('be.visible')
    cy.contains('Corrigida · 0').should('be.visible')
  })

  it('soma a nota da discursiva e a guarda ao salvar sem finalizar', () => {
    cy.get('[aria-label^="Nota da questão"]').clear().type('2.5')
    totalShown().should('have.text', '2.5')
    cy.contains('button', 'Salvar sem finalizar').click()

    cy.contains('Em andamento · 2.5', { timeout: 10000 }).should('be.visible')
    cy.get('[aria-label^="Revisar a folha 1, "]').click()
    cy.get('[aria-label^="Nota da questão"]').should('have.value', '2.5')
  })
})

/** RF31: a sheet printed without the student's name waits on P17 until somebody says whose it is. */
describe('pendentes de atribuição', () => {
  it('lista a folha sem dono e a tira da lista depois de associar o aluno', () => {
    printForTheTeacher({ withStudentIdentification: false }).then((printed) => {
      photographPrinted(printed, { 0: [0] }).then((photo) => {
        openGrading(printed)
        cy.sendSheetPhoto(photo)
      })
      cy.get('[aria-label="Revisar a folha 1"]', { timeout: 30000 }).click()
      cy.contains('h2', 'De quem é esta folha?').should('be.visible')
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('a', 'Ver correções pendentes de atribuição', { timeout: 10000 }).click()
      cy.contains('h1', 'Pendentes de atribuição').should('be.visible')
      cy.get('[aria-label="Associar aluno à folha 1"]').click()
      cy.get('[aria-label="Associar esta folha a um aluno"]').select(printed.studentName)
      cy.contains('button', 'Confirmar correção').click()

      cy.contains('a', 'Ver correções pendentes de atribuição', { timeout: 10000 }).click()
      cy.contains('Nenhuma pendência').should('be.visible')
    })
  })
})

describe('relatório da aplicação', () => {
  it('explica que nada foi corrigido ainda', () => {
    printForTheTeacher().then((printed) => {
      cy.visit(`/aplicacoes/${printed.applicationId}/relatorio`)

      cy.contains('h3', 'Nada corrigido ainda').should('be.visible')
    })
  })

  it('mostra as estatísticas depois da primeira correção confirmada', () => {
    sendRightAnswer().then((printed) => {
      cy.get('[aria-label="Revisar a folha 1"]').click()
      cy.contains('button', 'Confirmar correção').click()
      cy.contains('Corrigida · 10', { timeout: 10000 }).should('be.visible')

      cy.contains('a', 'Aplicação').click()
      cy.contains('a', 'Ver relatório').click()

      cy.contains('h1', 'Relatório da aplicação').should('be.visible')
      cy.contains('Média').should('be.visible')
      cy.contains(printed.studentName).should('be.visible')
    })
  })
})
