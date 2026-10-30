import { sampleClasses } from '@/lib/seed'
import { apiAs, printForTheTeacher, type SignedInTeacher } from '../support/commands'

/**
 * Applications: where an exam meets a class on a date, and paper comes out.
 *
 * Everything here is on the API (#46): the server generates the versions, the
 * sheets with their codes and the PDF, and the screens read what it printed.
 * The sample data of every test has one application already generated, the
 * calculus midterm (2 versions, 12 students), and one still a draft, the
 * physics quiz (10 students).
 */
const TO_GENERATE = 'Física II — Teste rápido'
const ALREADY_GENERATED = 'Cálculo I — Prova 1'

/** How many students the sample of this test put in a class, which is how many sheets its application prints. */
function sampleStudentCount(className: string): number {
  const group = sampleClasses().find((item) => item.input.name === className)
  if (group === undefined) throw new Error(`A turma ${className} não está na amostra.`)
  return group.students.length
}

const TO_GENERATE_SHEETS = sampleStudentCount('Física II')
const ALREADY_GENERATED_SHEETS = sampleStudentCount('Cálculo I — Noturno')
const LINEAR_ALGEBRA_SHEETS = sampleStudentCount('Álgebra Linear')

/** The sample exam no application uses yet, to create one in a test. */
const LINEAR_ALGEBRA_EXAM = 'Álgebra Linear — Prova 1'

/** The sheets table of P14, the one table of the page. */
function sheetTable(options?: Partial<Cypress.Timeoutable>) {
  return cy.contains('table', 'Código', options)
}

/** The codes of the sheets, read from the column under the "Código" header rather than from a position. */
function codesOf($table: JQuery<HTMLElement>): string[] {
  const column = $table
    .find('thead th')
    .toArray()
    .findIndex((cell) => cell.textContent?.trim() === 'Código')
  return $table
    .find('tbody tr')
    .toArray()
    .map((row) => row.querySelectorAll('td')[column]?.textContent?.trim() ?? '')
}

/** The item of the list that names the application. */
function itemOf(title: string) {
  return cy.contains('a', title).closest('li')
}

/** Opens the menu of one item of P11, found by the name the menu carries for a screen reader. */
function openMenuOf(title: string) {
  cy.get(`[aria-label^="Ações de ${title}"]`).click()
  return cy.get('[role="menu"]').should('be.visible')
}

/**
 * An item of the open menu that stays there blocked, ready for an assertion on
 * the reason under its label. `match` keeps the item as the subject:
 * `have.attr` would hand the next assertion the value of `aria-disabled`, and
 * the reason would be searched for in it.
 */
function blockedMenuItem(label: string) {
  return cy.contains('[role="menuitem"]', label).should('match', '[aria-disabled="true"]')
}

/** The detail of a seeded application, reached through the list as a teacher would. */
function openDetailOf(title: string) {
  cy.visit('/aplicacoes')
  cy.contains('a', title).click()
  cy.contains('h1', title).should('be.visible')
}

/** Archives on the API the exam or class chosen in one of the form's selects, as another tab of the teacher would. */
function archiveChosenIn(label: 'Prova' | 'Turma', collection: '/exams' | '/classes') {
  cy.get<SignedInTeacher>('@teacher').then(({ accessToken }) => {
    cy.findByLabel(label)
      .invoke('val')
      .then((id) => apiAs(accessToken)('PATCH', `${collection}/${String(id)}/archive`))
  })
}

/** The application this test is on, to come back to it after a change, as the list leads there. */
function backToTheList() {
  cy.get('main').contains('a', 'Aplicações').click()
  cy.contains('h1', 'Aplicações').should('be.visible')
}

describe('lista de aplicações', () => {
  beforeEach(() => cy.visit('/aplicacoes'))

  it('lista as aplicações semeadas com a turma e a data', () => {
    cy.contains('h1', 'Aplicações').should('be.visible')
    itemOf(ALREADY_GENERATED).should('contain', 'Cálculo I — Noturno').and('contain', '05/10/2026')
  })

  it('distingue a que já foi gerada da que ainda não', () => {
    itemOf(ALREADY_GENERATED).should('contain', 'Gerada')
    itemOf(TO_GENERATE).should('contain', 'A gerar')
  })

  /** P11 tells, without opening anything, whether the students see the key and how far the correction went. */
  it('mostra em cada item se o gabarito foi publicado e o progresso da correção', () => {
    itemOf(ALREADY_GENERATED)
      .should('contain', 'Gabarito não publicado')
      .and('contain', `0 de ${ALREADY_GENERATED_SHEETS} folhas corrigidas`)
    itemOf(TO_GENERATE).should('not.contain', 'Gabarito').and('not.contain', 'folhas corrigidas')
  })

  it('mostra as aplicações mais recentes primeiro', () => {
    cy.get('[data-tour="list"] > li').should('have.length', 2)
    cy.get('[data-tour="list"] > li').then(($items) => {
      const titles = [...$items].map((item) => (item.textContent?.includes(TO_GENERATE) ? TO_GENERATE : ALREADY_GENERATED))
      expect(titles).to.deep.equal([TO_GENERATE, ALREADY_GENERATED])
    })
  })

  it('separa ativas de arquivadas', () => {
    itemOf(TO_GENERATE).contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()
    cy.contains('a', TO_GENERATE).should('not.exist')

    cy.chooseSegment('Arquivadas')
    cy.contains('a', TO_GENERATE).should('be.visible')
  })

  it('restaura o que foi arquivado', () => {
    itemOf(TO_GENERATE).contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()

    cy.chooseSegment('Arquivadas')
    itemOf(TO_GENERATE).contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.chooseSegment('Ativas')
    cy.contains('a', TO_GENERATE).should('be.visible')
  })

  it('distingue busca sem resultado de nenhuma aplicação ainda', () => {
    cy.get('[aria-label="Buscar aplicações"]').type('zzzz')

    cy.contains('h3', 'Nenhuma aplicação encontrada').should('be.visible')
    cy.contains('h3', 'Nenhuma aplicação ainda').should('not.exist')
  })

  /** The day is typed the way the list prints it, with or without the year. */
  it('acha a aplicação pela data como a tela mostra', () => {
    cy.get('[aria-label="Buscar aplicações"]').type('05/10')

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('not.exist')

    cy.get('[aria-label="Buscar aplicações"]').clear().type('12/11/2026')
    cy.contains('a', TO_GENERATE).should('be.visible')
    cy.contains('a', ALREADY_GENERATED).should('not.exist')
  })
})

/**
 * The class, exam and paper filters (#57) live in the URL beside the situation
 * of #158, so a filtered list survives a reload and can be sent as a link.
 */
describe('lista de aplicações: filtros', () => {
  beforeEach(() => cy.visit('/aplicacoes'))

  it('filtra por turma', () => {
    cy.findByLabel('Turma').should('contain', 'Física II').select('Física II')

    cy.contains('a', TO_GENERATE).should('be.visible')
    cy.contains('a', ALREADY_GENERATED).should('not.exist')
  })

  /** An application keeps its exam when the exam is archived later, so the archived ones are offered too. */
  it('filtra pela prova, oferecendo também as arquivadas', () => {
    cy.findByLabel('Prova').should('contain', 'Cálculo I — Prova 1 (2025/2) (arquivada)')
    cy.findByLabel('Prova').select(ALREADY_GENERATED)

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('not.exist')
  })

  it('filtra pela situação do PDF e mantém os filtros ao recarregar', () => {
    cy.findByLabel('Situação do PDF').select('Gerada')
    cy.contains('a', TO_GENERATE).should('not.exist')
    cy.location('search').should('contain', 'pdf=generated')

    cy.reload()

    cy.findByLabel('Situação do PDF').find('option:selected').should('have.text', 'Gerada')
    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('not.exist')
  })

  /** An archived application is closed whatever paper it had, so the filter would only empty the list. */
  it('só oferece a situação do PDF entre as ativas', () => {
    cy.contains('label', 'Situação do PDF').should('be.visible')

    cy.chooseSegment('Arquivadas')
    cy.contains('label', 'Situação do PDF').should('not.exist')

    cy.chooseSegment('Correção em andamento')
    cy.contains('label', 'Situação do PDF').should('not.exist')
  })

  it('explica quando nada passa pelos filtros e volta a tudo ao limpar', () => {
    cy.findByLabel('Turma').should('contain', 'Álgebra Linear').select('Álgebra Linear')

    cy.contains('h3', 'Nenhuma aplicação com esses filtros').should('be.visible')
    cy.get('main').contains('button', 'Limpar filtros').click()

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('be.visible')
    cy.location('search').should('not.contain', 'class=')
  })
})

/** What the specification lists for each item of P11: see the detail, generate, and correct. */
describe('lista de aplicações: menu de cada item', () => {
  beforeEach(() => cy.visit('/aplicacoes'))

  it('bloqueia corrigir antes de gerar, dizendo o motivo', () => {
    openMenuOf(TO_GENERATE)
    blockedMenuItem('Corrigir folhas').and('contain', 'Gere o PDF antes de corrigir as folhas.')
  })

  /** A blocked item and its reason reach the keyboard: the arrows stop on it, and Enter changes nothing. */
  it('deixa o item bloqueado ao alcance do teclado, sem executar nada', () => {
    cy.get(`[aria-label^="Ações de ${TO_GENERATE}"]`).focus().type('{enter}')
    cy.get('[role="menu"]').should('be.visible')

    cy.focused().type('{end}')
    cy.focused().should('contain', 'Corrigir folhas').and('contain', 'Gere o PDF antes de corrigir as folhas.')
    cy.focused().type('{enter}')

    cy.get('[role="menu"]').should('be.visible')
    cy.contains('h1', 'Aplicações').should('be.visible')
  })

  it('leva a gerar a prova, e cancelar volta para a lista', () => {
    openMenuOf(TO_GENERATE).contains('[role="menuitem"]', 'Gerar PDF').click()

    cy.contains('h1', `Gerar PDF — ${TO_GENERATE}`).should('be.visible')
    cy.contains('button', 'Cancelar').click()
    cy.contains('h1', 'Aplicações').should('be.visible')
  })

  it('leva à correção da aplicação gerada', () => {
    openMenuOf(ALREADY_GENERATED).contains('[role="menuitem"]', 'Corrigir folhas').click()

    cy.contains('h1', 'Enviar folhas de respostas').should('be.visible')
  })

  it('leva ao detalhe', () => {
    openMenuOf(ALREADY_GENERATED).contains('[role="menuitem"]', 'Ver detalhes').click()

    cy.contains('h2', 'Versões').should('be.visible')
  })
})

/**
 * The list pages on the server, 20 at a time. Twenty-one applications would
 * take a minute to create through the API, so the page is answered here, in
 * the shape the API answers it.
 */
describe('lista de aplicações: paginação', () => {
  it('pagina a lista em vez de cortar sem aviso', () => {
    const total = 21
    cy.intercept({ method: 'GET', pathname: '/api/applications' }, (req) => {
      const start = (Number(req.query.page ?? 1) - 1) * 20
      const items = Array.from({ length: Math.min(20, total - start) }, (_, index) => {
        const number = String(start + index + 1).padStart(2, '0')
        return {
          id: `application-${number}`,
          examId: 'exam-da-lista',
          classId: 'class-da-lista',
          teacherId: 'professor-da-lista',
          status: 'draft',
          date: `2026-12-${number}T12:00:00.000Z`,
          gradesReleased: false,
          examTitle: `Prova ${number}`,
          className: 'Turma da lista',
          progress: { versions: 0, publishedAnswerKeys: 0, sheets: 0, correctedSheets: 0, corrections: 0 },
        }
      })
      req.reply({ items, total })
    })
    cy.visit('/aplicacoes')
    cy.get('[aria-label^="Tour desta tela"]').contains('button', 'Pular').click()

    cy.contains('Mostrando 1–20 de 21').should('be.visible')
    cy.contains('a', 'Prova 21').should('not.exist')

    cy.contains('button', 'Próxima').click()
    cy.contains('a', 'Prova 21').should('be.visible')
    cy.contains('Mostrando 21–21 de 21').should('be.visible')
  })
})

/**
 * The filter lives in the URL: the panel's "Correções pendentes" card links to
 * it, and it has to survive a reload.
 */
describe('lista de aplicações: correção em andamento', () => {
  const FILTERED_URL = /^\/aplicacoes\?status=correction-in-progress$/

  it('explica que nada está em andamento quando nenhuma folha foi lida', () => {
    cy.visit('/aplicacoes')
    cy.chooseSegment('Correção em andamento')

    cy.contains('Nenhuma correção em andamento').should('be.visible')
    cy.contains('a', ALREADY_GENERATED).should('not.exist')
  })

  it('guarda a escolha na URL', () => {
    cy.visit('/aplicacoes')
    cy.chooseSegment('Correção em andamento')

    cy.location().should((location) => expect(location.pathname + location.search).to.match(FILTERED_URL))
  })

  it('lista só a aplicação com folha lida esperando nota', () => {
    cy.readFirstSheetOf(ALREADY_GENERATED)
    cy.visit('/aplicacoes')
    cy.chooseSegment('Correção em andamento')

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('not.exist')
  })

  it('continua filtrada depois de recarregar a página', () => {
    cy.readFirstSheetOf(ALREADY_GENERATED)
    cy.visit('/aplicacoes?status=correction-in-progress')

    cy.contains('label', 'Correção em andamento').find('input[type="radio"]').should('be.checked')
    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.reload()
    cy.contains('label', 'Correção em andamento').find('input[type="radio"]').should('be.checked')
    cy.contains('a', ALREADY_GENERATED).should('be.visible')
  })

  it('volta à lista normal ao escolher Ativas', () => {
    cy.visit('/aplicacoes?status=correction-in-progress')
    cy.chooseSegment('Ativas')

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('a', TO_GENERATE).should('be.visible')
  })

  it('abre a lista normal quando a URL traz um filtro desconhecido', () => {
    cy.visit('/aplicacoes?status=nonsense')

    cy.contains('a', ALREADY_GENERATED).should('be.visible')
    cy.contains('label', 'Ativas').find('input[type="radio"]').should('be.checked')
  })
})

describe('criar aplicação', () => {
  beforeEach(() => {
    cy.visit('/aplicacoes')
    cy.contains('a', 'Nova aplicação').click()
    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  it('exige prova e turma', () => {
    cy.findByLabel('Prova').should('contain', ALREADY_GENERATED)
    cy.contains('button', 'Salvar e gerar').click()

    cy.get('[role="alert"]').should('have.length.at.least', 1)
  })

  it('cria e segue direto para gerar, dizendo qual aplicação é', () => {
    cy.findByLabel('Prova').should('contain', 'Álgebra Linear — Prova 1').select('Álgebra Linear — Prova 1')
    cy.findByLabel('Turma').select('Álgebra Linear')
    cy.contains('button', 'Salvar e gerar').click()

    cy.contains('h1', 'Gerar PDF — Álgebra Linear — Prova 1').should('be.visible')
  })

  it('oferece apenas provas e turmas ativas', () => {
    cy.findByLabel('Prova').should('contain', ALREADY_GENERATED).and('not.contain', 'Cálculo I — Prova 1 (2025/2)')
    cy.findByLabel('Turma').should('contain', 'Cálculo I — Noturno').and('not.contain', 'Cálculo I — Matutino')
  })

  /** The same exam, to the same class, on the same day is one sitting; the server refuses a second one. */
  it('recusa a mesma prova para a mesma turma no mesmo dia', () => {
    cy.findByLabel('Prova').should('contain', ALREADY_GENERATED).select(ALREADY_GENERATED)
    cy.findByLabel('Turma').select('Cálculo I — Noturno')
    cy.findByLabel('Data da aplicação').clear().type('2026-10-05')
    cy.contains('button', 'Salvar e gerar').click()

    cy.get('[role="alert"]').should('contain', 'Já existe uma aplicação com estes dados.')
    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  /**
   * The form offers only active exams and classes, but either can be archived
   * in another tab while the form is open. The server checks again (RF20),
   * and the screen says what to do instead of failing silently.
   */
  it('recusa a prova arquivada depois de aberto o formulário, dizendo o que fazer', () => {
    cy.findByLabel('Prova').should('contain', LINEAR_ALGEBRA_EXAM).select(LINEAR_ALGEBRA_EXAM)
    cy.findByLabel('Turma').select('Álgebra Linear')
    archiveChosenIn('Prova', '/exams')
    cy.contains('button', 'Salvar e gerar').click()

    cy.get('[role="alert"]').should('contain', 'Esta prova está arquivada. Restaure a prova antes de aplicá-la.')
    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  it('recusa a turma arquivada depois de aberto o formulário, dizendo o que fazer', () => {
    cy.findByLabel('Prova').should('contain', LINEAR_ALGEBRA_EXAM).select(LINEAR_ALGEBRA_EXAM)
    cy.findByLabel('Turma').select('Álgebra Linear')
    archiveChosenIn('Turma', '/classes')
    cy.contains('button', 'Salvar e gerar').click()

    cy.get('[role="alert"]').should('contain', 'Esta turma está arquivada. Restaure a turma antes de aplicar uma prova a ela.')
    cy.contains('h1', 'Nova aplicação').should('be.visible')
  })

  /**
   * #160: what is created and printed lives on the API, so a browser with
   * nothing stored still shows it. The browser is wiped only after the
   * detail shows the sheets, when the generation has finished.
   */
  it('mostra a aplicação criada e gerada mesmo depois de limpar o navegador', () => {
    cy.findByLabel('Prova').should('contain', LINEAR_ALGEBRA_EXAM).select(LINEAR_ALGEBRA_EXAM)
    cy.findByLabel('Turma').select('Álgebra Linear')
    cy.contains('button', 'Salvar e gerar').click()
    cy.contains('h1', `Gerar PDF — ${LINEAR_ALGEBRA_EXAM}`).should('be.visible')
    cy.contains('button', 'Gerar PDF').click()
    cy.contains(`${LINEAR_ALGEBRA_SHEETS} folhas prontas para imprimir`, { timeout: 20000 }).should('be.visible')
    sheetTable().find('tbody tr').should('have.length', LINEAR_ALGEBRA_SHEETS)

    cy.clearLocalStorage()
    cy.reload()

    cy.contains('h1', LINEAR_ALGEBRA_EXAM).should('be.visible')
    sheetTable().find('tbody tr').should('have.length', LINEAR_ALGEBRA_SHEETS)
  })
})

describe('gerar a prova', () => {
  beforeEach(() => {
    openDetailOf(TO_GENERATE)
    cy.contains('a', 'Gerar PDF').click()
    cy.contains('h1', `Gerar PDF — ${TO_GENERATE}`).should('be.visible')
  })

  it('diz qual aplicação está sendo gerada', () => {
    cy.contains('Física II · 12/11/2026').should('be.visible')
  })

  /** The physics quiz keeps its questions in order and shuffles the alternatives (RF17). */
  it('herda o embaralhamento da prova em cada versão', () => {
    cy.get('[aria-label="Embaralhar questões da versão 1"]').should('not.be.checked')
    cy.get('[aria-label="Embaralhar alternativas da versão 1"]').should('be.checked')
  })

  /** RF22: each version is printed with its own choice, and the detail says which. */
  it('embaralha cada versão do seu jeito', () => {
    cy.get('[aria-label="Quantas versões"]').clear().type('2')
    cy.get('[aria-label="Embaralhar alternativas da versão 2"]').uncheck()
    cy.contains('button', 'Gerar PDF').click()

    cy.contains(`${TO_GENERATE_SHEETS} folhas prontas para imprimir`, { timeout: 20000 }).should('be.visible')
    cy.contains('li', 'Versão 1').should('contain', 'alternativas embaralhadas')
    cy.contains('li', 'Versão 2').should('contain', 'alternativas na ordem')
  })

  it('gera uma folha por aluno, cada uma com um código próprio', () => {
    cy.contains('button', 'Gerar PDF').click()
    cy.contains(`${TO_GENERATE_SHEETS} folhas prontas para imprimir`, { timeout: 20000 }).should('be.visible')

    sheetTable().find('tbody tr').should('have.length', TO_GENERATE_SHEETS)
    sheetTable().then(($table) => {
      const codes = codesOf($table)
      expect(new Set(codes).size).to.equal(codes.length)
    })
  })

  /** P13 was opened on the detail, so going back lands there and not on the whole list (#57). */
  it('volta para o detalhe ao cancelar', () => {
    cy.contains('button', 'Cancelar').click()

    cy.contains('h1', TO_GENERATE).should('be.visible')
    cy.contains('h2', 'Versões').should('be.visible')
  })
})

describe('gerar de novo', () => {
  it('avisa antes de substituir o papel que já existe', () => {
    openDetailOf(ALREADY_GENERATED)
    cy.contains('button', 'Ações').click()
    cy.contains('[role="menuitem"]', 'Regenerar PDF').click()

    cy.get('[role="status"]').should('contain', 'substitui')
    cy.contains('button', 'Gerar de novo').should('be.visible')
  })

  /**
   * RF24: every sheet comes back with a new code, so the old paper stops
   * leading anywhere; the public lookup refusing the old code is covered in
   * `public-lookup.cy.ts`. The codes before are kept in a variable, since an
   * alias of the table would be read again after the change.
   */
  it('troca o código de todas as folhas ao gerar de novo', () => {
    openDetailOf(ALREADY_GENERATED)
    sheetTable().find('tbody tr').should('have.length', ALREADY_GENERATED_SHEETS)

    sheetTable().then(($table) => {
      const before = codesOf($table)

      cy.contains('button', 'Ações').click()
      cy.contains('[role="menuitem"]', 'Regenerar PDF').click()
      cy.contains('button', 'Gerar de novo').click()
      cy.location('pathname', { timeout: 20000 }).should('match', /^\/aplicacoes\/[^/]+$/)

      sheetTable({ timeout: 10000 }).should(($after) => {
        const after = codesOf($after)
        expect(after, 'folhas depois de gerar de novo').to.have.length(before.length)
        expect(after.filter((code) => before.includes(code)), 'códigos antigos que continuam').to.deep.equal([])
      })
    })
  })

  /**
   * A correction points at the version it was read from, so once a sheet is
   * corrected the paper cannot change, and the menu says why before anyone
   * opens P13. The correction is written on the API, where the rule reads it.
   */
  it('bloqueia gerar de novo depois de uma folha corrigida, dizendo o motivo', () => {
    printForTheTeacher().then(({ accessToken, applicationId, examTitle, sheet }) => {
      cy.recordCorrection(accessToken, { applicationId, answerSheetId: sheet.id, answers: [], finalize: false })
      openDetailOf(examTitle)
    })

    cy.contains('button', 'Ações').click()
    blockedMenuItem('Regenerar PDF').and('contain', 'Uma folha desta aplicação já foi corrigida.')
  })
})

describe('detalhe da aplicação', () => {
  beforeEach(() => openDetailOf(ALREADY_GENERATED))

  it('diz qual prova, turma e dia, e em que situação está', () => {
    cy.contains('Cálculo I — Noturno · 05/10/2026').should('be.visible')
    cy.get('main').contains('Gerada').should('be.visible')
  })

  /** The file is the one the server drew for this application, not a fixed sample. */
  it('baixa o PDF gerado pelo servidor', () => {
    cy.intercept({ method: 'GET', pathname: /^\/api\/applications\/[^/]+\/pdf$/ }).as('pdf')
    cy.contains(`${ALREADY_GENERATED_SHEETS} folhas prontas para imprimir`).should('be.visible')

    cy.contains('button', 'Baixar PDF').click()

    cy.wait('@pdf').then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.headers['content-type']).to.contain('application/pdf')
      expect(response?.headers['content-disposition']).to.contain('prova-2026-10-05.pdf')
    })
  })

  it('não oferece baixar quando nada foi gerado', () => {
    openDetailOf(TO_GENERATE)

    cy.contains('a', 'Gerar PDF').should('be.visible')
    cy.contains('button', 'Baixar PDF').should('not.exist')
  })

  it('mostra as versões e as folhas geradas', () => {
    cy.contains('h2', 'Versões').should('be.visible')
    cy.contains('li', 'Versão 2').should('be.visible')
    cy.contains('h2', 'Folhas').should('be.visible')
    sheetTable().find('tbody tr').should('have.length', ALREADY_GENERATED_SHEETS)
  })

  /** Publishing shows students something, so it asks first; taking the key back only hides it. */
  it('pede confirmação para publicar o gabarito de uma versão e despublica sem pedir', () => {
    cy.get('[aria-label="Publicar gabarito da versão 1"]').click()
    cy.findInDialog('h2', 'Publicar o gabarito da versão 1?').should('be.visible')
    cy.findInDialog('button', 'Publicar gabarito').click()

    cy.contains('li', 'Versão 1').should('contain', 'Gabarito publicado')
    cy.contains('li', 'Versão 2').should('not.contain', 'Gabarito publicado')

    cy.get('[aria-label="Despublicar gabarito da versão 1"]').click()
    cy.contains('li', 'Versão 1').should('not.contain', 'Gabarito publicado')
  })

  it('publica o gabarito de todas as versões de uma vez', () => {
    cy.contains('button', 'Publicar todos').click()
    cy.findInDialog('h2', 'Publicar o gabarito de todas as versões?').should('be.visible')
    cy.findInDialog('button', 'Publicar todos').click()

    cy.contains('li', 'Versão 1').should('contain', 'Gabarito publicado')
    cy.contains('li', 'Versão 2').should('contain', 'Gabarito publicado')
    cy.contains('button', 'Publicar todos').should('not.exist')
  })

  it('só libera as notas depois de publicar o gabarito de todas as versões', () => {
    cy.contains('button', 'Liberar notas').should('be.disabled')
    cy.contains('Publique o gabarito de todas as versões antes de liberar as notas.').should('be.visible')
  })

  /**
   * Each change is left through the app's own link rather than `cy.visit`: the
   * write is asynchronous, and reloading while it is in flight throws it away.
   * The single reload at the end proves the choice was stored, not only cached.
   */
  it('libera as notas depois de confirmar e recolhe sem pedir', () => {
    cy.contains('button', 'Publicar todos').click()
    cy.findInDialog('button', 'Publicar todos').click()
    cy.contains('li', 'Versão 2').should('contain', 'Gabarito publicado')

    cy.contains('button', 'Liberar notas').click()
    cy.findInDialog('h2', 'Liberar as notas?').should('be.visible')
    cy.findInDialog('button', 'Liberar notas').click()
    cy.contains('button', 'Recolher notas').should('be.visible')

    backToTheList()
    itemOf(ALREADY_GENERATED).should('contain', 'Notas liberadas').and('contain', 'Gabarito publicado')

    cy.contains('a', ALREADY_GENERATED).click()
    cy.contains('button', 'Recolher notas').click()
    cy.contains('button', 'Liberar notas').should('be.visible')
    backToTheList()
    itemOf(ALREADY_GENERATED).should('not.contain', 'Notas liberadas')

    cy.reload()
    itemOf(ALREADY_GENERATED).should('not.contain', 'Notas liberadas')
  })

  /** New versions are born with the key unpublished, and a grade never shows without its key (RF46). */
  it('bloqueia gerar de novo com as notas liberadas, dizendo o motivo no menu', () => {
    cy.contains('button', 'Publicar todos').click()
    cy.findInDialog('button', 'Publicar todos').click()
    cy.contains('li', 'Versão 2').should('contain', 'Gabarito publicado')
    cy.contains('button', 'Liberar notas').click()
    cy.findInDialog('button', 'Liberar notas').click()
    cy.contains('button', 'Recolher notas').should('be.visible')

    cy.contains('button', 'Ações').click()
    blockedMenuItem('Regenerar PDF').and('contain', 'Recolha as notas antes de gerar de novo.')
  })

  /** After generating only the date changes (#163): the printed sheets belong to this exam and this class. */
  it('edita a data, mantendo a prova e a turma', () => {
    cy.contains('button', 'Ações').click()
    cy.contains('[role="menuitem"]', 'Editar data').click()
    cy.findInDialog('h2', 'Editar a data').should('be.visible')
    cy.findByLabel('Data da aplicação').clear().type('2026-10-20')
    cy.findInDialog('button', 'Salvar data').click()

    cy.contains('Cálculo I — Noturno · 20/10/2026').should('be.visible')
    cy.contains('h1', ALREADY_GENERATED).should('be.visible')
  })

  /** Archived, it shows students nothing new until it is restored, and the screen says so once. */
  it('fica só para leitura quando arquivada, até restaurar', () => {
    cy.contains('button', 'Ações').click()
    cy.contains('[role="menuitem"]', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()

    cy.contains('Esta aplicação está arquivada').should('be.visible')
    cy.contains('button', 'Publicar todos').should('not.exist')
    cy.contains('button', 'Liberar notas').should('be.disabled')
    cy.contains('button', 'Ações').click()
    blockedMenuItem('Editar data').and('contain', 'Restaure a aplicação para editar a data.')
    cy.focused().type('{esc}')

    cy.get('main').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()
    cy.contains('Esta aplicação está arquivada').should('not.exist')
    cy.contains('button', 'Publicar todos').should('be.visible')
  })

  it('mostra o progresso da correção, contando só as folhas corrigidas', () => {
    cy.contains(`0 de ${ALREADY_GENERATED_SHEETS} folhas corrigidas`).should('be.visible')
    cy.contains('a', 'Corrigir folhas').should('be.visible')
  })

  it('bloqueia corrigir antes de gerar, dizendo o motivo', () => {
    openDetailOf(TO_GENERATE)

    cy.contains('button', 'Corrigir folhas').should('be.disabled')
    cy.contains('Gere o PDF antes de corrigir as folhas.').should('be.visible')
  })
})

/** Another teacher's application answers "not found", never its data (`docs/Seguranca_e_LGPD.md`, section 2). */
describe('isolamento entre professoras', () => {
  it('não mostra a aplicação de outra professora, nem pelo endereço', () => {
    openDetailOf(ALREADY_GENERATED)
    cy.location('pathname').then((pathname) => {
      cy.signInAsNewTeacher()
      cy.visit(pathname)
    })

    cy.contains('Aplicação não encontrada.').should('be.visible')
    cy.contains('h2', 'Versões').should('not.exist')
  })
})
