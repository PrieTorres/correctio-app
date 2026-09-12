/**
 * The tour text, copied verbatim from `docs/Tour_Guiado.md`.
 *
 * It lives here rather than inside the screens so the wording is reviewed in
 * one place, and so the two limits the document sets — at most four steps per
 * screen, at most ninety characters per step — can be a test rather than a
 * promise.
 */
export const TOUR_STEPS = {
  dashboard: [
    'Estes cartões resumem seu semestre. Clique em qualquer um para ver a lista.',
    '"Correções pendentes" é o que precisa da sua atenção hoje.',
    'Os atalhos abrem direto as quatro ações mais comuns.',
    'O menu à esquerda segue a ordem do trabalho: turma, questão, prova, aplicação.',
  ],
  signUp: ['Sua conta é só sua: cada professor vê apenas as próprias turmas e provas.'],
  classes: [
    'Turma é onde ficam seus alunos. Arquive as antigas para limpar a lista.',
    'Turma arquivada não some: continua nos relatórios e pode voltar quando quiser.',
  ],
  classDetail: [
    'Cadastre alunos um a um, ou importe a lista inteira de uma planilha.',
    'Remover aluno não apaga as notas dele. Anonimizar apaga os dados e mantém a nota.',
    'Aqui embaixo aparecem todas as provas já aplicadas nesta turma.',
  ],
  questions: [
    'Escreva a questão uma vez. Ela serve para todas as provas, todo semestre.',
    'Use tags para separar por conteúdo: é por elas que a prova automática monta.',
    'Excluir é reversível — a questão sai da lista, mas segue nas provas que já a usam.',
  ],
  questionForm: [
    'Marque qual alternativa é a correta: é ela que o sistema usa para corrigir.',
    'Desligue o embaralhar em questões como "todas as anteriores".',
  ],
  exams: [
    'Prova é o conteúdo. Aplicar a uma turma é o passo seguinte.',
    '"Gerar automaticamente" monta a prova sozinho a partir das suas tags.',
    'Duplicar cria uma cópia editável, sem mexer na original.',
  ],
  examForm: [
    'Arraste para reordenar. A pontuação de cada questão é livre.',
    'A soma não é validada: conferir se fecha em 10,0 é com você.',
    'O embaralhamento definido aqui vira o padrão de toda aplicação desta prova.',
  ],
  generateExam: [
    'Escolha as tags e a quantidade: o sistema sorteia do seu banco.',
    'Não gostou de uma questão? "Trocar" sorteia outra com os mesmos filtros.',
  ],
  applications: [
    'Aplicação é a prova entregue a uma turma numa data. A mesma prova rende várias.',
    'Acompanhe aqui quantas folhas já foram corrigidas de cada uma.',
  ],
  applicationPdf: [
    'Cada versão embaralha de um jeito. Mais versões, menos chance de cola.',
    '"Com identificação" já imprime o nome do aluno em cada folha.',
    'Sai um arquivo único com tudo dentro, pronto para imprimir.',
  ],
  applicationDetail: [
    'Baixe o PDF aqui. Regenerar troca as folhas e invalida os QR já impressos.',
    'Publique o gabarito quando quiser que os alunos vejam as respostas certas.',
    '"Corrigir provas" é onde você envia as fotos das folhas.',
    'Liberar as notas faz cada aluno ver a dele ao escanear o QR da própria folha.',
  ],
  grading: [
    'No celular, fotografe as folhas uma a uma. No computador, arraste os arquivos.',
    'O sistema lê o QR e as marcações, e já calcula a nota prévia.',
    'Nada vira nota sem você confirmar. Revise antes.',
  ],
  gradingSheet: [
    'À esquerda a folha, à direita o que o sistema leu. Compare e ajuste.',
    'Clique no seletor para trocar a alternativa lida. A nota recalcula na hora.',
    '"Salvar e próxima" mantém o ritmo: confirma esta e já abre a seguinte.',
  ],
  unassignedCorrections: [
    'Provas sem identificação caem aqui até você dizer de quem é cada folha.',
  ],
  applicationReport: [
    'A distribuição mostra se a prova ficou fácil, difícil ou bem calibrada.',
    '"Por questão" revela onde a turma errou — e qual alternativa errada atraiu mais.',
    'Exporte para levar ao sistema acadêmico ou à coordenação.',
  ],
} as const satisfies Record<string, readonly string[]>

export type TourScreen = keyof typeof TOUR_STEPS

/** The document's own limits, kept here so the test reads them from one place. */
export const TOUR_LIMITS = { maxSteps: 4, maxCharacters: 90 } as const
