/**
 * Classes and students on the API (P3, the P4 modal and P5).
 *
 * Every test starts as a new teacher whose sample classes and students were
 * created on the API (`signInAsNewTeacher`), so these flows run through the
 * routes, the query cache and the repositories, the way production does.
 */

/** What the app shows for any server failure, whatever the server said: the detail stays in the API log. */
const SERVER_DOWN = 'Não foi possível falar com o servidor. Tente de novo em instantes.'

const FAILURE = { statusCode: 500, body: { code: 'failure', message: 'Erro inesperado.' } }

/** Opens a class from the list by its name, through the app's own link. */
function openClass(name: string): void {
  cy.visit('/turmas')
  cy.contains('a', name).click()
  cy.contains('h1', name).should('be.visible')
}

function pasteStudentList(lines: readonly string[]): void {
  cy.contains('button', 'Importar alunos').click()
  cy.findByLabel('Nome, matrícula e e-mail').type(lines.join('{enter}'))
}

describe('turmas', () => {
  it('lista as turmas semeadas', () => {
    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    cy.contains('Cálculo I — Noturno').should('be.visible')
  })

  it('cria uma turma e mostra na lista', () => {
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Estatística I')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
    cy.contains('button', 'Salvar').click()

    cy.contains('Estatística I').should('be.visible')
  })

  it('arquiva uma turma e a encontra no filtro de arquivadas', () => {
    cy.visit('/turmas')

    cy.contains('Física II')
      .closest('li')
      .within(() => {
        cy.contains('button', 'Arquivar').click()
      })

    cy.findInDialog('button', 'Arquivar').click()

    cy.contains('Física II').should('not.exist')

    cy.chooseSegment('Arquivadas')
    cy.contains('Física II').should('be.visible')
  })

  it('abre o detalhe da turma e lista os alunos', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('Ana Beatriz Moreira').should('be.visible')
    cy.contains('h2', 'Alunos (12)').should('be.visible')
  })

  it('cadastra um aluno sem e-mail, porque o campo é opcional', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Rafael Nunes')
    cy.findByLabel('Matrícula').type('2026099')
    cy.findInDialog('button', 'Adicionar').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('li', 'Rafael Nunes').should('be.visible')
  })

  it('recusa um e-mail malformado, que é diferente de não informar', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Rafael Nunes')
    cy.findByLabel('Matrícula').type('2026099')
    cy.findByLabel('E-mail (opcional)').type('rafael@')
    cy.findInDialog('button', 'Adicionar').click()

    cy.contains('E-mail inválido').should('be.visible')
  })

  it('mostra a matrícula repetida no campo Matrícula', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Outra Ana')
    cy.findByLabel('Matrícula').type('202601')
    cy.findInDialog('button', 'Adicionar').click()

    cy.findByLabel('Matrícula').should('have.attr', 'aria-invalid', 'true')
    cy.findInDialog('p', 'A matrícula 202601 já existe nesta turma.').should('be.visible')
  })

  it('anonimiza um aluno preservando o registro', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('li', 'Ana Beatriz Moreira').within(() => {
      cy.contains('button', 'Anonimizar').click()
    })
    cy.findInDialog('button', 'Anonimizar').click()

    cy.contains('Ana Beatriz Moreira').should('not.exist')
    cy.contains('Aluno anonimizado').should('be.visible')
  })

  /** Removing keeps the record and its grades on the API (RF09); the class list just stops showing the student. */
  it('remove um aluno da turma', () => {
    openClass('Cálculo I — Noturno')

    cy.contains('li', 'Bruno Carvalho Lima').within(() => {
      cy.contains('button', 'Remover').click()
    })
    cy.findInDialog('button', 'Remover').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('Bruno Carvalho Lima').should('not.exist')
    cy.contains('h2', 'Alunos (11)').should('be.visible')
  })

  /** RNF14: a class of another teacher answers 404 on the API, and the screen treats it as missing. */
  it('trata a turma de outro professor como inexistente', () => {
    cy.visit('/turmas')
    cy.contains('a', 'Física II')
      .invoke('attr', 'href')
      .then((href) => {
        cy.signInAsNewTeacher({ withSampleData: false })
        cy.visit(String(href))
      })

    cy.contains('Turma não encontrada.').should('be.visible')
  })
})

describe('turmas: importação de alunos', () => {
  it('importa uma lista colada e mostra o que entrou e o que foi ignorado', () => {
    openClass('Álgebra Linear')

    pasteStudentList([
      'Nome;Matrícula;E-mail',
      'Rafaela Souza;2027901;rafaela@exemplo.edu.br',
      'Ana Beatriz Moreira;202701',
      'Tiago Prado;2027902',
    ])

    cy.findInDialog('h3', '3 alunos prontos para importar').should('be.visible')
    cy.findInDialog('a', 'Aviso de privacidade').should('be.visible')
    cy.findInDialog('button', 'Importar 3 alunos').click()

    cy.findInDialog('h3', 'Importação concluída').should('be.visible')
    cy.get('[role="dialog"]')
      .should('contain', '2 alunos entraram na turma.')
      .and('contain', '1 foi ignorado porque a matrícula já estava na turma.')
    cy.findInDialog('button', 'Fechar').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('li', 'Rafaela Souza').should('be.visible')
    cy.contains('h2', 'Alunos (10)').should('be.visible')
  })

  /** The API refuses the whole list over one row it cannot store, so the preview leaves that row out and says why. */
  it('aponta na prévia o e-mail malformado e não o envia', () => {
    cy.intercept('POST', '/api/classes/*/students/import').as('import')
    openClass('Álgebra Linear')

    pasteStudentList(['Rafaela Souza;2027901;rafaela@', 'Tiago Prado;2027902'])

    cy.findInDialog('li', 'Linha 1: E-mail inválido.').should('be.visible')
    cy.findInDialog('h3', '1 aluno pronto para importar').should('be.visible')
    cy.findInDialog('button', 'Importar 1 aluno').click()

    cy.wait('@import').its('request.body.rows').should('deep.equal', [{ fullName: 'Tiago Prado', registration: '2027902' }])
    cy.findInDialog('h3', 'Importação concluída').should('be.visible')
  })

  it('mostra o erro da API sem fechar a importação', () => {
    cy.intercept('POST', '/api/classes/*/students/import', FAILURE)
    openClass('Álgebra Linear')

    pasteStudentList(['Tiago Prado;2027902'])
    cy.findInDialog('button', 'Importar 1 aluno').click()

    cy.get('[role="dialog"]').should('contain', SERVER_DOWN)
    cy.findInDialog('button', 'Importar 1 aluno').should('be.visible')
  })
})

describe('turmas: erros da API na tela', () => {
  it('mostra o erro ao salvar uma turma', () => {
    cy.intercept('POST', '/api/classes', FAILURE)
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Estatística I')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
    cy.findInDialog('button', 'Salvar').click()

    cy.get('[role="dialog"]').should('contain', SERVER_DOWN)
  })

  it('mantém o diálogo de arquivar aberto, com o erro', () => {
    cy.intercept('PATCH', '/api/classes/*/archive', FAILURE)
    cy.visit('/turmas')

    cy.contains('li', 'Física II').contains('button', 'Arquivar').click()
    cy.findInDialog('button', 'Arquivar').click()

    cy.get('[role="dialog"]').should('contain', 'Arquivar esta turma?').and('contain', SERVER_DOWN)
  })

  it('mantém o diálogo de restaurar aberto, com o erro', () => {
    cy.intercept('PATCH', '/api/classes/*/restore', FAILURE)
    cy.visit('/turmas')

    cy.chooseSegment('Arquivadas')
    cy.contains('li', 'Cálculo I — Matutino').contains('button', 'Restaurar').click()
    cy.findInDialog('button', 'Restaurar').click()

    cy.get('[role="dialog"]').should('contain', 'Restaurar esta turma?').and('contain', SERVER_DOWN)
  })

  /** Under "Matrícula" the message would send the teacher to fix a field that has nothing wrong. */
  it('mostra a falha ao cadastrar aluno abaixo do formulário, e não no campo Matrícula', () => {
    cy.intercept('POST', '/api/classes/*/students', FAILURE)
    openClass('Cálculo I — Noturno')

    cy.contains('button', 'Adicionar aluno').click()
    cy.findByLabel('Nome completo').type('Rafael Nunes')
    cy.findByLabel('Matrícula').type('2026099')
    cy.findInDialog('button', 'Adicionar').click()

    cy.get('[role="dialog"]').should('contain', SERVER_DOWN)
    cy.findByLabel('Matrícula').should('not.have.attr', 'aria-invalid')
  })

  it('mantém o diálogo de remover aberto, com o erro, e o aluno na lista', () => {
    cy.intercept('DELETE', '/api/classes/*/students/*', FAILURE)
    openClass('Cálculo I — Noturno')

    cy.contains('li', 'Bruno Carvalho Lima').contains('button', 'Remover').click()
    cy.findInDialog('button', 'Remover').click()

    cy.get('[role="dialog"]').should('contain', SERVER_DOWN)
    cy.findInDialog('button', 'Cancelar').click()
    cy.contains('li', 'Bruno Carvalho Lima').should('be.visible')
  })

  it('mantém o diálogo de anonimizar aberto, com o erro', () => {
    cy.intercept('POST', '/api/classes/*/students/*/anonymize', FAILURE)
    openClass('Cálculo I — Noturno')

    cy.contains('li', 'Ana Beatriz Moreira').contains('button', 'Anonimizar').click()
    cy.findInDialog('button', 'Anonimizar').click()

    cy.get('[role="dialog"]').should('contain', SERVER_DOWN)
  })

  /** An empty class and an unreachable server ask for opposite things, so they cannot look alike. */
  it('mostra erro, e não turma vazia, quando os alunos não carregam', () => {
    cy.intercept({ method: 'GET', pathname: /^\/api\/classes\/[^/]+\/students$/ }, FAILURE)
    openClass('Cálculo I — Noturno')

    cy.contains('Não foi possível carregar os alunos.').should('be.visible')
    cy.contains('button', 'Tentar de novo').should('be.visible')
    cy.contains('Nenhum aluno nesta turma').should('not.exist')
  })
})

describe('turmas: busca e paginação no servidor', () => {
  it('aceita a mesma turma em outro período, que é o semestre seguinte', () => {
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Cálculo I — Noturno')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2027/1')
    cy.findInDialog('button', 'Salvar').click()

    cy.get('[role="dialog"]').should('not.exist')
  })

  it('recusa uma turma com os mesmos dados de outra', () => {
    cy.visit('/turmas')

    cy.contains('button', 'Nova turma').click()
    cy.findByLabel('Nome da turma').type('Cálculo I — Noturno')
    cy.findByLabel('Disciplina').type('Matemática')
    cy.findByLabel('Período').type('2026/2')
    cy.findInDialog('button', 'Salvar').click()

    cy.contains('Já existe uma turma com estes dados').should('be.visible')
  })

  it('busca por nome e por disciplina sem acento', () => {
    cy.visit('/turmas')

    cy.get('[aria-label="Buscar turmas"]').type('calculo')
    cy.contains('Cálculo I — Noturno').should('be.visible')
    cy.contains('Física II').should('not.exist')

    cy.get('[aria-label="Buscar turmas"]').clear().type('matematica')
    cy.contains('Álgebra Linear').should('be.visible')
    cy.contains('Física II').should('not.exist')
  })

  /** One request when typing pauses, not one per letter: each would be a round trip to the API. */
  it('busca só quando a pessoa para de digitar', () => {
    cy.intercept({ method: 'GET', pathname: '/api/classes' }).as('list')
    cy.visit('/turmas')
    cy.contains('Cálculo I — Noturno').should('be.visible')

    cy.get('[aria-label="Buscar turmas"]').type('fisica')
    cy.contains('Cálculo I — Noturno').should('not.exist')
    cy.contains('Física II').should('be.visible')

    cy.get<{ request: { url: string } }[]>('@list.all').then((calls) => {
      const searches = calls
        .map((call) => new URL(call.request.url).searchParams.get('search'))
        .filter((search) => search !== null)
      expect(searches).to.include('fisica')
      expect(searches.filter((search) => search !== 'fisica'), 'searches for part of the word').to.deep.equal([])
    })
  })

  /** Fifty-one classes from the API, so the list has a second page to reach without creating them all. */
  it('pagina quando há mais turmas do que cabem numa página', () => {
    const total = 51
    cy.intercept({ method: 'GET', pathname: '/api/classes' }, (req) => {
      const start = (Number(req.query.page ?? 1) - 1) * 50
      const items = Array.from({ length: Math.min(50, total - start) }, (_, index) => {
        const number = String(start + index + 1).padStart(2, '0')
        return {
          id: `turma-${number}`,
          teacherId: 'professor-da-lista',
          name: `Turma ${number}`,
          subject: 'Matemática',
          term: '2026/2',
          status: 'active',
          inviteCode: `CODE${number}`,
        }
      })
      req.reply({ items, total })
    })
    cy.visit('/turmas')
    cy.get('[aria-label^="Tour desta tela"]').contains('button', 'Pular').click()

    cy.contains('Mostrando 1–50 de 51').should('be.visible')
    cy.contains('a', 'Turma 51').should('not.exist')

    cy.contains('button', 'Próxima').click()
    cy.contains('a', 'Turma 51').should('be.visible')
    cy.contains('Mostrando 51–51 de 51').should('be.visible')

    cy.contains('button', 'Anterior').click()
    cy.contains('a', 'Turma 01').should('be.visible')
  })
})
