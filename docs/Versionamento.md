# Versionamento e Releases — Correctio

Como a versão do projeto evolui e como as entregas do time são agrupadas. Atende à issue #7.

---

## 1. A regra

O projeto segue **SemVer** (`MAIOR.MENOR.CORREÇÃO`), com uma leitura própria do que cada número significa aqui:

| Faixa | Significado |
|---|---|
| **0.0.x** | Fundação. O sistema ainda não faz nada de ponta a ponta. |
| **0.x.0** | Cada tela ou fluxo que passa a funcionar de verdade com `localStorage`. |
| **1.0.0** | **Tudo que foi planejado funcionando com `localStorage`.** É a entrega da N1. |
| **2.0.0** | Telas ligadas ao MySQL, sem nenhum dado simulado. Entrega da N2. |
| **3.0.0** | Escopo completo com validações e casos de borda. Entrega da N3. |

A troca de maior acompanha a fase da disciplina porque cada uma muda a fonte de dados por baixo — é uma quebra real de arquitetura, não um detalhe interno.

Enquanto a versão começar com `0.`, vale a regra do SemVer: **nada é estável e qualquer coisa pode mudar**. É exatamente a situação das próximas semanas, e é honesto sinalizar isso.

### O que faz subir cada número

- **CORREÇÃO** (`0.3.0` → `0.3.1`): conserto de bug, ajuste de texto, refatoração sem mudança de comportamento.
- **MENOR** (`0.3.1` → `0.4.0`): tela nova funcionando, fluxo novo, requisito atendido.
- **MAIOR** (`0.9.0` → `1.0.0`): virada de fase, conforme a tabela acima.

## 2. Como chegar em 1.0.0

A versão sobe conforme os passos do plano de execução são concluídos. Cada tela que sai do estado de espaço reservado e passa a funcionar com dados reais rende uma versão menor.

O critério para declarar **1.0.0** é objetivo — não é "parece pronto":

- [ ] As 25 telas navegam entre si conforme a seção 8 do documento de requisitos
- [ ] Todos os fluxos previstos funcionam com `localStorage`, sem tela de espaço reservado
- [ ] O conjunto de dados de demonstração cobre todas as telas
- [ ] Portão de qualidade passando: lint, tipos, cobertura ≥ 80% nas regras críticas, Cypress e Sonar
- [ ] Sistema publicado e acessível pelo link do GitHub Pages

Faltando qualquer item, continua `0.x`.

## 3. Release do dia

As entregas são agrupadas em **uma release por dia de trabalho**, e não uma por Pull Request.

**Por quê:** com cinco pessoas mergeando ao longo do dia, uma release por PR vira ruído e ninguém lê. Uma por dia produz uma lista legível do que o time entregou naquela data — que é exatamente a evidência que o diário individual precisa.

### Como sair

**Release do dia:** os PRs do dia não vão direto para a `main`. Eles se juntam numa branch isolada, `release/AAAA-MM-DD`, e só ela entra na `main`, pela PM, ao final do dia.

1. A PM roda **"0. Start the day's release"** (aba Actions → Run workflow), que cria `release/AAAA-MM-DD` a partir da `main`.
2. Cada PR do dia aponta para essa branch (campo *base* do PR), com o mesmo portão e a mesma aprovação da `main`.
3. Quando o primeiro PR entra, abre-se o PR da release para a `main`. Daí em diante, o workflow "Release pull request" lista nele o `Closes #N` de cada PR do dia: o GitHub só fecha issue com merge na `main`, então é esse PR que fecha todas.

**Pré-versão:**

1. Rode **"1. Pre-release: publish to pre-production"** com `release/AAAA-MM-DD`. A PM aprova em "Review deployments", e a pré-versão do dia sobe no **link fixo** da pré-produção, `https://correctio-app-preview.web.app`, com API e banco próprios.
2. Testem no link. Achou problema, corrige por PR na release do dia e publica a pré de novo. (Uma branch qualquer também pode ser publicada para teste: ganha um link próprio, e a pré-produção guarda só os 10 mais recentes.)
3. Ao final do dia, a PM marca o PR da release como pronto e mergeia na `main`.

**Versão oficial:**

1. Rode **"2. Release: publish to production"** informando a versão, por exemplo `1.2.0`.
2. O workflow recusa uma versão que já existe e roda o portão de qualidade inteiro.
3. **A PM aprova a publicação** na página da execução ("Review deployments"). Sem a aprovação dela, nada vai para produção e nenhuma tag é criada.
4. O workflow **publica em produção** (`https://correctio-app.web.app`) exatamente o commit que passou no portão e, com a produção respondendo, cria a tag `v1.2.0` e a release com as notas geradas a partir dos PRs mergeados desde a tag anterior. Se a publicação falhar, nenhuma tag é criada: corrija e rode de novo com a mesma versão.

Nenhuma release sai de código que não passa no portão — é a mesma barreira do merge, aplicada de novo antes de publicar.

### Notas de release legíveis

As notas são geradas a partir dos **títulos dos Pull Requests**, então o título do PR é o texto que a equipe e a professora vão ler. Vale escrever pensando nisso.

O projeto usa Conventional Commits nos títulos de PR e nos commits:

| Prefixo | Uso |
|---|---|
| `feat:` | funcionalidade nova |
| `fix:` | correção de bug |
| `docs:` | documentação |
| `refactor:` | mudança interna sem alterar comportamento |
| `test:` | testes |
| `chore:` | build, dependências, configuração |

## 4. Onde a versão vive

**Na tag e na release**, criadas pelo workflow. A `main` só aceita mudança por Pull Request, então a release não faz commit: ela marca com a tag o commit que passou no portão. O campo `version` dos `package.json` fica parado e não é lido por nada do app; a versão publicada é sempre a da tag. **Ninguém cria tag à mão** — quem faz isso é o workflow, para que tag, release e produção nunca divirjam.

## 5. Estado atual

**`1.1.0`** — primeira release com tag: a N1 completa mais a infraestrutura da N2 (API, banco MySQL e publicação no Firebase), ainda sem telas ligadas ao banco. A `2.0.0` sai na entrega da N2.
