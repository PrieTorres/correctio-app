# Decisões de Arquitetura — Correctio

Registro das decisões técnicas e do porquê de cada uma. Complementa [Principais_Requisitos_Correctio.md](Principais_Requisitos_Correctio.md) e [Seguranca_e_LGPD.md](Seguranca_e_LGPD.md).

---

## 1. Front-end: React, não Next.js

**Decisão: React com Vite.**

O decisor não foi o front — foi o back-end, já fixado pela disciplina: **Node.js + Express + MySQL em arquitetura em camadas** (`rota → controle → serviço → repositório → model`). Isso remove do Next.js exatamente aquilo que justifica adotá-lo.

| O que o Next.js oferece | Vale aqui? |
|---|---|
| Renderização no servidor / SEO | **Não.** 20 das 24 telas ficam atrás de login. A única pública mostra a nota de um aluno — que não deve ser indexada. SEO é o oposto do desejado. |
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
Componentes (24 telas)
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
+ dados semeados   + MySQL               + Firebase Auth
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
| Autenticação | sessão simulada | token do Express | Firebase Auth |
| Base do roteador | de variável do build | idem | idem, sem tocar em código |

O mesmo vale para autenticação: uma interface `AuthProvider`, com implementação simulada na N1 e Firebase depois.

---

## 3. Publicação e roteamento

**N1: GitHub Pages. Depois: Firebase Hosting. Autenticação: Firebase Auth.**

**Roteamento por caminho, não por hash.** URL limpa (`/correctio/r/ABC123`), usando o recurso padrão do GitHub Pages de copiar o `index.html` para `404.html` no build, com a base do roteador vinda da variável de build.

O motivo é específico deste projeto e é o **único ponto verdadeiramente irreversível**: a URL de consulta vai impressa em papel dentro do QR Code. Se a N1 imprimir `.../#/r/ABC` e depois o sistema migrar de host, toda folha impressa quebra. Por isso:

- O formato do caminho (`/r/:codigo`) precisa sobreviver à troca de host — migrar para o Firebase só remove o prefixo do repositório.
- A URL pública sai de uma constante de ambiente, **nunca** escrita fixa no código.

### O que Firebase Auth muda nos requisitos

Os RFs sobrevivem quase intactos: o Firebase emite token JWT com renovação, então o RF02 continua literalmente verdadeiro; o RF03 (recuperação de senha por e-mail) sai pronto; o RF04 (encerrar todas as sessões) é revogação de tokens.

O que ele **não** faz sozinho é restringir domínio de e-mail — o que deixou de importar, já que a restrição foi removida do RF01.

---

## 4. Limites do `localStorage` na N1

Três restrições que definem o que a N1 pode fazer:

**Cerca de 5 MB, e síncrono — não cabe foto de folha de resposta.** Uma foto de celular convertida para texto ocupa de 3 a 7 MB: estoura a cota em **uma única imagem**. Na N1, as telas de correção usam um conjunto fixo de imagens de demonstração e a leitura é simulada com atraso artificial. Upload real fica para a N2.

**É por navegador.** O cliente e a professora abrindo o link veem os dados semeados, não o que a equipe demonstrou. Por isso é obrigatório um conjunto de dados de demonstração realista — turmas, alunos, questões, provas, aplicações e correções já preenchidas — carregado no primeiro acesso, mais um botão "Restaurar dados de demonstração". Sem isso, quem abrir o link vê 24 telas vazias.

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
| Formulários | React Hook Form | Nove das 24 telas são formulário |
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

Estrutura por funcionalidade, com `index.ts` como interface pública de cada pasta. Com 24 telas, seis domínios e cinco pessoas, é o que evita conflito de merge e o erro mais comum em equipe: cinco tabelas diferentes fazendo a mesma coisa. Os componentes compartilhados — modal de confirmação, modal de importação, tabela, estado vazio — precisam existir **antes** de qualquer tela.

### Conceitos aplicados

- **Dado remoto não vive em estado local nem em store global.** Tratar o `localStorage` como estado de servidor desde a N1 é o que torna a troca gratuita. Ler `localStorage` dentro de um efeito transforma a N2 em reescrita.
- **Modelar apenas estados válidos.** O domínio pede união discriminada: questão é objetiva **ou** discursiva (não um campo de tipo com campos opcionais que combinam em estados impossíveis); prova é rascunho, pronta ou arquivada; correção vem de imagem ou de digitação; a página pública tem estados mutuamente exclusivos (código inválido, nota não liberada, gabarito não publicado, liberado) — nunca três booleanos soltos.
- **Validar dado externo na fronteira**, com a mesma definição de schema dos dois lados.
- **Acessibilidade não é etapa final.** O RNF11 exige alvos de toque de 44 px e nota mínima em auditoria de acessibilidade; primitives acessíveis entregam gestão de foco e ARIA sem reimplementação.

---

## 7. Três padrões que atravessam o sistema inteiro

### Operação demorada nunca trava a tela (RF41, RNF13)

Gerar PDF, ler folhas, importar e exportar não devolvem o resultado — devolvem **um job**. A tela confirma em menos de 1 segundo, o professor volta a trabalhar, e a notificação chega quando o resultado existe.

No front isso é um padrão único e reutilizável: iniciar job → registrar o id → acompanhar o estado → avisar. Nenhuma tela implementa isso do seu jeito, e nenhuma mostra spinner bloqueante.

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
