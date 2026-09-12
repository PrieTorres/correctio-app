export interface TourStep {
  /** One sentence, starting with a verb. The document caps it at 90 characters. */
  text: string
  /**
   * What the step is about, matched against `data-tour` on the element.
   *
   * A step with a target points at the thing it describes; one without speaks
   * about the screen as a whole. Naming the element rather than writing a CSS
   * selector keeps the tour off markup that is free to change.
   */
  target?: string
}

/**
 * The tour text, copied from `docs/Tour_Guiado.md`, with each step tied to the
 * element it talks about.
 *
 * It lives here rather than inside the screens so the wording is reviewed in
 * one place, and so the two limits the document sets — at most four steps per
 * screen, at most ninety characters per step — can be a test rather than a
 * promise.
 */
export const TOUR_STEPS = {
  dashboard: [
    { text: 'Clique em um destes cartões para abrir a lista que ele resume.', target: 'summary' },
    { text: 'Aqui embaixo ficam as últimas aplicações, para retomar de onde parou.', target: 'recent' },
    { text: 'Use os atalhos para as quatro ações mais comuns, sem passar pelo menu.', target: 'quick-actions' },
    { text: 'O menu segue a ordem do trabalho: turma, questão, prova, aplicação.', target: 'nav' },
  ],
  signUp: [{ text: 'Sua conta é só sua: cada professor vê apenas as próprias turmas e provas.' }],
  classes: [
    { text: 'Clique em "Nova turma" para cadastrar a primeira turma do semestre.', target: 'create' },
    { text: 'Abra uma turma pelo nome dela para ver e cadastrar os alunos.', target: 'list' },
    { text: 'Arquivar tira a turma da lista sem apagar nada, e dá para desfazer.', target: 'filters' },
  ],
  classDetail: [
    { text: 'Use "Importar alunos" para colar a lista inteira de uma planilha.', target: 'import' },
    { text: 'Cadastre um aluno por vez quando for só uma inclusão.', target: 'create' },
    { text: 'Anonimizar apaga os dados do aluno e mantém a nota nos relatórios.', target: 'list' },
  ],
  questions: [
    { text: 'Clique em "Nova questão" para escrever uma que servirá a várias provas.', target: 'create' },
    { text: 'Filtre por tag para achar tudo de um conteúdo de uma vez.', target: 'tags' },
    { text: 'Troque para "A–Z" quando estiver lendo o banco em vez de procurar.', target: 'filters' },
  ],
  questionForm: [
    { text: 'Marque qual alternativa é a correta: é por ela que o sistema corrige.', target: 'correct' },
    { text: 'Desligue o embaralhar em questões como "todas as anteriores".', target: 'shuffle' },
  ],
  exams: [
    { text: 'Clique em "Nova prova" para montar uma escolhendo questões do banco.', target: 'create' },
    { text: 'Use "Gerar automaticamente" para o sistema montar a partir das tags.', target: 'generate' },
    { text: 'Duplicar cria uma cópia editável, sem mexer na prova original.', target: 'list' },
  ],
  examForm: [
    { text: 'Clique em "Adicionar do banco" para escolher as questões da prova.', target: 'add' },
    { text: 'Arraste pela alça, ou use as setas, para mudar a ordem das questões.', target: 'list' },
    { text: 'A soma não é validada: conferir se fecha em 10,0 é com você.', target: 'total' },
  ],
  generateExam: [
    { text: 'Escolha as tags e a quantidade: o sistema sorteia do seu banco.', target: 'filters' },
    { text: 'Não gostou de uma questão? "Trocar" sorteia outra com os mesmos filtros.', target: 'preview' },
  ],
  applications: [
    { text: 'Clique em "Nova aplicação" para levar uma prova a uma turma numa data.', target: 'create' },
    { text: 'Acompanhe aqui quais já foram geradas e quais ainda faltam.', target: 'list' },
  ],
  applicationPdf: [
    { text: 'Escolha quantas versões: mais versões, menos chance de cola.', target: 'versions' },
    { text: 'Ligue a identificação para já imprimir o nome do aluno em cada folha.', target: 'identification' },
    { text: 'Clique em "Gerar" para produzir as versões e as folhas com código.', target: 'generate' },
  ],
  applicationDetail: [
    { text: 'Baixe o PDF aqui. Regenerar troca as folhas e invalida os QR impressos.', target: 'pdf' },
    { text: 'Publique o gabarito quando quiser que os alunos vejam as respostas.', target: 'versions' },
    { text: 'Clique em "Corrigir folhas" para enviar as fotos das provas feitas.', target: 'grading' },
    { text: 'Liberar as notas faz cada aluno ver a dele ao escanear o próprio QR.', target: 'release' },
  ],
  grading: [
    { text: 'No celular fotografe as folhas; no computador, arraste os arquivos.', target: 'upload' },
    { text: 'Marque quais folhas ler e clique no botão para o sistema corrigir.', target: 'list' },
    { text: 'Nada vira nota sem você confirmar. Revise cada folha antes.', target: 'confirm' },
  ],
  gradingSheet: [
    { text: 'À esquerda a folha lida; compare com o que o sistema entendeu.', target: 'image' },
    { text: 'Clique na letra para trocar a alternativa lida. A nota recalcula na hora.', target: 'questions' },
    { text: 'Lance a nota de cada discursiva: o sistema não corrige essas sozinho.', target: 'score' },
  ],
  unassignedCorrections: [
    { text: 'Provas sem identificação caem aqui até você dizer de quem é cada folha.' },
  ],
  applicationReport: [
    { text: 'A distribuição mostra se a prova ficou fácil, difícil ou bem calibrada.', target: 'distribution' },
    { text: '"Por questão" revela onde a turma errou e qual alternativa atraiu mais.', target: 'by-question' },
    { text: '"Por conteúdo" mostra o que vale retomar em aula, da pior para a melhor.', target: 'by-tag' },
  ],
} as const satisfies Record<string, readonly TourStep[]>

export type TourScreen = keyof typeof TOUR_STEPS

/**
 * The steps of one screen, widened back to `TourStep`.
 *
 * `as const` keeps the screen names a union, which is what makes a typo in a
 * screen name a compile error — but it also narrows each step to its own
 * literal, so a step written without a target has no `target` property at all.
 * Reading through here gives back the shape the component works with.
 */
export function stepsOf(screen: TourScreen): readonly TourStep[] {
  return TOUR_STEPS[screen]
}

/** The document's own limits, kept here so the test reads them from one place. */
export const TOUR_LIMITS = { maxSteps: 4, maxCharacters: 90 } as const
