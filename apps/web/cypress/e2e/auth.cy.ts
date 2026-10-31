import { TEST_PASSWORD, uniqueEmail, type SignedInTeacher } from '../support/commands'

/** The refresh cookie of the API and the only path it is sent to (`apps/api/src/lib/session-cookie.ts`). */
const SESSION_COOKIE = '__session'
const SESSION_COOKIE_PATH = '/api/auth'

/**
 * Screens C1, C2 and C3 against the API (#40): real accounts, real passwords,
 * the block after repeated failures and the session guard. The teacher the
 * support file signed up is `@teacher`; these tests start signed out of it.
 */
describe('autenticação', () => {
  beforeEach(() => {
    cy.clearCookies()
  })

  function signInThroughForm(email: string, password: string): void {
    cy.findByLabel('E-mail').clear().type(email)
    cy.findByLabel('Senha').clear().type(password)
    cy.contains('button', /^Entrar$/).click()
  }

  it('cria uma conta e vai para o painel', () => {
    cy.visit('/criar-conta')
    cy.contains('h1', 'Criar conta').should('be.visible')

    cy.findByLabel('Nome completo').type('Bianca Souza')
    cy.findByLabel('E-mail').type(uniqueEmail('cadastro'))
    cy.findByLabel('Senha').type(TEST_PASSWORD)
    cy.findByLabel('Confirmar senha').type(TEST_PASSWORD)
    cy.contains('button', 'Criar conta').click()

    cy.location('pathname').should('eq', '/painel')
    cy.get('[aria-label="Navegação principal"]').should('contain', 'Bianca Souza')
  })

  it('avisa no próprio campo quando o e-mail já tem conta', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/criar-conta')
      cy.findByLabel('Nome completo').type('Outra Pessoa')
      cy.findByLabel('E-mail').type(email)
      cy.findByLabel('Senha').type(TEST_PASSWORD)
      cy.findByLabel('Confirmar senha').type(TEST_PASSWORD)
      cy.contains('button', 'Criar conta').click()

      cy.findByLabel('E-mail').should('have.attr', 'aria-invalid', 'true')
      cy.contains('[role="alert"]', 'Este e-mail já tem uma conta').should('be.visible')
      cy.location('pathname').should('eq', '/criar-conta')
    })
  })

  it('exige senha de pelo menos 8 caracteres no cadastro', () => {
    cy.visit('/criar-conta')
    cy.findByLabel('Nome completo').type('Bianca Souza')
    cy.findByLabel('E-mail').type(uniqueEmail('curta'))
    cy.findByLabel('Senha').type('curta12')
    cy.findByLabel('Confirmar senha').type('curta12')
    cy.contains('button', 'Criar conta').click()

    cy.contains('A senha precisa ter ao menos 8 caracteres').should('be.visible')
    cy.location('pathname').should('eq', '/criar-conta')
  })

  it('avisa quando a confirmação de senha não bate', () => {
    cy.visit('/criar-conta')
    cy.contains('h1', 'Criar conta').should('be.visible')

    cy.findByLabel('Nome completo').type('Ana Ribeiro')
    cy.findByLabel('E-mail').type(uniqueEmail('confirma'))
    cy.findByLabel('Senha').type(TEST_PASSWORD)
    cy.findByLabel('Confirmar senha').type('outra-senha-1')
    cy.contains('button', 'Criar conta').click()

    cy.contains('As senhas não coincidem').should('be.visible')
    cy.location('pathname').should('eq', '/criar-conta')
  })

  it('faz login e vai para o painel', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/entrar')
      cy.contains('h1', 'Entrar').should('be.visible')

      signInThroughForm(email, TEST_PASSWORD)

      cy.location('pathname').should('eq', '/painel')
    })
  })

  /** Saying which of the two was wrong would tell a stranger which addresses have an account. */
  it('dá a mesma mensagem para senha errada e para e-mail sem conta', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/entrar')

      signInThroughForm(email, 'senha-errada-1')
      cy.contains('[role="alert"]', 'E-mail ou senha incorretos.').should('be.visible')

      signInThroughForm(uniqueEmail('ninguem'), TEST_PASSWORD)
      cy.contains('[role="alert"]', 'E-mail ou senha incorretos.').should('be.visible')
      cy.location('pathname').should('eq', '/entrar')
    })
  })

  /** RNF04 and RNF12: five failures in 15 minutes block the address and e-mail, and the screen says how long. */
  it('bloqueia depois de 5 tentativas erradas e diz quanto esperar', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/entrar')

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        signInThroughForm(email, `chute-errado-${attempt}`)
        cy.contains('[role="alert"]', 'E-mail ou senha incorretos.').should('be.visible')
        cy.contains('button', /^Entrar$/).should('not.be.disabled')
      }
      signInThroughForm(email, TEST_PASSWORD)

      cy.contains('[role="alert"]', 'Aguarde 15 minutos').should('be.visible')
      cy.location('pathname').should('eq', '/entrar')
    })
  })

  it('manda para o login quem abre uma tela sem sessão, e volta para ela depois de entrar', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/turmas')

      cy.location('pathname').should('eq', '/entrar')
      signInThroughForm(email, TEST_PASSWORD)

      cy.location('pathname').should('eq', '/turmas')
    })
  })

  it('sai da conta e não deixa voltar sem entrar de novo', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/entrar')
      signInThroughForm(email, TEST_PASSWORD)
      cy.location('pathname').should('eq', '/painel')

      cy.contains('button', 'Sair').click()
      cy.location('pathname').should('eq', '/entrar')

      cy.visit('/painel')
      cy.location('pathname').should('eq', '/entrar')
    })
  })

  /**
   * RF04: "Sair de todos os dispositivos" ends the sessions of other devices
   * too, which leaving this browser alone would not prove. The other device is
   * a session signed in through the API, whose refresh cookie is set aside
   * before this browser signs in, and offered again once everything ended.
   */
  it('encerra também a sessão de outro aparelho ao sair de todos os dispositivos', () => {
    cy.get<SignedInTeacher>('@teacher').then(({ email }) => {
      cy.request('POST', '/api/auth/login', { email, password: TEST_PASSWORD })
      cy.getCookie(SESSION_COOKIE).then((cookie) => {
        const otherDevice = cookie?.value
        if (otherDevice === undefined) throw new Error('O login pela API não deixou a sessão no cookie.')
        cy.clearCookies()

        cy.visit('/entrar')
        signInThroughForm(email, TEST_PASSWORD)
        cy.location('pathname').should('eq', '/painel')
        cy.visit('/perfil')
        cy.contains('button', 'Sair de todos os dispositivos').click()
        cy.location('pathname').should('eq', '/entrar')

        cy.setCookie(SESSION_COOKIE, otherDevice, { path: SESSION_COOKIE_PATH, httpOnly: true, sameSite: 'strict' })
        cy.getCookie(SESSION_COOKIE).should('have.property', 'value', otherDevice)
        cy.request({ method: 'POST', url: '/api/auth/refresh', failOnStatusCode: false }).its('status').should('eq', 401)
      })
    })
  })

  /** Whoever signs in next on the same computer may be someone else, so the page the last person left from is forgotten. */
  it('depois de sair de propósito, entrar de novo leva ao painel e não à tela de onde saiu', () => {
    cy.get<{ email: string }>('@teacher').then(({ email }) => {
      cy.visit('/entrar')
      signInThroughForm(email, TEST_PASSWORD)
      cy.location('pathname').should('eq', '/painel')
      cy.get('[aria-label="Navegação principal"]').contains('a', 'Turmas').click()
      cy.location('pathname').should('eq', '/turmas')

      cy.contains('button', 'Sair').click()
      cy.location('pathname').should('eq', '/entrar')
      signInThroughForm(email, TEST_PASSWORD)

      cy.location('pathname').should('eq', '/painel')
    })
  })

  it('navega entre a tela de login e a de cadastro', () => {
    cy.visit('/entrar')
    cy.contains('h1', 'Entrar').should('be.visible')

    cy.contains('a', 'Criar conta').click()
    cy.location('pathname').should('eq', '/criar-conta')

    cy.contains('a', 'Entrar').click()
    cy.location('pathname').should('eq', '/entrar')
  })

  /** RNF11: a link is as wide as its words, but the finger needs 44 px of height to land on it. */
  function expectTouchHeight(label: string): void {
    cy.contains('a', label)
      .should('be.visible')
      .invoke('outerHeight')
      .should('be.gte', 44)
  }

  it('dá 44 px de altura aos links das telas de acesso', () => {
    cy.visit('/entrar')
    expectTouchHeight('Esqueci minha senha')
    expectTouchHeight('Criar conta')

    cy.visit('/criar-conta')
    expectTouchHeight('Entrar')

    cy.visit('/recuperar-senha')
    expectTouchHeight('Voltar para entrar')
  })

  describe('com o Google', () => {
    it('oferece entrar com o Google', () => {
      cy.visit('/entrar')

      cy.contains('button', 'Entrar com o Google').should('be.visible')
    })

    /** The suite's API has no Google client, which is the path a broken configuration takes too. */
    it('volta para o login com um aviso quando o Google não conclui', () => {
      cy.visit('/entrar')
      cy.contains('button', 'Entrar com o Google').click()

      cy.location('pathname').should('eq', '/entrar')
      cy.contains('[role="alert"]', 'Não foi possível entrar com o Google').should('be.visible')
    })
  })

  describe('recuperação de senha', () => {
    /** RF03: the answer never says whether the address has an account. */
    it('responde igual para e-mail com e sem conta', () => {
      cy.get<{ email: string }>('@teacher').then(({ email }) => {
        for (const address of [email, uniqueEmail('sem-conta')]) {
          cy.visit('/recuperar-senha')
          cy.findByLabel('E-mail').type(address)
          cy.contains('button', 'Enviar link de recuperação').click()

          cy.contains('[role="status"]', 'Se houver uma conta com esse e-mail').should('be.visible')
        }
      })
    })

    it('abre a etapa de nova senha pelo link, tira o código do endereço e recusa um link inválido', () => {
      cy.visit('/redefinir-senha?codigo=codigo-que-nao-existe')

      cy.contains('h1', 'Redefinir senha').should('be.visible')
      cy.location('search').should('eq', '')
      cy.findByLabel('Senha nova').type('senha-nova-123')
      cy.findByLabel('Confirmar senha nova').type('senha-nova-123')
      cy.contains('button', 'Redefinir senha').click()

      cy.contains('[role="alert"]', 'inválido ou já foi usado').should('be.visible')
    })

    it('explica o que fazer quando o endereço não traz o código', () => {
      cy.visit('/redefinir-senha')

      cy.contains('[role="alert"]', 'não traz o código').should('be.visible')
      cy.contains('a', 'Pedir um link novo').click()
      cy.location('pathname').should('eq', '/recuperar-senha')
    })

    it('confere a confirmação da senha nova antes de enviar', () => {
      cy.visit('/redefinir-senha?codigo=qualquer')
      cy.findByLabel('Senha nova').type('senha-nova-123')
      cy.findByLabel('Confirmar senha nova').type('outra-senha-123')
      cy.contains('button', 'Redefinir senha').click()

      cy.contains('As senhas não coincidem').should('be.visible')
    })

    it('recusa um e-mail malformado sem dizer que enviou o link', () => {
      cy.visit('/recuperar-senha')
      cy.findByLabel('E-mail').type('ana@')
      cy.contains('button', 'Enviar link de recuperação').click()

      cy.contains('Informe um e-mail válido').should('be.visible')
      cy.contains('[role="status"]', 'Se houver uma conta com esse e-mail').should('not.exist')
    })

    it('exige ao menos 8 caracteres na senha nova', () => {
      cy.visit('/redefinir-senha?codigo=qualquer')
      cy.findByLabel('Senha nova').type('curta12')
      cy.findByLabel('Confirmar senha nova').type('curta12')
      cy.contains('button', 'Redefinir senha').click()

      cy.contains('A senha precisa ter ao menos 8 caracteres').should('be.visible')
      cy.location('pathname').should('eq', '/redefinir-senha')
    })

    /**
     * A valid code only exists in the e-mail, and the suite has no inbox to
     * read it from, so the API's answer is stubbed: the screen still has to
     * send the code of its link with the new password, and confirm on the
     * sign-in. The real API refusing a used or unknown link is the scenario
     * above.
     */
    it('envia o código do link com a senha nova e confirma no login', () => {
      cy.intercept('POST', '/api/auth/reset-password', { statusCode: 204 }).as('reset')
      cy.visit('/redefinir-senha?codigo=codigo-do-email')
      cy.findByLabel('Senha nova').type('senha-nova-123')
      cy.findByLabel('Confirmar senha nova').type('senha-nova-123')
      cy.contains('button', 'Redefinir senha').click()

      cy.wait('@reset').its('request.body').should('deep.equal', { code: 'codigo-do-email', password: 'senha-nova-123' })
      cy.location('pathname').should('eq', '/entrar')
      cy.contains('Senha redefinida. Entre com a senha nova.').should('be.visible')
    })
  })
})

/**
 * The page shown while the session is restored, before any screen exists: the
 * brand in the middle of the page and what is happening, never a line of text
 * in the corner of an empty page. The restore is slowed down, or refused by
 * the server, so the page stays long enough to be seen.
 */
describe('abrindo a sessão', () => {
  it('mostra a marca e o aviso no meio da tela enquanto a sessão abre', () => {
    cy.intercept('POST', '/api/auth/refresh', (req) => {
      req.on('response', (res) => {
        res.setDelay(1500)
      })
    })
    cy.visit('/painel')

    cy.contains('[role="status"]', 'Abrindo sua sessão…').should('be.visible')
    cy.contains('p', 'Correctio').should('be.visible')
    cy.contains('h1', 'Painel', { timeout: 10000 }).should('be.visible')
  })

  it('diz quando não conseguiu abrir a sessão e oferece tentar de novo', () => {
    cy.intercept('POST', '/api/auth/refresh', { statusCode: 500, body: { code: 'FAILURE', message: 'Erro inesperado.' } })
    cy.visit('/painel')

    cy.contains('[role="alert"]', 'Não foi possível abrir sua sessão', { timeout: 20000 }).should('be.visible')
    cy.contains('button', 'Tentar de novo').should('be.visible')
  })
})
