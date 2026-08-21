<div align="center">

# 📄 Correctio

**Plataforma web onde o professor monta a prova uma vez e o sistema gera o PDF pronto para impressão — com múltiplas versões embaralhadas, QR Code e gabarito publicável.**

`Projeto e Arquitetura de Software` · `Grupo 2` · `Católica SC`

`Node.js` · `Express` · `MySQL` · `React`

</div>

---

## 🎁 O que o Correctio entrega

Em uma frase: **o professor cadastra as questões uma vez e o sistema cuida do resto da papelada da prova.**

1. **Banco de questões reutilizável** — objetivas e discursivas, com tags e busca.
2. **Provas montadas por composição** — escolhe questões do banco, define a pontuação de cada uma, e a mesma prova serve para várias turmas.
3. **Arquivo único consolidado, em PDF e em DOCX** — todas as versões e, se quiser, uma prova por aluno em um só arquivo, com QR Code e embaralhamento antifraude. O **DOCX é editável**, para o professor ajustar o layout antes de imprimir.
4. **Gabarito publicável** — o aluno vê as respostas corretas só depois que o professor libera.
5. **Correção e nota** — o professor lança as respostas de cada aluno e o sistema calcula a nota a partir do gabarito.

> A correção do MVP é **manual** (o professor lança as respostas na tela). A **leitura automática por foto/scan** da folha de respostas é a evolução seguinte — ver [Escopo](#-3-escopo-definido).

---

## 👥 1. Identificação dos integrantes

| Nome completo | E-mail institucional |
|---|---|
| Cleberson Luis Vieira Martins Maia | cleberson.maia@catolicasc.edu.br |
| Fabricio da Silva Junior | fabricio94.silva@catolicasc.edu.br |
| Heloísa Fogaça do Nascimento | h.nascimento@catolicasc.edu.br |
| Jeliel Nunes da Silva | jeliel.silva@catolicasc.edu.br |
| Priscila Torres Benedito de Paula | priscila.paula@catolicasc.edu.br |

---

## 🎯 2. Objetivo

**O problema, na voz do cliente:** em semana de prova, um professor de 40 horas chega a ter **200 a 400 provas para corrigir**. Isso consome o tempo que ele não tem e atrasa a devolução da avaliação para o aluno.

Hoje ele resolve isso com uma ferramenta de mercado (GradePen), que gera a prova embaralhada e corrige por leitura da folha de respostas — mas que **não mostra qual alternativa o aluno marcou** (impedindo a análise pedagógica do erro) e **quebra questões no meio da página**.

**O objetivo do Correctio** é cobrir o ciclo inteiro da prova em um só lugar: montar (banco de questões e provas reutilizáveis), aplicar (arquivo em PDF e DOCX, com versões embaralhadas e QR Code), corrigir (lançamento das respostas com nota calculada pelo sistema) e devolver (gabarito publicado para o aluno).

O que o MVP **não** faz é ler a folha de respostas por imagem — mas registra o dado em um formato que já viabiliza essa leitura depois, e que resolve a lacuna do GradePen: guardar **qual alternativa o aluno marcou**, não só se ele acertou.

**Ganho concreto para o professor:** montar a prova deixa de ser trabalho manual repetido a cada turma e a cada semestre, e a nota sai do lançamento sem cálculo na mão.

---

## 🔭 3. Escopo definido

### Como o sistema funciona, de ponta a ponta

```
Turma ──┐                                      ┌─► Gabarito publicado
        ├─► Aplicação ──► Geração da prova ────┤     (aluno consulta)
Prova ──┘                  (versões +          │
   ▲                     embaralhamento +      └─► Correção manual ──► Nota do aluno
   │                    QR Code · PDF + DOCX)        (professor lança
Banco de Questões                                     as respostas)
```

O conceito-chave é a separação entre **Prova** (conteúdo, reutilizável) e **Aplicação** (a prova entregue a *uma* turma em *uma* data). É isso que permite aplicar a mesma prova a várias turmas ou reaplicá-la em 2ª chamada, sem duplicar conteúdo.

### ✅ Dentro do MVP

| Bloco | Entrega |
|---|---|
| **Contas** | Cadastro e login de professor e aluno (JWT + refresh), recuperação de senha, anonimização de conta (LGPD) |
| **Turmas** | Criar, editar, arquivar; matrícula por e-mail ou por código de convite |
| **Questões** | CRUD de objetivas (2 a 5 alternativas) e discursivas, com tags e soft-delete |
| **Provas** | Montagem por composição, até 20 questões, pontuação independente por questão |
| **Aplicações** | Associa uma prova a uma turma; permite reaplicação |
| **Geração da prova** | Arquivo único consolidado em **PDF** (impressão) e em **DOCX** (editável): nº de versões, embaralhamento configurável, QR Code, com/sem identificação do aluno |
| **Gabarito** | Publicação por versão ou pela aplicação inteira |
| **Correção e nota** | Correção **manual**: o professor lança, por aluno, a alternativa marcada em cada questão objetiva e a nota de cada discursiva; o sistema confronta com o gabarito e calcula a nota total |

### 🚫 Fora do MVP — decisões explícitas do grupo

| Item | Decisão |
|---|---|
| **App mobile nativo** | Fora em qualquer hipótese — não é entregável desta disciplina. Tudo pelo site. |
| **Leitura da folha de respostas por imagem** | Evolução seguinte da correção: o professor envia foto/scan e o sistema lê as marcações. Sem câmera ao vivo, sempre por upload no site. A correção manual do MVP continua valendo como alternativa. |
| **Relatórios e exportação de notas** | Estatísticas por aplicação, consolidado e exportação em CSV/Excel ficam para depois. |
| **Importação de alunos em lote** | Sugestão do cliente, mas fora da especificação obrigatória. |

### 📅 Evolução ao longo do semestre

| | Entrega | Prazo |
|---|---|---|
| **N1** | Telas navegáveis com dados mock, hospedadas | 11/09/2026 |
| **N2** | Mesmas telas ligadas de verdade ao MySQL, sem nenhum mock | 23/10/2026 |
| **N3** | Escopo completo, validações e casos de borda, apresentação ao cliente | 27/11/2026 |

---

## ✅ 4. Principais requisitos

### Requisitos Funcionais

| Cód. | Requisito |
|---|---|
| **RF01** | Cadastro separado de professor e aluno, com domínio de e-mail validado por papel (`@catolicasc.org.br` professor / `@catolicasc.edu.br` aluno) |
| **RF02** | Login com JWT + refresh token, recuperação de senha por e-mail, logout e logout de todos os dispositivos |
| **RF03** | Consulta dos próprios dados de perfil |
| **RF04** | Anonimização de conta sob demanda (LGPD) — irreversível, preserva o histórico dos demais |
| **RF05** | CRUD de questões objetivas (2 a 5 alternativas, exatamente 1 correta) e discursivas, com tags, filtros e soft-delete |
| **RF06** | Criar, editar e arquivar turmas; matricular aluno por e-mail ou por código de convite regenerável |
| **RF07** | Criar provas com até 20 questões e pontuação independente por questão |
| **RF08** | Criar Aplicação associando uma prova existente a uma turma, com reaplicação permitida |
| **RF09** | Gerar a prova como arquivo único consolidado, com nº de versões, embaralhamento e identificação do aluno configuráveis |
| **RF10** | Baixar a prova gerada em **PDF** (pronta para impressão) e em **DOCX** (editável, para o professor ajustar o layout antes de imprimir) |
| **RF11** | Regenerar a prova, invalidando as versões e os QR Codes anteriores; bloqueado se já houver correção confirmada na Aplicação |
| **RF12** | Publicar gabarito por versão ou pela Aplicação inteira |
| **RF13** | Nenhuma questão pode ser quebrada entre páginas — enunciado e alternativas saem sempre na mesma página, nos dois formatos |
| **RF14** | Correção manual: lançar, por aluno, a alternativa marcada em cada questão objetiva e a nota de cada discursiva, com a nota total calculada pelo sistema a partir do gabarito |
| **RF15** | Atribuição automática da nota ao aluno quando a prova foi gerada **com** identificação |
| **RF16** | Quando gerada **sem** identificação: a correção fica pendente de atribuição e o professor associa ao aluno depois, buscando por nome/matrícula |
| **RF17** | O aluno consulta a própria nota e o desempenho por questão, com isolamento total dos dados de outros alunos |

### Requisitos Não-Funcionais

| Cód. | Requisito |
|---|---|
| **RNF01** | Suportar 500–600 professores e 10.000 alunos ativos no primeiro ano |
| **RNF02** | API com p95 < 300 ms nas operações comuns |
| **RNF03** | 99,5% de uptime mensal |
| **RNF04** | HTTPS, JWT + refresh, rate limiting e isolamento total entre alunos |
| **RNF05** | LGPD: anonimização sob demanda (exclusão física fora do MVP) |
| **RNF06** | Logs estruturados, métricas e alertas |
| **RNF07** | Backup diário do banco, retenção de 30 dias |
| **RNF08** | Cobertura de testes ≥ 80% nas regras críticas de negócio |

### Regras de negócio que definem o produto

- **Uma prova é reutilizável.** Aplicá-la a outra turma, ou reaplicá-la à mesma turma, cria sempre uma nova Aplicação — nunca uma cópia da prova.
- **A soma da pontuação não é validada pelo sistema.** Garantir que feche em 10,0 é responsabilidade do professor.
- **A prova gerada é um arquivo único consolidado**, tanto em PDF como em DOCX. Nunca um arquivo por aluno ou por versão.
- **O DOCX é para ajuste fino de layout antes da impressão** — mover uma questão que ficou mal posicionada, por exemplo. Alterar o **conteúdo** ou a **ordem** das questões e alternativas no arquivo baixado faz a prova impressa divergir do que o sistema registrou, o que invalida a correção daquela versão.
- **Embaralhamento de questões e de alternativas são independentes**, configuráveis por versão.
- **A ordem embaralhada é persistida** no momento da geração — é ela que torna a correção possível depois, porque o sistema sabe qual letra impressa corresponde a qual alternativa original.
- **Com identificação:** cada aluno recebe uma versão específica e um QR Code próprio. **Sem identificação:** o QR Code identifica só a versão, e o aluno escreve nome e matrícula à mão.
- **Nenhuma questão é quebrada entre páginas** — requisito de qualidade confirmado, e uma das reclamações diretas do cliente sobre a ferramenta atual.
- **Regenerar a prova invalida** as versões e os QR Codes anteriores, e **não é permitido** depois que existe correção confirmada na Aplicação — nesse caso o caminho é criar uma nova Aplicação (2ª chamada).
- **O aluno só vê o gabarito depois da publicação** pelo professor.
- **A correção registra qual alternativa o aluno marcou**, não apenas acerto/erro — é o que viabiliza a análise pedagógica do erro pedida pelo cliente.
- **Uma correção não pode ser atribuída duas vezes** ao mesmo aluno na mesma versão.

### Telas do MVP — 24 no total

| Área | Telas |
|---|---|
| **Compartilhadas** (4) | Login · Cadastro · Recuperar/redefinir senha · Ingressar em turma por código |
| **Web Professor** (16) | Painel · Meu perfil · Turmas (lista, criar/editar, detalhe) · Banco de Questões (lista, criar/editar) · Provas (lista, criar/editar, detalhe) · Aplicações (lista, criar, gerar prova, detalhe) · Correção (lançar respostas, correções pendentes de atribuição) |
| **Web Aluno** (4) | Painel · Meu perfil · Provas atribuídas (lista, detalhe com nota e desempenho por questão) |

---

## 🎨 Prévia visual

Um primeiro norte de layout da área do professor, para dar ideia da direção visual:

**[→ Ver prévia da área do professor](https://2b53098fdd844aab905c-main.projects.builder.my/professor)**

> ⚠️ **Prévia não funcional e não definitiva.** Serve apenas como referência visual em discussão — não tem back-end, não reflete o comportamento final das telas e pode mudar por completo. As telas oficiais da N1 serão construídas a partir da especificação da seção 4.

---

## 🏗️ Stack e arquitetura

**Back-end:** Node.js + Express + MySQL, em **arquitetura em camadas** — `rota → controle → serviço → repositório → model`, cada camada com uma única responsabilidade.

**Front-end:** React. A especificação original indicava Vue no diagrama de arquitetura; foi confirmado que o grupo pode seguir em React, e que a API pode receber campos além dos descritos literalmente na Spec quando fizer sentido de produto.

**Entidades de domínio:** `User` · `Class` · `ClassEnrollment` · `Question` · `Exam` · `Application` · `ExamVersion` · `ExamAssignment` · `Correction`

---

<div align="center">

*README v1 — apresentação de validação de entendimento e viabilidade · 28/08/2026*

</div>
