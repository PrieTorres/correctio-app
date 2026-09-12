/**
 * The tour runs on the first visit to each screen, never all at once, and
 * never on a screen with nothing on it — an empty state teaches better than a
 * caption pointing at a table with no rows.
 */
const tour = () => cy.get('[role="region"][aria-label^="Tour desta tela"]')

describe('tour guiado', () => {
  beforeEach(() => {
    cy.clearLocalStorage('correctio:v1:tour-seen')
  })

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

  it('não volta a aparecer na mesma tela', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()

    cy.visit('/turmas')

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

  it('volta em todas as telas depois de rever pelo perfil', () => {
    cy.visit('/turmas')
    tour().contains('button', 'Pular').click()
    cy.visit('/questoes')
    tour().contains('button', 'Pular').click()

    cy.visit('/perfil')
    cy.contains('button', 'Rever o tour').click()

    cy.visit('/turmas')
    tour().should('be.visible')
    cy.visit('/questoes')
    tour().should('be.visible')
  })

  /** An empty screen already explains itself, and better. */
  it('não aparece em tela vazia', () => {
    cy.visit('/turmas')
    cy.contains('button', 'Limpar').click()

    cy.visit('/turmas')

    tour().should('not.exist')
    cy.contains('h3', 'Nenhuma turma').should('be.visible')
  })
})
