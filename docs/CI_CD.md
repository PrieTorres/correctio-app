# CI/CD e Portão de Qualidade — Correctio

Como todo Pull Request é verificado antes de poder ser mergeado, e como o sistema é publicado. Atende **RNF08** (testes), **RNF18** (dependências) e **RNF20** (qualidade contínua).

---

## 1. Por que isso existe

A regra da disciplina é explícita: a nota individual só reconhece o que está **mergeado e presente no sistema hospedado**. Código em PR aberto, ou mergeado quebrado, não conta.

O portão de qualidade transforma isso em algo automático, em vez de depender de alguém lembrar de conferir. Com cinco pessoas trabalhando em paralelo nas mesmas 25 telas, é também o que impede um merge de derrubar o sistema publicado na véspera da entrega.

---

## 2. O que roda em todo Pull Request

| # | Verificação | Bloqueia o merge se |
|---|---|---|
| 1 | **Instalação** (`npm ci`, Node fixado) | o lockfile estiver inconsistente |
| 2 | **Lint** | houver erro de ESLint |
| 3 | **Verificação de tipos** (`tsc --noEmit`) | houver erro de tipo |
| 4 | **Testes unitários + cobertura** | algum teste falhar ou a cobertura de código novo ficar abaixo de 80% |
| 5 | **Build de produção** | o build quebrar |
| 6 | **Testes E2E (Cypress)** | algum fluxo principal falhar |
| 7 | **Auditoria de dependências** | houver vulnerabilidade alta ou crítica |
| 8 | **SonarCloud** | o portão de qualidade reprovar |

Os passos 2 a 4 rodam em paralelo — não faz sentido esperar o lint para descobrir que um teste quebrou. O E2E depende do build, então vem depois.

### Portão do SonarCloud

Avaliado sobre **código novo** (o que o PR adiciona ou altera), não sobre o repositório inteiro. É o comportamento padrão e o correto: um PR pequeno não deve ser reprovado por dívida antiga.

| Métrica no código novo | Mínimo |
|---|---|
| Cobertura | 80% |
| Linhas duplicadas | ≤ 3% |
| Problemas novos de severidade alta | 0 |
| Confiabilidade, segurança e manutenibilidade | nota A |

---

## 3. Proteção da branch principal

Configuração no GitHub, sem a qual o portão acima é decorativo — bastaria fazer push direto:

- Merge em `main` **somente por Pull Request**
- Pelo menos **1 aprovação** de outra pessoa do grupo
- **Todas as verificações precisam passar** antes do botão de merge liberar
- Push direto em `main` **bloqueado para todos**
- Branch atualizada com a `main` antes do merge

Efeito colateral bem-vindo: os prints de PR aprovado que o diário individual exige (C4) passam a existir naturalmente, com as verificações visíveis no próprio PR.

---

## 4. Publicação

| Gatilho | O que acontece |
|---|---|
| Pull Request aberto ou atualizado | portão de qualidade completo, sem publicar nada |
| Merge em `main` | portão completo + publicação no GitHub Pages |

Na N1 a publicação é o site estático no GitHub Pages, com o `index.html` copiado para `404.html` para as rotas funcionarem. Depois, Firebase Hosting — a troca é do passo de publicação, não do resto do fluxo.

---

## 5. Detalhes que costumam dar trabalho

**A cobertura mede lógica, não tela.** O `coverage.include` do vitest e o
`sonar.coverage.exclusions` precisam apontar para o mesmo conjunto de arquivos. Se
divergirem, o portão reprova com a suíte verde — foi exatamente o que aconteceu na primeira
execução: o vitest media 100% de `src/lib` e o Sonar via 64% porque contava as telas junto.
Componentes seguem analisados para bugs e duplicação; só ficam fora da métrica de cobertura,
porque quem os cobre é o Cypress.

**A cobertura é medida só nos testes unitários.** Somar a cobertura do Cypress exige instrumentar o build com Istanbul, juntar os relatórios e manter isso funcionando — muito custo para pouco ganho. O Cypress é um portão de **passa ou não passa**: os fluxos principais funcionam de ponta a ponta, sim ou não. Quem responde pela métrica de cobertura é o teste unitário, e é lá que as regras críticas (cálculo de nota, embaralhamento, geração de PDF, leitura da folha) precisam estar cobertas.

**O Cypress precisa da aplicação servida.** Não adianta rodar contra o código-fonte: sobe o build de produção, espera a porta responder, roda os testes, derruba. Rodar contra o servidor de desenvolvimento esconde justamente os problemas que só aparecem no build.

**O Sonar precisa do histórico completo.** O checkout padrão traz um commit só, e sem histórico o Sonar não consegue identificar o que é código novo — o portão passa a avaliar o repositório inteiro e reprova tudo. Precisa de checkout com histórico completo.

**Cancelar execuções superadas.** Sem isso, cada push em um PR enfileira uma execução nova enquanto a anterior ainda roda. Agrupar por PR e cancelar a anterior deixa o retorno mais rápido.

**Node fixado em um lugar só.** A versão vem do `.nvmrc` e o CI lê de lá. Duas fontes divergem em algumas semanas, e aí o build passa na máquina de alguém e falha no CI.

**Cache das dependências.** `npm ci` sem cache é o passo mais lento do fluxo inteiro.

**Segredos necessários:** apenas o token do SonarCloud. Publicação no GitHub Pages usa a credencial do próprio Actions.

---

## 6. O que existe em cada fase

| Fase | Fluxo |
|---|---|
| **N1** | Lint, tipos, testes unitários com cobertura, build, Sonar e publicação no GitHub Pages. O Cypress entra assim que houver fluxo navegável para testar. |
| **N2** | Mesmo fluxo, mais os testes do back-end e as migrações do banco. Publicação passa a incluir a API. |
| **N3** | Acrescenta verificação de acessibilidade automatizada (RNF11) e auditoria de dependências como bloqueio, não como aviso. |

---

## 7. Ainda não implementado

Os arquivos de workflow **não existem no repositório**, e é proposital: sem `package.json`, um workflow que roda `npm ci` reprovaria todo PR desde o primeiro. Eles entram junto com a fundação do projeto, na primeira issue de código da N1 — antes de qualquer tela, para que o portão já esteja valendo quando as cinco pessoas começarem a abrir PRs em paralelo.
