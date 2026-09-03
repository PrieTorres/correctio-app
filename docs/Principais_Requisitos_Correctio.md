# Principais Requisitos — Correctio

> ⚠️ **Este é um resumo derivado.** A fonte da verdade de RFs, RNFs, regras de negócio, telas e modelo de dados é [Correctio_Requisitos_e_Telas.md](Correctio_Requisitos_e_Telas.md) — o documento completo, que também é a base do PDF de validação com o cliente.
>
> Este arquivo existe para consulta rápida e para alimentar o README. **Ao alterar um requisito, altere primeiro o documento completo e replique aqui** — nunca o contrário. Se os dois divergirem, o completo vence.

Sistema web responsivo (desktop e celular, sem app nativo) para o professor criar, aplicar e **corrigir provas por escaneamento da folha de respostas**. Não há área do aluno: o aluno consulta nota e gabarito escaneando o QR Code único do seu cartão-resposta, depois que o professor corrige e libera.

Itens marcados com **[validar]** dependem de confirmação do cliente.

> **Segurança, proteção de custo e LGPD** têm documento próprio: [Seguranca_e_LGPD.md](Seguranca_e_LGPD.md).
> **Decisões de arquitetura** (React sem Next, GitHub Pages → Firebase, camada de repositórios): [Arquitetura.md](Arquitetura.md).
> **Portão de qualidade nos Pull Requests** (testes, cobertura, Sonar, proteção de branch): [CI_CD.md](CI_CD.md).
> **Tour guiado** (regras de escrita e texto de cada passo): [Tour_Guiado.md](Tour_Guiado.md).

## Requisitos Funcionais (RF)

| Cód. | Requisito |
|---|---|
| RF01 | O sistema deve permitir que o professor se cadastre com nome, e-mail válido e único, e senha de no mínimo 8 caracteres. |
| RF02 | O sistema deve permitir que o professor faça login e receba JWT + refresh token. |
| RF03 | O sistema deve permitir que o professor recupere a senha por e-mail. |
| RF04 | O sistema deve permitir que o professor encerre a sessão atual ou todas as sessões ativas. |
| RF05 | O sistema deve permitir que o professor consulte os próprios dados e anonimize a própria conta de forma irreversível. |
| RF06 | O sistema deve permitir que o professor crie, edite e arquive turmas (nome, disciplina, período). |
| RF07 | O sistema deve permitir que o professor cadastre alunos em uma turma (nome, matrícula, e-mail opcional). **[validar minimização]** |
| RF08 | O sistema deve permitir que o professor importe alunos em lote a partir de planilha Excel ou arquivo JSON. **[validar]** |
| RF09 | O sistema deve permitir que o professor remova um aluno da turma preservando o histórico de notas. |
| RF10 | O sistema deve permitir que o professor crie, edite e exclua (soft-delete) questões objetivas (2 a 5 alternativas, 1 correta) e discursivas (enunciado + nota máxima). **[validar discursivas]** |
| RF11 | O sistema deve permitir que o professor classifique cada questão com tags de categoria/conteúdo. |
| RF12 | O sistema deve permitir que o professor filtre questões por tipo, tag e texto do enunciado. |
| RF13 | O sistema deve permitir que o professor defina, para cada questão ao montar a prova, se as alternativas podem ser embaralhadas — com o padrão vindo do cadastro da questão. |
| RF14 | O sistema deve permitir que o professor importe questões em lote via Excel ou JSON. **[validar]** |
| RF15 | O sistema deve permitir que o professor monte uma prova selecionando até 20 questões do banco e definindo a pontuação de cada uma. |
| RF16 | O sistema deve permitir que o professor gere uma prova automaticamente a partir de filtros: tags, incluir discursivas ou não, quantidade de questões. |
| RF17 | O sistema deve permitir que o professor salve na prova as preferências padrão de embaralhamento (questões e alternativas), a serem herdadas pela aplicação. |
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
| RF30 | O sistema deve permitir que o professor insira uma correção manualmente, sem imagem, quando a leitura falhar ou não houver folha digitalizada. |
| RF31 | O sistema deve atribuir a nota automaticamente ao aluno quando a prova tiver identificação, e permitir associação manual por nome/matrícula quando não tiver. |
| RF32 | O sistema deve armazenar cada correção com a alternativa marcada em cada questão, o acerto/erro, a nota por questão e a origem (imagem ou manual). |
| RF33 | O sistema deve disponibilizar ao aluno a nota e o gabarito da sua prova por meio do QR Code impresso nela, em página pública, após liberação pelo professor. **[validar]** |
| RF34 | O sistema deve gerar relatório de notas por Aplicação: lista por aluno, média, mediana, desvio padrão e distribuição. |
| RF35 | O sistema deve gerar estatística por questão (percentual de acerto e alternativa mais marcada) e por tag de categoria (percentual de acerto por conteúdo), para análise pedagógica. |
| RF36 | O sistema deve exportar relatórios em Excel, CSV e PDF. |
| RF37 | O sistema deve apresentar um tour guiado contextual na primeira visita a cada tela, destacando os elementos e ações daquela tela, com opção de pular a qualquer momento e de rever pelo botão "Ajuda". |
| RF38 | O sistema deve permitir que o professor anonimize os dados pessoais de um aluno de forma irreversível, apagando nome, matrícula e e-mail e preservando a nota já registrada. |
| RF39 | O sistema deve exibir aviso de privacidade ao professor no cadastro e na importação de alunos, informando que ele é responsável pelos dados de terceiros que insere. |
| RF40 | O sistema deve registrar em trilha de auditoria toda operação sobre dado pessoal de aluno — criação, edição, anonimização, publicação de gabarito e liberação de notas — com autor, ação, entidade e data/hora. |
| RF41 | O sistema deve confirmar imediatamente o início de operações demoradas (gerar PDF, ler folhas, importar e exportar em lote), informando que a execução ocorre em segundo plano, mantendo o professor livre para navegar e notificando-o quando o resultado ficar pronto. |
| RF42 | O sistema deve permitir que o professor desfaça ações destrutivas, restaurando turmas, provas e aplicações arquivadas e questões excluídas, sem perda de vínculo com os registros que já as utilizavam. |

> **Minimização (RF07).** O e-mail do aluno é coletado hoje sem nenhuma finalidade no sistema: não existe área do aluno e nada é enviado a ele por e-mail. Coletar dado pessoal sem finalidade contraria o princípio da necessidade (LGPD, Art. 6º, III). Levar ao cliente: o campo tem uso previsto? Se não tiver, sai do cadastro e da importação.

## Requisitos Não-Funcionais (RNF)

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

> **⚠️ Conferir a escala do RNF02.** Hoje o requisito diz **600 professores e 10.000 alunos cadastrados**. Surgiu na discussão a expectativa de "10 mil professores simultâneos", que é ordem de grandeza bem diferente (cadastrados ≠ simultâneos, e 600 ≠ 10.000) e muda dimensionamento e custo. Definir qual é o número antes da N2.

> **Nenhum dado é apagado automaticamente.** Não existe rotina de descarte por prazo: apagar dado que ninguém pediu para apagar é perda de informação, não conformidade. A exclusão acontece **sob solicitação** (RF38, anonimização de aluno; RF05, anonimização da conta), e tudo que é "excluído" pela interface é soft-delete reversível (RF42). O que protege contra perda é o backup com restauração testada (RNF09).

## Regras de negócio

**Conta** — só professores têm conta; e-mail único, sem restrição de domínio; senha de no mínimo 8 caracteres; anonimização é irreversível e preserva turmas, provas e correções. Como o cadastro é aberto, o isolamento por conta (RNF14) é a única barreira protegendo os dados — cada professor enxerga exclusivamente o que ele criou.

**Alunos e turmas** — aluno é um registro da turma (nome, matrícula, e-mail opcional), não faz login; matrícula única dentro da turma; remover aluno não apaga notas. Remover **não é** exclusão de dado pessoal: quem exerce o direito de exclusão (LGPD, Art. 18) é o RF38, que anonimiza.

**Questões** — objetiva: 2 a 5 alternativas, 1 correta; discursiva: enunciado + nota máxima; excluir é soft-delete; cada questão tem opção "permitir embaralhar alternativas" (padrão ligada), ajustável questão a questão ao montar a prova.

**Provas** — até 20 questões; pontuação livre, soma não validada; estados rascunho → pronta (automático na 1ª aplicação) → arquivada (manual); prova arquivada não recebe novas aplicações; guarda preferências padrão de embaralhamento; duplicar cria cópia em rascunho.

**Aplicações e PDF** — mesma prova pode ir para várias turmas ou ser reaplicada; PDF único por Aplicação; embaralhamento independente por versão; identificação vale para a Aplicação inteira; regenerar é bloqueado após a primeira correção confirmada.

**Correção e notas** — nenhuma leitura vira nota sem confirmação do professor; a nota fica ligada à folha corrigida — com identificação vai direto ao aluno, sem identificação o vínculo fica pendente até o professor associar, mas o aluno já consulta pela própria folha; duas correções para o mesmo aluno/versão geram conflito para revisão; gabarito e nota só aparecem na página pública depois que o professor publica/libera.

**Identificação da folha** — cada cartão-resposta impresso carrega **duas identificações distintas, que não se misturam**:

| | Para quê | Formato |
|---|---|---|
| **Número da folha** (ex.: "Folha 37") | o professor organizar e conferir as pilhas de papel | curto, sequencial, legível |
| **Código de consulta** (dentro do QR Code) | abrir a página pública daquela folha | token aleatório opaco, ≥ 128 bits |

Separar os dois é o que permite ter um número curto legível no papel sem tornar as notas dos alunos varreduráveis por quem tentar códigos em sequência. O número da folha **nunca** serve como chave de consulta. Regenerar o PDF (RF24) invalida os códigos anteriores: a página pública responde "QR inválido", nunca a nota antiga.

**Nada é apagado de verdade** — arquivar turma, prova ou aplicação e excluir questão são todos reversíveis (RF42): o registro sai das listas, mantém o vínculo com quem já o usava e pode voltar. Exclusão definitiva só acontece por solicitação explícita, via anonimização (RF05 e RF38). Não há descarte automático por prazo.

**Retenção** — definida pela instituição, não pelo sistema. Imagens de folhas, notas e correções permanecem enquanto forem úteis; a proteção contra perda é o backup com restauração testada (RNF09), não o descarte.

## Telas do sistema

**Acesso (professor)** — Login · Cadastro · Recuperar/redefinir senha

**Pública (sem login)** — Consulta de nota e gabarito pelo QR Code do cartão-resposta (código único por folha) · Aviso de privacidade

**Web Professor**
- Painel (com tour guiado no 1º acesso) · Meu perfil
- Turmas — lista · criar/editar · detalhe (alunos, cadastro manual e importação, aviso de privacidade e anonimização de aluno)
- Banco de questões — lista (com importação) · criar/editar
- Provas — lista · criar/editar · gerar automaticamente · detalhe
- Aplicações — lista · criar · gerar PDF · detalhe (versões, gabarito, correção, liberar notas)
- Correção — enviar folhas de respostas · revisar e confirmar · pendentes de atribuição
- Relatórios — por aplicação (notas + estatística por questão) · consolidado

## Fora do escopo / em discussão

- **Fora:** app mobile; área do aluno com login; editor manual de layout do PDF.
- **Em discussão:** versionamento A/B/C de questões (provas realmente diferentes por aluno).
