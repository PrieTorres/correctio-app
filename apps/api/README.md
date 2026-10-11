# @correctio/api — Back-end

Node.js 22 + Express 5 + TypeScript, em camadas: **rota → controle → serviço → repositório →
model**, como a disciplina pede. Os dados ficam em MySQL (ver "Banco de dados" abaixo).

## Como rodar localmente

```bash
nvm use 22                         # o projeto exige Node 22.12 ou mais novo
npm install                        # na raiz do repositório
cp apps/api/.env.example apps/api/.env   # opcional: todos os valores têm padrão
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

### Um banco por ambiente

| Ambiente | Banco | Usuário | Onde ficam as credenciais |
|---|---|---|---|
| Local | `correctio` no Docker (porta 3307) | `correctio` | `apps/api/.env`, valores do `.env.example` |
| CI | banco descartável por execução | `root` do serviço MySQL do job | `pr.yml`, só valores de teste |
| Pré-produção (links de preview) | `correctio_preview` no Aiven | um usuário que só enxerga `correctio_preview` | segredos do projeto Firebase de pré-produção e do ambiente `preview` do GitHub |
| Produção | `correctio` no Aiven | um usuário que só enxerga `correctio` | segredos do projeto Firebase de produção e do ambiente `production` do GitHub |

- **Credencial de produção nunca vai para um `.env` local.** Para conferir a conexão com o
  Aiven, use a de pré-produção: é o mesmo servidor e o mesmo certificado.
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
  db/               conexão, migrations e o comando de migrar
  middlewares/      autenticação, erro, rota inexistente
  lib/              ApiError, paginação, logger
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
| Segurança | Regras completas em `docs/Seguranca_e_LGPD.md`, seção 7 |

### Rotas que o grupo acrescentou à tabela da Spec

| Rota | Por quê |
|---|---|
| `PATCH /<x>/:id/restore` | A Spec arquiva, mas não restaura; as telas permitem restaurar |
| `POST /exams/draw` | Geração automática de prova (RF16) |
| `GET /public/sheets/:code` | Consulta pública por folha, pelo `AnswerSheet.code` (#49) |

## Variáveis de ambiente

Ver `.env.example`. Em produção, `CORS_ORIGINS` precisa ser só esquema e host
(`https://prietorres.github.io`, sem `/correctio-app/`), e `TRUST_PROXY_HOPS` o número de proxies
da hospedagem.
