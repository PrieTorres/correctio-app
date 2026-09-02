# Principais Requisitos — Correctio

Sistema web responsivo (desktop e celular, sem app nativo) para o professor criar, aplicar e **corrigir provas por escaneamento da folha de respostas**. Não há área do aluno: o aluno consulta nota e gabarito escaneando o QR Code único do seu cartão-resposta, depois que o professor corrige e libera.

Itens marcados com **[validar]** dependem de confirmação do cliente.

## Requisitos Funcionais (RF)

| Cód. | Requisito |
|---|---|
| RF01 | O sistema deve permitir que o professor se cadastre com nome, e-mail institucional (@catolicasc.org.br) e senha de no mínimo 8 caracteres. |
| RF02 | O sistema deve permitir que o professor faça login e receba JWT + refresh token. |
| RF03 | O sistema deve permitir que o professor recupere a senha por e-mail. |
| RF04 | O sistema deve permitir que o professor encerre a sessão atual ou todas as sessões ativas. |
| RF05 | O sistema deve permitir que o professor consulte os próprios dados e anonimize a própria conta de forma irreversível. |
| RF06 | O sistema deve permitir que o professor crie, edite e arquive turmas (nome, disciplina, período). |
| RF07 | O sistema deve permitir que o professor cadastre alunos em uma turma (nome, matrícula, e-mail opcional). |
| RF08 | O sistema deve permitir que o professor importe alunos em lote a partir de planilha Excel ou arquivo JSON. **[validar]** |
| RF09 | O sistema deve permitir que o professor remova um aluno da turma preservando o histórico de notas. |
| RF10 | O sistema deve permitir que o professor crie, edite e exclua (soft-delete) questões objetivas (2 a 5 alternativas, 1 correta) e discursivas (enunciado + nota máxima). **[validar discursivas]** |
| RF11 | O sistema deve permitir que o professor classifique cada questão com tags de categoria/conteúdo. |
| RF12 | O sistema deve permitir que o professor filtre questões por tipo, tag e texto do enunciado. |
| RF13 | O sistema deve permitir que o professor defina, por questão, se as alternativas podem ser embaralhadas. |
| RF14 | O sistema deve permitir que o professor importe questões em lote via Excel ou JSON. **[validar]** |
| RF15 | O sistema deve permitir que o professor monte uma prova selecionando até 20 questões do banco e definindo a pontuação de cada uma. |
| RF16 | O sistema deve permitir que o professor gere uma prova automaticamente a partir de filtros: tags, incluir discursivas ou não, quantidade de questões. |
| RF17 | O sistema deve permitir que o professor salve na prova as preferências padrão de embaralhamento (questões e alternativas), herdadas pela aplicação. |
| RF18 | O sistema deve permitir que o professor duplique uma prova existente. |
| RF19 | O sistema deve permitir que o professor importe e exporte provas via Excel ou JSON. **[validar]** |
| RF20 | O sistema deve permitir que o professor arquive uma prova, bloqueando novas aplicações sem afetar as existentes. |
| RF21 | O sistema deve permitir que o professor aplique uma prova a uma turma, criando uma Aplicação. |
| RF22 | O sistema deve permitir que o professor configure a geração do PDF: nº de versões, embaralhamento (herdado da prova, editável por versão) e com/sem identificação do aluno. |
| RF23 | O sistema deve gerar um único PDF consolidado por Aplicação, com um QR Code único em cada cartão-resposta impresso, identificando a folha e, quando houver, o aluno. |
| RF24 | O sistema deve permitir que o professor regenere o PDF enquanto não houver correção confirmada, invalidando os QR Codes anteriores. |
| RF25 | O sistema deve permitir que o professor publique o gabarito por versão ou por Aplicação inteira. |
| RF26 | O sistema deve permitir que o professor envie a imagem (foto/scan) da folha de respostas de cada aluno, individualmente ou em lote. |
| RF27 | O sistema deve ler o QR Code e as marcações da imagem, comparar com o gabarito da versão e calcular a nota automaticamente. |
| RF28 | O sistema deve permitir que o professor revise e corrija manualmente qualquer leitura antes de confirmar a correção. |
| RF29 | O sistema deve permitir que o professor lance a nota das questões discursivas na mesma tela de revisão. **[validar discursivas]** |
| RF30 | O sistema deve permitir que o professor insira uma correção manualmente, sem imagem, quando a leitura falhar. |
| RF31 | O sistema deve atribuir a nota automaticamente ao aluno quando a prova tiver identificação, e permitir associação manual por nome/matrícula quando não tiver. |
| RF32 | O sistema deve armazenar cada correção com a alternativa marcada em cada questão, o acerto/erro, a nota por questão e a origem (imagem ou manual). |
| RF33 | O sistema deve disponibilizar ao aluno a nota e o gabarito da sua prova por meio do QR Code impresso nela, em página pública, após liberação pelo professor. **[validar]** |
| RF34 | O sistema deve gerar relatório de notas por Aplicação: lista por aluno, média, mediana, desvio padrão e distribuição. |
| RF35 | O sistema deve gerar estatística por questão, incluindo percentual de acerto e alternativa mais marcada. |
| RF36 | O sistema deve exportar relatórios em Excel, CSV e PDF. |
| RF37 | O sistema deve oferecer um tour guiado no primeiro acesso do professor, com opção de pular e rever depois. |

## Requisitos Não-Funcionais (RNF)

| Cód. | Categoria | Requisito e métrica |
|---|---|---|
| RNF01 | Desempenho | 95% das requisições da API respondem em até 300 ms. |
| RNF02 | Escalabilidade | Suportar 600 professores e 10.000 alunos cadastrados mantendo o RNF01. |
| RNF03 | Disponibilidade | Uptime mensal ≥ 99,5%. |
| RNF04 | Segurança | 100% do tráfego em HTTPS; JWT com refresh; bloqueio temporário após 5 tentativas de login falhas em 15 min. |
| RNF05 | Privacidade (LGPD) | Anonimização de conta concluída em até 24 h; nenhum dado pessoal em logs. |
| RNF06 | Usabilidade (minimalismo) | Toda ação principal (criar turma, criar prova, gerar PDF, corrigir uma folha) concluída em até 3 cliques a partir do painel. |
| RNF07 | Confiabilidade da correção | Erro de leitura das marcações < 1% em imagens com boa iluminação; 100% das leituras confirmadas pelo professor antes de virar nota. |
| RNF08 | Testabilidade | Cobertura ≥ 80% nas regras críticas (cálculo de nota, embaralhamento, geração de PDF); fluxos principais cobertos por testes E2E com Cypress. |
| RNF09 | Backup | Backup diário com retenção de 30 dias; restauração testada 1x/mês. |
| RNF10 | Compatibilidade | Funcionar nas 2 últimas versões de Chrome, Firefox, Edge e Safari, incluindo Chrome Android e Safari iOS. |
| RNF11 | Responsividade | Todas as telas utilizáveis de 360 px (celular) a 1920 px (desktop), sem rolagem horizontal da página; alvos de toque ≥ 44 px; Lighthouse mobile ≥ 90. |

## Regras de negócio

**Conta** — só professores têm conta; e-mail único com domínio @catolicasc.org.br; anonimização é irreversível e preserva turmas, provas e correções.

**Alunos e turmas** — aluno é um registro da turma (nome, matrícula, e-mail opcional), não faz login; matrícula única dentro da turma; remover aluno não apaga notas.

**Questões** — objetiva: 2 a 5 alternativas, 1 correta; discursiva: enunciado + nota máxima; excluir é soft-delete; cada questão tem opção "permitir embaralhar alternativas" (padrão ligada).

**Provas** — até 20 questões; pontuação livre, soma não validada; estados rascunho → pronta (automático na 1ª aplicação) → arquivada (manual); prova arquivada não recebe novas aplicações; guarda preferências padrão de embaralhamento; duplicar cria cópia em rascunho.

**Aplicações e PDF** — mesma prova pode ir para várias turmas ou ser reaplicada; PDF único por Aplicação; embaralhamento independente por versão; identificação vale para a Aplicação inteira; regenerar é bloqueado após a primeira correção confirmada.

**Correção e notas** — nenhuma leitura vira nota sem confirmação do professor; a nota fica ligada à folha corrigida — com identificação vai direto ao aluno, sem identificação o vínculo fica pendente até o professor associar, mas o aluno já consulta pela própria folha; duas correções para o mesmo aluno/versão geram conflito para revisão; gabarito e nota só aparecem na página pública depois que o professor publica/libera.

## Telas do sistema

**Acesso (professor)** — Login · Cadastro · Recuperar/redefinir senha

**Pública (aluno, sem login)** — Consulta de nota e gabarito pelo QR Code do cartão-resposta (código único por folha)

**Web Professor**
- Painel (com tour guiado no 1º acesso) · Meu perfil
- Turmas — lista · criar/editar · detalhe (alunos, cadastro manual e importação)
- Banco de questões — lista (com importação) · criar/editar
- Provas — lista · criar/editar · gerar automaticamente · detalhe
- Aplicações — lista · criar · gerar PDF · detalhe (versões, gabarito, correção, liberar notas)
- Correção — enviar folhas de respostas · revisar e confirmar · pendentes de atribuição
- Relatórios — por aplicação (notas + estatística por questão) · consolidado

## Fora do escopo / em discussão

- **Fora:** app mobile; área do aluno com login; editor manual de layout do PDF.
- **Em discussão:** versionamento A/B/C de questões (provas realmente diferentes por aluno).
