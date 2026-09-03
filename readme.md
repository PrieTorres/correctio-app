<div align="center">

# 📄 Correctio

**Plataforma web onde o professor monta a prova uma vez, imprime versões embaralhadas com QR Code, corrige fotografando as folhas de resposta e devolve a nota ao aluno pelo próprio QR.**

`Projeto e Arquitetura de Software` · `Grupo 2` · `Católica SC`

`React` · `Vite` · `Node.js` · `Express` · `MySQL`

</div>

---

## 🎁 O que o Correctio entrega

Em uma frase: **o professor cadastra as questões uma vez e o sistema cuida do resto da papelada da prova.**

1. **Banco de questões reutilizável** — objetivas e discursivas, com tags, busca e importação em lote.
2. **Provas montadas por composição** — escolhe questões do banco ou deixa o sistema montar por filtros; a mesma prova serve para várias turmas.
3. **PDF único consolidado** — todas as versões em um só arquivo, com embaralhamento antifraude e um QR Code único por folha impressa.
4. **Correção por foto** — o professor fotografa as folhas pelo navegador do celular, o sistema lê as marcações e calcula a nota. Nenhuma leitura vira nota sem a confirmação dele.
5. **Devolução ao aluno sem login** — o aluno escaneia o QR da própria folha e vê nota e gabarito, depois que o professor libera.

> **Sem app mobile e sem área do aluno.** Tudo pelo site, que é responsivo — é isso que permite fotografar as folhas direto do celular, sem instalar nada.

---

## 👥 1. Identificação dos integrantes

| Nome completo | E-mail institucional |
|---|---|
| Cleberson Luis Vieira Martins Maia | cleberson.maia@catolicasc.edu.br |
| Fabricio da Silva Junior | fabricio94.silva@catolicasc.edu.br |
| Heloísa Fogaça do Nascimento | h.nascimento@catolicasc.edu.br |
| Jeliel Nunes da Silva | jeliel.silva@catolicasc.edu.br |
| Priscila Torres Benedito de Paula | priscila.paula@catolicasc.edu.br |

**Board de tarefas:** [GitHub Project 4](https://github.com/users/PrieTorres/projects/4)

---

## 🎯 2. Objetivo

**O problema, na voz do cliente:** em semana de prova, um professor de 40 horas chega a ter **200 a 400 provas para corrigir**. Isso consome o tempo que ele não tem e atrasa a devolução da avaliação para o aluno.

Hoje ele resolve com uma ferramenta de mercado (GradePen), que gera a prova embaralhada e corrige por leitura da folha — mas que **não mostra qual alternativa o aluno marcou**, impedindo a análise pedagógica do erro, e **quebra questões no meio da página**.

**O objetivo do Correctio** é cobrir o ciclo inteiro da prova em um só lugar: montar, aplicar, corrigir e devolver — guardando **qual alternativa o aluno marcou**, não apenas se ele acertou.

**Ganho concreto:** montar a prova deixa de ser trabalho manual repetido a cada turma e a cada semestre, e a correção deixa de ser feita folha a folha na mão.

---

## 🔭 3. Escopo definido

### Como o sistema funciona, de ponta a ponta

```
Turma ──┐                                    ┌─► Gabarito publicado ──┐
        ├─► Aplicação ──► PDF consolidado ───┤                        ├─► QR Code
Prova ──┘                 (versões +         │                        │   (aluno consulta
   ▲                    embaralhamento +     └─► Correção por foto ───┘    sem login)
   │                    QR único por folha)      (professor confirma)
Banco de Questões
```

O conceito-chave é a separação entre **Prova** (conteúdo, reutilizável) e **Aplicação** (a prova entregue a *uma* turma em *uma* data). É isso que permite aplicar a mesma prova a várias turmas ou reaplicá-la em segunda chamada, sem duplicar conteúdo.

### ✅ Dentro do MVP

| Bloco | Entrega |
|---|---|
| **Contas** | Só o professor tem conta. Cadastro, login, recuperação de senha, encerrar sessões, anonimização de conta |
| **Turmas** | Criar, editar, arquivar; alunos cadastrados um a um ou importados em lote |
| **Questões** | Objetivas (2 a 5 alternativas) e discursivas, com tags, filtros, soft-delete e importação em lote |
| **Provas** | Montagem manual ou automática por filtros, até 20 questões, duplicação, importação e exportação |
| **Aplicações** | Associa prova a turma; permite reaplicação |
| **PDF** | Arquivo único consolidado: nº de versões, embaralhamento configurável, QR Code único por folha, com ou sem identificação |
| **Gabarito** | Publicação por versão ou pela aplicação inteira |
| **Correção** | Envio de foto/scan da folha, leitura automática das marcações, revisão obrigatória do professor, lançamento manual como alternativa |
| **Notas** | Consulta pelo aluno via QR Code, sem login, após liberação |
| **Relatórios** | Por aplicação e consolidado, com exportação |

### 🚫 Fora do MVP

| Item | Decisão |
|---|---|
| **App mobile nativo** | Fora em qualquer hipótese. Tudo pelo site responsivo. |
| **Área do aluno com login** | Fora. O aluno é um registro da turma e consulta a nota pelo QR Code da sua folha. |
| **Editor manual de layout do PDF / exportar .doc** | Fora. Não quebrar questão entre páginas é tratado como qualidade da geração, não como editor. |

### 🤔 Em discussão e pendente de validação

- **Em discussão com a professora:** versionamento A/B/C de questões (provas realmente diferentes por aluno, não só embaralhadas).
- **Pendente de validação com o cliente:** questões discursivas · importação e exportação via Excel · nota disponibilizada por QR Code · retorno do cartão-resposta corrigido ao aluno · finalidade do campo e-mail do aluno · existência de alunos menores de idade.
- **Pendente de validação com a professora:** uso de Firebase Auth no lugar dos endpoints `/auth` previstos na Spec.

### 📅 Evolução ao longo do semestre

| | Entrega | Prazo |
|---|---|---|
| **N1** | Telas navegáveis com dados simulados, hospedadas | 11/09/2026 |
| **N2** | Mesmas telas ligadas ao MySQL, sem nenhum dado simulado | 23/10/2026 |
| **N3** | Escopo completo, validações e casos de borda, apresentação ao cliente | 27/11/2026 |

---

## ✅ 4. Requisitos

São **42 requisitos funcionais** e **20 não-funcionais**, escritos como ações do sistema e com métrica verificável.

**📋 Lista completa e fonte da verdade: [docs/Correctio_Requisitos_e_Telas.md](docs/Correctio_Requisitos_e_Telas.md)** — resumo rápido em [Principais_Requisitos_Correctio.md](docs/Principais_Requisitos_Correctio.md)

### Resumo por área

| Área | RFs | O que cobre |
|---|---|---|
| Conta | RF01–RF05 | Cadastro, login, recuperação, sessões, anonimização |
| Turmas e alunos | RF06–RF09, RF38–RF39 | Turmas, alunos, importação em lote, aviso de privacidade, anonimização de aluno |
| Questões | RF10–RF14 | CRUD, tags, filtros, embaralhamento por questão, importação |
| Provas | RF15–RF20 | Montagem manual e automática, duplicação, importação/exportação, arquivamento |
| Aplicações e PDF | RF21–RF25 | Aplicação, configuração e geração do PDF, QR Code, gabarito |
| Correção | RF26–RF32 | Envio de folhas, leitura automática, revisão, lançamento manual, atribuição |
| Notas e relatórios | RF33–RF36 | Consulta pública, estatísticas, exportação |
| Transversais | RF37, RF40–RF42 | Tour guiado por tela, trilha de auditoria, execução em segundo plano com notificação, desfazer ações |

### Requisitos não-funcionais — categorias

| Cód. | Categoria | Métrica resumida |
|---|---|---|
| RNF01–03 | Desempenho, escala, disponibilidade | p95 ≤ 300 ms · 500–600 professores e 10.000 alunos ativos · 99,5% de uptime |
| RNF04 | Segurança de acesso | HTTPS integral, token com renovação, bloqueio após 5 falhas em 15 min |
| RNF05 | Privacidade (LGPD) | Anonimização em até 24 h; nenhum dado pessoal em log |
| RNF06–07 | Usabilidade e confiabilidade | Ação principal em até 3 cliques · erro de leitura < 1% · 100% confirmado pelo professor |
| RNF08–10 | Testes, backup, compatibilidade | Unitários ≥ 80% nas regras críticas + E2E Cypress · backup diário com restauração testada · 2 últimas versões dos navegadores |
| RNF11 | Responsividade | 360 px a 1920 px, alvos ≥ 44 px, Lighthouse mobile ≥ 90 |
| RNF12–13 | Abuso, custo e resposta | Limite por rota escalonado por custo, com teto e alerta de orçamento · operação demorada confirma em < 1 s e notifica ao concluir |
| RNF14–16 | Isolamento e dados | 0 vazamento entre contas · código público ≥ 128 bits · arquivos privados, sem EXIF |
| RNF17–19 | Auditoria, API, tour | Trilha de auditoria · CSP, CORS, SQL parametrizado · tour de no máximo 4 passos e 90 caracteres |
| RNF20 | Qualidade contínua | Todo PR roda lint, tipos, testes, build e Sonar; merge bloqueado se falhar ou se a cobertura do código novo cair abaixo de 80% |

**🔒 Desenho de segurança, proteção de custo e LGPD: [docs/Seguranca_e_LGPD.md](docs/Seguranca_e_LGPD.md)**

### Regras de negócio que definem o produto

- **Uma prova é reutilizável.** Aplicá-la a outra turma cria uma nova Aplicação, nunca uma cópia da prova.
- **A soma da pontuação não é validada.** Fechar em 10,0 é responsabilidade do professor.
- **O PDF é um arquivo único consolidado**, nunca um arquivo por aluno ou por versão.
- **Embaralhamento de questões e de alternativas são independentes**, configuráveis por versão, e a ordem sorteada é persistida — é ela que torna a correção possível.
- **Cada folha impressa tem duas identificações distintas:** um número curto e legível, para o professor organizar o papel, e um código aleatório opaco dentro do QR Code, que é a chave de consulta. O número visível nunca serve como chave.
- **Regenerar o PDF invalida** as folhas anteriores, e é bloqueado depois da primeira correção confirmada — o caminho passa a ser criar nova Aplicação.
- **Nenhuma leitura de imagem vira nota sem confirmação do professor.**
- **A correção registra qual alternativa o aluno marcou**, não apenas acerto ou erro.
- **O aluno só vê gabarito e nota depois** que o professor publica e libera, respectivamente.
- **Remover aluno da turma não apaga notas** — e também não é exclusão de dado pessoal: para isso existe a anonimização (RF38).
- **Nada é apagado de verdade.** Arquivar e excluir são reversíveis (RF42); nenhum dado é descartado automaticamente por prazo. Exclusão definitiva só sob solicitação.
- **Operação demorada não trava a tela.** Gerar PDF, ler folhas e exportar confirmam em menos de 1 segundo, rodam em segundo plano e avisam quando ficam prontas — o professor continua trabalhando.

---

## 🖥️ 5. Telas

**25 telas:** 3 de acesso · 2 públicas · 20 do professor.

| Área | Telas |
|---|---|
| **Acesso** (3) | Login · Cadastro · Recuperar/redefinir senha |
| **Públicas, sem login** (2) | Consulta de nota e gabarito por QR Code · Aviso de privacidade |
| **Web Professor** (20) | Painel · Meu perfil · Turmas (lista, criar/editar, detalhe) · Banco de questões (lista, criar/editar) · Provas (lista, criar/editar, geração automática, detalhe) · Aplicações (lista, criar, gerar PDF, detalhe) · Correção (enviar folhas, revisar, pendentes de atribuição) · Relatórios (por aplicação, consolidado) |

A especificação detalhada de cada tela — conteúdo, elementos e destino de cada ação — está em [docs/Correctio_Requisitos_e_Telas.md](docs/Correctio_Requisitos_e_Telas.md), seção 8.

**Responsivo:** o menu lateral vira menu hambúrguer, as tabelas viram cards empilhados, e a tela de envio de folhas abre a câmera do celular direto. A consulta pública é desenhada primeiro para o celular, já que o aluno a abre escaneando o QR.

---

## 🏗️ 6. Stack e arquitetura

**Decisões completas e o porquê de cada uma: [docs/Arquitetura.md](docs/Arquitetura.md)**

**Front-end:** React com Vite e TypeScript. A especificação original indicava Vue; foi confirmado que o grupo pode seguir em React. Next.js foi avaliado e descartado — as telas ficam atrás de login, o back-end já é Express, e as vantagens do Next.js não se aplicam aqui.

**Back-end:** Node.js + Express + MySQL, em **arquitetura em camadas** — `rota → controle → serviço → repositório → model`, cada camada com uma responsabilidade única.

**A camada que torna a evolução barata:** a aplicação inteira conversa com uma única fronteira de repositórios. Na N1, a implementação lê do `localStorage`; na N2, do Express com MySQL. Os mesmos schemas de validação e os mesmos hooks servem aos dois — **nenhuma tela muda na migração**.

**Publicação:** GitHub Pages na N1, Firebase Hosting depois. A URL de consulta pública mantém o mesmo formato de caminho nas duas, porque ela vai impressa em papel dentro do QR Code e não pode quebrar.

**Entidades de domínio:** `User` · `RefreshToken` · `Class` · `Student` · `Question` · `Exam` · `Application` · `ExamVersion` · `AnswerSheet` · `Correction`

A estrutura obrigatória de cada uma segue a seção 8 da Spec SGP Católica e está travada em [docs/Modelo_de_Dados.md](docs/Modelo_de_Dados.md): campos podem ser acrescentados, mas nenhuma chave da Spec pode ser removida, renomeada ou ter a forma alterada.

---

## ▶️ 7. Como rodar

> ⏳ **Preenchido quando a fundação do projeto for criada.** O repositório contém hoje apenas a documentação — o código entra na primeira issue da N1.

**Versões previstas:** Node 22 LTS · React 19 · Vite · TypeScript

```bash
npm install
npm run dev       # ambiente local
npm run build     # gera a versão publicável
npm run test      # testes unitários com cobertura
npm run test:e2e  # testes Cypress
```

**Contribuindo:** todo trabalho entra por Pull Request. O merge só libera depois que lint, tipos, testes, build e o portão do SonarCloud passarem — detalhes em [CI_CD.md](docs/CI_CD.md).

---

## 📚 Documentação

| Documento | Conteúdo |
|---|---|
| [Modelo_de_Dados.md](docs/Modelo_de_Dados.md) | **Normativo:** estrutura obrigatória de cada entidade, conforme a Spec SGP Católica |
| [Correctio_Requisitos_e_Telas.md](docs/Correctio_Requisitos_e_Telas.md) | **Fonte da verdade:** RFs, RNFs, regras de negócio e especificação das 25 telas |
| [Principais_Requisitos_Correctio.md](docs/Principais_Requisitos_Correctio.md) | Resumo derivado do documento acima, para consulta rápida |
| [Arquitetura.md](docs/Arquitetura.md) | Decisões técnicas, camada de repositórios, stack, organização do código |
| [Seguranca_e_LGPD.md](docs/Seguranca_e_LGPD.md) | Autorização, limite de requisições, proteção de custo, LGPD |
| [Tour_Guiado.md](docs/Tour_Guiado.md) | Tour contextual por tela: regras de escrita, comportamento e o texto de cada passo |
| [CI_CD.md](docs/CI_CD.md) | Portão de qualidade nos Pull Requests, proteção de branch e publicação |
| `Escopo do Projeto e Criterios de Avaliacao.md` | Critérios de avaliação da disciplina (documento da professora) |

---

<div align="center">

*README v1.1 — 02/09/2026*

</div>
