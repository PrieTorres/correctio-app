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

1. Confirme que a `main` está verde e publicada.
2. Rode o workflow **Release do dia** (aba Actions → Run workflow) informando a versão, por exemplo `0.4.0`.
3. O workflow roda o portão de qualidade inteiro, fixa a versão nos `package.json`, cria a tag `v0.4.0` e publica a release com as notas geradas a partir dos PRs mergeados desde a tag anterior.

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

Em `package.json` na raiz e em `apps/web/package.json`, mantidos em sincronia pelo workflow. **Ninguém edita a versão à mão** — quem faz isso é o workflow, para que a tag, o commit e o manifesto nunca divirjam.

## 5. Estado atual

**`0.0.0`** — fundação. Estrutura, portão de qualidade, camada de dados e a primeira tela funcionando. Ver o plano de execução para os próximos passos.
