# ADR-002: API Express em camadas

**Status:** aceito em 15/10/2026 · Issues: #31 (estrutura da API), #38 (adaptador HTTP), #84 (este registro)

## Contexto

A disciplina pede o back-end em camadas: rota → controle → serviço → repositório → model. O front já conversa com uma única fronteira de dados, os repositórios, escritos desde a N1 no formato do contrato HTTP: assíncronos, paginados e com um formato só de erro (`docs/Arquitetura.md`, seção 2). Para nenhuma tela mudar quando o dado passa do `localStorage` para a API, a API precisa responder exatamente nesse formato.

Alternativas avaliadas:

| Opção | Por que ficou de fora |
|---|---|
| Rotas com a regra e o SQL dentro | Menos arquivos, mas a regra de negócio fica presa ao HTTP e não se testa sem subir o servidor. É também onde o escopo por professor costuma ser esquecido. |
| ORM com entidades ativas | Esconde o SQL e convida a renomear colunas no mapeamento, que é justamente o que o modelo de dados proíbe (`docs/Modelo_de_Dados.md`). |
| Framework com injeção de dependência (NestJS) | Atende as camadas, mas traz decorators, módulos e uma curva que o prazo da N2 não comporta. |

## Decisão

Cada recurso tem um arquivo por camada, e cada camada só conversa com a de baixo:

| Camada | Pode | Não pode |
|---|---|---|
| **Rota** (`routes/`) | Ligar método e caminho ao controle; aplicar o limite de requisições da camada certa | Ter regra |
| **Controle** (`controllers/`) | Ler o pedido e entregar ao serviço o corpo e o professor do token (`res.locals`); traduzir o resultado em status e JSON | Acessar o banco |
| **Serviço** (`services/`) | Validar a entrada com os schemas Zod do `@correctio/domain` antes de qualquer regra (ou receber do controle já validada); aplicar a regra de negócio; receber sempre o professor como parâmetro | Ler o professor do corpo da requisição |
| **Repositório** (`repositories/`) | SQL, sempre parametrizado e sempre filtrado por `teacherId` | Decidir regra |
| **Model** (`models/tables.ts`) | Tipar as tabelas com os nomes exatos do contrato | — |

Regras que valem para todos os recursos:

- **Validação na entrada, antes de qualquer regra**, com os mesmos schemas que o front usa. A mensagem de erro do schema é a mesma que o formulário mostra.
- **Escopo pelo professor do token.** O `requireAuth` põe o professor em `res.locals`, e todo repositório filtra por ele. Recurso de outro professor responde 404, nunca 403, para não confirmar que existe (`docs/Seguranca_e_LGPD.md`, seção 2).
- **Erro sempre como `{ code, message }`.** Os códigos são os mesmos do `StorageError` do front, e a mensagem é escrita para a tela. Erro inesperado vira `failure` genérico, registrado no log, sem stack trace para o cliente.
- **Listas como `{ items, total }`**, com `page` e `pageSize`.
- **`PATCH` mescla.** O registro gravado recebe por cima só os campos enviados, e `null` limpa um campo. Substituir o registro inteiro apagaria em silêncio o que o cliente não conhece.
- **Rotas públicas antes do portão de autenticação**, e o resto depois. Um endpoint novo nasce fechado.
- **Composição em um lugar só.** O `createApp` recebe as dependências (banco, logger, autenticação, limites) e o `bootstrapApi` monta tudo a partir do ambiente. O servidor local e a função do Firebase sobem pelo mesmo caminho.

## Consequências

- **Mais arquivos por recurso:** rota, controle, serviço, repositório, schema e testes. É o custo de cada camada ter um teste próprio e de a regra não depender do HTTP.
- **As telas não mudam com a troca para a API (#38).** O adaptador HTTP traduz o mesmo contrato do repositório local, e trocar uma área de `localStorage` para API muda só a fábrica de repositórios.
- **O isolamento entre professores fica testável.** Os testes de rota rodam contra um MySQL real e conferem que um professor não alcança o recurso do outro (RNF14).
- **A regra do `PATCH` precisa ser repetida em cada recurso novo.** Ela está no `CLAUDE.md` e em `docs/Modelo_de_Dados.md` porque já foi quebrada uma vez.
