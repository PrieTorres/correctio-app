import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Button, Card, NumberInput, PageHeader, QueryBoundary } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { canRegenerate } from '@/lib/applications';
import { useExam } from '@/features/exams';
import {
  useApplication,
  useApplicationPrinting,
  useCorrectionsOfApplication,
  useGenerateApplication,
} from '../hooks/useApplications';

const MAX_VERSIONS = 6;

export function ApplicationGeneratePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: application, isPending, isError } = useApplication(id);
  const { data: exam } = useExam(application?.examId);
  const { data: printing } = useApplicationPrinting(id);
  const { data: corrections = [] } = useCorrectionsOfApplication(id);
  const generate = useGenerateApplication();

  const [versionCount, setVersionCount] = useState(2);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean | null>(null);
  const [shuffleAlternatives, setShuffleAlternatives] = useState<boolean | null>(null);
  const [withStudentIdentification, setWithStudentIdentification] = useState(true);

  /**
   * The shuffle defaults are the exam's until the teacher says otherwise, so
   * `null` means "not decided here" rather than "off". Copying the exam's value
   * into state on load would freeze whatever it was at that moment.
   */
  const questionsShuffled = shuffleQuestions ?? exam?.defaultShuffleQuestions ?? true;
  const alternativesShuffled = shuffleAlternatives ?? exam?.defaultShuffleAlternatives ?? true;

  const alreadyPrinted = (printing?.versions.length ?? 0) > 0;
  const verdict =
    application === null || application === undefined
      ? { allowed: false as const, reason: 'Aplicação não encontrada.' }
      : canRegenerate(application, corrections);

  const run = () => {
    if (id === undefined) return;

    generate.mutate(
      {
        id,
        options: {
          versionCount,
          shuffleQuestions: questionsShuffled,
          shuffleAlternatives: alternativesShuffled,
          withStudentIdentification,
        },
      },
      { onSuccess: () => void navigate(buildPath(ROUTES.applicationDetail, { id })) },
    );
  };

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicação…">
      <div className="flex flex-col gap-6">
        <Link
          to={ROUTES.applications}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Aplicações
        </Link>

        <PageHeader help
          title="Gerar prova"
          description="Cada versão embaralha de um jeito. Cada aluno recebe uma folha com código próprio, que é o que a consulta de nota vai ler."
        />

        {!verdict.allowed && (
          <Card className="flex items-start gap-3 border-l-4 border-l-danger p-5">
            <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0 text-danger" />
            <div>
              <h2 className="text-label text-danger">Não é possível gerar agora</h2>
              <p role="alert" className="mt-1 text-body text-ink-muted">
                {verdict.reason}
              </p>
            </div>
          </Card>
        )}

        {verdict.allowed && alreadyPrinted && (
          <Card className="flex items-start gap-3 border-l-4 border-l-accent p-5">
            <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
            <div>
              <h2 className="text-label text-ink">Esta aplicação já foi gerada</h2>
              <p role="status" className="mt-1 text-body text-ink-muted">
                Gerar de novo substitui as {printing?.versions.length} versões e todas as folhas.
                As folhas já impressas deixam de valer, porque os códigos mudam.
              </p>
            </div>
          </Card>
        )}

        <Card className="flex flex-col gap-5 p-6">
          <div data-tour="versions" className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-title text-primary">Quantas versões</h2>
              <p className="mt-1 text-caption text-ink-subtle">
                Versões diferentes deixam quem senta ao lado com provas diferentes.
              </p>
            </div>
            <NumberInput
              value={versionCount}
              onValueChange={(next) => setVersionCount(Math.min(next, MAX_VERSIONS))}
              min={1}
              max={MAX_VERSIONS}
              label="Quantas versões"
              className="w-24"
            />
          </div>

          <fieldset className="flex flex-col gap-3 border-t border-line pt-5">
            <legend className="text-label text-ink-muted">
              Embaralhamento — herdado desta prova
            </legend>
            <Toggle
              label="Embaralhar as questões"
              checked={questionsShuffled}
              onChange={setShuffleQuestions}
            />
            <Toggle
              label="Embaralhar as alternativas"
              checked={alternativesShuffled}
              onChange={setShuffleAlternatives}
            />
            <p className="text-caption text-ink-subtle">
              Uma questão marcada como de ordem fixa no banco não é embaralhada, mesmo aqui.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-line pt-5">
            <legend data-tour="identification" className="text-label text-ink-muted">
              Identificação, para a prova inteira
            </legend>
            <Toggle
              label="Imprimir o nome do aluno em cada folha"
              checked={withStudentIdentification}
              onChange={(next) => setWithStudentIdentification(next)}
            />
            <p className="text-caption text-ink-subtle">
              Sem identificação, a folha sai só com o código e o aluno é atribuído na correção.
            </p>
          </fieldset>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => void navigate(ROUTES.applications)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={
              generate.isPending ? (
                <Loader2 size={18} aria-hidden className="animate-spin" />
              ) : (
                <FileText size={18} aria-hidden />
              )
            }
            disabled={!verdict.allowed || generate.isPending}
            onClick={run}
          >
            {generate.isPending ? 'Gerando…' : alreadyPrinted ? 'Gerar de novo' : 'Gerar'}
          </Button>
        </div>

        {generate.isPending && (
          <p role="status" className="text-center text-caption text-ink-subtle">
            A geração roda em segundo plano. Você pode sair desta tela e voltar depois.
          </p>
        )}
      </div>
    </QueryBoundary>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: Readonly<{ label: string; checked: boolean; onChange: (value: boolean) => void }>) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--color-primary)]"
      />
      <span className="text-body text-ink">{label}</span>
    </label>
  );
}
