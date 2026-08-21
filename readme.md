<div align="center">

# 🚀 Correctio

**Plataforma web para professores criarem, aplicarem e organizarem provas — com embaralhamento antifraude, QR Code e publicação de gabarito.**

*Projeto e Arquitetura de Software · Grupo 2*

</div>

---

## 👥 Identificação dos integrantes

| Nome completo | E-mail institucional |
|---|---|
| Cleberson Luis Vieira Martins Maia | cleberson.maia@catolicasc.edu *(conferir se falta o ".br" final)* |
| Fabricio da Silva Junior | *pendente de confirmação* |
| Heloísa Fogaça do Nascimento | h.nascimento@catolicasc.edu.br |
| Jeliel Nunes da Silva | *pendente de confirmação* |
| Priscila Torres Benedito de Paula | priscila.paula@catolicasc.edu.br |

## 🎯 Objetivo

O Correctio nasce da rotina real de professores que corrigem centenas de provas por semana manualmente — tempo que atrasa o retorno da avaliação ao aluno e disputa espaço com outras atividades do professor.

O objetivo do MVP é entregar a base do sistema: criação de turmas, banco de questões, montagem de provas reutilizáveis e geração de PDFs com múltiplas versões embaralhadas e QR Code, reduzindo cola e organizando a aplicação de provas. A correção automatizada é a evolução natural do produto, mapeada como bloco pós-MVP (ver seção de Escopo).

## 🔭 Escopo definido

**Stack:** back-end em Node.js + Express + MySQL (definida pela disciplina); front-end em React (a Spec original indicava Vue no diagrama de arquitetura, mas foi confirmado que o grupo pode seguir em React por hora).

**Dentro do MVP (entrega da N1):**
- Cadastro e login de professores e alunos, com JWT + recuperação de senha
- Gerenciamento de turmas e matrícula de alunos (por e-mail ou código de convite)
- Banco de questões objetivas e discursivas
- Montagem de provas reutilizáveis (banco de até 20 questões, pontuação independente por questão)
- Aplicação de uma prova a uma ou mais turmas
- Geração de PDF único consolidado, com múltiplas versões, embaralhamento de questões/alternativas e QR Code
- Publicação de gabarito

**Fora do MVP (decisão do grupo):**
- App mobile nativo — não é entregável desta matéria; tudo é feito pelo site
- Correção de provas e lançamento de notas — bloco pós-MVP, em duas camadas (correção manual e, depois, leitura de imagem da folha de respostas), ainda em validação com a professora

## ✅ Principais requisitos

### Requisitos Funcionais (RF)

| Cód. | Requisito |
|---|---|
| RF01 | Cadastro separado de professor e aluno, com domínio de e-mail validado por papel (@catolicasc.org.br professor / @catolicasc.edu.br aluno) |
| RF02 | Login (JWT + refresh token), recuperação de senha, logout e logout de todos os dispositivos |
| RF03 | Consulta dos próprios dados de perfil |
| RF04 | Anonimização de conta sob demanda (LGPD), irreversível |
| RF05 | CRUD de questões objetivas (2 a 5 alternativas, 1 correta) e discursivas, com tags e soft-delete |
| RF06 | Criação/edição/arquivamento de turmas; matrícula por e-mail ou código de convite |
| RF07 | Criação de provas: banco de até 20 questões, pontuação independente por questão |
| RF08 | Criação de Aplicação: associa uma prova existente a uma turma; permite reaplicação (2ª chamada) |
| RF09 | Geração de PDF único consolidado, com nº de versões, embaralhamento e identificação do aluno configuráveis |
| RF10 | Regeneração do PDF (invalida QR Codes e versões anteriores) |
| RF11 | Publicação de gabarito por versão ou pela Aplicação inteira |

### Requisitos Não-Funcionais (RNF)

| Cód. | Requisito |
|---|---|
| RNF01 | Suportar 500–600 professores + 10.000 alunos ativos no primeiro ano |
| RNF02 | API com p95 < 300ms nas operações comuns |
| RNF03 | 99,5% de uptime mensal |
| RNF04 | HTTPS, JWT + refresh, rate limiting, isolamento total entre alunos |
| RNF05 | LGPD: anonimização sob demanda; exclusão física de dados fica fora do MVP |
| RNF06 | Cobertura de testes ≥ 80% nas regras críticas de negócio |

### Regras de negócio

- Uma prova pode ter até 20 questões, com pontuação independente por questão — a soma não é validada pelo sistema, a responsabilidade é do professor.
- Uma prova é reutilizável: pode ser aplicada a várias turmas, ou reaplicada à mesma turma (2ª chamada), sempre por meio de uma nova Aplicação.
- O PDF gerado é um único arquivo consolidado — nunca arquivos separados por aluno ou por versão.
- Embaralhamento de questões e de alternativas é configurável de forma independente, por versão.
- Com identificação: cada aluno recebe uma versão específica, associada a um QR Code próprio.
- Sem identificação: o QR Code identifica só a versão da prova; o aluno escreve nome/matrícula à mão.
- Regenerar o PDF substitui as versões existentes e invalida os QR Codes anteriores.
- O aluno só enxerga o gabarito depois que o professor publica.
- Contas podem ser anonimizadas sob demanda; a anonimização é irreversível e preserva o histórico de outras pessoas (notas, matrículas).

### Telas envolvidas (22 no total)

**Compartilhadas** — Login · Cadastro · Recuperar/Redefinir senha · Ingressar em turma (código de convite)

**Web Professor** (14 telas)
- Painel · Meu perfil
- Turmas: lista, criar/editar, detalhe
- Banco de Questões: lista, criar/editar
- Provas: lista, criar/editar, detalhe
- Aplicações: lista, criar, gerar PDF, detalhe

**Web Aluno** (4 telas)
- Painel · Meu perfil
- Provas atribuídas: lista, detalhe

> Especificação completa de cada tela (conteúdo, elementos e fluxo de navegação) está no documento de apoio do grupo, junto com o bloco pós-MVP de Correção e Notas.

---

<div align="center">

*README preparado para a apresentação de validação de entendimento — aula de 28/08/2026.*

</div>