/**
 * The browser tab shows the Correctio icon instead of the browser's blank page,
 * and the phone's home screen gets the same icon when the site is saved there.
 */
describe('aba do navegador', () => {
  beforeEach(() => cy.visit('/entrar'))

  it('mostra o nome do sistema', () => {
    cy.title().should('eq', 'Correctio')
  })

  it('aponta para ícones que existem, no tamanho da aba e no da tela inicial do celular', () => {
    for (const selector of ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="icon"][sizes="32x32"]', 'link[rel="apple-touch-icon"]']) {
      cy.get(selector)
        .invoke('attr', 'href')
        .then((href) => {
          expect(href).to.be.a('string')
          cy.request(href ?? '').its('status').should('eq', 200)
        })
    }
  })
})
