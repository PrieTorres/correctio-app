# Segurança, Proteção de Custo e LGPD — Correctio

Documento de apoio aos requisitos. Os requisitos verificáveis estão em [Correctio_Requisitos_e_Telas.md](Correctio_Requisitos_e_Telas.md) — aqui está o **desenho** por trás deles: por que cada medida existe e como é implementada.

**Onde cada coisa roda.** Praticamente nada disto é da N1: a N1 é um site estático no GitHub Pages. A implementação é da N2/N3, no Express. O documento existe agora porque essas regras mudam o modelo de dados (retenção, anonimização de aluno, EXIF, código da folha) e é mais barato desenhar antes do que remendar depois.

---

## 1. A N1 não tem segurança — e isso é intencional

GitHub Pages + `localStorage` é um site estático rodando **inteiro na máquina do visitante**. Todo o dado está no navegador dele, legível e editável pelo DevTools. Rota protegida em SPA é experiência de uso, não controle de acesso: quem quiser, contorna.

Isso não é um problema na N1, porque lá o dado é fictício e semeado. O que a N1 entrega é o **formato** da autorização, não a autorização:

- Todo repositório já é escopado pelo id do professor da sessão, mesmo lendo do `localStorage`. Não por segurança — para que a assinatura seja idêntica na N2 e o Express não descubra escopo faltando em vinte lugares.
- Toda consulta pública já devolve um DTO estreito e explícito, nunca a entidade inteira.

**A segurança real nasce na N2, no servidor. Nada do que o front faz conta como controle de acesso.**

---

## 2. Modelo de autorização

### Regra 1 — nunca confiar em id vindo do cliente

`GET /turmas/:id` não busca a turma e devolve. Busca `WHERE id = :id AND professor_id = :usuarioAutenticado`. Isso vale para turma, aluno, questão, prova, aplicação, versão, folha e correção.

É o bug conhecido como IDOR (*Insecure Direct Object Reference*) e é por onde vazam praticamente todos os sistemas desse tipo. Duas consequências de projeto:

- **O enforcement fica na camada de serviço/repositório, não na rota.** Se depender da rota, o próximo endpoint que alguém escrever vai esquecer.
- **Responder 404, não 403**, para recurso de outro professor. Um 403 confirma que aquela prova existe.

### Regra 2 — o servidor valida o token em toda requisição

A API confere a assinatura e a validade do access token (JWT HS256, assinado com `JWT_SECRET`)
a cada chamada. O front nunca decide permissão; ele só decide o que desenhar.

O login com o Google não muda isso: o Google só confirma quem é a pessoa, e a API emite a mesma
sessão própria do login por e-mail e senha (decisão da PM de 14/10, na #40).

### Regra 3 — nenhum token em `localStorage`

O access token (15 minutos) vive só na memória do front. O refresh token nem chega ao
JavaScript: mora no cookie `__session`, `httpOnly`, `Secure`, `SameSite=Strict` e com caminho
`/api/auth`. O nome não é escolha: o Firebase Hosting só repassa à função o cookie chamado
`__session` e descarta os outros.

Cada refresh revoga o token usado e emite outro. Um token já revogado que volta depois de 10
segundos é sinal de cópia, e todas as sessões da conta terminam. As abas do mesmo navegador
renovam uma de cada vez (Web Locks), para que a rotação de uma não pareça roubo para a outra.

### O que isso significa com cadastro aberto

Sem restrição de domínio de e-mail, qualquer pessoa cria uma conta de professor. Isso é aceitável **desde que** o isolamento seja perfeito: cada conta vê exclusivamente o que criou. O isolamento deixa de ser uma boa prática e passa a ser a única barreira do sistema — daí ele ser um requisito com métrica e teste automatizado (RNF14), não uma recomendação.

---

## 3. O maior risco do sistema é a página pública

A consulta por QR Code (PUB1) é a única superfície sem autenticação, e ela expõe **nome do aluno e nota**. Se o código da folha for sequencial ou curto, qualquer pessoa varre `/r/1`, `/r/2`, `/r/3` e colhe as notas da instituição inteira.

Como a decisão de produto foi consulta sem digitar matrícula, **o código é a segurança inteira**. Ele precisa aguentar isso sozinho:

| Medida | Detalhe |
|---|---|
| **Token opaco** | Aleatório criptográfico, ≥ 128 bits. Nunca sequencial, nunca derivado do id do aluno ou da aplicação. |
| **Separado do número visível** | "Folha 37" é para o professor organizar papel. Não é chave de consulta. |
| **Limite de requisições** | 30/min por IP, com espera progressiva. Segunda barreira contra varredura. |
| **`noindex` + `robots.txt`** | Sem isso o Google indexa notas de aluno — e o site é totalmente público. |
| **Resposta mínima** | Só o que a regra autoriza, e só depois de notas liberadas / gabarito publicado. Nunca o registro completo do aluno. |
| **Invalidação** | Folha de PDF regenerado responde "QR inválido", nunca a nota antiga. |
| **Dois níveis de liberação** | Publicar o gabarito mostra as alternativas corretas; liberar as notas acrescenta a nota do aluno. A nota nunca aparece sem o gabarito, e nada aparece antes da liberação (RF46). |

---

## 4. Limite de requisições, escalonado por custo

Um limite único não serve: 300 req/min mata a importação em lote e não impede alguém de queimar 500 gerações de PDF.

| Camada | Rotas | Limite | Chave |
|---|---|---|---|
| Pública | consulta por código | 30/min, espera progressiva | IP |
| Autenticação | cadastro, login, recuperação | 5 tentativas / 15 min, espera progressiva a partir da 3ª | IP **+** e-mail |
| Leitura | GETs autenticados | 300/min | professor |
| Escrita comum | CRUD | 60/min | professor |
| **Cara** | gerar PDF, importar lote, exportar relatório | 10/h + 1 job concorrente | professor |
| **Muito cara** | upload e leitura de folha | 500 imagens/dia, 200 MB/dia, 1 job concorrente | professor |

### Quatro detalhes que quebram isso na prática

**1. Limitar só por IP pune a faculdade inteira.** Os 600 professores saem pelo mesmo NAT institucional — o primeiro a estourar derruba os outros 599. Por isso a chave nas rotas autenticadas é o **id do professor**. IP só onde não existe usuário: rota pública e autenticação.

**2. `app.set('trust proxy', ...)` é obrigatório.** Atrás de balanceador de carga sem essa configuração, o IP que a aplicação enxerga é o do proxy, e *todo mundo* compartilha o mesmo balde. O limite some silenciosamente — não gera erro, só para de funcionar.

**3. O contador precisa ser compartilhado.** Com mais de uma instância, um limitador em memória conta por processo: três instâncias entregam o triplo do limite. Exige store externo (Redis).

**4. Trabalho caro vai para fila — e a fila deixa o app mais rápido, não mais lento.** Este é o ponto que costuma ser mal lido. A alternativa à fila não é "resposta instantânea": é a tela travada em uma barra de progresso por 40 segundos enquanto o servidor monta o PDF. Com fila, o professor recebe **confirmação em menos de 1 segundo** ("Gerando seu PDF, avisamos quando ficar pronto") e volta a usar o sistema imediatamente; a notificação chega quando o arquivo existe (RNF13).

Ou seja: a fila é o que permite atender pico de semana de prova **sem** degradar o tempo de resposta percebido. O que ela converte em latência é a conclusão do trabalho pesado, não a interação. E dá idempotência de graça — duplo clique em "Gerar PDF" não gera dois PDFs.

Isso vale para gerar PDF, ler folhas, importar em lote e exportar relatório. Nenhuma dessas telas mostra spinner bloqueante.

---

## 5. Proteção de custo

Limite por usuário não protege a conta: 600 professores legítimos na semana de prova estouram o orçamento sem violar limite nenhum.

- **Quota global diária com degradação** — passado o teto do dia, as rotas caras entram em fila longa ou recusam com mensagem clara, em vez de escalar sem limite.
- **Alerta de orçamento** em 50%, 80% e 100%. É a linha de defesa que de fato evita a fatura surpresa.
- **Teto de instâncias.** Autoescalonamento sem máximo definido é exatamente como o custo explode.
- **Leitura da folha com processamento de imagem próprio**, em vez de API de visão paga: no servidor por padrão, e no navegador do professor no demo e quando a API não responde (ADR-006). Custo previsível, e a imagem nunca vai a terceiros (ver seção 6).
- **Armazenamento em classe adequada ao acesso.** Folhas escaneadas são o maior volume e quase nunca são relidas depois do semestre. A economia vem de mover imagens antigas para armazenamento frio — **não** de apagá-las. Não existe descarte automático no Correctio: apagar dado que ninguém pediu para apagar é perda de informação. Exclusão só sob solicitação, via anonimização (RF05 e RF38).

---

## 6. LGPD

**Papéis.** A instituição é a **controladora**; o Correctio é **operador**, tratando dados por conta dela.

**Base legal.** O dado do aluno **não** é tratado com base em consentimento — o aluno nunca consente, ele é cadastrado pelo professor. A base é o legítimo interesse / execução de política educacional da instituição. Isso precisa estar escrito, não implícito.

**Dados tratados:** nome, matrícula, e-mail (opcional), notas, respostas por questão e a imagem da folha de resposta — que contém letra manuscrita e, quando identificada, o nome.

### Princípios e direitos aplicáveis

| Exigência | Como o Correctio atende |
|---|---|
| **Necessidade / minimização** (Art. 6º, III) | Pendente: o e-mail do aluno é coletado sem finalidade no sistema. Ver nota do RF07. |
| **Transparência** (Art. 6º, VI) | RF39 — aviso de privacidade no cadastro e na importação de alunos, mais página pública de aviso de privacidade. |
| **Direito de exclusão** (Art. 18, VI) | RF38 — anonimização do aluno. Remover da turma (RF09) **não** cumpre esse direito: preserva os dados. |
| **Direito de acesso e correção** (Art. 18, I–III) | O aluno não tem login, então exerce pelo professor, que edita ou anonimiza o registro. |
| **Segurança** (Art. 46) | RNF04 (tráfego), RNF16 (arquivos), RNF18 (API), RNF14 (isolamento). |
| **Registro das operações** (Art. 37) | RF40 e RNF17 — trilha de auditoria. |
| **Retenção** | Definida pela instituição, não pelo sistema. Sem descarte automático — o que protege contra perda é o backup com restauração testada (RNF09), e o que é "excluído" pela interface é reversível (RF42). Os backups em si duram 30 dias: um aluno anonimizado (RF38) continua, por até 30 dias, nos backups feitos antes da anonimização. |
| **Transferência internacional** (Art. 33) | Acontece e precisa estar declarada. O banco fica nos EUA, no Aiven sobre a DigitalOcean, em São Francisco (ADR-001). A API, as imagens das folhas e os backups diários do banco ficam no Google, em us-west1 (ADR-004, ADR-005 e `docs/CI_CD.md`, seção 8). Aiven, DigitalOcean e Google são subprocessadores. A leitura da folha roda no servidor ou no navegador do professor, nunca mandando a imagem a terceiros (ADR-006). |
| **Comunicação de incidente** (Art. 48) | Procedimento documentado: quem detecta, quem comunica, em quanto tempo. |

### Três pontos que não estavam previstos em lugar nenhum

**Imagens de questão são upload de professor, não dado de aluno.** Valem os mesmos limites
técnicos do RNF16 — tipo real do arquivo, teto de tamanho e re-processamento no recebimento —
mas a sensibilidade é outra: são conteúdo autoral, não dado pessoal de terceiro. Ficam no mesmo
armazenamento privado, e entram no PDF gerado.

**EXIF.** Foto de celular carrega **coordenadas de GPS**, data e modelo do aparelho. A tela de envio de folhas aceita foto direto da câmera. Toda imagem recebida precisa ser **re-processada no servidor**, o que remove os metadados e, de quebra, neutraliza conteúdo malicioso embutido em arquivo de imagem.

**Armazenamento privado.** As imagens das folhas ficam em armazenamento fechado, acessível só por URL assinada de curta validade. Se o repositório de arquivos for público, toda folha de resposta — com nome e nota — está na internet aberta.

**Trilha ≠ log.** São coisas diferentes e ambas precisam existir: a **trilha de auditoria** registra quem fez o quê (autor, ação, entidade, data), enquanto o **log de aplicação** não pode conter nenhum dado pessoal (RNF05). A trilha guarda a ação, nunca o conteúdo do dado.

### A confirmar

**Menores de idade** (Art. 14). Se houver aluno com menos de 18 anos, o tratamento tem exigências adicionais. Católica SC é ensino superior, então provavelmente não se aplica — confirmar com o cliente.

---

## 7. Endurecimento da API — lista de verificação

| Item | Detalhe |
|---|---|
| Cabeçalhos de segurança + CSP | Via `helmet`. Não depender de `X-XSS-Protection`, hoje desativado nos navegadores. |
| CORS | Só os endereços do próprio projeto Firebase (`<projeto>.web.app` e `<projeto>.firebaseapp.com`), derivados do projeto em que a API roda (`config/hosted-env.ts`). Nunca `*`. Front e API dividem o mesmo endereço, então o navegador nem faz chamada entre origens. |
| Validação de entrada | Schemas na fronteira, reaproveitando os mesmos do front. |
| Limite de payload | JSON pequeno por rota; upload com teto próprio. |
| Upload | Validar pelo **tipo real do arquivo**, não pela extensão. Teto de tamanho e de dimensão. |
| SQL | Sempre parametrizado ou via ORM. Nunca concatenar, nunca "escapar na mão". |
| Segredos | Em gerenciador de segredos. Nunca no repositório, nunca no bundle do front. |
| Dependências | `npm ci` com lockfile; build reprovado com vulnerabilidade alta ou crítica. |
| Container | Executado sem privilégio de root, imagem em versão LTS fixada. |
| Observabilidade | Log estruturado em JSON com id de correlação por requisição, sem dado pessoal. |
| Ciclo de vida | Encerramento gracioso em `SIGTERM`; erro desconhecido derruba o processo em vez de seguir em estado corrompido. |
| Processamento pesado | Leitura de imagem é uso intensivo de CPU e **não pode** rodar na thread principal — trava a API inteira. Vai para worker ou serviço separado, o mesmo motivo que empurra o trabalho caro para fila. |
| Cache das respostas | `Cache-Control: no-store` em toda resposta da API (`middlewares/no-store.ts`). O cache existe só na memória do app — ver "Cache" abaixo. |
| Limite de requisições | As camadas da seção 4 estão em `apps/api/src/middlewares/rate-limit.ts` (`RATE_LIMITS`). Cada rota especial aplica a sua camada. |

### Credenciais em trânsito

- **Só HTTPS.** O `helmet` envia HSTS, e a partir daí o navegador nunca mais volta para HTTP naquele domínio. É o que impede que alguém leia o token no tráfego de uma rede compartilhada.
- **Token só no cabeçalho `Authorization`.** Nunca na URL (fica em histórico, log de proxy e cabeçalho `Referer`) e nunca no log. O log da API apaga `Authorization` e `Cookie`.
- **Access token curto (15 min) e refresh token rotativo, com detecção de reuso.** O refresh token mora num cookie `httpOnly` + `Secure` + `SameSite=Strict`, fora do alcance de qualquer JavaScript, e o access token fica só na memória do front (Regra 3).
- **Barreira contra adivinhar token.** No máximo 30 respostas 401 por minuto por endereço. Só 401 conta, então um professor logado nunca gasta esse limite, nem num NAT compartilhado.

### Criptografia de dados

| Dado | Proteção |
|---|---|
| Senha | Hash **argon2id**. Nunca criptografia reversível: nem o sistema consegue recuperar a senha. |
| Refresh token | Só o hash (`tokenHash` da Spec). Quem lê o banco não consegue usar o token. |
| E-mail do aluno | **Criptografia de campo AES-256-GCM.** A chave vem de `DATA_ENCRYPTION_KEY`, guardada no gerenciador de segredos, nunca no repositório nem no bundle. |
| Nome, matrícula e notas | Criptografia em repouso do provedor, no disco e nos backups. Criptografia de campo aqui quebraria a busca e a ordenação por nome no servidor. |
| Imagens das folhas | Armazenamento privado com criptografia em repouso. Saem só por rota autenticada (N2) e, na N3, por URL assinada de curta validade. |
| Tráfego | TLS entre navegador e API, e entre API e MySQL. Conexão com o banco sem TLS é recusada. |

### Cache

O objetivo é não refazer a mesma leitura a cada troca de tela, sem nunca guardar dado pessoal onde outra pessoa alcance.

- **No front, TanStack Query só em memória.** `staleTime` de 5 minutos para o que só muda por ação do próprio professor: toda ação já invalida as chaves que afeta. O painel é invalidado por qualquer escrita. A consulta pública por QR não usa cache. Nada é persistido em `localStorage`.
- **Cache apagado no logout e em qualquer 401.** O próximo usuário do mesmo navegador não vê nada do anterior.
- **Na API, `no-store`.** Nenhum proxy, CDN ou disco de navegador guarda resposta com dado de professor ou aluno.
- **A economia vem do app não perguntar de novo**, e nunca de um cache compartilhado de dado pessoal.

---

## 8. O que entra em cada fase

| Fase | Entrega desta área |
|---|---|
| **N1** (11/09) | Este documento e os requisitos. No código: escopo por professor já na camada de repositório, DTO estreito na consulta pública, `noindex`. |
| **N2** (23/10) | Autenticação real, isolamento por conta com teste automatizado, validação na fronteira, SQL parametrizado, CORS, cabeçalhos de segurança (HSTS incluído), limite de requisições em camadas, hash de senha e de token, criptografia do e-mail do aluno, TLS até o banco, `no-store` na API e cache só em memória no front. |
| **N3** (27/11) | Fila com confirmação imediata e notificação, re-processamento de imagem e remoção de EXIF, URLs assinadas, trilha de auditoria, anonimização de aluno, alertas de orçamento. |
