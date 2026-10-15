# ADR-004: Imagens das folhas no Firebase Storage, fora do banco

**Status:** aceito em 15/10/2026, decisão da PM · Issues: #47 (envio das folhas, segue este ADR), #84 (este registro)

## Contexto

Uma foto de folha tirada no celular tem de 3 a 7 MB, e a correção guarda uma por folha. A imagem é o dado mais sensível do sistema: mostra a letra do aluno e, quando a folha é identificada, o nome junto da resposta e da nota.

O RNF16 pede:
- armazenamento privado;
- acesso só por URL assinada com validade de até 15 minutos;
- tipo real do arquivo conferido no envio;
- limite de 10 MB por imagem;
- nenhum dado EXIF guardado (a foto do celular traz GPS, data e modelo do aparelho).

Um armazenamento público poria toda folha, com nome e nota, na internet aberta (`docs/Seguranca_e_LGPD.md`, seção 6).

Alternativas avaliadas:

| Opção | Por que ficou de fora |
|---|---|
| Dentro do MySQL (BLOB) | O plano gratuito tem 1 GB de disco (ADR-001), que algumas centenas de folhas esgotam. Também não existe URL assinada: toda imagem teria de passar pela API. |
| Bucket em São Paulo (`southamerica-east1`) | Deixaria as fotos no Brasil. Mas o banco, com nome e nota, já está nos EUA (ADR-001), então o ganho de privacidade seria pequeno. Não há cota gratuita nessa região, e haveria tráfego entre regiões até a API. |
| Outro provedor de arquivos | Mais um subprocessador e mais um conjunto de credenciais, sem ganho sobre o armazenamento do próprio projeto Firebase. |

## Decisão

- **Onde:** Cloud Storage for Firebase, num bucket do próprio projeto de cada ambiente (`correctio-app` e `correctio-app-preview`), na região **us-west1**, a mesma da API (ADR-005).
- **Privado de verdade:**
  - as regras de segurança do Storage negam toda leitura e escrita vinda do navegador;
  - só a API, com a conta de serviço da função, lê e grava.
- **O que vai para `Correction.imageUrl`:**
  - a **chave do objeto**, não uma URL, por exemplo `answer-sheets/<applicationId>/<answerSheetId>/<id>.jpg`. Uma URL assinada expira em 15 minutos, então gravá-la deixaria um link morto no banco;
  - o nome do campo é do contrato e não muda.
- **Leitura:** a cada pedido de quem tem direito à imagem, a API gera uma URL assinada V4 válida por 15 minutos.
- **Envio:**
  - passa pela API, que confere o tipo real pelos primeiros bytes do arquivo, recusa acima de 10 MB e grava no bucket;
  - o front nunca recebe credencial de escrita.
- **Imagens de enunciado (RF45):** usam o mesmo bucket, em outro prefixo (`question-images/<teacherId>/`), com os mesmos limites técnicos. São conteúdo autoral do professor, não dado de aluno, e entram no PDF gerado.

## Consequências

- **Cota gratuita:** o Cloud Storage dá 5 GB-mês grátis em us-west1, mais 100 GB por mês de tráfego de saída da América do Norte ([cotas gratuitas do Google Cloud](https://docs.cloud.google.com/free/docs/free-cloud-features)). São de 700 a 1.700 fotos dentro da cota; acima dela, alguns centavos por GB.
- **Transferência internacional.** As fotos ficam nos EUA, como o banco (LGPD, Art. 33). O Google já é subprocessador pelo Firebase. O aviso de privacidade (RF39) e o acordo com a instituição precisam citar onde ficam as imagens (`docs/Seguranca_e_LGPD.md`, seção 6).
- **Fica para a N3** (`docs/Seguranca_e_LGPD.md`, seção 8):
  - re-processar toda imagem no recebimento, o que remove o EXIF e neutraliza conteúdo embutido no arquivo;
  - a fila para a leitura da folha.

  Processamento de imagem é uso pesado de CPU e não pode rodar na thread que atende as requisições. Enquanto a N3 não chega, o EXIF fica guardado, e esta é uma lacuna conhecida do RNF16.
- **Apagar é soft, como no resto do sistema (RF42).** O objeto continua no bucket enquanto a correção existir. A anonimização do aluno (RF38) precisa decidir se a imagem é apagada ou mantida sem vínculo, junto da #50.
- **Onde a leitura da folha roda**, no navegador ou no servidor, é o ADR seguinte, da #78.
