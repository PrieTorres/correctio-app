| **PROJETO E ARQUITETURA DE SOFTWARE** **Escopo do Projeto e Critérios de Avaliação — N1, N2 e N3** |
| --- |
 
|  |
| --- |
 
| **FASE 01 — N1: Telas navegáveis** |
| --- |
 
| **Escopo — o que precisa estar pronto até esta N** A N1 encerra a primeira fase da disciplina. As equipes já entregam código nesta fase, não é só organização de processo. O que ainda NÃO existe até a N1 é conexão com banco de dados: as telas são construídas e hospedadas, podendo usar dados estáticos/mock, apenas para o cliente já conseguir visualizar o sistema tomando forma. |
| --- |
 
**Passo a passo**
 
| **01** | Formação das equipes que vão levar o projeto até o fim do semestre. |
| --- | --- |
| **02** | Ler o briefing do cliente e, em equipe, esboçar as primeiras classes de domínio do sistema. |
| **03** | Criar o repositório da equipe no GitHub e estruturar as primeiras Issues, uma para cada parte do trabalho identificada a partir do briefing do cliente. |
| **04** | Construir as telas principais do sistema, navegáveis (a tela A leva à tela B), com dados estáticos/mock, ainda sem conexão real ao banco. |
| **05** | Fazer commits e abrir Pull Requests ao longo de toda a fase e, principalmente, revisar e dar merge neles. |
| **06** | Escrever o README v1 conforme o modelo da disciplina (modelo_doc.md). |
| **07** | Manter o diário de organização de tarefas individual com evidências de commits e PRs aprovados e mergeados. |
| **08** | Publicar o sistema em um serviço de hospedagem gratuito (Netlify, Vercel, GitHub Pages ou similar). |
| **09** | Entregar, no fim da fase: o código-fonte completo zipado, a documentação e o link do sistema hospedado. |
 
**Critérios N1**
 
| **Cód.** | **Critério** | **Peso** | **Descrição** |
| --- | --- | --- | --- |
| **C1** | **Código-fonte Compactado** | **10%** | Pasta .zip contendo o repositório completo (sem node_modules). |
| **C2** | **Sistema Hospedado** | **20%** | Link funcionando em serviço de hospedagem gratuito (Netlify, Vercel, GitHub Pages ou similar), com as telas do sistema construídas e navegáveis. |
| **C3** | **Documentação (README)** | **20%** | README v1 conforme o modelo definido pela disciplina (modelo_doc.md): visão geral, escopo, RF/RNF, telas principais e instruções de como rodar a aplicação (incluindo versões utilizadas). |
| **C4** | **Diário de Organização de Tarefas Individual** | **50%** | Tarefas do aluno + evidências (prints) de commits e Pull Requests aprovados e mergeados. Se algum PR foi reprovado antes de aprovar, o diário mostra o histórico até a aprovação, não só o resultado final. Inclui comprovação de que o código do aluno está de fato integrado ao sistema hospedado entregue. |
 
| **REGRA** A Nota Individual (C4) só reconhece o que está de fato mergeado e presente no sistema hospedado entregue: código desenvolvido cujo PR nunca foi revisado, aprovado e/ou integrado ao projeto conta apenas parcialmente, pois na prática não chegou a fazer parte do sistema. Essa regra é válida para todas as Ns. |
| --- |
 
| **FASE 02 — N2: Integração real com banco de dados** |
| --- |
 
| **Escopo — o que precisa estar pronto até a N2** A N2 avança a partir da estrutura navegável entregue na N1. O sistema deixa de depender de dados mock: as telas principais passam a ler e gravar dados em um banco de dados real (MySQL), com as operações básicas (conforme o escopo do cliente) funcionando de ponta a ponta em pelo menos as funcionalidades centrais do sistema. |
| --- |
 
**Passo a passo**
 
| **01** | Conectar o sistema a um banco de dados real (MySQL, vide documentação da API) e substituir os dados mock pelas operações reais nas telas já existentes, seguindo a arquitetura em camadas. |
| --- | --- |
| **02** | Modelar o banco de dados (MER/DER) e documentar as decisões de arquitetura. |
| **03** | Ampliar/ajustar as classes de domínio e as Issues. |
| **04** | Continuar o fluxo de commits, Pull Requests, revisão e merge, nenhum PR pendente ao final da fase. |
| **05** | Atualizar o README para a v2. |
| **06** | Manter o diário de organização de tarefas individual atualizado, separando o que foi feito na N1 do que foi feito na N2. |
| **07** | Republicar o sistema hospedado, agora com o backend conectado. |
| **08** | Entregar o código-fonte completo zipado, com a documentação e o link do sistema hospedado atualizado, com banco de dados funcional (nessa etapa já não deve conter nenhum mock). |
 
**Critérios N2**
 
| **Cód.** | **Critério** | **Peso** | **Descrição** |
| --- | --- | --- | --- |
| **C1** | **Código-fonte Compactado** | **10%** | Projeto completo zipado, refletindo a conexão real com o banco de dados. |
| **C2** | **Sistema Hospedado (com banco)** | **40%** | Sistema hospedado com as telas operando sobre banco de dados real, cadastrar/listar/editar/excluir conforme o escopo, sem dado fixo/mock (mock presente gera desconto de nota). |
| **C3** | **Documentação (README v2)** | **20%** | README atualizado: diagramas UML, modelo de dados (MER/DER) e o estado atual da integração com o banco. |
| **C4** | **Diário de Organização de Tarefas Individual** | **30%** | Evidências de commits e PRs aprovados e mergeados + comprovação de integração do código no sistema hospedado entregue, separando o que foi feito na N1 do que foi feito na N2. |
 
| **FASE 03 — N3: Refinamentos, entrega final e apresentação ao cliente** |
| --- |
 
| **Escopo — o que precisa estar pronto até esta N** A N3 é a entrega final do semestre. O sistema deve estar completo dentro do escopo definido com o cliente, com todas as funcionalidades planejadas implementadas, integradas ao banco de dados e efetivamente mergeadas na branch principal, não bastam partes desenvolvidas isoladamente em PRs abertos. Esta fase inclui também a apresentação do produto ao cliente real. |
| --- |
 
**Passo a passo**
 
| **01** | Finalizar todas as funcionalidades previstas no escopo (revisado ao longo do semestre) e garantir que estejam integradas ao banco de dados. |
| --- | --- |
| **02** | Fechar todas as Issues e garantir que todo PR relevante tenha sido revisado, aprovado e mergeado antes do prazo, não deixar trabalho pronto "preso" em PR aberto. |
| **03** | Testar o sistema final de ponta a ponta, cobrindo o fluxo completo do usuário nas funcionalidades centrais, com validações e tratamento de casos de borda e erros. |
| **04** | Atualizar o README para a versão final conforme o modelo modelo_doc.md, incluindo o manual do usuário (pode ser um arquivo .md separado, com link a partir do README). |
| **05** | Finalizar o diário de organização de tarefas individual com todas as evidências da fase. |
| **06** | Preparar e realizar a apresentação (Pitch) do produto final para o cliente. |
| **07** | Entregar o código-fonte completo zipado, com documentação e manual do usuário, e o link do sistema hospedado, na versão final e funcional. |
 
**Critérios N3**
 
| **Cód.** | **Critério** | **Peso** | **Descrição** |
| --- | --- | --- | --- |
| **C1** | **Código-fonte Compactado** | **10%** | Pasta .zip contendo o repositório completo. |
| **C2** | **Sistema Hospedado (versão final)** | **50%** | Sistema completo, funcional e integrado ao banco de dados, refletindo o escopo definido com o cliente, com validações e casos de borda tratados. |
| **C3** | **Documentação (README final + manual do usuário)** | **20%** | README final conforme o modelo modelo_doc.md, arquitetura em camadas, decisões de arquitetura, incluindo o manual do usuário (pode ser um arquivo .md separado, com link a partir do README). |
| **C4** | **Diário de Organização de Tarefas Individual** | **10%** | Evidências finais de commits e PRs aprovados e mergeados + comprovação de integração do código no sistema hospedado entregue. |
| **C5** | **Apresentação ao Cliente (Pitch)** | **10%** | Demonstração ao vivo do sistema hospedado funcionando, clareza da comunicação e domínio técnico da equipe. |