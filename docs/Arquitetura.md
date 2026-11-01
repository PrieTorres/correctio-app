# Decisões de Arquitetura — Correctio

Registro das decisões técnicas e do porquê de cada uma. A fonte da verdade de requisitos e telas é [Correctio_Requisitos_e_Telas.md](Correctio_Requisitos_e_Telas.md); o desenho de segurança está em [Seguranca_e_LGPD.md](Seguranca_e_LGPD.md).

---

## 1. Front-end: React, não Next.js

**Decisão: React com Vite.**

O decisor não foi o front — foi o back-end, já fixado pela disciplina: **Node.js + Express + MySQL em arquitetura em camadas** (`rota → controle → serviço → repositório → model`). Isso remove do Next.js exatamente aquilo que justifica adotá-lo.

| O que o Next.js oferece | Vale aqui? |
|---|---|
| Renderização no servidor / SEO | **Não.** 20 das 25 telas ficam atrás de login. A única pública mostra a nota de um aluno — que não deve ser indexada. SEO é o oposto do desejado. |
| Rotas de API / Server Actions | **Não.** Já existe o Express. Seria um segundo servidor Node só de passagem, e a arquitetura em camadas é justamente o que a disciplina avalia. |
| React Server Components | **Não.** Todo dado vem da API autenticada por token. RSC obrigaria a repassar credencial no servidor sem ganho. |
| Otimização de imagem | **Marginal.** As imagens que importam são upload do usuário, servidas pela API, não arquivos estáticos do projeto. |
| Roteamento por arquivo | **Empate.** Rotas aninhadas do React Router modelam melhor o layout do professor (barra superior + menu lateral + conteúdo). |

**Custo de adotar Next.js:** curva de aprendizado real para cinco pessoas com nove dias até a N1; atrito de configuração para publicar fora da Vercel; e nenhuma simplificação de deploy, já que o Express e o MySQL precisam de hospedagem própria de qualquer forma.

**Quando a decisão mudaria:** se o Express fosse descartado e tudo passasse a viver no Next.js (rotas de API + MySQL). A disciplina fecha essa porta.

---

## 2. A camada que torna tudo substituível

O que dá escalabilidade não é o framework — é ter **uma única fronteira de dados** que a aplicação inteira atravessa, com implementações trocáveis.

```
Componentes (25 telas)
        │   nunca sabem de onde vem o dado
        ▼
TanStack Query          cache, carregamento, repetição, invalidação
        │
        ▼
Repositórios            ◄── A FRONTEIRA: interface única, assíncrona, tipada
        │
   ┌────┴─────────────┬──────────────────────┐
   ▼                  ▼                      ▼
N1 (11/09)         N2 (23/10)            N3 / produção
localStorage       HTTP → Express        HTTP → Express
+ dados semeados   + MySQL               + MySQL
                   + login próprio (JWT)
```

**Regra dura: nenhum componente chama `localStorage` ou `fetch` diretamente.** Ele chama `useTurmas()`, que chama `turmaRepository.list()`. Trocar de fonte significa trocar uma fábrica lida de variável de ambiente — nenhuma tela muda.

O que faz isso funcionar é a interface do repositório já ser escrita **no formato do contrato HTTP futuro**: assíncrona (mesmo lendo `localStorage`, que é síncrono), paginada, com o mesmo formato de erro e os mesmos DTOs. Assim o adaptador HTTP da N2 é tradução mecânica, não redesenho.

### O que muda em cada migração

| | N1 — GitHub Pages | N2 — API MySQL | Firebase |
|---|---|---|---|
| Repositórios | `LocalStorageRepo` | `HttpRepo` (arquivo novo) | inalterado |
| Schemas de validação | validam o que sai do `localStorage` | **os mesmos** validam a resposta da API | inalterado |
| Hooks / cache | inalterados | inalterados | inalterados |
| Telas | — | **nenhuma mudança** | nenhuma |
| Autenticação | sessão simulada (só o demo do Pages) | JWT próprio da API: e-mail e senha ou Google | inalterado |
| Base do roteador | de variável do build | idem | idem, sem tocar em código |

O mesmo vale para autenticação: uma interface `AuthProvider` (`apps/web/src/lib/auth`), com a
implementação local, que só o demo do GitHub Pages usa, e a HTTP (`http-auth-provider.ts`), que os
builds do Firebase usam.

**O demo existe só no GitHub Pages.** A flag de build `VITE_DEMO_MODE` (`lib/app-mode.ts`), ligada
apenas no `pages.yml`, decide entre o login local com dados de exemplo e o login real. O Vite
grava o valor como constante, então o seed, a sessão simulada e os botões "Aplicar"/"Limpar"
ficam fora do pacote do Firebase, em vez de só escondidos: em produção e na pré-produção nada é
inventado. As áreas cuja API ainda não entrou continuam gravando no navegador, separadas pelo
professor logado, até a issue de cada uma ligar o repositório HTTP.

---

## 3. Publicação e roteamento

**N1: GitHub Pages. N2: Firebase Hosting para o front e Cloud Functions para a API, no mesmo endereço (o Hosting encaminha `/api/**` para a função); o GitHub Pages segue publicando o front da `main`, como demo. Autenticação: os endpoints `/auth` da Spec, com JWT próprio, login por e-mail e senha ou pelo Google** (decisão da PM de 14/10, na #40).

**Roteamento por caminho, não por hash.** URL limpa (`/correctio/r/ABC123`), com a base do roteador vinda da variável de build. No GitHub Pages, onde o front segue publicado para teste, o `pages.yml` copia o `index.html` para `404.html`; no Firebase, o `firebase.json` devolve o `index.html` para todo caminho que não é arquivo nem `/api`.

O motivo é específico deste projeto e é o **único ponto verdadeiramente irreversível**: a URL de consulta vai impressa em papel dentro do QR Code. Se a N1 imprimir `.../#/r/ABC` e depois o sistema migrar de host, toda folha impressa quebra. Por isso:

- O formato do caminho (`/r/:codigo`) precisa sobreviver à troca de host — migrar para o Firebase só remove o prefixo do repositório.
- A URL pública sai de uma constante de ambiente, **nunca** escrita fixa no código.

### Como a autenticação atende os requisitos

- **RF01 e RF02:** cadastro e login nos endpoints `/auth` da Spec. O access token dura 15 minutos
  e o refresh token, rotativo, renova a sessão sem nova senha.
- **Google:** o fluxo de código no servidor volta sempre ao mesmo endereço por projeto
  (`/api/auth/google/callback`), e de lá a API devolve o navegador à origem que começou, seja
  produção, o link fixo da pré ou o link de uma branch. O código de uso único fica preso ao
  navegador que iniciou o login, então um link repassado não serve em outro navegador.
- **RF03:** e-mail de redefinição pelo Gmail do projeto, com link de 30 minutos e uso único. A
  resposta é a mesma, e leva o mesmo tempo, com ou sem conta.
- **RF04:** "Sair de todos os dispositivos" revoga todos os refresh tokens da conta.

---

## 4. Limites do `localStorage` na N1

Três restrições que definem o que a N1 pode fazer:

**Cerca de 5 MB, e síncrono — não cabe foto de folha de resposta.** Uma foto de celular convertida para texto ocupa de 3 a 7 MB: estoura a cota em **uma única imagem**. Na N1, as telas de correção usavam um conjunto fixo de imagens de demonstração e a leitura era simulada. Desde a N2 a foto vai para a API, que a guarda no Storage e a lê numa worker thread ([ADR-007](adr/ADR-007-sheet-reading-on-api-worker.md)); o demo do Pages lê a foto no próprio navegador e a guarda só na memória, sem `localStorage`.

**É por navegador.** O cliente e a professora abrindo o link veem os dados semeados, não o que a equipe demonstrou. Por isso é obrigatório um conjunto de dados de demonstração realista — turmas, alunos, questões, provas, aplicações e correções já preenchidas — carregado no primeiro acesso, mais um botão "Restaurar dados de demonstração". Sem isso, quem abrir o link vê 25 telas vazias.

**O conteúdo é dado externo e não confiável.** O usuário pode editar, ou pode sobrar uma versão antiga do formato depois de um deploy. Toda leitura passa por validação de schema — os **mesmos** schemas que na N2 validam a resposta da API. É isso que faz os tipos da N1 não serem descartáveis.

---

## 5. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node 22 LTS, fixado em `.nvmrc` e no CI | Node 20 está em fim de vida |
| Build | Vite + TypeScript em modo estrito | |
| UI | React 19 | |
| Rotas | React Router (rotas aninhadas) | Modela o layout do professor |
| Estado de servidor | TanStack Query | Dado remoto não vive em estado local nem em store global |
| Validação | Schemas compartilhados front/back | Mesma definição valida `localStorage`, API e entrada do Express |
| Formulários | React Hook Form | Nove das 25 telas são formulário |
| Estilo | Tailwind + componentes próprios no repositório | Customização total, dependência mínima |
| Acessibilidade | Primitives headless para modal, drawer, abas e combobox | Metade do RNF11 sai pronta |
| Gráficos | Biblioteca de gráficos para os relatórios | Histograma e barras |
| Testes | Unitários nas regras críticas + Cypress ponta a ponta | Exigido pelo RNF08, com cobertura mínima barrando o merge |
| Qualidade contínua | GitHub Actions + SonarCloud em todo PR | RNF20 — ver [CI_CD.md](CI_CD.md) |

**Sobre estilo:** Tailwind como camada de utilitários mais componentes nossos dentro do repositório, envolvendo primitives sem estilo apenas onde a acessibilidade é difícil. Não se adiciona uma biblioteca de CSS-in-JS por cima do Tailwind — seriam dois sistemas de estilo concorrendo no mesmo projeto.

---

## 6. Organização do código

```
src/
  app/            roteador, providers (cache, autenticação), layouts
  features/
    turmas/       pages/ components/ hooks/ repository/ schemas.ts index.ts
    questoes/
    provas/
    aplicacoes/
    correcao/
    relatorios/
    publico/
  components/ui/  Botão, Modal, Tabela, ConfirmarAcao, Importar, EstadoVazio, Tour
  lib/            adaptadores de armazenamento, cliente HTTP, dados semeados
  types/          domínio compartilhado
```

Estrutura por funcionalidade, com `index.ts` como interface pública de cada pasta. Com 25 telas, seis domínios e cinco pessoas, é o que evita conflito de merge e o erro mais comum em equipe: cinco tabelas diferentes fazendo a mesma coisa. Os componentes compartilhados — modal de confirmação, modal de importação, tabela, estado vazio — precisam existir **antes** de qualquer tela.

### Conceitos aplicados

- **Dado remoto não vive em estado local nem em store global.** Tratar o `localStorage` como estado de servidor desde a N1 é o que torna a troca gratuita. Ler `localStorage` dentro de um efeito transforma a N2 em reescrita.
- **Modelar apenas estados válidos.** O domínio pede união discriminada: questão é objetiva **ou** discursiva (não um campo de tipo com campos opcionais que combinam em estados impossíveis); prova é rascunho, pronta ou arquivada; correção vem de imagem ou de digitação; a página pública tem estados mutuamente exclusivos (código inválido, nota não liberada, gabarito não publicado, liberado) — nunca três booleanos soltos.
- **Validar dado externo na fronteira**, com a mesma definição de schema dos dois lados.
- **Acessibilidade não é etapa final.** O RNF11 exige alvos de toque de 44 px e nota mínima em auditoria de acessibilidade; primitives acessíveis entregam gestão de foco e ARIA sem reimplementação.
- **Um controle de cada vez.** Ação que leva a outra tela com cara de botão é o `ButtonLink` de `components/ui`, que é o próprio link desenhado com as classes do `Button`. Botão com link dentro, ou link com botão dentro, só navegava pelo texto e parava duas vezes no Tab (#141).
- **44 px resolvidos no componente, não na tela.** O link de voltar é o `BackLink`, a caixa de marcar com texto é o `CheckboxField` e o campo de número é o `NumberInput`, todos de `components/ui` e todos com 44 px de altura. Botão que se repete em cada item de uma lista ("Remover", "Arquivar", "Revisar") tem nome acessível que começa pelo texto visível e depois diz o item, como "Remover Ana Beatriz Moreira da turma" (#145, WCAG 2.5.3).

---

## 7. Três padrões que atravessam o sistema inteiro

### Operação demorada nunca trava a tela (RF41, RNF13)

Gerar PDF, ler folhas, importar e exportar não devolvem o resultado — devolvem **um job**. A tela confirma em menos de 1 segundo, o professor volta a trabalhar, e a notificação chega quando o resultado existe.

No front isso é um padrão único e reutilizável: iniciar job → registrar o id → acompanhar o estado → avisar. Nenhuma tela implementa isso do seu jeito, e nenhuma mostra spinner bloqueante.

O padrão está em `apps/web/src/lib/background-jobs` (#82): cada job é uma mutation do TanStack Query sob a chave `background-job`, com o tipo do `BackgroundJob` (`EXPORT`, `GENERATE_PDF`, `READ_SHEETS`, `IMPORT`). O cache guarda o job depois que a tela que o iniciou sai, e o aviso do layout (`BackgroundJobsNotice`) lê todos de lá: mostra "em andamento" no clique, oferece o arquivo quando fica pronto, em qualquer tela, e some quando o professor fecha ou quando a sessão termina. A exportação de relatórios é o primeiro uso; gerar PDF e importar usam os mesmos hooks (`useBackgroundJob`, `useBackgroundJobs`).

A leitura de imagem é intensiva em CPU e **não pode** rodar na thread principal do servidor — travaria a API inteira. É o mesmo motivo, visto do outro lado.

### Nada é apagado de verdade (RF42)

Arquivar turma, prova e aplicação e excluir questão são todos **soft-delete**: o registro sai das listas, mantém o vínculo com quem já o usava e pode voltar. Consequências de projeto:

- Toda consulta de listagem filtra os registros inativos por padrão — no **repositório**, não em cada tela, senão a primeira consulta que alguém escrever vai esquecer.
- Nenhuma rotina apaga dado por prazo. Exclusão definitiva só sob solicitação, via anonimização.
- O que protege contra perda é o backup com restauração testada (RNF09).

### O tour é conteúdo, não código (RF37, RNF19)

Componente único alimentado por um arquivo de texto por tela. O limite de 4 passos e 90 caracteres vira teste automatizado; revisar a redação é mexer em um arquivo só. Especificação e texto final: [Tour_Guiado.md](Tour_Guiado.md).

---

## 8. Ordem de construção até a N1

Segue a prioridade definida no documento de requisitos e telas:

1. **Fundação** — build, publicação, **portão de qualidade e proteção de branch**, tipos e schemas do domínio, interfaces de repositório e autenticação com implementação local, dados semeados, componentes compartilhados
2. Acesso — login, cadastro, recuperação de senha
3. Painel
4. Turmas — lista, criar/editar, detalhe
5. Banco de questões — lista, criar/editar
6. Provas — lista, criar/editar, geração automática
7. Aplicações — lista, gerar PDF, detalhe
8. Correção — envio de folhas, revisão
9. Consulta pública por QR Code
10. Pendentes de atribuição e relatórios

A fundação precisa estar pronta antes da divisão de tarefas entre as cinco pessoas — é ela que permite trabalho paralelo sem conflito.

---

## 9. Extensão futura: área do aluno

A área do aluno **está fora do escopo deste projeto** — decisão de 28/08, e ela não será
construída aqui. Mas o modelo foi mantido aberto para que quem herde o projeto possa
adicioná-la sem migrar dados.

### O que já está no lugar

| Costura | Onde | Estado |
|---|---|---|
| `role: "estudante"` | `types/domain.ts` | no contrato, só `professor` autentica |
| `ClassEnrollment` | `types/domain.ts`, `lib/schemas` | modelada, sem repositório |
| `Student.userId` | `types/domain.ts` | opcional, sempre vazio |
| `Class.inviteCode` | gerado na criação da turma | preenchido, sem uso na interface |
| `Correction.studentId` | preenchido quando há identificação | já é a chave da consulta do aluno |
| `Application.gradesReleased` | em uso | já controla o que o aluno pode ver |
| `createTeacherRepositories` | `lib/repositories/index.ts` | nomeado pelo escopo, não genérico |

### O que faltaria construir

1. **`createStudentRepositories(studentUserId)`** ao lado da fábrica do professor, devolvendo
   só o que o aluno pode ver: as próprias correções e as turmas em que está matriculado.
   **Não** alargar a fábrica existente com um `if` de papel — a separação por escopo é o que
   torna o isolamento auditável.
2. **Repositório de `ClassEnrollment`**, mais o fluxo de entrar na turma por `inviteCode`.
3. **Telas do aluno** em `features/student/`, com layout próprio: o menu do professor não
   serve, e reaproveitá-lo com condicionais vira a pior parte do código.
4. **Roteamento por papel** no `router.tsx`, escolhendo o layout pelo `role` da sessão.
5. **Isolamento no servidor.** Esta é a parte que não pode ser improvisada: toda consulta do
   aluno filtra pelo id dele na camada de serviço, e recurso de outro aluno responde 404.
   Ver `Seguranca_e_LGPD.md`.

### O que não fazer

**Não construa nada disso agora.** Rota, tela ou repositório de aluno sem uso é código morto:
ninguém testa, o portão de qualidade cobra cobertura dele, e a primeira limpeza apaga.

O que ficou pronto foi só o que custa perto de zero e é caro de adicionar depois: campos de
contrato e nomes que revelam o escopo. Maquinário fica para quem for construir a feature.

**E não apague as costuras por parecerem sem uso.** Estão listadas em
[Modelo_de_Dados.md](Modelo_de_Dados.md), seção "Reservado para escopo futuro". Removê-las
transforma "adicionar a área do aluno" em "migrar o banco".
