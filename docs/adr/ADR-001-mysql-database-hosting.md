# ADR-001: MySQL 8 no Aiven, com um banco por ambiente

**Status:** aceito em 15/10/2026, revisto em 21/10/2026 · Issues: #32 (banco), #11 (pré-produção), #84 (este registro), #151 (backup)

## Contexto

A disciplina exige MySQL a partir da N2. O `localStorage` da N1 não serve como banco: tem cerca de 5 MB, é síncrono e vale por navegador, então o que um professor grava não existe em outro aparelho (`docs/Arquitetura.md`, seção 4).

A #32 fixou os critérios para escolher onde o banco roda:

- plano gratuito que aguente a N2 e a N3;
- MySQL 8, porque o esquema usa colunas JSON e uma collation que compara sem diferenciar maiúsculas;
- conexão com TLS, a partir de onde a API roda (ADR-005);
- credenciais fora do código;
- backup, de preferência automático. O RNF09 pede backup diário com 30 dias de retenção.

Alternativas avaliadas:

| Opção | Por que ficou de fora |
|---|---|
| Cloud SQL (Google) | Ficaria no mesmo provedor da API, mas não tem plano gratuito. A menor instância custa por hora ligada. |
| MySQL junto da API | A API roda em Cloud Functions (ADR-005), que não guarda estado entre requisições. Não há onde manter um banco ali. |
| MySQL só em Docker | Funciona no desenvolvimento, e é o que o `docker compose` sobe na porta 3307. Não alcança a versão publicada. |
| Aiven for MySQL, plano gratuito | Escolhido: MySQL 8 gerenciado, TLS obrigatório, criptografia em repouso, sem cartão. Os limites ficam nas Consequências. |

## Decisão

- **Serviço:** Aiven for MySQL 8, plano gratuito, na nuvem DigitalOcean, região de São Francisco (EUA).
- **Um banco por ambiente**, no mesmo serviço:
  - `correctio`, de produção, com o usuário `correctio_prod`;
  - `correctio_preview`, da pré-produção, com um usuário que só enxerga esse banco.

  O `avnadmin` fica só para administração e nunca vai para a API nem para o CI. O desenvolvimento local usa sempre o MySQL do Docker.
- **Conexão:**
  - a API lê `DATABASE_URL` e `DATABASE_CA_CERT` do ambiente, e `loadEnv` valida as duas na subida;
  - em produção, `DATABASE_TLS=verify` é forçado (`apps/api/src/config/hosted-env.ts`), então o certificado do servidor é conferido contra a CA do Aiven;
  - uma conexão sem TLS é recusada em qualquer ambiente.
- **Credenciais:** ficam só no Secret Manager de cada projeto Firebase e nos ambientes `production` e `preview` do GitHub. Nunca no repositório, nunca no bundle do front.
- **Acesso e migrations:**
  - [Kysely](https://kysely.dev), um query builder que gera SQL sempre parametrizado (RNF18);
  - migrations versionadas em `apps/api/src/db/migrations`, cada uma com `up` e `down`, rodadas por `npm run db:migrate` e pelo deploy antes de publicar a função.
- **Esquema:**
  - tabela e coluna com o nome exato do campo do contrato (`docs/Modelo_de_Dados.md`);
  - JSON para os campos aninhados que não entram em consulta, e tabela filha para os que entram;
  - um teste compara o esquema real com os schemas do `@correctio/domain`.

## Consequências

- **Limites do plano gratuito:** 1 CPU, 1 GB de RAM, 1 GB de disco, até 76 conexões, sem pool de conexões, sem IP fixo e sem VPC ([Aiven, MySQL free tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)). Cabe com folga no volume de uma disciplina.
- **O serviço pode ser desligado por inatividade.**
  - O Aiven reserva o direito de desligar serviços gratuitos sem "atividade contínua", sem dizer depois de quanto tempo, e avisa por e-mail antes.
  - O serviço foi desligado em 13/10, o que motivou o workflow `keep-alive.yml`, que consulta o banco a cada 6 horas. Foi desligado de novo em 15/10, já com o keep-alive rodando. Quando isso acontece, produção e pré respondem 503 até alguém clicar em "Power on" no console do Aiven.
  - O único plano que nunca desliga é o Developer, de US$ 5 a 8 por mês ([Aiven, planos gratuitos](https://aiven.io/blog/free-plans-postgresql-mysql-redis)). Em 20/10 a PM decidiu ficar no gratuito e aceitar esse risco (ver "Revisão de 21/10/2026").
- **O backup do plano gratuito não atende o RNF09, e o projeto faz o seu.**
  - O Aiven guarda um único backup, só para recuperação de desastre ([Aiven, preços do MySQL](https://aiven.io/pricing/mysql)), que o projeto não consegue baixar nem restaurar. O RNF09 pede backup diário com 30 dias de retenção, restauração testada todo mês e perda máxima de 24 horas.
  - Desde 21/10, um dump diário da produção vai para um bucket privado do Google com retenção de 30 dias, e a restauração é testada todo mês num MySQL descartável da CI (`docs/CI_CD.md`, seção 8).
- **Os dados ficam fora do Brasil.**
  - São Francisco é transferência internacional de dado de aluno (LGPD, Art. 33): nome, matrícula, e-mail cifrado e notas.
  - O Aiven e a DigitalOcean entram como subprocessadores, ao lado do Google (ADR-004, ADR-005), e precisam constar no aviso de privacidade (RF39) e no acordo com a instituição (`docs/Seguranca_e_LGPD.md`, seção 6).
  - Proteções em vigor: TLS 1.3 em trânsito, disco cifrado (LUKS, AES-XTS) e backups cifrados (AES-256) pelo próprio Aiven, e o e-mail do aluno cifrado na aplicação com AES-256-GCM (`DATA_ENCRYPTION_KEY`).
- **Pré e produção dividem o mesmo serviço.** Os dados nunca se misturam, porque cada ambiente tem seu banco e seu usuário. Mas um desligamento derruba os dois juntos, e uma carga pesada na pré disputa a mesma CPU.

## Revisão de 21/10/2026

- **Fica no plano gratuito.** O desligamento por inatividade aconteceu duas vezes (13 e 15/10). A PM avaliou o plano Developer, de US$ 5 por mês, sempre ligado, e decidiu ficar no gratuito com o risco aceito.
  - O que reduz o risco: o `keep-alive.yml` consulta o banco a cada 6 horas.
  - O que avisa: uma execução do keep-alive que falha manda e-mail, e a volta é clicar em "Power on" no console do Aiven.
- **O RNF09 passa a ser atendido pelo backup do projeto**, não pelo do Aiven (#151): dump diário, só de leitura, no bucket `correctio-app-db-backups`, e teste mensal de restauração com registro. Fica no Google, que já é subprocessador (ADR-004, ADR-005), na mesma região us-west1.
- **Trocar de plano continua sendo uma decisão reversível.** Subir para o Developer é um clique no console e não muda nada no código, e o backup do projeto continua valendo do mesmo jeito.
