/**
 * The tour runs by itself once per screen and per browser, never all at once,
 * and never on a screen with nothing on it: an empty state teaches better than
 * a caption pointing at a table with no rows. Finishing it, skipping it,
 * closing it on the X or with Esc are all final; only the help of the screen
 * the teacher is on opens it again.
 */
const TOUR = '[aria-label^="Tour desta tela"]'
const tour = () => cy.get(TOUR)

describe('tour guiado', () => {
  it('aparece na primeira visita de uma tela com conteúdo', () => {
    cy.visit('/turmas')

    tour().should('be.visible')
    tour().should('contain', 'Nova turma')
  })

  it('diz em que passo está, além de mostrar', () => {
    cy.visit('/turmas')

    tour().should('contain', 'Passo 1 de 3')
  })

  it('avança até o fim e fecha', () => {
    cy.visit('/turmas')

    tour().contains('button', 'Próximo').click()
    tour().contains('button', 'Próximo').click()
    tour().should('contain', 'Passo 3 de 3')
    tour().contains('button', 'Entendi').click()

    tour().should('not.exist')
  })

  it('não volta a aparecer na mesma tela depois de pular', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()

    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    tour().should('not.exist')
  })

  it('não volta a aparecer depois de fechar no X', () => {
    cy.visit('/turmas')
    tour().find('button[aria-label="Fechar o tour"]').click()

    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    tour().should('not.exist')
  })

  it('não volta a aparecer depois de concluído', () => {
    cy.visit('/aplicacoes')
    tour().contains('button', 'Próximo').click()
    tour().contains('button', 'Entendi').click()

    cy.visit('/aplicacoes')

    cy.contains('h1', 'Aplicações').should('be.visible')
    tour().should('not.exist')
  })

  /** Sign-out leaves the preference behind: it belongs to the browser, not to the session. */
  it('continua dispensado depois de sair e entrar de novo', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()
    cy.contains('button', 'Sair').click()
    cy.location('pathname').should('eq', '/entrar')

    cy.get<{ email: string; password: string }>('@teacher').then(({ email, password }) => {
      cy.findByLabel('E-mail').type(email)
      cy.findByLabel('Senha').type(password)
      cy.contains('button', /^Entrar$/).click()
    })
    cy.location('pathname').should('eq', '/painel')
    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    tour().should('not.exist')
  })

  it('aparece de novo em outra tela, não tudo de uma vez', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()

    cy.visit('/questoes')

    tour().should('contain', 'Nova questão')
  })

  it('fecha pelo Escape', () => {
    cy.visit('/turmas')

    cy.get('body').type('{esc}')

    tour().should('not.exist')
  })

  it('reabre pelo ícone de interrogação ao lado do título', () => {
    cy.visit('/questoes')
    tour().contains('button', 'Pular').click()
    tour().should('not.exist')

    cy.get('button[aria-label="Ver o tour desta tela"]').click()

    tour().should('contain', 'Nova questão')
  })

  it('reabre só o tour da tela atual pela ajuda do menu', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()

    cy.get('[aria-label="Navegação principal"]').contains('button', 'Ajuda desta tela').click()

    cy.get(TOUR).should('contain', 'Nova turma').and('contain', 'Passo 1 de 3')
  })

  it('reabre pelo botão de ajuda do celular', () => {
    cy.viewport('iphone-x')
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()

    cy.get('button[aria-label="Ajuda: rever o tour desta tela"]').click()

    cy.get(TOUR).should('contain', 'Nova turma')
  })

  it('reabrir não faz o tour voltar sozinho depois', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()
    cy.get('button[aria-label="Ver o tour desta tela"]').click()
    tour().contains('button', 'Pular').click()

    cy.visit('/turmas')

    cy.contains('h1', 'Turmas').should('be.visible')
    tour().should('not.exist')
  })

  it('dá a cada tela o seu próprio ícone de ajuda', () => {
    cy.visit('/provas')
    cy.get('button[aria-label="Ver o tour desta tela"]').should('be.visible')

    cy.visit('/aplicacoes')
    cy.get('button[aria-label="Ver o tour desta tela"]').should('be.visible')
  })

  /** A step that says what to click has to show which one. */
  it('destaca o elemento de que o passo está falando', () => {
    cy.visit('/provas')

    cy.get('[data-tour="create"]').should('have.class', 'tour-target')
  })

  it('move o destaque ao avançar de passo', () => {
    cy.visit('/provas')
    cy.get('[data-tour="create"]').should('have.class', 'tour-target')

    tour().contains('button', 'Próximo').click()

    cy.get('[data-tour="create"]').should('not.have.class', 'tour-target')
    cy.get('[data-tour="generate"]').should('have.class', 'tour-target')
  })

  it('tira o destaque ao fechar', () => {
    cy.visit('/provas')
    tour().contains('button', 'Pular').click()

    cy.get('[data-tour="create"]').should('not.have.class', 'tour-target')
  })

  it('deixa voltar um passo', () => {
    cy.visit('/provas')
    tour().contains('button', 'Próximo').click()
    tour().should('contain', 'Passo 2 de 3')

    tour().contains('button', 'Voltar').click()

    tour().should('contain', 'Passo 1 de 3')
  })

  it('não oferece voltar no primeiro passo', () => {
    cy.visit('/provas')

    tour().contains('button', 'Voltar').should('not.exist')
  })

  /** Everything the steps of the generator point at is inside its dialog, so the tour is too: in front of the overlay and reachable. */
  it('mostra o tour do gerador dentro do diálogo, e usá-lo não fecha o diálogo', () => {
    cy.visit('/provas/gerar')

    cy.get('[role="dialog"]').within(() => {
      tour().should('contain', 'Escolha as tags').and('be.visible')
      tour().contains('button', 'Próximo').click()
      tour().contains('button', 'Entendi').click()
      tour().should('not.exist')
    })
    cy.get('[role="dialog"]').should('be.visible')
  })

  /** The form tour opens when the bank arrives, which is often while the title is being typed. */
  it('não tira o cursor de quem está digitando quando abre sozinho', () => {
    const title = 'Prova digitada enquanto o tour abre'
    cy.visit('/provas/nova')
    cy.findByLabel('Título').type(title)

    tour().should('be.visible')
    cy.findByLabel('Título').should('have.value', title).and('be.focused')
  })

  it('abre o tour no formulário de questão, no primeiro uso', () => {
    cy.visit('/questoes/nova')

    tour().should('contain', 'Marque qual alternativa é a correta')
    cy.get('[data-tour="correct"]').should('have.class', 'tour-target')
  })

  /** Six screens had a help button that opened nothing; the detail of an application was one of them. */
  it('reabre pelo ícone de ajuda no detalhe da aplicação', () => {
    cy.visit('/aplicacoes/application-calculus-midterm')
    tour().contains('button', 'Pular').click()

    cy.get('button[aria-label="Ver o tour desta tela"]').click()

    cy.get(TOUR).should('contain', 'Baixe o PDF aqui')
  })

  /** An empty screen already explains itself, and better. */
  it('não aparece em tela vazia', () => {
    cy.clearCookies()
    cy.signInAsNewTeacher({ withSampleData: false })

    cy.visit('/turmas')

    tour().should('not.exist')
    cy.contains('h3', 'Nenhuma turma').should('be.visible')
  })
})
