# Backlog da N2

Planejamento da N2, que vence em **23/10/2026**: 57 tarefas, cada uma com responsável, prazo e
checklist de aceite. Este documento é um retrato de 09/10/2026. O estado atual de cada tarefa fica
no [GitHub Project 4](https://github.com/users/PrieTorres/projects/4).

A mesma lista está na planilha [Backlog_N2.xlsx](Backlog_N2.xlsx), com filtros e as abas de distribuição e
cronograma.

## Como uma tarefa é concluída

- Cada tarefa é uma issue do milestone N2, com checklist de aceite no corpo.
- Ela fecha pelo merge de um PR com `Closes #N`, aprovado pela PM, com o checklist da issue e do PR marcados
  e o vídeo do teste anexado. Documentação, infraestrutura, processo, QA, UX e validação de escopo dispensam o vídeo.
- Só a PM conclui tarefas. Uma issue fechada por outra pessoa é reaberta automaticamente.

## Distribuição

Cada integrante desenvolve uma frente e revisa e testa a frente de outro colega, em ciclo. Assim, ninguém revisa
nem testa o próprio código.

| Integrante | Tarefas | Desenvolve | Revisa e testa os PRs de |
|---|---|---|---|
| Priscila Torres | 13 | Infraestrutura, API base, banco, CI e deploy, leitura do QR, ADRs | Todos os PRs (code owner) |
| Heloísa Fogaça | 11 | Acesso (login, cadastro, senha) e consulta pública por QR | Turmas e aplicações |
| Jeliel Nunes | 11 | Turmas, aplicações e PDF, exportação de relatórios | Banco de questões e provas |
| Cleberson Maia | 11 | Banco de questões e provas | Correção, painel e relatórios |
| Fabricio da Silva | 11 | Correção, painel e relatórios | Acesso e consulta pública |

A Priscila tem duas tarefas a mais porque, como PM e única code owner, revisa todos os PRs e conduz o planejamento.

## Tarefas por prazo

| Prazo | Issue | Tarefa | Responsável | Tipo | Origem |
|---|---|---|---|---|---|
| 09/10 | [#37](https://github.com/PrieTorres/correctio-app/issues/37) | chore: set up delivery rules, templates and ruleset | Priscila Torres | Processo | Plano da N2 |
| 09/10 | [#85](https://github.com/PrieTorres/correctio-app/issues/85) | docs: N2 backlog plan as a spreadsheet and a docs page | Priscila Torres | Processo | Atividade de planejamento da N2 |
| 10/10 | [#31](https://github.com/PrieTorres/correctio-app/issues/31) | montar backend voltado para banco de dados produtivo | Priscila Torres | Desenvolvimento | Issue já existente |
| 10/10 | [#36](https://github.com/PrieTorres/correctio-app/issues/36) | fix: clear high and critical npm audit findings | Priscila Torres | Infraestrutura | Ajuste pendente (portão vermelho na main) |
| 11/10 | [#32](https://github.com/PrieTorres/correctio-app/issues/32) | criar banco de dados mysql e conectar ao projeto com envs e cadastrar envs no repo | Priscila Torres | Infraestrutura | Issue já existente |
| 12/10 | [#38](https://github.com/PrieTorres/correctio-app/issues/38) | feat(web): HTTP repository adapter replacing localStorage | Priscila Torres | Desenvolvimento | Plano da N2 |
| 12/10 | [#83](https://github.com/PrieTorres/correctio-app/issues/83) | po: settle the open decisions with the professor (Firebase Auth, A/B/C versions) | Heloísa Fogaça | Validação de escopo | Pendência do README (professora) |
| 13/10 | [#26](https://github.com/PrieTorres/correctio-app/issues/26) | diagrama de caso de uso | Heloísa Fogaça | Documentação | Issue já existente |
| 13/10 | [#39](https://github.com/PrieTorres/correctio-app/issues/39) | ci: run API tests and migrations, deploy the API | Priscila Torres | Infraestrutura | Plano da N2 |
| 13/10 | [#40](https://github.com/PrieTorres/correctio-app/issues/40) | feat: authentication end to end (register, sign-in, refresh, sign-out) | Heloísa Fogaça | Desenvolvimento | Plano da N2 |
| 13/10 | [#53](https://github.com/PrieTorres/correctio-app/issues/53) | ux: review access and public lookup screens | Heloísa Fogaça | UX | Plano da N2 |
| 13/10 | [#57](https://github.com/PrieTorres/correctio-app/issues/57) | ux: review classes and applications screens | Jeliel Nunes | UX | Plano da N2 |
| 13/10 | [#61](https://github.com/PrieTorres/correctio-app/issues/61) | ux: review question bank and exams screens | Cleberson Maia | UX | Plano da N2 |
| 13/10 | [#65](https://github.com/PrieTorres/correctio-app/issues/65) | ux: review grading, dashboard and reports screens | Fabricio da Silva | UX | Plano da N2 |
| 14/10 | [#41](https://github.com/PrieTorres/correctio-app/issues/41) | feat(api): classes and students CRUD | Jeliel Nunes | Desenvolvimento | Plano da N2 |
| 14/10 | [#70](https://github.com/PrieTorres/correctio-app/issues/70) | docs: ER diagram (MER/DER) for README v2 | Fabricio da Silva | Documentação | Plano da N2 |
| 14/10 | [#77](https://github.com/PrieTorres/correctio-app/issues/77) | fix(web): send "Corrigir folhas" on the dashboard to grading | Fabricio da Silva | Desenvolvimento | Feedback da N1 |
| 15/10 | [#42](https://github.com/PrieTorres/correctio-app/issues/42) | feat(web): class and student screens on the API, including bulk import | Jeliel Nunes | Desenvolvimento | Plano da N2 |
| 15/10 | [#43](https://github.com/PrieTorres/correctio-app/issues/43) | feat(api): question bank CRUD with server-side filters | Cleberson Maia | Desenvolvimento | Plano da N2 |
| 16/10 | [#44](https://github.com/PrieTorres/correctio-app/issues/44) | feat(web): question bank screens on the API | Cleberson Maia | Desenvolvimento | Plano da N2 |
| 16/10 | [#69](https://github.com/PrieTorres/correctio-app/issues/69) | po: validate open scope items with the client | Heloísa Fogaça | Validação de escopo | Pendência do README (cliente) |
| 16/10 | [#84](https://github.com/PrieTorres/correctio-app/issues/84) | docs: first architecture decision records in docs/adr | Priscila Torres | Documentação | Modelo de documentação da disciplina |
| 17/10 | [#45](https://github.com/PrieTorres/correctio-app/issues/45) | feat: exams on the API, with the automatic draw on the server | Cleberson Maia | Desenvolvimento | Plano da N2 |
| 18/10 | [#46](https://github.com/PrieTorres/correctio-app/issues/46) | feat: applications, exam versions and answer sheets with QR code | Jeliel Nunes | Desenvolvimento | Plano da N2 |
| 18/10 | [#62](https://github.com/PrieTorres/correctio-app/issues/62) | qa: exploratory test of question bank and exams on the real database | Jeliel Nunes | QA exploratório | Plano da N2 |
| 18/10 | [#64](https://github.com/PrieTorres/correctio-app/issues/64) | review: code review of the question bank and exams pull requests | Jeliel Nunes | Code review | Plano da N2 |
| 19/10 | [#47](https://github.com/PrieTorres/correctio-app/issues/47) | feat(api): answer sheet upload and correction review | Fabricio da Silva | Desenvolvimento | Plano da N2 |
| 19/10 | [#58](https://github.com/PrieTorres/correctio-app/issues/58) | qa: exploratory test of classes and applications on the real database | Heloísa Fogaça | QA exploratório | Plano da N2 |
| 19/10 | [#63](https://github.com/PrieTorres/correctio-app/issues/63) | test(e2e): Cypress coverage for question bank and exams against the API | Cleberson Maia | Teste automatizado | Plano da N2 |
| 19/10 | [#78](https://github.com/PrieTorres/correctio-app/issues/78) | feat: read the QR code and the marks from the sheet photo (RF27) | Priscila Torres | Desenvolvimento | Feedback da N1 |
| 20/10 | [#28](https://github.com/PrieTorres/correctio-app/issues/28) | Diagrama de Classe | Cleberson Maia | Documentação | Issue já existente |
| 20/10 | [#48](https://github.com/PrieTorres/correctio-app/issues/48) | feat(web): grading screens with real upload | Fabricio da Silva | Desenvolvimento | Plano da N2 |
| 20/10 | [#49](https://github.com/PrieTorres/correctio-app/issues/49) | feat: public QR lookup on the API | Heloísa Fogaça | Desenvolvimento | Plano da N2 |
| 20/10 | [#59](https://github.com/PrieTorres/correctio-app/issues/59) | test(e2e): Cypress coverage for classes and applications against the API | Jeliel Nunes | Teste automatizado | Plano da N2 |
| 21/10 | [#27](https://github.com/PrieTorres/correctio-app/issues/27) | Diagrama de Atividade | Jeliel Nunes | Documentação | Issue já existente |
| 21/10 | [#29](https://github.com/PrieTorres/correctio-app/issues/29) | Diagrama de Sequência | Cleberson Maia | Documentação | Issue já existente |
| 21/10 | [#50](https://github.com/PrieTorres/correctio-app/issues/50) | feat: dashboard, profile and reports on the API | Fabricio da Silva | Desenvolvimento | Plano da N2 |
| 21/10 | [#54](https://github.com/PrieTorres/correctio-app/issues/54) | qa: exploratory test of access and public lookup on the real database | Fabricio da Silva | QA exploratório | Plano da N2 |
| 21/10 | [#56](https://github.com/PrieTorres/correctio-app/issues/56) | review: code review of the access and public lookup pull requests | Fabricio da Silva | Code review | Plano da N2 |
| 21/10 | [#71](https://github.com/PrieTorres/correctio-app/issues/71) | docs: README v2 with integration status | Cleberson Maia | Documentação | Plano da N2 |
| 22/10 | [#35](https://github.com/PrieTorres/correctio-app/issues/35) | Testar passo e cenários da aplicação | Heloísa Fogaça | QA exploratório | Issue já existente |
| 22/10 | [#51](https://github.com/PrieTorres/correctio-app/issues/51) | chore(web): remove every simulated data source from production | Priscila Torres | Desenvolvimento | Plano da N2 |
| 22/10 | [#52](https://github.com/PrieTorres/correctio-app/issues/52) | chore: republish with backend and cut release 2.0.0 | Priscila Torres | Entrega | Plano da N2 |
| 22/10 | [#55](https://github.com/PrieTorres/correctio-app/issues/55) | test(e2e): Cypress coverage for access and public lookup against the API | Heloísa Fogaça | Teste automatizado | Plano da N2 |
| 22/10 | [#60](https://github.com/PrieTorres/correctio-app/issues/60) | review: code review of the classes and applications pull requests | Heloísa Fogaça | Code review | Plano da N2 |
| 22/10 | [#66](https://github.com/PrieTorres/correctio-app/issues/66) | qa: exploratory test of grading, dashboard and reports on the real database | Cleberson Maia | QA exploratório | Plano da N2 |
| 22/10 | [#67](https://github.com/PrieTorres/correctio-app/issues/67) | test(e2e): Cypress coverage for grading, dashboard and reports against the API | Fabricio da Silva | Teste automatizado | Plano da N2 |
| 22/10 | [#68](https://github.com/PrieTorres/correctio-app/issues/68) | review: code review of the grading, dashboard and reports pull requests | Cleberson Maia | Code review | Plano da N2 |
| 22/10 | [#79](https://github.com/PrieTorres/correctio-app/issues/79) | docs: screen captures with captions in README section 4 | Jeliel Nunes | Documentação | Feedback da N1 |
| 22/10 | [#80](https://github.com/PrieTorres/correctio-app/issues/80) | docs: team roles and contributions in README section 14 | Fabricio da Silva | Documentação | Feedback da N1 |
| 22/10 | [#81](https://github.com/PrieTorres/correctio-app/issues/81) | review: code review of teammates' pull requests | Priscila Torres | Code review | Feedback da N1 |
| 22/10 | [#82](https://github.com/PrieTorres/correctio-app/issues/82) | feat: export reports as Excel, CSV and PDF (RF36) | Jeliel Nunes | Desenvolvimento | Mock da N1 a remover (RF36) |
| 23/10 | [#72](https://github.com/PrieTorres/correctio-app/issues/72) | docs: N2 logbook — Priscila | Priscila Torres | Documentação | Plano da N2 |
| 23/10 | [#73](https://github.com/PrieTorres/correctio-app/issues/73) | docs: N2 logbook — Heloísa | Heloísa Fogaça | Documentação | Plano da N2 |
| 23/10 | [#74](https://github.com/PrieTorres/correctio-app/issues/74) | docs: N2 logbook — Jeliel | Jeliel Nunes | Documentação | Plano da N2 |
| 23/10 | [#75](https://github.com/PrieTorres/correctio-app/issues/75) | docs: N2 logbook — Cleberson | Cleberson Maia | Documentação | Plano da N2 |
| 23/10 | [#76](https://github.com/PrieTorres/correctio-app/issues/76) | docs: N2 logbook — Fabricio | Fabricio da Silva | Documentação | Plano da N2 |
