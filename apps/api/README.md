# @correctio/api — Back-end

Node.js 22 + Express 5 + TypeScript, em camadas: **rota → controle → serviço → repositório →
model**, como a disciplina pede. Os dados ficam em MySQL (ver "Banco de dados" abaixo).

## Como rodar localmente

```bash
nvm use 22                         # o projeto exige Node 22.12 ou mais novo
npm install                        # na raiz do repositório
cp apps/api/.env.example apps/api/.env   # sem DATABASE_URL e DATA_ENCRYPTION_KEY a API não sobe
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"   # cole a saída em DATA_ENCRYPTION_KEY
docker compose up -d mysql         # MySQL local na porta 3307
npm run db:migrate                 # cria as tabelas
npm run dev:api                    # http://localhost:3000, recarrega ao salvar
curl localhost:3000/health         # {"status":"UP"}
```

| Comando (dentro de `apps/api`) | O que faz |
|---|---|
| `npm run dev` | sobe com `tsx watch`, lendo o `.env` se existir |
| `npm test` | testes (Vitest + supertest) com cobertura mínima de 80% |
| `npm run typecheck` / `npm run lint` | tipos e regras de lint compartilhadas (`tooling/eslint`) |
| `npm run build` | gera `dist/server.js` com o esbuild (`build.mjs`) |
| `npm start` | roda o `dist/server.js` |

## Banco de dados (MySQL)

```bash
docker compose up -d mysql   # na raiz: MySQL 8.4 local na porta 3307
npm run db:migrate           # aplica as migrations pendentes
npm run db:rollback          # desfaz a última
npm run db:reset             # desfaz todas
```

- **Kysely + mysql2:** toda consulta é montada em TypeScript, sempre parametrizada, e o tipo
  das tabelas (`src/models/tables.ts`) usa os tipos do `@correctio/domain`. Nome de coluna
  errado não compila.
- **Migrations em `src/db/migrations`,** listadas em `index.ts`, com subida e descida. Uma
  migration nova pega o próximo número e nunca muda depois de mergeada.
- **Sempre TLS.** `DATABASE_TLS=local` aceita o certificado autoassinado do Docker.
  Em produção, `verify` com `DATABASE_CA_CERT` é obrigatório. Conexão sem criptografia é recusada.
- **Hospedagem:** o MySQL hospedado é o plano gratuito do Aiven, e a API roda no Firebase
  (Cloud Functions), com o deploy na #39. As credenciais ficam só no gerenciador de segredos.
  O Aiven gratuito pode desligar o serviço por inatividade, sem prazo definido, e avisa por
  e-mail antes. O workflow `keep-alive.yml` chama o `/api/health` a cada 6 horas para reduzir o
  risco, mas não o elimina: o banco caiu em 15/10 mesmo com ele rodando. Se acontecer, religue
  em **Power on** no console do Aiven. Limites, backup e região: `docs/adr/ADR-001-mysql-database-hosting.md`.

### Um banco por ambiente

| Ambiente | Banco | Usuário | Onde ficam as credenciais |
|---|---|---|---|
| Local | `correctio` no Docker (porta 3307) | `correctio` | `apps/api/.env`, valores do `.env.example` |
| CI | banco descartável por execução | `root` do serviço MySQL do job | `pr.yml`, só valores de teste |
| Pré-produção (links de preview, #11) | `correctio_preview` no Aiven | um usuário que só enxerga `correctio_preview` | segredos do projeto Firebase de pré-produção e do ambiente `preview` do GitHub |
| Produção | `correctio` no Aiven | um usuário que só enxerga `correctio` | segredos do projeto Firebase de produção e do ambiente `production` do GitHub |

- **O `.env` local aponta sempre para o Docker.** Credencial do Aiven não fica salva na máquina:
  uma conferência pontual usa um `.env.<ambiente>.local`, que o git ignora, apagado logo depois.
- **Pré-produção e produção são projetos Firebase separados**, então um link de preview nunca
  chama a API de produção.
- **Cada ambiente tem o próprio usuário**, com acesso só ao próprio banco: um engano de
  configuração na pré-produção esbarra num "acesso negado", e não apaga dado real. O `avnadmin`
  do Aiven fica só para administração, nunca na API.
- **Teste de contrato:** `src/db/__tests__/schema.test.ts` cria um banco descartável, aplica
  as migrations e confere que toda tabela tem todos os campos de `docs/Modelo_de_Dados.md`, que
  nenhuma chave apaga em cascata e que a conexão é TLS. Ele roda quando `DATABASE_TEST_URL` existe
  (no `.env` local ou na CI), e na CI nunca é pulado.

Como o modelo vira tabelas: `docs/Modelo_de_Dados.md`, seção "Como o modelo vira tabelas".

## Pastas

```
src/
  app.ts            createApp(): monta o Express sem abrir porta, para o supertest
  server.ts         abre a porta e encerra com calma no SIGTERM
  config/env.ts     variáveis de ambiente validadas com Zod na subida
  routes/           só liga caminho a controle
  controllers/      lê a requisição, chama o serviço, escreve a resposta
  services/         regra de negócio e escopo pelo professor
  repositories/     acesso ao banco (Kysely)
  models/           tipos das tabelas (tables.ts)
  db/               conexão, migrations, comando de migrar, busca de texto e erros do MySQL
  middlewares/      autenticação, erro, rota inexistente
  lib/              ApiError, paginação, validação da entrada, mesclagem do PATCH, criptografia de campo,
                    armazenamento de arquivos, logger
  lib/exam-pdf/     o PDF da aplicação: páginas, cartão-resposta e QR Code de cada folha
```

Tipos e schemas vêm de `@correctio/domain` (`packages/domain`), os mesmos do front: a API valida
com as mesmas regras das telas, sem cópia.

## Convenções

| Tema | Regra |
|---|---|
| Rotas | Os nomes da tabela de endpoints da Spec (seção 7 do `docs/Spec SGP Católica.pdf`), sem prefixo, substantivo no plural (`/questions`) |
| Lista | `{ items, total }`. `page` (padrão 1), `pageSize` (padrão 50, máximo 1000), `search`, `archived`, mais os filtros da entidade, aplicados **antes** de paginar. Acima de 1000 responde 400, nunca corta em silêncio |
| Erro | `{ code, message }`, com `message` em português, porque a tela mostra o texto como veio |
| Códigos | `not-found` 404 · `invalid` 400 · `conflict` 409 · `failure` 500 · `unauthorized` 401 · `too-many-requests` 429 (com `Retry-After`). Erro inesperado vira `failure` sem stack trace, e o detalhe fica só no log |
| Escrita | `PATCH` mescla `{ ...atual, ...enviado }` e nunca apaga campo que não conhece. Campo limpo chega como `null` |
| Remoção | Sempre soft: `DELETE /questions/:id` preenche `deletedAt`; turmas, provas e aplicações usam `PATCH /<x>/:id/archive`. Restaurar é `PATCH /<x>/:id/restore` |
| Dono | O professor vem do token, nunca do corpo. Recurso de outro professor responde **404, nunca 403** |
| Acesso | Fechado por padrão: tudo que é montado depois do `requireAuth` exige token. Ficam antes dele só `/health`, as rotas de login (#40) e a consulta pública (#49) |
| Datas | String ISO 8601 no JSON |
| Limite | Camadas de `RATE_LIMITS` (`middlewares/rate-limit.ts`). Por professor atrás do `requireAuth`: leitura 300/min e escrita 60/min. Por endereço, só respostas 401 (30/min), contra quem tenta adivinhar token. Login, consulta pública e rotas caras aplicam a própria camada (`createRateLimit`) |
| Cache | `Cache-Control: no-store` em toda resposta: dado pessoal não fica em proxy nem em disco. O front guarda em memória (TanStack Query) |
| Arquivos | Fora do banco, pelo `lib/file-storage.ts`: uma pasta local (`FILE_STORAGE_DIR`) fora do host e o bucket do Firebase Storage no host (ADR-004). A coluna guarda a chave do arquivo, nunca uma URL, e o arquivo só sai pela API, com o token do professor dono |
| E-mail do aluno | Gravado cifrado com AES-256-GCM (`lib/field-encryption.ts`), com um IV novo a cada gravação, e devolvido em claro só ao professor dono da turma. Quem cifra e decifra é o repositório de alunos, e mais ninguém |
| Segurança | Regras completas em `docs/Seguranca_e_LGPD.md`, seção 7 |

### Rotas que o grupo acrescentou à tabela da Spec

| Rota | Por quê |
|---|---|
| `PATCH /<x>/:id/restore` | A Spec arquiva, mas não restaura; as telas permitem restaurar |
| `GET /classes/:id` | A tela P5 abre uma turma pelo id, e a Spec só lista as turmas |
| `POST /classes/:id/students/import` | Importação em lote (RF08). Responde `{ created, skipped }` e usa o limite das rotas caras |
| `PATCH /classes/:id/students/:studentId` | Editar o aluno (RF07), mesclando como os outros `PATCH` |
| `POST /classes/:id/students/:studentId/anonymize` | Anonimização irreversível do aluno (RF38) |
| `POST /exams/draw` | Geração automática de prova (RF16) |
| `POST /applications/:id/grades-release` | Libera ou recolhe as notas, com `{ released }`. Responde a aplicação |
| `GET /applications/:id/sheets` | Folhas impressas, por `sheetNumber`. Faz o papel do `GET /applications/:id/students` da Spec, porque a `AnswerSheet` substituiu o `ExamAssignment` (`docs/Modelo_de_Dados.md`) |
| `GET /applications/:id/pdf` | Baixa o PDF consolidado. É o endereço que o `pdfUrl` da aplicação traz |
| `POST /applications/:id/corrections` | Grava a revisão de uma folha (RF28, RF30). A Spec só lista e edita as correções |
| `GET /applications/:id/corrections/:correctionId` | Uma correção, para a tela de revisão (P16) |
| `GET /public/sheets/:code` | Consulta pública por folha, pelo `AnswerSheet.code` (#49) |

### Aplicações

As rotas de aplicação trabalham, por enquanto, sobre aplicações que já existem. Criar, editar e
gerar (`POST /applications`, `PATCH /applications/:id` e `POST /applications/:id/generate-pdf`)
leem a prova e chegam junto com as provas da #45.

- **Lista:** além dos parâmetros de lista, aceita `classId`, `examId` e `status`, da mais antiga
  para a mais recente. A busca procura o dia, escrito como a tela mostra (`05/10/2026`) ou como
  ISO (`2026-10-05`), inteiro ou em parte. Cada `status` fica de um lado só do `archived`:
  `closed` só entre as arquivadas, `draft` e `generated` só entre as ativas. Pedir um `status` do
  outro lado responde 400, em vez de uma lista vazia que pareceria "não há nenhuma".
- **Restaurar** devolve a aplicação arquivada como `draft`, nunca como `generated`; uma que não
  está arquivada fica como está.
- **Versões e folhas** são listas `{ items, total }`, por `versionNumber` e `sheetNumber`.
- **Gabarito e notas (RF46):** `POST /applications/:id/versions/:versionId/publish-answer-key`
  recebe `{ published }`. Liberar as notas exige o gabarito de todas as versões publicado, e o
  gabarito não pode ser despublicado com as notas liberadas, porque a nota nunca aparece sem
  ele. Publicar de novo não muda o `answerKeyPublishedAt`.
- **PDF:** o `pdfUrl` aparece só quando há PDF e traz o endereço da rota de download, relativo à
  raiz da API. O arquivo contém o nome dos alunos quando a aplicação é identificada, então
  não existe link público: o front baixa com o token, como qualquer outra chamada.

### Correções

As correções ficam debaixo da aplicação: `GET` e `POST /applications/:id/corrections`, e `GET` e
`PATCH /applications/:id/corrections/:correctionId`. O dono é o professor da aplicação.

- **A nota é do servidor.** O cliente manda só o que o professor escolheu: a folha
  (`answerSheetId`), a alternativa marcada em cada objetiva (`answers`), as notas das discursivas
  (`discursiveScores`), `notes`, `studentId` e `finalize`. O servidor calcula acerto, nota por
  questão, `totalScore` e `status` com as mesmas regras das telas (`@correctio/domain`) e
  descarta esses campos se vierem do cliente.
- **Validação contra a prova:** cada resposta é de uma objetiva da prova e marca uma alternativa
  dela; cada nota é de uma discursiva e fica entre 0 e o `maxScore` da questão. A prova é lida
  como foi impressa, inclusive a questão excluída do banco depois.
- **Status:** `finalize: false` grava `IN_PROGRESS`. `finalize: true` grava `DONE` só quando toda
  discursiva tem nota, e zero conta como nota (RF28, RF47). No `PATCH`, sem `finalize`, a
  correção continua como estava.
- **Uma correção por folha:** a segunda responde 409, e a edição é pelo `PATCH`, que mescla e
  calcula a nota de novo.
- **Aluno (RF31):** a folha impressa com nome é daquele aluno, com `isAutomaticallyAssigned: true`.
  Na folha sem nome, o `studentId` enviado precisa ser da turma, e grava
  `isAutomaticallyAssigned: false`. O mesmo aluno duas vezes na mesma versão responde 409.
- **`clientCorrectionId` e `syncStatus`** são obrigatórios, como na Spec. O site não manda nenhum
  dos dois, e o servidor gera a chave e grava `synced`. Um app que migre para cá manda os seus, e a
  API guarda; a mesma chave duas vezes responde 409.
- **Lista:** na ordem das folhas, com os filtros `assigned` (`false` lista as pendentes de
  atribuição, P17) e `status` (`IN_PROGRESS`, RF48).
- Por enquanto toda correção é `MANUAL`. A correção que vem de uma foto (`IMAGE_UPLOAD`), com a
  `imageUrl`, chega com o envio das fotos (#47, segunda parte).

`POST /classes/:id/students` cria o registro do aluno, com nome, matrícula e e-mail opcional. Na
Spec, a mesma rota matricula por e-mail um aluno que já tem conta, mas aqui o aluno não tem conta
(`docs/Arquitetura.md`, seção 9). Pelo mesmo motivo, as rotas de código de convite da Spec
(`/classes/:id/invite-code` e `/classes/join-by-code`) não existem.

## Variáveis de ambiente

Ver `.env.example` para rodar local. No Firebase, `NODE_ENV=production`, `DATABASE_TLS=verify`,
`FILE_STORAGE=firebase`, `CORS_ORIGINS` (os endereços do próprio projeto) e `TRUST_PROXY_HOPS=2`
vêm de `src/config/hosted-env.ts`, e nenhuma variável do host consegue trocar os três primeiros. Os 2 saltos
foram medidos no primeiro deploy: a requisição chega com `X-Forwarded-For: <cliente>, <proxy do Google>`. Os segredos vêm do Secret Manager do projeto.

Sem `DATA_ENCRYPTION_KEY`, a API não sobe: o `bootstrapApi` recusa a falta da chave, tanto no
servidor local quanto na função do Firebase. As migrations não leem a chave, então o passo de
migração do deploy continua funcionando sem ela.

## Publicação

A API roda como a função `api` do Firebase (`src/function.ts`), na região `us-west1`, perto do
banco, com uma instância só, porque os limites de requisição contam em memória. O Hosting
encaminha `/api/**` para ela, então em produção as rotas respondem em
`https://correctio-app.web.app/api/...`.

- `npm run build` gera também `dist/function/`: o código da função com um `package.json` próprio,
  nas versões exatas que os testes usaram.
- `src/server.ts` e `src/function.ts` só recebem requisições; tudo o que respondem é montado em
  `bootstrapApi` (`src/bootstrap.ts`), então local e publicado não divergem.
- Os PDFs vão para o bucket padrão do Firebase Storage de cada projeto, criado em `us-west1` e
  privado, com as regras do Storage negando todo acesso vindo do navegador (ADR-004). A função
  usa a própria conta de serviço, sem chave salva em lugar nenhum. Enquanto o bucket não existir,
  a API sobe normalmente e só as rotas de arquivo respondem com erro: 500, com a mensagem "O
  armazenamento de arquivos do servidor não está disponível.", registrado no log com a causa. O
  Cloud Storage responde 404 tanto para o bucket que não existe quanto para o arquivo que sumiu,
  e por isso a API pergunta se o bucket existe antes de tratar o 404 como arquivo perdido.
- A função também responde no endereço direto do Google, sem passar pelo Hosting, e ali o
  `X-Forwarded-For` pode ser forjado: os limites por endereço valem para quem usa o site, não para
  quem chama a função direto. Os limites por professor não dependem do endereço.
- Quem publica é o workflow `deploy.yml`, chamado pela release (produção) e pelo "1. Pre-release"
  (pré-produção). Ordem e segredos: `docs/CI_CD.md`, seção 4.
