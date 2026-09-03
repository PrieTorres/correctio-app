# Análise de Requisitos e Especificação de Telas

**Correctio — Sistema de Geração e Correção de Provas · Grupo 2 · Projeto e Arquitetura de Software**

Revisado após a apresentação de 28/08 · atualizado em 02/09/2026 · N1 até 11/09/2026 (faltam 9 dias)

---

## Resumo

O que mudou depois da apresentação de 28/08:

- **Sem área do aluno.** Aluno não tem login. Ele consulta nota e gabarito escaneando o QR Code do próprio cartão-resposta — único por folha — em página pública.
- **Correção por escaneamento virou obrigatória no MVP.** Professor envia foto/scan da folha de respostas pelo site, o sistema lê as marcações e calcula a nota. Continua sem app mobile.
- **Importação em lote entrou no escopo:** alunos, questões e provas via Excel ou JSON.
- **Novos recursos:** montar prova automaticamente por filtros (tags, tipo, quantidade), duplicar prova, preferências de embaralhamento salvas na prova, embaralhamento de alternativas por questão, tour guiado.
- **Responsivo para celular:** todas as telas, inclusive a área do professor — o que permite fotografar as folhas de respostas direto do navegador do celular, sem app.
- **Regra da professora para o README:** RFs escritos como ações do sistema (senão desconta nota) e RNFs com métrica verificável. Seções 3 e 4 já estão nesse formato.
- **Pendente de validação com o cliente:** questões discursivas, importação/exportação via Excel, notas via QR Code para o aluno.

## 1. Sobre este documento e regra de ouro

Cruza o **Relato do Cliente**, a **Spec SGP Católica** e o retorno da apresentação de 28/08. A Spec continua sendo a base para entidades e API, mas a professora confirmou que o grupo pode adicionar campos e endpoints além do que está escrito nela.

**Nome da plataforma:** Correctio.

**Stack:** React + Vite + TypeScript no front (Vue era a preferência da Spec, mas React foi aceito). Backend Node.js + Express + MySQL, conforme a disciplina. Hospedagem: GitHub Pages na N1 (dados simulados em localStorage), migrando para Firebase Hosting com Firebase Auth nas fases seguintes. **[Firebase Auth: validar com a professora — substitui os endpoints /auth da Spec]**

*As decisões de arquitetura, o desenho de segurança/LGPD, a especificação do tour guiado e o portão de qualidade dos Pull Requests estão detalhados em documentos próprios no repositório (docs/Arquitetura.md, docs/Seguranca_e_LGPD.md, docs/Tour_Guiado.md, docs/CI_CD.md).*

**Recorte de escopo (definido pelo time e validado em 28/08):** 

- Sem app mobile em nenhuma hipótese — tudo pelo site.
- Sem área do aluno — o único usuário autenticado é o professor. Alunos são registros dentro das turmas, cadastrados pelo professor (um a um ou por importação).
- Correção por escaneamento da folha de respostas está no MVP — via upload de imagem pelo site, com revisão do professor antes de confirmar.
- Ações de gerenciamento (arquivar, duplicar, exportar) entram nas telas mesmo quando a Spec não define endpoint — fica como nota técnica de endpoint a criar.

## 2. Equipe — Grupo 2

| Nome completo | E-mail institucional / status |
|---|---|
| Cleberson Luis Vieira Martins Maia | cleberson.maia@catolicasc.edu (conferir se falta o ".br" final) |
| Fabricio da Silva Junior | ainda não enviado no grupo |
| Heloísa Fogaça do Nascimento | h.nascimento@catolicasc.edu.br |
| Jeliel Nunes da Silva | ainda não enviado no grupo |
| Priscila Torres Benedito de Paula | priscila.paula@catolicasc.edu.br |

Board de tarefas: GitHub Project *github.com/users/PrieTorres/projects/4* — registra quem fez o quê e quando (inclui os slides da apresentação).

## 3. Requisitos Funcionais (RF) — escritos como ações

Formato exigido pela professora: cada RF descreve uma ação que pode ser feita dentro do sistema. Itens marcados com **[validar]** dependem de confirmação do cliente.

| Cód. | Requisito | Área |
|---|---|---|
| RF01 | O sistema deve permitir que o professor se cadastre com nome, e-mail válido e único, e senha de no mínimo 8 caracteres. | Conta |
| RF02 | O sistema deve permitir que o professor faça login e receba JWT + refresh token. | Conta |
| RF03 | O sistema deve permitir que o professor recupere a senha por e-mail. | Conta |
| RF04 | O sistema deve permitir que o professor encerre a sessão atual ou todas as sessões ativas. | Conta |
| RF05 | O sistema deve permitir que o professor consulte os próprios dados e anonimize a própria conta de forma irreversível. | Conta |
| RF06 | O sistema deve permitir que o professor crie, edite e arquive turmas (nome, disciplina, período). | Turmas |
| RF07 | O sistema deve permitir que o professor cadastre alunos em uma turma (nome, matrícula, e-mail opcional). [validar minimização] | Turmas |
| RF08 | O sistema deve permitir que o professor importe alunos em lote a partir de planilha Excel ou arquivo JSON. [validar] | Turmas |
| RF09 | O sistema deve permitir que o professor remova um aluno da turma preservando o histórico de notas. | Turmas |
| RF10 | O sistema deve permitir que o professor crie, edite e exclua (soft-delete) questões objetivas (2 a 5 alternativas, 1 correta) e discursivas (enunciado + nota máxima). [validar discursivas] | Questões |
| RF11 | O sistema deve permitir que o professor classifique cada questão com tags de categoria/conteúdo. | Questões |
| RF12 | O sistema deve permitir que o professor filtre questões por tipo, tag e texto do enunciado. | Questões |
| RF13 | O sistema deve permitir que o professor defina, para cada questão ao montar a prova, se as alternativas podem ser embaralhadas — com o padrão vindo do cadastro da questão. | Questões |
| RF14 | O sistema deve permitir que o professor importe questões em lote via Excel ou JSON. [validar] | Questões |
| RF15 | O sistema deve permitir que o professor monte uma prova selecionando até 20 questões do banco e definindo a pontuação de cada uma. | Provas |
| RF16 | O sistema deve permitir que o professor gere uma prova automaticamente a partir de filtros: tags, incluir discursivas ou não, quantidade de questões. | Provas |
| RF17 | O sistema deve permitir que o professor salve na prova as preferências padrão de embaralhamento (questões e alternativas), a serem herdadas pela aplicação. | Provas |
| RF18 | O sistema deve permitir que o professor duplique uma prova existente. | Provas |
| RF19 | O sistema deve permitir que o professor importe e exporte provas via Excel ou JSON. [validar] | Provas |
| RF20 | O sistema deve permitir que o professor arquive uma prova, bloqueando novas aplicações sem afetar as existentes. | Provas |
| RF21 | O sistema deve permitir que o professor aplique uma prova a uma turma, criando uma Aplicação. | Aplicações |
| RF22 | O sistema deve permitir que o professor configure a geração do PDF: nº de versões, embaralhamento (herdado da prova, editável por versão) e com/sem identificação do aluno. | Aplicações |
| RF23 | O sistema deve gerar um único PDF consolidado por Aplicação, com um QR Code único em cada cartão-resposta impresso, identificando a folha e, quando houver, o aluno. | Aplicações |
| RF24 | O sistema deve permitir que o professor regenere o PDF enquanto não houver correção confirmada, invalidando os QR Codes anteriores. | Aplicações |
| RF25 | O sistema deve permitir que o professor publique o gabarito por versão ou por Aplicação inteira. | Aplicações |
| RF26 | O sistema deve permitir que o professor envie a imagem (foto/scan) da folha de respostas de cada aluno, individualmente ou em lote. | Correção |
| RF27 | O sistema deve ler o QR Code e as marcações da imagem, comparar com o gabarito da versão e calcular a nota automaticamente. | Correção |
| RF28 | O sistema deve permitir que o professor revise e corrija manualmente qualquer leitura antes de confirmar a correção. | Correção |
| RF29 | O sistema deve permitir que o professor lance a nota das questões discursivas na mesma tela de revisão. [validar discursivas] | Correção |
| RF30 | O sistema deve permitir que o professor insira uma correção manualmente, sem imagem, quando a leitura falhar ou não houver folha digitalizada. | Correção |
| RF31 | O sistema deve atribuir a nota automaticamente ao aluno quando a prova tiver identificação, e permitir associação manual por nome/matrícula quando não tiver. | Correção |
| RF32 | O sistema deve armazenar cada correção com a alternativa marcada em cada questão, o acerto/erro, a nota por questão e a origem (imagem ou manual). | Correção |
| RF33 | O sistema deve disponibilizar ao aluno a nota e o gabarito da sua prova por meio do QR Code impresso nela, em página pública, após liberação pelo professor. [validar] | Notas |
| RF34 | O sistema deve gerar relatório de notas por Aplicação: lista por aluno, média, mediana, desvio padrão e distribuição. | Notas |
| RF35 | O sistema deve gerar estatística por questão (percentual de acerto e alternativa mais marcada) e por tag de categoria (percentual de acerto por conteúdo), para análise pedagógica. | Notas |
| RF36 | O sistema deve exportar relatórios em Excel, CSV e PDF. | Notas |
| RF37 | O sistema deve apresentar um tour guiado contextual na primeira visita a cada tela, destacando os elementos e ações daquela tela, com opção de pular a qualquer momento e de rever pelo botão "Ajuda". | Usabilidade |
| RF38 | O sistema deve permitir que o professor anonimize os dados pessoais de um aluno de forma irreversível, apagando nome, matrícula e e-mail e preservando a nota já registrada. | Turmas |
| RF39 | O sistema deve exibir aviso de privacidade ao professor no cadastro e na importação de alunos, informando que ele é responsável pelos dados de terceiros que insere. | Turmas |
| RF40 | O sistema deve registrar em trilha de auditoria toda operação sobre dado pessoal de aluno — criação, edição, anonimização, publicação de gabarito e liberação de notas — com autor, ação, entidade e data/hora. | Segurança |
| RF41 | O sistema deve confirmar imediatamente o início de operações demoradas (gerar PDF, ler folhas, importar e exportar em lote), informando que a execução ocorre em segundo plano, mantendo o professor livre para navegar e notificando-o quando o resultado ficar pronto. | Usabilidade |
| RF42 | O sistema deve permitir que o professor desfaça ações destrutivas, restaurando turmas, provas e aplicações arquivadas e questões excluídas, sem perda de vínculo com os registros que já as utilizavam. | Usabilidade |

**Minimização (RF07).** O e-mail do aluno é coletado hoje sem nenhuma finalidade no sistema: não existe área do aluno e nada é enviado a ele por e-mail. Coletar dado pessoal sem finalidade contraria o princípio da necessidade (LGPD, Art. 6º, III). Levar ao cliente: o campo tem uso previsto? Se não tiver, sai do cadastro e da importação.

## 4. Requisitos Não-Funcionais (RNF) — com métrica

Cada RNF traz um critério mensurável para dizer se foi atendido ou não, como pedido pela professora.

| Cód. | Categoria | Requisito e métrica |
|---|---|---|
| RNF01 | Desempenho | 95% das requisições da API respondem em até 300 ms. |
| RNF02 | Escalabilidade | Suportar 600 professores e 10.000 alunos cadastrados mantendo o RNF01. |
| RNF03 | Disponibilidade | Uptime mensal igual ou superior a 99,5%. |
| RNF04 | Segurança | 100% do tráfego em HTTPS; JWT com refresh; bloqueio temporário após 5 tentativas de login falhas em 15 minutos. |
| RNF05 | Privacidade (LGPD) | Anonimização de conta concluída em até 24 h após a solicitação; nenhum dado pessoal gravado em logs. |
| RNF06 | Usabilidade (minimalismo) | Toda ação principal — criar turma, criar prova, gerar PDF, corrigir uma folha — concluída em até 3 cliques a partir do painel. |
| RNF07 | Confiabilidade da correção | Taxa de erro na leitura das marcações abaixo de 1% em imagens com boa iluminação; 100% das leituras passam por confirmação do professor antes de virar nota. |
| RNF08 | Testabilidade | Testes unitários com cobertura ≥ 80% nas regras críticas (cálculo de nota, embaralhamento, geração de PDF, leitura da folha); testes E2E com Cypress cobrindo os fluxos principais de ponta a ponta; build reprovado se a cobertura cair abaixo do mínimo. |
| RNF09 | Backup e recuperação | Backup diário do banco com retenção de 30 dias; restauração testada e registrada 1x/mês; perda máxima aceitável de 24 h de dados e restabelecimento em até 4 h. |
| RNF10 | Compatibilidade | Funcionar nas 2 últimas versões de Chrome, Firefox, Edge e Safari, incluindo Chrome Android e Safari iOS. |
| RNF11 | Responsividade | Todas as telas utilizáveis de 360 px (celular) a 1920 px (desktop), sem rolagem horizontal da página; alvos de toque com no mínimo 44 px; Lighthouse mobile ≥ 90 em acessibilidade/usabilidade. |
| RNF12 | Proteção contra abuso e custo | 100% das rotas da API sob limite de requisições, escalonado por custo da operação; excedente responde HTTP 429 com Retry-After; rotas autenticadas limitadas por professor (não por IP); teto de instâncias configurado; alerta de orçamento em 50%, 80% e 100% do previsto. |
| RNF13 | Resposta imediata em operação demorada | Nenhuma operação cara (gerar PDF, ler folha, importar/exportar lote) bloqueia a tela: o sistema confirma o início em até 1 s, executa em segundo plano com no máximo 1 job concorrente por professor, e notifica na conclusão. O professor continua navegando durante a execução — nenhuma tela fica travada esperando. |
| RNF14 | Isolamento entre contas | 0 respostas da API contendo dado de outro professor; 100% das consultas escopadas pelo id do professor autenticado na camada de serviço; acesso a recurso de terceiro responde 404. Verificado por teste automatizado a cada build. |
| RNF15 | Segurança do código público | Código da folha com no mínimo 128 bits de entropia, aleatório e não sequencial; consulta pública limitada a 30 requisições/minuto por IP; página com noindex e robots.txt bloqueando indexação. |
| RNF16 | Segurança de arquivos | Armazenamento das imagens privado, acessível apenas por URL assinada com validade ≤ 15 min; 100% das imagens re-processadas no recebimento, com 0 campos EXIF persistidos; upload validado por tipo real do arquivo e limitado a 10 MB por imagem. |
| RNF17 | Auditoria (LGPD, Art. 37) | 100% das operações do RF40 registradas em trilha imutável; a trilha registra a ação e o autor, nunca o conteúdo do dado pessoal. |
| RNF18 | Endurecimento da API | Cabeçalhos de segurança e CSP ativos em 100% das respostas; CORS restrito a lista de origens conhecidas; payload JSON limitado a 100 KB; 100% das consultas SQL parametrizadas; container executado sem privilégio de root; build reprovado se houver vulnerabilidade alta ou crítica em dependência. |
| RNF19 | Objetividade do tour | No máximo 4 passos por tela e 90 caracteres por passo; o tour é dispensável em 1 clique e nunca impede o uso da tela; navegável por teclado e anunciado por leitor de tela. |
| RNF20 | Qualidade contínua | 100% dos Pull Requests executam automaticamente lint, verificação de tipos, testes unitários com cobertura, build e testes E2E; o merge é bloqueado se qualquer verificação falhar, se a cobertura do código novo ficar abaixo de 80%, se a duplicação no código novo passar de 3% ou se o portão do SonarCloud reprovar. Nenhum merge direto na branch principal, e todo PR exige ao menos 1 aprovação. |

**⚠️ Conferir a escala do RNF02.** Hoje o requisito diz 600 professores e 10.000 alunos cadastrados. Surgiu na discussão a expectativa de "10 mil professores simultâneos", que é ordem de grandeza bem diferente (cadastrados ≠ simultâneos, e 600 ≠ 10.000) e muda dimensionamento e custo. Definir qual é o número antes da N2.

**Nenhum dado é apagado automaticamente.** Não existe rotina de descarte por prazo: apagar dado que ninguém pediu para apagar é perda de informação, não conformidade. A exclusão acontece sob solicitação (RF38, anonimização de aluno; RF05, anonimização da conta), e tudo que é "excluído" pela interface é soft-delete reversível (RF42). O que protege contra perda é o backup com restauração testada (RNF09).

## 5. Regras de negócio

**Conta**

- Só professores têm conta; e-mail único, sem restrição de domínio; senha com mínimo de 8 caracteres.
- Anonimizar é irreversível: apaga nome/e-mail do professor, mas preserva turmas, provas e correções já registradas.
- Como o cadastro é aberto, o isolamento por conta (RNF14) é a única barreira protegendo os dados — cada professor enxerga exclusivamente o que ele criou.

**Alunos e turmas**

- Aluno é um registro da turma (nome, matrícula, e-mail opcional), não um usuário — não faz login.
- Um aluno pode estar em mais de uma turma; a matrícula é única dentro da mesma turma.
- Remover aluno da turma não apaga as notas já lançadas para ele.
- Remover aluno da turma **não é** exclusão de dado pessoal: quem exerce o direito de exclusão (LGPD, Art. 18) é o RF38, que anonimiza.

**Questões**

- Objetiva: 2 a 5 alternativas, exatamente 1 correta. Discursiva: enunciado + nota máxima.
- Excluir é soft-delete — a questão sai do banco, mas continua nas provas que já a usam.
- Cada questão tem uma opção “permitir embaralhar alternativas” (padrão ligada); desligar serve para questões com “todas as anteriores” e similares. Ao montar a prova, esse padrão pode ser ajustado questão a questão.

**Provas**

- Até 20 questões; pontuação livre por questão, soma não validada pelo sistema.
- Estados: rascunho → pronta (automático na 1ª aplicação) → arquivada (manual). Prova arquivada não recebe novas aplicações; as existentes seguem normais.
- A prova guarda preferências padrão de embaralhamento; a aplicação herda e pode alterar.
- Duplicar cria uma cópia em rascunho, com as mesmas questões e pontuações.

**Aplicações e PDF**

- A mesma prova pode ser aplicada a várias turmas ou reaplicada à mesma (2ª chamada).
- PDF único consolidado por Aplicação; embaralhamento independente por versão; identificação (com/sem) vale para a Aplicação inteira.
- Regenerar o PDF é bloqueado assim que existir uma correção confirmada — o professor deve criar nova Aplicação.

**Correção e notas**

- Nenhuma leitura de imagem vira nota sem confirmação do professor.
- A nota fica ligada à folha corrigida. Se a prova tinha identificação, vai direto para o aluno; se não, o vínculo folha → aluno fica pendente até o professor associar — mas o aluno já consegue consultar pela própria folha.
- Duas correções confirmadas para o mesmo aluno na mesma versão geram conflito para revisão — a primeira não é sobrescrita silenciosamente.
- Gabarito e nota só ficam visíveis na página pública do QR depois que o professor publica o gabarito e libera as notas, respectivamente.

**Identificação da folha**

Cada cartão-resposta impresso carrega duas identificações distintas, que não se misturam. O **número da folha** (ex.: "Folha 37") é curto, sequencial e legível, e serve para o professor organizar e conferir as pilhas de papel. O **código de consulta**, dentro do QR Code, é um token aleatório opaco de no mínimo 128 bits, e é a única chave que abre a página pública daquela folha. Separar os dois é o que permite ter um número curto legível no papel sem tornar as notas dos alunos varreduráveis por quem tentar códigos em sequência. O número da folha nunca serve como chave de consulta. Regenerar o PDF (RF24) invalida os códigos anteriores: a página pública responde "QR inválido", nunca a nota antiga.

**Nada é apagado de verdade**

Arquivar turma, prova ou aplicação e excluir questão são todos reversíveis (RF42): o registro sai das listas, mantém o vínculo com quem já o usava e pode voltar. Exclusão definitiva só acontece por solicitação explícita, via anonimização (RF05 e RF38). Não há descarte automático por prazo.

**Retenção**

Definida pela instituição, não pelo sistema. Imagens de folhas, notas e correções permanecem enquanto forem úteis; a proteção contra perda é o backup com restauração testada (RNF09), não o descarte.

## 6. Pontos de atenção

### 6.1 — QR Code e consulta do aluno (resolvido: um código único por folha)

Decisão: cada cartão-resposta impresso recebe um código único (não só por versão). O professor corrige a partir dessa folha; o aluno, depois que o professor libera, escaneia o mesmo QR da sua folha e vê o gabarito e a própria nota — sem login, sem digitar matrícula. Vale também para provas sem identificação: a correção fica ligada à folha, e o vínculo com o aluno (para relatórios) o professor faz depois, se quiser. É o mesmo modelo do GradePen (código “Prova: 1835220.0” por folha).

Um código só basta: a correção acontece por upload autenticado do professor, não por chamada disparada pelo QR, então não há o risco que levou a Spec a separar qrCodePayload de publicCode. Gabarito e nota só aparecem após publicação/liberação.

**A confirmar com o cliente:** o cartão-resposta corrigido volta para o aluno? Se não voltar, o mesmo código precisa estar também no caderno de prova que o aluno leva para casa (ou em um canhoto destacável).

**Como o código é gerado.** Como a consulta acontece sem digitar matrícula, o código é a única barreira protegendo a nota do aluno — ele precisa aguentar isso sozinho. É um token aleatório criptográfico de no mínimo 128 bits, nunca sequencial e nunca derivado do id do aluno ou da aplicação. O número da folha impresso para o professor organizar o papel ("Folha 37") é uma identificação separada e não serve como chave de consulta. Como barreiras adicionais: limite de 30 requisições por minuto por IP na página pública, e noindex mais robots.txt bloqueando indexação — sem isso, buscadores indexariam notas de aluno.

### 6.2 — Questão cortada no meio da página

Reclamação do cliente sobre o GradePen; a Spec não fala de paginação. Tratar como qualidade básica na geração do PDF (uma questão não quebra entre páginas), sem editor manual de layout.

### 6.3 — Versionamento A/B/C de questões (discutível)

Ideia levantada em 28/08: provas realmente diferentes por aluno, não só embaralhadas. Marcada como discutível pelo grupo. Fica em discussão — hoje a Aplicação sempre embaralha a mesma prova.

### 6.4 — LGPD dos alunos sem conta

Alunos são cadastrados pelo professor, sem consentimento próprio no sistema. A base legal do tratamento **não é** consentimento: é o legítimo interesse / execução de política educacional da instituição, que é a controladora — o Correctio atua como operador. Isso foi endereçado por três requisitos novos: aviso de privacidade ao professor no cadastro e na importação (RF39), anonimização do aluno sob solicitação (RF38), e trilha de auditoria das operações sobre dado pessoal (RF40, RNF17). O desenho completo, incluindo remoção de metadados EXIF das fotos das folhas, armazenamento privado com URL assinada e a análise por artigo da LGPD, está em docs/Seguranca_e_LGPD.md.

## 7. Validações pendentes e dúvidas

**Levar ao cliente (definido em 28/08):**

1. Questões discursivas — entram? Como ele quer lançar a nota delas?
1. Importação e exportação de dados via Excel — quais colunas ele já usa hoje (lista de alunos, notas para o sistema acadêmico)?
1. Nota disponibilizada ao aluno via QR Code da prova — ele quer isso? Só nota ou também acertos por questão?
1. O cartão-resposta corrigido volta para o aluno? Se não, o código de consulta deve ir também no caderno de prova (ver 6.1).
1. Finalidade do campo e-mail do aluno — ele tem algum uso previsto? Hoje é coletado sem finalidade no sistema (ver nota do RF07).
1. Existe aluno menor de 18 anos? Se houver, o tratamento tem exigências adicionais (LGPD, Art. 14).

**Levar à professora:**

1. Versionamento A/B/C de questões entra em algum momento ou fica fora (ver 6.3)?

## 8. Especificação de telas

25 telas: 3 de acesso (C), 2 públicas (PUB) e 20 do professor (P). Cada uma traz conteúdo/elementos e ações com destino explícito. É a base do PDF de telas para validação com o cliente.

### 8.1 Estrutura de navegação (Web Professor)

- Barra superior: logo/nome do Correctio à esquerda; à direita, botão “Ajuda” (reabre o tour da tela atual, não do sistema inteiro) e avatar do professor com menu (Meu perfil, Sair).
- Tour guiado contextual: dispara automaticamente na primeira visita a cada tela, com no máximo 4 passos por tela e 90 caracteres por passo (RF37, RNF19); dispensável em 1 clique e nunca bloqueia o uso da tela.
- Menu lateral, com ícone + texto: Painel · Turmas · Banco de Questões · Provas · Aplicações · Relatórios. Item ativo destacado.
- Modais reutilizáveis: confirmação (arquivar, remover, regenerar), importação (upload Excel/JSON com modelo para download e prévia antes de confirmar).

**Comportamento em celular (responsivo):**

- Menu lateral vira menu hambúrguer (drawer) na barra superior; a ação primária de cada lista (“+ Nova …”) fica fixa no topo ou como botão flutuante.
- Tabelas (alunos, versões, relatórios) viram cards empilhados ou tabela com rolagem horizontal interna — nunca rolagem da página inteira.
- Layouts de duas colunas (P16: imagem + grade de respostas) empilham verticalmente ou viram abas “Imagem / Respostas”.
- Reordenar por arrastar (P9) ganha botões subir/descer como alternativa ao toque.
- Upload de imagem (P15) abre a câmera do celular diretamente — o professor fotografa as folhas pelo navegador, folha a folha.
- PUB1 é mobile-first: o aluno abre no celular ao escanear o QR.

### 8.2 Acesso (professor)

#### C1. Login

*Acesso: URL raiz, não autenticado*

**Conteúdo e elementos:**

- Card centralizado com logo do Correctio
- Campo e-mail
- Campo senha com ícone de mostrar/ocultar
- Checkbox “Lembrar de mim”
- Botão primário “Entrar”
- Link “Esqueci minha senha”
- Link “Criar conta”
- Erro inline se credenciais inválidas; aviso de bloqueio temporário após 5 falhas

**Ações e fluxo:**

- “Entrar” válido → P1 Painel
- “Esqueci minha senha” → C3
- “Criar conta” → C2

#### C2. Cadastro (professor)

*Acesso: Link “Criar conta” em C1*

**Conteúdo e elementos:**

- Campo nome completo
- Campo e-mail, com validação inline de formato e de e-mail já cadastrado
- Campo senha (mín. 8) com indicador de força
- Campo confirmar senha
- Botão “Criar conta”
- Link “Já tem conta? Entrar”

**Ações e fluxo:**

- “Criar conta” → P1 Painel, com o tour contextual do Painel iniciado
- “Entrar” → C1

#### C3. Recuperar / redefinir senha

*Acesso: Link em C1*

**Conteúdo e elementos:**

- Etapa 1: campo e-mail + botão “Enviar link”
- Confirmação: “Verifique seu e-mail”, com reenviar
- Etapa 2 (via link do e-mail): nova senha + confirmar + botão “Redefinir senha”

**Ações e fluxo:**

- “Enviar link” → tela de confirmação
- “Redefinir senha” → C1 com mensagem de sucesso

### 8.3 Páginas públicas (sem login)

#### PUB1. Consulta de nota e gabarito por QR Code

*Acesso: Aluno escaneia o QR Code impresso na própria prova — URL pública, sem login*

**Conteúdo e elementos:**

- Cabeçalho da prova: título, disciplina, turma, data
- Cada QR é único por folha: a página abre direto no resultado daquela folha, com ou sem identificação
- Se prova identificada: nome do aluno exibido; se não: “Folha nº X — Versão Y”
- Bloco “Sua nota”: nota total, acertos/erros por questão (se o professor liberou notas)
- Bloco “Gabarito”: alternativa correta por questão (se o professor publicou o gabarito)
- Mensagens de estado: “Nota ainda não liberada”, “Gabarito ainda não publicado”, “QR inválido ou expirado”
- Sem menu, sem login, layout mobile-first (o aluno abre no celular)
- noindex e robots.txt bloqueando indexação por buscadores — a página exibe nome e nota de aluno

**Ações e fluxo:**

- Somente leitura — não há ações além de rolar a página

#### PUB2. Aviso de privacidade

*Acesso: Link no rodapé de todas as telas e a partir do aviso exibido ao professor no cadastro/importação de alunos (RF39)*

**Conteúdo e elementos:**

- Quais dados o sistema trata e para quê
- Quem é controlador e quem é operador
- Base legal
- Como solicitar acesso, correção ou anonimização
- Contato
- Sem menu, sem login, layout mobile-first

**Ações e fluxo:**

- Somente leitura

### 8.4 Web Professor

#### P1. Painel

*Acesso: Tela inicial após login*

**Conteúdo e elementos:**

- Saudação “Olá, [nome]”
- Cards de resumo: Turmas ativas · Provas · Aplicações · Correções pendentes
- Lista “Atividade recente” (últimas 5 ações)
- Atalhos: “+ Nova turma”, “+ Nova prova”, “+ Nova aplicação”, “Corrigir provas”
- Tour guiado contextual desta tela na primeira visita (RF37): até 4 passos destacando cards e atalhos, com “Pular” e “Próximo” — como em todas as telas

**Ações e fluxo:**

- Card Turmas → P3
- Card Provas → P8
- Card Aplicações → P11
- Card Correções pendentes → P11 filtrada por “correção em andamento”
- “+ Nova turma” → P4
- “+ Nova prova” → P9
- “+ Nova aplicação” → P12
- “Corrigir provas” → P11 (escolher a aplicação) → P15

#### P2. Meu perfil

*Acesso: Menu do avatar*

**Conteúdo e elementos:**

- Nome, e-mail (leitura), tipo (Professor)
- Botão “Sair de todos os dispositivos”
- Botão “Rever tour guiado”
- Zona de risco: “Anonimizar minha conta” com aviso de irreversibilidade

**Ações e fluxo:**

- “Sair de todos” → confirmação → C1
- “Rever tour” → P1 com tour ativo
- “Anonimizar” → modal com “digite ANONIMIZAR” → C1

#### P3. Turmas (lista)

*Acesso: Menu lateral “Turmas”*

**Conteúdo e elementos:**

- Cabeçalho “Turmas” + botão “+ Nova turma”
- Filtro Ativas / Arquivadas; busca por nome/disciplina
- Cards: nome, disciplina, período, nº de alunos, badge de status
- Menu por card: Ver detalhes · Editar · Arquivar
- Estado vazio com botão “+ Nova turma”

**Ações e fluxo:**

- “+ Nova turma” → P4
- Clique no card → P5
- Editar → P4 (edição)
- Arquivar → confirmação → atualiza lista

#### P4. Turma — Criar/Editar

*Acesso: “+ Nova turma” ou Editar*

**Conteúdo e elementos:**

- Campos: nome, disciplina, período/ano
- Botões “Cancelar” / “Salvar”

**Ações e fluxo:**

- “Salvar” ao criar → P5 (já para cadastrar alunos)
- “Salvar” ao editar → P5
- “Cancelar” → volta

#### P5. Turma — Detalhe

*Acesso: Clique em P3 ou após P4*

**Conteúdo e elementos:**

- Cabeçalho: nome, disciplina/período, status, menu (Editar, Arquivar)
- Seção “Alunos”: tabela (nome, matrícula, e-mail), busca, botão “+ Adicionar aluno”, botão “Importar alunos”, ícone remover por linha
- Modal “Adicionar aluno”: nome, matrícula, e-mail opcional
- Modal “Importar alunos”: upload Excel/JSON, link “baixar modelo”, prévia das linhas com validação (matrícula duplicada, campo vazio), botão “Confirmar importação”
- Seção “Aplicações desta turma”: lista resumida (prova, data, status de correção)
- Aviso de privacidade ao adicionar ou importar alunos, informando que o professor é responsável pelos dados de terceiros que insere (RF39)
- Ação “Anonimizar dados do aluno” por linha, com confirmação de irreversibilidade (RF38)
- Estado vazio da tabela: “Nenhum aluno ainda” + botões Adicionar / Importar

**Ações e fluxo:**

- “+ Adicionar aluno” → modal → salva e atualiza tabela
- “Importar alunos” → modal de importação → prévia → confirma → atualiza tabela
- Remover → confirmação → remove (mantém notas)
- Clique em uma aplicação → P14
- Editar → P4 · Arquivar → confirmação → P3
- “Anonimizar” → modal de confirmação → apaga nome, matrícula e e-mail e preserva a nota

#### P6. Banco de questões (lista)

*Acesso: Menu lateral “Banco de Questões”*

**Conteúdo e elementos:**

- Cabeçalho + botões “+ Nova questão” e “Importar questões”
- Filtros: tipo, tags (multi), busca por enunciado
- Lista: enunciado truncado, badge de tipo, chips de tags, nº de alternativas ou nota máxima, ícone se “embaralhar alternativas” está desligado
- Menu por item: Editar · Duplicar · Excluir
- Estado vazio com Nova / Importar

**Ações e fluxo:**

- “+ Nova questão” → P7
- “Importar questões” → modal de importação (Excel/JSON) → prévia → confirma
- Clique/Editar → P7 (edição)
- Duplicar → P7 pré-preenchida como nova
- Excluir → confirmação → soft-delete

#### P7. Questão — Criar/Editar

*Acesso: Nova, Editar ou Duplicar em P6*

**Conteúdo e elementos:**

- Tabs de tipo: Objetiva / Discursiva
- Enunciado (markdown básico, botão “Visualizar”)
- Tags (chips; sugestão de tags já usadas; recomendação de ao menos 1)
- Objetiva: 2 a 5 alternativas com marcador “correta”; “+ Alternativa”; remover
- Toggle “Permitir embaralhar alternativas” (padrão ligado) — é o padrão da questão; pode ser ajustado por prova em P9
- Discursiva: campo “Nota máxima”
- Botões “Cancelar” / “Salvar”

**Ações e fluxo:**

- Trocar tab → alterna campos
- “Salvar” (válido) → P6

#### P8. Provas (lista)

*Acesso: Menu lateral “Provas”*

**Conteúdo e elementos:**

- Cabeçalho + botões “+ Nova prova”, “Gerar automaticamente”, “Importar prova”
- Filtros: status (Rascunho/Pronta/Arquivada), tag, busca por título
- Lista: título, nº de questões, pontuação total, tags predominantes, status
- Menu por item: Ver detalhes · Editar · Duplicar · Exportar (Excel/JSON) · Arquivar

**Ações e fluxo:**

- “+ Nova prova” → P9
- “Gerar automaticamente” → P9b
- “Importar prova” → modal de importação → cria prova em rascunho → P10
- Clique → P10 · Editar → P9 · Duplicar → cria cópia em rascunho → P9 da cópia
- Exportar → download · Arquivar → confirmação

#### P9. Prova — Criar/Editar

*Acesso: Nova, Editar, Duplicar, ou retorno de P9b*

**Conteúdo e elementos:**

- Campos: título, descrição
- Seção “Preferências padrão de aplicação”: toggles “Embaralhar questões” e “Embaralhar alternativas” (herdáveis pela aplicação)
- Lista arrastável de questões: enunciado, tipo, pontuação editável, toggle “embaralhar alternativas” desta questão nesta prova (vem do padrão da questão), remover
- Botões “+ Adicionar do banco” (painel lateral com filtros e checkbox) e “Preencher automaticamente” (→ P9b)
- Indicador “Pontuação total: X” (ao vivo) + “X/20 questões”
- Botões “Cancelar” / “Salvar”

**Ações e fluxo:**

- “+ Adicionar do banco” → painel → “Adicionar selecionadas”
- “Preencher automaticamente” → P9b → volta com a lista preenchida
- Arrastar → reordena · Remover → tira da prova
- “Salvar” → P10

#### P9b. Gerar prova automaticamente

*Acesso: “Gerar automaticamente” em P8 ou “Preencher automaticamente” em P9*

**Conteúdo e elementos:**

- Formulário: tags de conteúdo (multi-select), nº de questões objetivas, toggle “Incluir discursivas” + quantidade, pontuação padrão por questão (opcional, distribui igualmente)
- Contador de questões disponíveis no banco para os filtros escolhidos
- Botão “Gerar seleção”
- Prévia: lista das questões sorteadas, com botão “Trocar” por linha (sorteia outra com os mesmos filtros) e “Remover”
- Botão “Usar esta seleção”

**Ações e fluxo:**

- “Gerar seleção” → mostra prévia
- “Trocar” → substitui a linha
- “Usar esta seleção” → P9 preenchida (nova prova ou complementando a atual)
- “Cancelar” → volta

#### P10. Prova — Detalhe

*Acesso: Clique em P8*

**Conteúdo e elementos:**

- Cabeçalho: título, status, menu (Editar, Duplicar, Exportar, Arquivar)
- Preferências padrão de embaralhamento (leitura)
- Lista somente-leitura das questões
- Seção “Aplicações desta prova” + botão “+ Nova aplicação com esta prova”

**Ações e fluxo:**

- Editar → P9 · Duplicar → P9 da cópia · Exportar → download · Arquivar → confirmação
- “+ Nova aplicação” → P12 (prova pré-selecionada)
- Clique em aplicação → P14

#### P11. Aplicações (lista)

*Acesso: Menu lateral “Aplicações”*

**Conteúdo e elementos:**

- Cabeçalho + “+ Nova aplicação”
- Filtros: turma, prova, status do PDF (Rascunho/Gerado), status de correção (Não iniciada / Em andamento / Concluída)
- Lista: prova, turma, data, PDF gerado?, gabarito publicado?, progresso de correção (X/N)
- Menu por item: Ver detalhes · Gerar/Regenerar PDF · Corrigir provas

**Ações e fluxo:**

- “+ Nova aplicação” → P12
- Clique → P14 · Gerar PDF → P13 · Corrigir → P15

#### P12. Aplicação — Criar

*Acesso: “+ Nova aplicação” em P1/P11 ou a partir de P10*

**Conteúdo e elementos:**

- Dropdown “Prova” (só Rascunho/Pronta)
- Dropdown “Turma” (só ativas)
- Botão “Criar aplicação”

**Ações e fluxo:**

- “Criar aplicação” → P13

#### P13. Aplicação — Gerar PDF

*Acesso: Após P12, ou Gerar/Regenerar em P11/P14*

**Conteúdo e elementos:**

- Stepper “Número de versões”
- Por versão: toggles “Embaralhar questões” e “Embaralhar alternativas”, pré-preenchidos com as preferências da prova (RF17), editáveis
- Alternância “Com identificação” / “Sem identificação” (para a Aplicação inteira), com texto de ajuda
- Banner se já existe PDF: “Regenerar substitui versões e invalida QR Codes”
- Banner de bloqueio se já existe correção confirmada: “Crie uma nova aplicação”
- Botão “Gerar PDF”

**Ações e fluxo:**

- “Gerar PDF” → confirma o início em menos de 1 segundo, informa que a execução ocorre em segundo plano e libera o professor para navegar (RF41); notifica quando o PDF fica pronto → P14 com PDF disponível. A tela nunca fica travada esperando

#### P14. Aplicação — Detalhe

*Acesso: Clique em P11*

**Conteúdo e elementos:**

- Cabeçalho: prova + turma, status, menu (Regenerar PDF, Arquivar)
- Card “PDF”: “Baixar PDF”, data de geração
- Tabela “Versões”: nº, embaralhamentos, gabarito publicado?, botão “Publicar gabarito” por linha; botão “Publicar todos”
- Tabela “Alunos e versões” (se identificada)
- Card “Correção”: progresso X/N alunos, botões “Corrigir provas” (→ P15) e “Ver relatório” (→ P18)
- Toggle “Liberar notas via QR Code para os alunos”, com confirmação

**Ações e fluxo:**

- “Baixar PDF” → download
- “Regenerar PDF” → P13 (bloqueado se houver correção confirmada)
- “Publicar gabarito” → confirmação → publica
- “Corrigir provas” → P15 · “Ver relatório” → P18
- “Liberar notas” → confirmação → PUB1 passa a exibir notas
- Arquivar → confirmação

#### P15. Correção — Enviar folhas de respostas

*Acesso: “Corrigir provas” em P1/P11/P14*

**Conteúdo e elementos:**

- Cabeçalho: prova + turma, progresso X/N
- Área de upload (arrastar/soltar) para múltiplas imagens ou PDF escaneado
- No celular: botão “Fotografar folha” abre a câmera direto, permitindo capturar uma folha por vez em sequência
- Lista de arquivos com status: Processando · Lido · QR não reconhecido · Falha na leitura
- Por item lido: miniatura, aluno identificado (ou “Versão 2 — sem identificação”), nota prévia, botão “Revisar”
- Botão “Inserir correção manualmente” (sem imagem)
- Botão “Confirmar todas as leituras sem pendência”

**Ações e fluxo:**

- Upload → confirma o início em menos de 1 segundo, informa que a leitura ocorre em segundo plano e libera o professor para navegar (RF41); notifica quando cada folha fica pronta e atualiza a lista. A tela nunca fica travada esperando
- “Revisar” → P16 daquele item
- “Inserir manualmente” → P16 vazio, escolhendo versão e aluno
- “Confirmar todas” → confirmação → registra correções → P14 atualizado
- Item com falha → “Revisar” abre P16 para digitação manual

#### P16. Correção — Revisar e confirmar

*Acesso: “Revisar” ou “Inserir manualmente” em P15*

**Conteúdo e elementos:**

- Esquerda: imagem da folha (zoom, rotação), ou vazio no modo manual
- Direita: grade por questão objetiva — alternativa lida (destacada), alternativa correta, ícone acerto/erro, seletor A–E para corrigir a leitura
- Campos de nota por questão discursiva (com nota máxima ao lado)
- Nota total ao vivo no topo
- Se sem identificação: campo “Associar aluno” (busca por nome/matrícula) ou “Deixar pendente”
- Campo “Observações”
- Botões “Confirmar correção”, “Salvar e próxima folha”, “Descartar leitura”

**Ações e fluxo:**

- Alterar seletor → recalcula nota
- “Confirmar” → registra (source = imagem ou manual) → volta a P15
- “Salvar e próxima” → confirma e abre o próximo item pendente de P15
- “Descartar” → confirmação → remove a leitura, mantém o aluno pendente

#### P17. Correções pendentes de atribuição

*Acesso: Link em P14 (card Correção) e em P18*

**Conteúdo e elementos:**

- Lista de correções confirmadas sem aluno (provas sem identificação): versão, nota, nome/matrícula anotados, data
- Busca de aluno da turma por nome/matrícula
- Aviso quando já existe correção para o aluno na mesma versão (conflito)

**Ações e fluxo:**

- “Atribuir” → modal de busca → associa → sai da lista
- Conflito → escolher qual correção manter

#### P18. Relatório da aplicação

*Acesso: “Ver relatório” em P14, ou Relatórios no menu*

**Conteúdo e elementos:**

- Cabeçalho: prova + turma, nº corrigidos/total, link para pendentes (P17)
- Tabela de notas por aluno (nome, matrícula, nota, versão), ordenável
- Cards: média, mediana, desvio padrão, maior/menor nota
- Gráfico de distribuição de notas (histograma)
- Seção “Por questão”: % de acerto e gráfico de barras com a alternativa mais marcada em cada questão
- Seção “Por categoria (tag)”: % de acerto por tag de conteúdo — localiza os temas com mais erro
- Botões “Exportar Excel”, “Exportar CSV”, “Exportar PDF”

**Ações e fluxo:**

- Clique em aluno → P16 daquela correção (leitura)
- Exportar → download

#### P19. Relatório consolidado

*Acesso: Menu lateral “Relatórios”*

**Conteúdo e elementos:**

- Filtros: turma, disciplina, período, intervalo de datas
- Tabela: aplicação, turma, data, média, nº corrigidos
- Gráfico de médias por aplicação
- Botões de exportação

**Ações e fluxo:**

- Clique em linha → P18
- Exportar → download

## 9. Ajustes no modelo de dados em relação à Spec

Mudanças em relação às entidades da Spec, decorrentes do novo escopo:

- **User:** só professor. Sai o role “estudante”.
- **Student (novo):** { id, classId, fullName, registration, email? } — registro da turma, sem senha, sem login. Substitui ClassEnrollment + User aluno.
- **Question:** + allowShuffleAlternatives: boolean (padrão true) — padrão da questão.
- **Exam:** + defaultShuffleQuestions, defaultShuffleAlternatives (herdados por Application); em questions[], + allowShuffleAlternatives por questão desta prova, sobrescrevendo o padrão da questão.
- **Application:** + gradesReleased: boolean (libera consulta em PUB1). Estado closed ganha endpoint de arquivar.
- **AnswerSheet (novo):** { id, applicationId, examVersionId, studentId?, sheetNumber, code } — uma por cartão-resposta impresso. sheetNumber é o número curto e legível impresso para o professor organizar as pilhas de papel; code é o token aleatório opaco de no mínimo 128 bits que vai dentro do QR Code e é a única chave de consulta pública. Os dois nunca se confundem. Substitui ExamAssignment e dispensa a separação qrCodePayload/publicCode da Spec — ver 6.1.
- **Correction:** passa a apontar para answerSheetId (a folha), não só para a versão; objectiveResults ganha selectedAlternativeId; + source: “upload_imagem” | “manual”; + imageUrl?. Saem clientCorrectionId e syncStatus (não há app/offline).
- **Endpoints novos:** import (alunos, questões, provas), export de prova, duplicar prova, gerar prova automática, upload/leitura de folha, liberar notas, página pública por código.

**Student:** o campo email está pendente de validação — hoje é coletado sem finalidade no sistema (ver nota do RF07).

**Soft delete geral:** Class, Exam e Application ganham marcação de arquivamento reversível, e Question mantém o soft-delete já previsto. Nenhuma exclusão é física, e a listagem filtra os inativos por padrão na camada de repositório (RF42).

**Trilha de auditoria (nova):** registro imutável de autor, ação, entidade e data/hora para toda operação sobre dado pessoal de aluno (RF40, RNF17). Guarda a ação, nunca o conteúdo do dado.

**Endpoints novos**, além dos já listados: anonimizar aluno, restaurar item arquivado, consultar status de operação em segundo plano.

## 10. Fora do escopo / em discussão

- **Fora:** app mobile; editor manual de layout do PDF / exportar .doc; área do aluno com login.
- **Em discussão:** versionamento A/B/C de questões (provas realmente diferentes) — ver 6.3.
- **Depende de validação:** discursivas, importação/exportação Excel, notas via QR — ver seção 7.

## 11. Como seguir — até a N1 (11/09)

### Esta semana

- Levar ao cliente as validações da seção 7 (agora com dois itens novos: finalidade do e-mail do aluno e existência de alunos menores de idade)
- Levar à professora a dúvida da seção 6.3 (versionamento A/B/C) e o uso de Firebase Auth no lugar dos endpoints /auth da Spec (seção 1)
- Definir a escala do RNF02 (600 professores ou 10 mil? cadastrados ou simultâneos?)
- Reorganizar as Issues do GitHub Project pela lista atual de 42 RFs, agrupando por área
- PDF de telas para validação com o cliente — confirmar se já foi entregue; é item obrigatório do checklist da N1 e a base textual é a seção 8 (agora com PUB2)

### Até 11/09

- Construir a fundação do código (build, publicação, portão de qualidade, tipos e schemas do domínio, camada de repositórios, dados de demonstração, componentes compartilhados) antes de dividir as telas entre as cinco pessoas
- Construir as telas navegáveis com dados simulados e publicar no GitHub Pages, na ordem de prioridade já definida: C1 → P1 → P3/P5 → P6/P7 → P8/P9 → P11/P13/P14 → P15/P16 → PUB1
- Diário individual atualizado a cada aula com prints de commit/PR — 50% da nota da N1

## 12. Rastreabilidade — pontos do chat de 28/08

Cada ponto levantado no grupo após a apresentação e onde ele está neste documento.

| Ponto do chat | Onde está |
|---|---|
| Não é pra ter área do aluno | Seção 1 (recorte); PUB1; RF33 |
| Escaneamento para autocorrigir provas | RF26–RF32; P15, P16, P17; RNF07 |
| PDF com todas as telas e o que cada uma faz | Seção 11 (Jeliel); base textual = seção 8 |
| Tags de categoria por questão, para melhores análises | RF11; P7; RF35 e P18 (% de acerto por tag) |
| RFs escritos em forma de ação | Seção 3 (42 RFs) |
| RNFs com métrica verificável | Seção 4 (20 RNFs) |
| Minimalismo medido por quantidade de cliques | RNF06 |
| Requisitos de confiabilidade | RNF07 |
| Cypress e afins | RNF08 |
| GitHub Project 4 (quem fez o quê e quando) | Seção 2 |
| Diminuir tempo de cadastro de alunos; importar alunos, provas, questões via Excel/JSON | RF08, RF14, RF19; modais de importação em P5, P6, P8 |
| Tour guiado | RF37; P1; P2 (rever tour) |
| Formulário para montar prova automaticamente (tags, discursivas, quantidade) | RF16; P9b |
| Salvar embaralhamento na prova, ativável/desativável na aplicação | RF17; P9 (preferências); P13 (herdadas, editáveis) |
| Duplicar provas | RF18; P8; P10 |
| Versionamento A/B/C de questões (discutível) | 6.3; seção 10 (em discussão) |
| Embaralhar alternativas por questão ao montar a prova | RF13; P7 (padrão da questão) e P9 (ajuste por prova) |
| Disponibilizar a nota pelo QR Code ao final da prova | RF33; PUB1; toggle “Liberar notas” em P14; 6.1 |
| Validar com o cliente: discursivas, import/export Excel, notas por QR | Seção 7; marcações [validar] nos RFs |
