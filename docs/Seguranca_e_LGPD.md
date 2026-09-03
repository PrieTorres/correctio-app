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

O Express verifica o ID token do Firebase com `firebase-admin` a cada chamada. O front nunca decide permissão; ele só decide o que desenhar.

A `apiKey` do Firebase vai no bundle e é **pública por design** — não é segredo e não precisa ser escondida. O que protege é a verificação do token no servidor.

### Regra 3 — a sessão é gerida pelo SDK

O token fica sob gestão do SDK do Firebase, não escrito à mão em `localStorage`. Renovação é problema dele.

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

---

## 4. Limite de requisições, escalonado por custo

Um limite único não serve: 300 req/min mata a importação em lote e não impede alguém de queimar 500 gerações de PDF.

| Camada | Rotas | Limite | Chave |
|---|---|---|---|
| Pública | consulta por código | 30/min, espera progressiva | IP |
| Autenticação | cadastro, login, recuperação | 5 tentativas / 15 min | IP **+** e-mail |
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
- **Leitura da folha no próprio servidor**, com processamento de imagem local, em vez de API de visão paga. Custo previsível e — ver seção 6 — evita transferência internacional de dado de aluno.
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
| **Retenção** | Definida pela instituição, não pelo sistema. Sem descarte automático — o que protege contra perda é o backup com restauração testada (RNF09), e o que é "excluído" pela interface é reversível (RF42). |
| **Transferência internacional** (Art. 33) | Evitada na leitura da folha, feita no próprio servidor. O Firebase (Google) permanece como subprocessador e precisa estar declarado. |
| **Comunicação de incidente** (Art. 48) | Procedimento documentado: quem detecta, quem comunica, em quanto tempo. |

### Três pontos que não estavam previstos em lugar nenhum

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
| CORS | Lista de origens conhecidas (GitHub Pages e domínio do Firebase Hosting). Nunca `*`. |
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

---

## 8. O que entra em cada fase

| Fase | Entrega desta área |
|---|---|
| **N1** (11/09) | Este documento e os requisitos. No código: escopo por professor já na camada de repositório, DTO estreito na consulta pública, `noindex`. |
| **N2** (23/10) | Autenticação real, isolamento por conta com teste automatizado, validação na fronteira, SQL parametrizado, CORS, cabeçalhos de segurança, limite de requisições. |
| **N3** (27/11) | Fila com confirmação imediata e notificação, re-processamento de imagem e remoção de EXIF, URLs assinadas, trilha de auditoria, anonimização de aluno, alertas de orçamento. |
