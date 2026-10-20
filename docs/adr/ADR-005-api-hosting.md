# ADR-005: API em Cloud Functions do Firebase, no mesmo endereço do front

**Status:** aceito em 15/10/2026 · Issues: #39 (deploy da API), #11 (pré-produção), #84 (este registro)

## Contexto

A partir da N2, a API Express precisa rodar publicada. A #39 fixou os critérios:
- plano gratuito;
- Node 22;
- HTTPS, porque o navegador bloqueia chamada de página HTTPS para API HTTP, além do RNF04;
- alcançar o MySQL do ADR-001;
- segredos fora do código;
- deploy automático a partir do GitHub.

O front da N1 já estava publicado em HTTPS, e a pré-produção precisava de um link por branch para testar antes da release.

Alternativas avaliadas:

| Opção | Por que ficou de fora |
|---|---|
| Render (plano gratuito) | Adormece o serviço depois de alguns minutos sem uso, e a primeira requisição espera dezenas de segundos. Também ficaria num endereço diferente do front, o que exige CORS e cookie entre sites. |
| Vercel (funções serverless) | Exige adaptar o Express e também separa o endereço da API do front. |
| Cloud Run puro | É o que roda por baixo das Cloud Functions de 2ª geração, mas sem a integração com o Firebase Hosting, que é o que põe front e API no mesmo endereço. |
| Máquina virtual | Custo fixo e manutenção do sistema operacional, sem ganho para o volume da disciplina. |

## Decisão

- **Front no Firebase Hosting e API em Cloud Functions de 2ª geração** (função `api`, Node 22, região **us-west1**, perto do banco em São Francisco). Cada requisição faz várias consultas, e a distância que pesa é entre a API e o banco.
- **Mesmo endereço.**
  - O Hosting encaminha `/api/**` para a função, então o navegador nunca faz chamada entre origens.
  - O cookie de sessão é do próprio site (ADR-003).
  - Cada link de pré-produção alcança a API do seu projeto.
- **Dois projetos Firebase, no plano Blaze:**
  - `correctio-app`, produção, em https://correctio-app.web.app;
  - `correctio-app-preview`, pré-produção, com o link fixo da release do dia e até 10 links de branch, os mais antigos apagados.
- **Uma instância (`maxInstances: 1`).** Os limites de requisição contam em memória; duas instâncias contariam separado e dobrariam cada limite.
- **Segredos no Secret Manager de cada projeto,** declarados na função (`apps/api/src/function.ts`). O que é igual em todo projeto (origens permitidas, endereço público, saltos de proxy, modo produção e TLS verificado) é montado no código (`config/hosted-env.ts`), sem configuração manual.
- **Deploy pelo GitHub Actions, sem chave guardada:**
  - o Google só entrega credencial a um job deste repositório rodando no ambiente `production` ou `preview`;
  - os dois ambientes têm a PM como revisora obrigatória;
  - o deploy roda as migrations antes de publicar a função e confere o `/api/health` depois (`docs/CI_CD.md`, seção 4).

## Consequências

- **Cota gratuita:** o Blaze cobra só acima da cota. O Cloud Run dá 2 milhões de requisições, 180 mil vCPU-segundo e 360 mil GB-segundo por mês ([cotas gratuitas do Google Cloud](https://docs.cloud.google.com/free/docs/free-cloud-features)), muito acima do volume da disciplina. O Secret Manager cobra cada versão ativa de segredo além de 6, alguns centavos por mês nos dois projetos.
- **Cartão vinculado.** O Blaze exige forma de pagamento. Alertas de orçamento estão previstos para a N3 (`docs/Seguranca_e_LGPD.md`, seção 8).
- **A função só tem CPU enquanto responde.** Nada pode rodar depois da resposta. Por isso o pedido de redefinição de senha espera um tempo fixo antes de responder, em vez de mandar o e-mail em segundo plano (ADR-003).
- **Partida a frio.** A primeira requisição depois de um tempo parada leva alguns segundos para subir a instância.
- **Escalar exige Redis.** Para passar de uma instância, os contadores dos limites e do bloqueio de login precisam ir para um armazenamento compartilhado.
- **Só o cookie `__session` chega à função.** O Hosting descarta qualquer outro cookie, o que fixou o nome do cookie de sessão (ADR-003).
- **Região nos EUA.** Os dados passam pelos EUA em trânsito e no processamento, como no banco (ADR-001) e nas imagens (ADR-004).
- **O GitHub Pages continua** publicando só o front, como demonstração sem API (`VITE_DEMO_MODE`).
