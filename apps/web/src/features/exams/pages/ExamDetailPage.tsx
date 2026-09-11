import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Pencil, Plus } from 'lucide-react';
import { Badge, Button, Card, PageHeader, QueryBoundary } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { totalScore } from '@/lib/exams';
import { useQuestionList } from '@/features/questions';
import { isMultipleChoice, type ExamStatus } from '@/types/domain';
import { useDuplicateExam, useExam } from '../hooks/useExams';

const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: 'Rascunho',
  ready: 'Aplicada',
  closed: 'Arquivada',
};

export function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: exam, isPending, isError } = useExam(id);
  const { data: bank } = useQuestionList({ search: '', type: 'all', tags: [], deleted: false });
  const duplicate = useDuplicateExam();

  const byId = new Map((bank?.items ?? []).map((item) => [item.id, item]));

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando prova…">
      {exam === null || exam === undefined ? (
        <Card className="p-6">
          <p className="text-body text-ink-muted">Prova não encontrada.</p>
          <Link to={ROUTES.exams} className="mt-3 inline-block text-label text-primary underline">
            Voltar para provas
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Link
            to={ROUTES.exams}
            className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
          >
            <ArrowLeft size={16} aria-hidden />
            Provas
          </Link>

          <PageHeader
            title={exam.title}
            description={exam.description || undefined}
            actions={
              <>
                <Button
                  icon={<Copy size={18} aria-hidden />}
                  onClick={() =>
                    duplicate.mutate(exam.id, {
                      onSuccess: (copy) =>
                        void navigate(buildPath(ROUTES.editExam, { id: copy.id })),
                    })
                  }
                >
                  Duplicar
                </Button>
                <Button icon={<Pencil size={18} aria-hidden />}>
                  <Link to={buildPath(ROUTES.editExam, { id: exam.id })}>Editar</Link>
                </Button>
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={exam.status === 'ready' ? 'success' : 'neutral'}>
              {STATUS_LABEL[exam.status]}
            </Badge>
            <span className="text-caption text-ink-subtle">
              {exam.questions.length}/20 questões · pontuação total {totalScore(exam.questions)}
            </span>
          </div>

          <Card className="flex flex-col gap-2 p-6">
            <h2 className="text-title text-primary">Preferências padrão de aplicação</h2>
            <p className="text-body text-ink-muted">
              Embaralhar questões: {exam.defaultShuffleQuestions ? 'sim' : 'não'} · Embaralhar
              alternativas: {exam.defaultShuffleAlternatives ? 'sim' : 'não'}
            </p>
            <p className="text-caption text-ink-subtle">
              Cada aplicação herda estes valores e pode alterá-los por versão.
            </p>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-title text-primary">Questões</h2>
            </div>
            <ol className="divide-y divide-line">
              {exam.questions.map((entry, index) => {
                const question = byId.get(entry.questionId);

                return (
                  <li key={entry.questionId} className="flex items-start gap-3 px-5 py-4">
                    <span className="text-label text-ink-subtle">{index + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body text-ink">
                        {question?.statement ?? 'Questão removida do banco'}
                      </p>
                      <p className="text-caption text-ink-subtle">
                        {question === undefined
                          ? 'sem detalhes'
                          : isMultipleChoice(question)
                            ? `Objetiva · ${question.alternatives.length} alternativas`
                            : 'Discursiva'}
                        {' · '}
                        {entry.score} {entry.score === 1 ? 'ponto' : 'pontos'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="flex flex-col items-start gap-3 p-6">
            <h2 className="text-title text-primary">Aplicações desta prova</h2>
            <p className="text-body text-ink-muted">
              Aplicar leva a prova a uma turma numa data. A mesma prova rende quantas aplicações
              você quiser, inclusive segunda chamada.
            </p>
            <Button variant="primary" icon={<Plus size={18} aria-hidden />}>
              <Link to={ROUTES.newApplication}>Nova aplicação com esta prova</Link>
            </Button>
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
}
