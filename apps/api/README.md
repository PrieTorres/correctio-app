# @correctio/api — Backend

Vazio até a **N2** (23/10/2026).

Aqui entra o Node.js + Express + MySQL em arquitetura em camadas
(`rota → controle → serviço → repositório → model`), conforme a disciplina.

O front já está preparado: `apps/web/src/lib/repositorio` define a interface que
o adaptador HTTP vai implementar, com os mesmos schemas de validação. Trocar
`localStorage` por esta API não deve alterar nenhuma tela.

Ver `docs/Arquitetura.md` (seção 2) e `docs/Seguranca_e_LGPD.md`.
