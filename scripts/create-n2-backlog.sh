#!/usr/bin/env bash
# Creates labels, the N2 milestone, the "Prazo" date field on Project 4 and every N2 issue.
# Requires gh with project scope:  gh auth refresh -s project
# Run once from the repository root:  bash scripts/create-n2-backlog.sh
set -euo pipefail

REPO=PrieTorres/correctio-app
OWNER=PrieTorres
PROJ=4

PRISCILA=PrieTorres
HELOISA=heloisaFogaca
JELIEL=Jeliell
CLEBERSON=maia202
FABRICIO=fabriciojrr

for l in "N2:0e8a16" "area:api:1d76db" "area:web:5319e7" "area:db:fbca04" "infra:6e7781" "docs:0075ca" "process:c5def5" \
         "qa:d4c5f9" "ux:f9d0c4" "po:bfdadc" "open-to-pick:7057ff" "missing-checklist:d93f0b"; do
  gh label create "${l%:*}" --color "${l##*:}" --repo "$REPO" --force >/dev/null
done

gh api "repos/$REPO/milestones" -f title="N2" -f due_on="2026-10-23T23:59:59Z" \
  -f description="Telas ligadas ao MySQL, sem dado simulado — release 2.0.0" >/dev/null 2>&1 || true

PID=$(gh project view $PROJ --owner $OWNER --format json --jq .id)
gh project field-create $PROJ --owner $OWNER --name Prazo --data-type DATE >/dev/null 2>&1 || true
FID=$(gh project field-list $PROJ --owner $OWNER --format json --jq '.fields[]|select(.name=="Prazo").id')

# issue "title" assignee due "labels" "depends on" "item|item|..."
issue() {
  local title=$1 who=$2 due=$3 labels=$4 dep=$5 items=$6 body url item extra
  if [[ "$labels" == *area:* ]]; then
    extra=$'\n- [ ] Testes automatizados do caso principal\n- [ ] Vídeo do teste anexado no PR'
  else
    extra=$'\n- [ ] Evidência (link, print ou vídeo) anexada na issue'
  fi
  body="### Checklist de aceite
$(echo "$items" | tr '|' '\n' | sed 's/^/- [ ] /')$extra

### Prazo
$due

### Depende de
${dep:-—}"
  url=$(gh issue create --repo "$REPO" --title "$title" --body "$body" --assignee "$who" --label "N2,$labels" --milestone N2)
  item=$(gh project item-add $PROJ --owner $OWNER --url "$url" --format json --jq .id)
  gh project item-edit --id "$item" --project-id "$PID" --field-id "$FID" --date "$due" >/dev/null
  echo "$due  $who  $url  $title"
}

DEV="open-to-pick"

# ---------- Development (Priscila by default; anyone may reassign and pull) ----------
issue "chore: set up delivery rules, templates and ruleset" $PRISCILA 2026-10-09 process "" \
 "Templates de issue (task, bug, ux) e de PR no main|CODEOWNERS e ruleset do main ativos|Workflows Delivery rules e Completion guard rodando|Workflows do Project configurados|Equipe avisada do fluxo"
issue "feat(api): scaffold Express + TypeScript layered API" $PRISCILA 2026-10-10 "area:api,infra,$DEV" "" \
 "rota → controle → serviço → repositório → model|Erro e paginação iguais ao contrato do front|GET /health|Lint, tipos e testes (supertest) no CI"
issue "feat(db): provision hosted MySQL and migrations for every entity" $PRISCILA 2026-10-11 "area:db,infra,$DEV" "API scaffold" \
 "MySQL hospedado acessível pela API, credenciais só em secrets|Migrations de todas as entidades do Modelo_de_Dados, sem renomear chaves da Spec|Soft delete e auditoria|.env.example documentado"
issue "feat(web): HTTP repository adapter replacing localStorage" $PRISCILA 2026-10-12 "area:web,$DEV" "API scaffold" \
 "Implementa a interface de lib/repositories sem mudar telas|Token, erros e paginação|URL da API por variável de ambiente"
issue "ci: run API tests and migrations, deploy the API" $PRISCILA 2026-10-13 "infra,$DEV" "MySQL" \
 "Testes da API em todo PR|Migrations aplicadas no deploy|API publicada com URL fixa"
issue "feat: authentication end to end (register, sign-in, refresh, sign-out)" $PRISCILA 2026-10-13 "area:api,area:web,$DEV" "Migrations, HTTP adapter" \
 "Senha com hash e rate limit no login|RefreshToken persistido e revogável|Telas de acesso usam a API|Rotas privadas redirecionam sem sessão"
issue "feat(api): classes, students and enrollments CRUD" $PRISCILA 2026-10-14 "area:api,$DEV" "Auth" \
 "Criar/listar/editar/excluir (soft delete)|Dados isolados por professor dono|Atualização é mesclagem"
issue "feat(web): class and student screens on the API, including bulk import" $PRISCILA 2026-10-15 "area:web,$DEV" "Classes API" \
 "Lista, criar/editar e detalhe da turma usam a API|Importação em lote grava no banco|Erros da API aparecem na tela"
issue "feat(api): question bank CRUD with server-side filters" $PRISCILA 2026-10-15 "area:api,$DEV" "Auth" \
 "Criar/listar/editar/excluir (soft delete)|Filtros e paginação no servidor"
issue "feat(web): question bank screens on the API" $PRISCILA 2026-10-16 "area:web,$DEV" "Questions API" \
 "Lista e criar/editar usam a API|Filtros chamam o servidor"
issue "feat: exams and versions with persisted shuffle" $PRISCILA 2026-10-17 "area:api,area:web,$DEV" "Questions API" \
 "Exam e ExamVersion com layout persistido|Geração automática no servidor|Telas de provas usam a API"
issue "feat: applications, assignments and answer sheets with QR code" $PRISCILA 2026-10-18 "area:api,area:web,$DEV" "Exams, classes" \
 "Application e ExamAssignment|AnswerSheet com sheetNumber e code aleatório de 128 bits|Telas de aplicação e PDF usam a API"
issue "feat(api): answer sheet upload and correction review" $PRISCILA 2026-10-19 "area:api,$DEV" "Applications" \
 "Upload aceita só imagem, com limite de tamanho, fora do banco|Correction por folha, lançamento manual e atribuição|Nota final só após confirmação do professor"
issue "feat(web): grading screens with real upload" $PRISCILA 2026-10-20 "area:web,$DEV" "Correction API" \
 "Enviar, revisar e pendentes usam a API|Imagens de demonstração removidas"
issue "feat: public QR lookup on the API" $PRISCILA 2026-10-20 "area:api,area:web,$DEV" "Correction API" \
 "Rota pública por code, com rate limit e sem dados de outros alunos|Página do QR lê do banco|Code inválido mostra mensagem"
issue "feat: dashboard, profile and reports on the API" $PRISCILA 2026-10-21 "area:api,area:web,$DEV" "Correction API" \
 "Indicadores e relatórios calculados no servidor|Perfil edita dados reais"
issue "chore(web): remove every simulated data source from production" $PRISCILA 2026-10-21 "area:web,$DEV" "All screens on the API" \
 "Seed, DemoDataControls e adaptador localStorage fora do build|App funciona só com banco"
issue "chore: republish with backend and cut release 2.0.0" $PRISCILA 2026-10-22 infra "Everything above" \
 "Front publicado apontando para a API|Nenhum PR aberto da N2|Tag e release 2.0.0|Zip sem node_modules"

# ---------- PO / QA / UX per member and area ----------
# member handle | member name | area | screens | UX due | QA due | Cypress due | review due
team() {
  local h=$1 n=$2 area=$3 screens=$4 ux=$5 qa=$6 cy=$7 rv=$8
  issue "ux: review $area screens" "$h" "$ux" "ux,po" "" \
   "Usar as telas ($screens) na versão publicada como professor faria|Abrir uma issue UX suggestion por melhoria, com print|Priorizar as sugestões por impacto|Registrar a sessão de uso no diário"
  issue "qa: exploratory test of $area on the real database" "$h" "$qa" "qa,po" "Integração de $area" \
   "Testar criar/listar/editar/excluir e casos de borda ($screens)|Abrir uma issue Bug por problema, com vídeo|Conferir que nada some ao editar e que não há dado simulado|Retestar os bugs corrigidos"
  issue "test(e2e): Cypress coverage for $area against the API" "$h" "$cy" "area:web,qa" "Exploratory test of $area" \
   "Specs de $screens cobrindo fluxo feliz, erro e estado vazio|Seletores por nome acessível, nunca por tag ou índice|Suíte inteira verde no CI"
  issue "review: code review of the $area pull requests" "$h" "$rv" "process" "" \
   "Revisar e aprovar ou pedir mudanças nos PRs de $area|Conferir o vídeo do teste contra o checklist da issue|Prints das revisões no diário"
}
team $HELOISA   Heloísa   "access and public lookup"      "login, cadastro, recuperar senha, consulta por QR, privacidade" 2026-10-13 2026-10-21 2026-10-21 2026-10-20
team $JELIEL    Jeliel    "classes and applications"      "turmas, alunos, importação, aplicações, PDF"                   2026-10-13 2026-10-19 2026-10-20 2026-10-18
team $CLEBERSON Cleberson "question bank and exams"       "banco de questões, provas, geração automática"                 2026-10-13 2026-10-18 2026-10-19 2026-10-17
team $FABRICIO  Fabricio  "grading, dashboard and reports" "correção, revisão, pendentes, painel, relatórios, perfil"      2026-10-13 2026-10-21 2026-10-22 2026-10-21

issue "po: validate open scope items with the client" $HELOISA 2026-10-16 po "" \
 "Excel na importação/exportação|Retorno do cartão-resposta ao aluno|Finalidade do e-mail do aluno e alunos menores de idade|Respostas registradas em docs e no README"
issue "docs: ER diagram (MER/DER) for README v2" $FABRICIO 2026-10-14 docs "Migrations" \
 "DER gerado a partir das migrations|Imagem em docs/ e no README"
issue "docs: update class, sequence and activity diagrams for N2" $JELIEL 2026-10-20 docs "" \
 "Classe reflete as entidades do banco|Sequência mostra front → API → MySQL|Atividade do fluxo de correção atualizada"
issue "docs: README v2 with integration status" $CLEBERSON 2026-10-21 docs "Diagrams, ER" \
 "Tabela do que está ligado ao banco|Como rodar API + banco localmente|Links para diagramas e DER"

for p in "$PRISCILA:Priscila" "$HELOISA:Heloísa" "$JELIEL:Jeliel" "$CLEBERSON:Cleberson" "$FABRICIO:Fabricio"; do
  issue "docs: N2 logbook — ${p#*:}" "${p%%:*}" 2026-10-22 docs "" \
   "Separar o que foi feito na N1 e na N2|Prints de commits, PRs aprovados/mergeados e reprovações|Prints de revisões, bugs e sugestões abertos|Comprovação no sistema hospedado"
done
