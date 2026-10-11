# @correctio/api — Back-end

Node.js 22 + Express 5 + TypeScript, em camadas: **rota → controle → serviço → repositório →
model**, como a disciplina pede. O banco MySQL entra na #32.

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

## Pastas

```
src/
  app.ts            createApp(): monta o Express sem abrir porta, para o supertest
  server.ts         abre a porta e encerra com calma no SIGTERM
  config/env.ts     variáveis de ambiente validadas com Zod na subida
  routes/           só liga caminho a controle
  controllers/      lê a requisição, chama o serviço, escreve a resposta
  services/         regra de negócio e escopo pelo professor
  repositories/     acesso ao banco (#32)
  models/           forma das tabelas (#32)
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
