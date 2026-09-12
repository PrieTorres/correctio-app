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

**O produto não é feito para um professor só.** O entrevistado é o primeiro cliente, não o único: o que ele não usa continua disponível, opcional em vez de obrigatório. Ele não libera nota por QR Code e não usa questões discursivas — outros clientes usam, e os dois recursos ficam.

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
| **Questões** | Objetivas (2 a 5 alternativas) e discursivas, com tags, filtros, soft-delete, importação em lote e imagens no enunciado |
| **Provas** | Montagem manual ou automática por filtros, até 20 questões, duplicação, importação e exportação |
| **Aplicações** | Associa prova a turma; permite reaplicação |
| **PDF** | Arquivo único consolidado: nº de versões, embaralhamento configurável, QR Code único por folha, com ou sem identificação. Questão nunca quebra entre páginas, e prova ímpar ganha folha em branco ao final |
| **Gabarito** | Publicação por versão ou pela aplicação inteira |
| **Correção** | Envio de foto/scan da folha, leitura automática das marcações, revisão obrigatória do professor, lançamento manual como alternativa |
| **Notas** | Consulta pelo aluno via QR Code, sem login. O professor decide se libera só o gabarito ou o gabarito com a nota |
| **Relatórios** | Por aplicação e consolidado, com exportação |

### 🚫 Fora do MVP

| Item | Decisão |
|---|---|
| **App mobile nativo** | Fora em qualquer hipótese. Tudo pelo site responsivo. |
| **Área do aluno com login** | Fora. O aluno é um registro da turma e consulta a nota pelo QR Code da sua folha. |
| **Editor manual de layout do PDF / exportar .doc** | Fora. A paginação é comportamento da geração (RF43, RF44), não configuração que o professor ajusta. |

### 🤔 Em discussão e pendente de validação

- **Em discussão com a professora:** versionamento A/B/C de questões (provas realmente diferentes por aluno, não só embaralhadas).
- **Pendente de validação com o cliente:** importação e exportação via Excel · retorno do cartão-resposta corrigido ao aluno · finalidade do campo e-mail do aluno · existência de alunos menores de idade.
- **Pendente de validação com a professora:** uso de Firebase Auth no lugar dos endpoints `/auth` previstos na Spec.

### 📅 Evolução ao longo do semestre

| | Entrega | Prazo |
|---|---|---|
| **N1** | Telas navegáveis com dados simulados, hospedadas | 11/09/2026 |
| **N2** | Mesmas telas ligadas ao MySQL, sem nenhum dado simulado | 23/10/2026 |
| **N3** | Escopo completo, validações e casos de borda, apresentação ao cliente | 27/11/2026 |

---

## ✅ 4. Requisitos

São **48 requisitos funcionais** e **20 não-funcionais**, escritos como ações do sistema e com métrica verificável.

**📋 Lista completa e fonte da verdade: [docs/Correctio_Requisitos_e_Telas.md](docs/Correctio_Requisitos_e_Telas.md)** — resumo rápido em [Principais_Requisitos_Correctio.md](docs/Principais_Requisitos_Correctio.md)

### Resumo por área

| Área | RFs | O que cobre |
|---|---|---|
| Conta | RF01–RF05 | Cadastro, login, recuperação, sessões, anonimização |
| Turmas e alunos | RF06–RF09, RF38–RF39 | Turmas, alunos, importação em lote, aviso de privacidade, anonimização de aluno |
| Questões | RF10–RF14, RF45 | CRUD, tags, filtros, embaralhamento por questão, importação, imagens no enunciado |
| Provas | RF15–RF20 | Montagem manual e automática, duplicação, importação/exportação, arquivamento |
| Aplicações e PDF | RF21–RF25, RF43–RF44 | Aplicação, geração do PDF, QR Code, gabarito, paginação por questão e folha par |
| Correção | RF26–RF32, RF47–RF48 | Envio de folhas, leitura automática, revisão, lançamento manual, atribuição, correção parcial quando há discursivas |
| Notas e relatórios | RF33–RF36, RF46 | Consulta pública em dois níveis, estatísticas, exportação |
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
- **Discursiva não bloqueia a correção automática.** Numa prova mista o sistema corrige as objetivas sozinho e deixa a correção em andamento até o professor lançar as notas das discursivas.
- **O aluno vê o que o professor liberou, em dois níveis:** publicar o gabarito mostra as respostas certas; liberar as notas acrescenta a nota dele. Nota sem gabarito não existe.
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

**Versões em uso:** Node 22 LTS · React 19 · Vite 6 · TypeScript 5.7 · Tailwind 4 · Vitest 3 · Cypress 15

```bash
npm install       # instala o monorepo inteiro (npm workspaces)
npm run dev       # ambiente local em http://localhost:5173
npm run build     # gera a versão publicável
npm run preview   # serve a versão publicável em http://localhost:4173
npm run typecheck # verificação de tipos
npm run lint      # ESLint e o verificador de idioma dos comentários
npm test          # testes unitários com cobertura
npm run test:e2e  # Cypress contra o build de produção
```

### A N1 roda sem back-end

Não há servidor nem banco: os dados ficam no `localStorage` do navegador. Abrir o link
publicado já mostra um sistema cheio — turmas, questões, provas, uma aplicação gerada e outra
por gerar. Os botões **Aplicar** e **Limpar** no rodapé do menu repõem ou esvaziam essa
demonstração a qualquer momento.

Três coisas são simuladas de propósito, porque exigem servidor:

| Simulado | O que é real |
|---|---|
| A montagem do arquivo PDF | As versões com o layout impresso gravado e as folhas com código único |
| A leitura da foto da folha | A correção das objetivas, o status parcial e a confirmação do professor |
| O e-mail de recuperação de senha | O fluxo da tela e a resposta que não revela quem tem conta |

### Se o Cypress não abrir

`bad option: --no-sandbox` significa `ELECTRON_RUN_AS_NODE=1` no ambiente — o VS Code define
essa variável para o processo de extensões, e com ela o Electron do Cypress roda como Node
puro. Os scripts já a removem com `env -u`; rodando o binário direto, faça o mesmo.

**Contribuindo:** todo trabalho entra por Pull Request. O merge só libera depois que lint,
tipos, testes, build e o portão do SonarCloud passarem — detalhes em [CI_CD.md](docs/CI_CD.md).

---

## 🧪 8. Qualidade

| Verificação | Estado |
|---|---|
| Testes unitários | 436, cobertura de linhas em 99% |
| Testes de ponta a ponta | 137 cenários Cypress, em 9 specs |
| Tipos | `tsc --noEmit` sem erros, em modo estrito |
| Lint | ESLint sem apontamentos, incluindo as regras próprias do grupo |

As regras críticas — cálculo da nota, paginação do PDF, sorteio de questões, estatísticas e
o que a consulta pública pode mostrar — vivem em funções puras sob `apps/web/src/lib`,
testadas sem renderizar tela nenhuma.

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

*README v2 — 12/09/2026 · versão 1.0.0*

</div>
