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
| 2 | **Lint** (regras de `tooling/eslint/`, mais o idioma dos comentários) | houver erro de ESLint, função acima dos limites de complexidade ou comentário que não seja JSDoc |
| 3 | **Verificação de tipos** (`tsc --noEmit`) | houver erro de tipo |
| 4 | **Testes unitários + cobertura** (inclui os testes das regras de lint, com `node:test`, e os da API contra um MySQL de verdade, que aplicam as migrations num banco vazio) | algum teste falhar ou a cobertura de código novo ficar abaixo de 80% |
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
| Merge em `main` | publica só o front no **GitHub Pages** (`pages.yml`), para teste: sem API nem banco, como na N1 |
| Release do dia (`release.yml`) | portão completo; **publicação em produção** (projeto `correctio-app`) depois da aprovação da PM; tag e notas só com a produção respondendo |
| "Preview link" (`preview.yml`), sob demanda | publica qualquer branch, pelo nome ou pelo número do PR, na **pré-produção**, no projeto `correctio-app-preview`, num link próprio que expira em 7 dias e é comentado no PR |
| "Republish a version" (`republish.yml`), sob demanda | põe de volta em produção uma versão já lançada, também com aprovação da PM: o caminho de volta quando uma release dá errado |

**Só a PM põe algo em produção.** Qualquer pessoa do time pode iniciar a release, mas o job que
publica roda no ambiente `production` do GitHub, que tem a PM como revisora obrigatória: a execução
para depois do portão e só segue quando ela aprova, na própria página da execução. A tag `vX.Y.Z`
é criada por último, depois que a produção respondeu 200, então o número de uma versão sempre é o
que está no ar.

**Produção só recebe versão numerada.** A produção, no Firebase, acompanha a release do dia
(`docs/Versionamento.md`). O GitHub Pages continua recebendo o front de cada merge, como na N1, para
testar tela rápido; a pré-produção é onde se testa com API e banco.

**Front e API no mesmo endereço.** O Firebase Hosting serve o front e encaminha `/api/**` para a
função `api` (Cloud Functions, Node 22, região `us-west1`, perto do banco). Sem chamada entre
origens, o navegador não precisa de CORS, e cada link de pré-produção fala com a API do próprio
projeto.

**A ordem de uma publicação** (`deploy.yml`, usado pelos três gatilhos acima):

1. `npm ci` e build do front e da API
2. migrations no banco do ambiente, antes da versão nova entrar no ar (migration só acrescenta,
   então a versão em execução continua funcionando)
3. publicação da API e depois do front, para o front novo nunca chamar uma API antiga
4. `GET /api/health` no endereço publicado: qualquer resposta diferente de 200 reprova a publicação

Duas publicações no mesmo ambiente nunca rodam juntas. Na pré-produção os links são por branch,
mas a API é uma só: a da última branch publicada.

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

**Todo workflow que roda `npm test` sobe um MySQL.** O teste do schema da API falha na CI sem
banco, de propósito: um teste de contrato pulado é por onde passaria uma coluna renomeada. O
`pr.yml`, o `checks.yml` e o `release.yml` têm o mesmo serviço `mysql`.

**Nenhuma chave de conta de serviço.** O GitHub prova ao Google qual repositório está pedindo
(Workload Identity Federation) e recebe um token de poucos minutos. Não há chave para vazar nem
para trocar.

**No Firebase o corpo da requisição chega lido.** O runtime das Functions lê e interpreta o corpo
antes do Express, com limite próprio de 10 MB, e o `express.json` não reaplica o dele. O limite de
100 KB fica em `middlewares/body-limit.ts`, que mede o corpo já lido.

**Segredos e variáveis:**

| Onde | O quê |
|---|---|
| Secrets do repositório | `SONAR_TOKEN`, `CYPRESS_RECORD_KEY` |
| Ambientes `production` e `preview` do GitHub, secrets | `DATABASE_URL` e `DATABASE_CA_CERT` do banco daquele ambiente, usados pelas migrations |
| Ambientes `production` e `preview` do GitHub, variáveis | `FIREBASE_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT` |
| Secret Manager de cada projeto Firebase | `DATABASE_URL`, `DATABASE_CA_CERT`, `DATA_ENCRYPTION_KEY`, lidos pela API em execução |

O mesmo nome em cada ambiente: o job declara `environment: production` ou `environment: preview`
e recebe o conjunto certo. O ambiente `production` só aceita execuções da `main` e exige a
aprovação da PM.

---

## 6. O que existe em cada fase

| Fase | Fluxo |
|---|---|
| **N1** | Lint, tipos, testes unitários com cobertura, build, Sonar e publicação no GitHub Pages. O Cypress entra assim que houver fluxo navegável para testar. |
| **N2** | Mesmo fluxo, mais os testes do back-end e as migrações do banco. Publicação passa a incluir a API, no Firebase: produção a cada release, pré-produção sob demanda. |
| **N3** | Acrescenta verificação de acessibilidade automatizada (RNF11) e auditoria de dependências como bloqueio, não como aviso. |

---

## 7. Configuração fora do repositório

Os workflows existem em `.github/workflows/`, mas parte do portão depende de configuração
na interface do GitHub, que nenhum arquivo versionado consegue ligar:

| Item | Onde | Situação |
|---|---|---|
| `SONAR_TOKEN` | Settings → Secrets | ✅ cadastrado |
| `CYPRESS_RECORD_KEY` | Settings → Secrets | ✅ cadastrado |
| Proteção da `main` | Settings → Rules | ✅ ligada |
| Projetos Firebase `correctio-app` e `correctio-app-preview`, no plano Blaze | console do Firebase, conta `correctioapp@gmail.com` | ✅ |
| Workload Identity Federation e conta de serviço do deploy, em cada projeto | Google Cloud, IAM | ✅ |
| Segredos da API no Secret Manager de cada projeto | Google Cloud, Secret Manager | ✅ |
| Ambientes `production` (só `main`, PM como revisora obrigatória) e `preview` | Settings → Environments | ✅ |
| Tags de versão `v*` não podem ser movidas nem apagadas (só a admin passa por cima) | Settings → Rules, "release tags" | ✅ |
| GitHub Pages publicando o front da `main`, para teste | Settings → Pages, fonte GitHub Actions | ✅ |

> **Workflow sob demanda só aparece depois de estar na `main`.** O GitHub lista em Actions apenas
> os workflows que existem na branch padrão, então o "Preview link" e o "Republish a version"
> ficam disponíveis a partir do merge que os cria.
