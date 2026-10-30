# ADR-003: Sessão própria da API, com login por e-mail e senha ou pelo Google

**Status:** aceito em 14/10/2026, decisão da PM registrada na #83 · Issues: #40 (implementação), #83, #84 (este registro)

## Contexto

A Spec prevê endpoints `/auth` com JWT e refresh token (RF02, RNF04, entidade `RefreshToken` em `docs/Modelo_de_Dados.md`). Os documentos da N1 propunham trocar isso por Firebase Auth (`docs/Arquitetura.md`, seção 3; `docs/Seguranca_e_LGPD.md`, seção 2), pendente de validação com a professora (#83). A N2 precisava de login real até 23/10, e a API já roda no Firebase (ADR-005).

Alternativas avaliadas:

| Opção | Por que ficou de fora |
|---|---|
| Firebase Auth | O SDK cuida da sessão e o login com Google sai pronto. Mas substitui os endpoints `/auth` da Spec, deixa a entidade `RefreshToken` sem uso e põe a identidade do professor dentro de um serviço externo, fora do banco do sistema. |
| Auth0, Clerk e semelhantes | Mesmo problema da Spec, mais um subprocessador e limites de plano gratuito. |
| Sessão no servidor (cookie + tabela de sessões) | Atende, mas não é o JWT que o RF02 pede, e toda requisição consultaria o banco para saber quem é o professor. |

## Decisão

**A sessão é sempre da própria API, nas rotas `/auth` da Spec.** O Google só confirma quem é a pessoa; a sessão emitida é a mesma do login por senha.

- **Access token:** JWT HS256 de 15 minutos, assinado com `JWT_SECRET`. Fica só na memória do front e vai no cabeçalho `Authorization`.
- **Refresh token:**
  - opaco, de 32 bytes aleatórios, gravado só como SHA-256 (`tokenHash` do `RefreshToken`);
  - gira a cada uso;
  - um token já revogado que volta depois de 10 segundos encerra todas as sessões da conta, porque é sinal de cópia;
  - mora no cookie `__session` (`httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`). O nome não é escolha: é o único cookie que o Firebase Hosting repassa à função.
- **Senha:**
  - argon2id, com os parâmetros mínimos do OWASP, e no mínimo 8 caracteres;
  - e-mail errado e senha errada respondem igual;
  - conta anonimizada não entra.
- **Bloqueio (RNF04):**
  - cadastro, login e pedido de redefinição aceitam 5 tentativas a cada 15 minutos por IP + e-mail, com espera progressiva a partir da 3ª;
  - depois disso, 429 com `Retry-After`;
  - o login conta só as falhas.
- **Recuperação de senha (RF03):**
  - e-mail pelo Gmail do projeto (`correctioapp@gmail.com`, SMTP com senha de app);
  - link de uso único, válido por 30 minutos, guardado só como hash (entidade `AuthCode`, acréscimo do grupo);
  - a resposta é a mesma, e leva o mesmo tempo, com ou sem conta.
- **Google:**
  - fluxo de código no servidor, com um endereço de retorno fixo por projeto;
  - a API devolve o navegador à origem que começou: produção, o link fixo da pré ou o link de uma branch;
  - o código de uso único só funciona no navegador que iniciou o login, e um link repassado não serve em outro;
  - o mesmo e-mail é sempre a mesma conta. Uma conta cujo e-mail ninguém provou ler (`User.emailVerifiedAt`, acréscimo do grupo) perde a senha e as sessões quando a dona do e-mail entra com o Google.
- **"Sair de todos os dispositivos" (RF04)** revoga todos os refresh tokens da conta.

## Consequências

- **A Spec é seguida como está.** `/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`, `/forgot-password`, `/reset-password` e `/me` existem, e o `RefreshToken` é usado com os campos do contrato.
- **Duas peças novas no modelo de dados,** marcadas como acréscimo: a entidade `AuthCode` e o campo `User.emailVerifiedAt`.
- **Segredos novos no Secret Manager de cada ambiente:** `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GMAIL_APP_PASSWORD`. Sem eles, a função não publica.
- **Uma instância só.** Os contadores do bloqueio ficam em memória, então a função roda com uma instância (ADR-005). Mais de uma exigiria um armazenamento compartilhado, como Redis.
- **O Gmail limita a 500 e-mails por dia.** Basta para redefinição de senha. Se o sistema passar a mandar notificações, precisa de um provedor transacional.
- **O cliente OAuth do Google precisa ficar "em produção" na tela de consentimento.** Sem isso, só contas de teste entram. Os escopos `openid`, `email` e `profile` não exigem verificação do Google.
- **Documentos atualizados:**
  - `docs/Arquitetura.md`, seção 3: a autenticação deixa de ser Firebase Auth;
  - `docs/Seguranca_e_LGPD.md`, regras 2 e 3 da seção 2: o token é validado pela própria API, e nenhum token fica em `localStorage`;
  - `docs/Modelo_de_Dados.md`: o `AuthCode` e o `User.emailVerifiedAt`.
- **Validado com a professora em 26/10/2026 (#83).** Ela respondeu que a decisão técnica da autenticação é do grupo e que o principal é entregar o MVP funcionando. Se ela passar a exigir outra forma de autenticação, este ADR é substituído por um novo, que o referencia.
