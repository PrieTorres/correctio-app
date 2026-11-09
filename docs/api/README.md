# Especificação da API

As rotas da API Express (`apps/api`), como os arquivos de `apps/api/src/routes` as montam. Em
produção a API responde no mesmo endereço do front, sob `/api`
(`https://correctio-app.web.app/api/...`). Localmente, a API responde direto em
`http://localhost:3000`, sem o prefixo `/api`; pelo front em `http://localhost:5173/api`, o Vite
repassa as chamadas à API tirando o prefixo.

O que vale para todas as rotas:

- **Autenticação:** toda rota fora de `/health`, `/public` e das rotas de entrada de `/auth` exige
  o token de acesso no cabeçalho `Authorization: Bearer <token>`
  ([ADR-003](../adr/ADR-003-authentication.md)).
- **Escopo pelo professor:** cada professor só lê e altera o que é dele. Um registro de outro
  professor responde 404, como se não existisse.
- **Corpo e resposta em JSON**, validados com os schemas de `@correctio/domain`, os mesmos das
  telas. As exceções são a foto da folha, enviada e devolvida como o próprio arquivo; o PDF e os
  relatórios pedidos com `?format=`, devolvidos como arquivo; e as rotas do Google, que
  respondem com redirecionamento (302).
- **`PATCH` mescla:** atualiza só os campos enviados e nunca apaga o que o cliente não conhece.
- **Listas paginadas** aceitam `page`, `pageSize` e `search`, e devolvem `{ items, total }`. As
  exceções são `GET /questions/tags`, que devolve `{ tags }`, e `GET /applications/:id/read-failures`,
  que devolve a lista sem paginar.
- **Erros** no formato `{ code, message }`, sem stack trace, com o status HTTP que descreve o
  problema (400, 401, 404, 409, 429 e 500; o `/health` responde 503 com o banco fora do ar). O
  429 traz `Retry-After`. Recurso de outro professor é 404, nunca 403, e corpo acima do limite
  é 400.
- **Limites:** por endereço na consulta pública e no cadastro, login e redefinição de senha; por
  professor nas demais (leitura 300/min, escrita 60/min). Gerar PDF, importar alunos e exportar
  relatório têm 10 por hora. O envio de foto tem cota de 500 fotos e 200 MB por professor em
  24 horas. Ver [Seguranca_e_LGPD.md](../Seguranca_e_LGPD.md).

O detalhe de cada recurso (regras, códigos de erro e exemplos) está no
[README da API](../../apps/api/README.md).

## Saúde e consulta pública

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Diz se a API e o banco respondem. |
| `GET` | `/public/sheets/:code` | Consulta do aluno pelo QR Code da folha (PUB1), sem login: gabarito e, se liberada, a nota. |

## Acesso

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cria a conta do professor (C2). |
| `POST` | `/auth/login` | Entra com e-mail e senha (C1); devolve o token de acesso e grava o de renovação em cookie. |
| `POST` | `/auth/refresh` | Troca o token de renovação por um novo token de acesso. |
| `POST` | `/auth/logout` | Encerra a sessão deste aparelho. |
| `POST` | `/auth/forgot-password` | Envia por e-mail o link de redefinição de senha (C3). |
| `POST` | `/auth/reset-password` | Grava a senha nova a partir do link. |
| `GET` | `/auth/google` | Começa a entrada pelo Google. |
| `GET` | `/auth/google/callback` | Volta do Google e leva ao front com um código de uso único. |
| `POST` | `/auth/google/exchange` | Troca o código de uso único pela sessão. |
| `POST` | `/auth/logout-all` | Encerra as sessões de todos os aparelhos (RF04). |
| `GET` | `/me` | O professor da sessão e o tipo da conta (P2). |
| `POST` | `/me/anonymize` | Anonimiza a conta (RF05): troca nome, e-mail e senha, encerra as sessões e mantém turmas, provas e correções. |

## Turmas e alunos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/classes` | Turmas do professor, ativas ou arquivadas (`archived=true`), com a contagem de alunos. |
| `POST` | `/classes` | Cria uma turma (P4). |
| `GET` | `/classes/:id` | Uma turma (P5). |
| `PATCH` | `/classes/:id` | Edita a turma. |
| `PATCH` | `/classes/:id/archive` | Arquiva a turma. |
| `PATCH` | `/classes/:id/restore` | Restaura a turma arquivada. |
| `GET` | `/classes/:id/students` | Alunos da turma; `includeRemoved=true` traz também os removidos, que seguem nas notas. |
| `POST` | `/classes/:id/students` | Adiciona um aluno. Turma arquivada responde 409. |
| `POST` | `/classes/:id/students/import` | Importa uma lista de alunos (RF08). |
| `PATCH` | `/classes/:id/students/:studentId` | Edita o aluno. |
| `DELETE` | `/classes/:id/students/:studentId` | Remove o aluno da turma, mantendo as notas. |
| `POST` | `/classes/:id/students/:studentId/anonymize` | Anonimiza os dados do aluno (RF38). |

## Banco de questões

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/questions` | Questões do professor, com filtros de tipo, tag e texto (P6); com várias tags exige todas, ou qualquer uma com `anyTag=true`. Aceita também `onlyUntagged`, `archived` e `sort` (`newest` ou `statement`). |
| `POST` | `/questions` | Cria uma questão objetiva ou discursiva (P7). |
| `GET` | `/questions/tags` | As tags já usadas, para os filtros e o autocompletar. |
| `GET` | `/questions/:id` | Uma questão, mesmo excluída, porque a prova aplicada ainda a imprime. |
| `PATCH` | `/questions/:id` | Edita a questão. |
| `DELETE` | `/questions/:id` | Exclui a questão (reversível, `deletedAt`). |
| `PATCH` | `/questions/:id/restore` | Restaura a questão excluída. |

## Provas

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/exams` | Provas do professor, ativas ou arquivadas (P8). |
| `POST` | `/exams` | Cria uma prova com as questões escolhidas (P9). |
| `POST` | `/exams/draw` | Sorteia as questões de uma prova (P9b) entre as que têm alguma das tags pedidas, equilibrando os conteúdos. |
| `GET` | `/exams/:id` | Uma prova (P10). |
| `PATCH` | `/exams/:id` | Edita a prova. |
| `PATCH` | `/exams/:id/archive` | Arquiva a prova. |
| `PATCH` | `/exams/:id/restore` | Restaura a prova arquivada. |

## Aplicações e PDF

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/applications` | Aplicações do professor, com filtros de situação, turma (`classId`), prova e correção (P11). |
| `POST` | `/applications` | Aplica uma prova a uma turma numa data (P12). |
| `GET` | `/applications/:id` | Uma aplicação, com a prova, a turma e o andamento (P14). |
| `PATCH` | `/applications/:id` | Edita a aplicação; depois de gerado o PDF, só a data muda. |
| `PATCH` | `/applications/:id/archive` | Arquiva a aplicação. |
| `PATCH` | `/applications/:id/restore` | Restaura a aplicação arquivada. |
| `POST` | `/applications/:id/generate-pdf` | Gera as versões, as folhas com QR Code e o PDF único (P13). Bloqueado depois da primeira correção, com as notas liberadas ou com a aplicação arquivada. |
| `GET` | `/applications/:id/pdf` | Baixa o PDF gerado. |
| `GET` | `/applications/:id/versions` | As versões impressas, com a ordem de cada uma (`layout`). |
| `POST` | `/applications/:id/versions/:versionId/publish-answer-key` | Publica ou despublica o gabarito de uma versão (`{ published }`). |
| `POST` | `/applications/:id/publish-answer-keys` | Publica o gabarito de todas as versões. |
| `POST` | `/applications/:id/grades-release` | Libera ou recolhe as notas da consulta pelo QR Code (`{ released }`). |
| `GET` | `/applications/:id/sheets` | As folhas impressas, uma por aluno ou sem identificação. |
| `GET` | `/applications/:id/report` | Relatório da aplicação (P18), só com as correções finalizadas; `?format=xlsx`, `csv` ou `pdf` devolve o arquivo (RF36). |

## Correção

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/applications/:id/sheet-images` | Envia a foto de uma folha (JPEG, PNG ou WebP, até 10 MB) e devolve a leitura do QR Code e das marcações (P15, [ADR-007](../adr/ADR-007-sheet-reading-on-api-worker.md)). Nada vira nota aqui. |
| `GET` | `/applications/:id/sheet-images/:imageId` | A foto enviada, só para o professor dono (P16). |
| `GET` | `/applications/:id/read-failures` | As fotos cuja leitura falhou, para nenhuma ficar esquecida (P15). |
| `GET` | `/applications/:id/corrections` | As correções da aplicação; `assigned=false` traz só as que esperam o aluno (P17). |
| `POST` | `/applications/:id/corrections` | Grava a revisão do professor; a nota é calculada pela API (P16, RF28). |
| `GET` | `/applications/:id/corrections/:correctionId` | Uma correção. |
| `PATCH` | `/applications/:id/corrections/:correctionId` | Edita a correção ou atribui o aluno de uma folha sem identificação (RF31). |

## Painel e relatórios

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/dashboard` | O painel (P1): contagens, correções pendentes, aplicações recentes, as que já têm folhas para corrigir e, para o próximo passo (#202), os alunos que recebem folha, a turma sem alunos e as aplicações em aberto com o progresso. |
| `GET` | `/reports/consolidated` | Relatório consolidado (P19), com os filtros de turma, disciplina, período e datas; `?format=xlsx`, `csv` ou `pdf` devolve o arquivo das linhas filtradas. |
