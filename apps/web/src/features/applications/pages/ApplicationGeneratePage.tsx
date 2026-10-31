import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { BackLink, Button, Card, CheckboxField, NumberInput, PageHeader, QueryBoundary, SaveError, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { canRegenerate } from '@/lib/applications';
import { MAX_VERSIONS, type VersionShuffle } from '@/lib/schemas';
import { useExam } from '@/features/exams';
import type { ApplicationOverview } from '@/types/domain';
import { examTitleOf, sittingOf } from '../application-labels';
import { returnPathFrom } from '../generation-origin';
import { useApplication, useGenerateApplication } from '../hooks/useApplications';
import { versionShufflesOf, withChange, withinCount, type ShuffleChanges } from '../version-shuffles';

/** Two versions by default: neighbours get different papers, which is the reason for versions at all. */
const DEFAULT_VERSION_COUNT = 2;

export function ApplicationGeneratePage() {
  const { id } = useParams<{ id: string }>();
  const { data: application, isPending, isError } = useApplication(id);

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicação…">
      {application === null || application === undefined ? (
        <Card className="p-6">
          <p className="text-body text-ink-muted">Aplicação não encontrada.</p>
        </Card>
      ) : (
        <GenerationWithExam application={application} />
      )}
    </QueryBoundary>
  );
}

/**
 * The versions start from the shuffling the exam prefers (RF17), so the form
 * waits for the exam. Offered earlier, a quick click sent shuffling the exam
 * had turned off. An exam that is not found leaves both preferences on, as a
 * new exam has them.
 */
function GenerationWithExam({ application }: Readonly<{ application: ApplicationOverview }>) {
  const { data: exam, isPending, isError } = useExam(application.examId);
  const preferences: VersionShuffle = {
    shuffleQuestions: exam?.defaultShuffleQuestions ?? true,
    shuffleAlternatives: exam?.defaultShuffleAlternatives ?? true,
  };

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando prova…">
      <GenerationForm application={application} preferences={preferences} />
    </QueryBoundary>
  );
}

/**
 * Generating an application (P13): how many versions, how each one shuffles
 * (RF22), pre-filled with the preferences of the exam (RF17), and whether the
 * sheets carry the name of the student, which holds for the whole application.
 *
 * The screen says which application it is generating, and goes back where it
 * came from: the detail of the application when the teacher started there.
 * When the server refuses, its reason shows here, since it may have seen a
 * correction this screen had not.
 */
function GenerationForm({
  application,
  preferences,
}: Readonly<{ application: ApplicationOverview; preferences: VersionShuffle }>) {
  const navigate = useNavigate();
  const location = useLocation();
  const origin: unknown = location.state;
  const backTo = returnPathFrom(origin);
  const generate = useGenerateApplication();

  const [versionCount, setVersionCount] = useState(DEFAULT_VERSION_COUNT);
  const [changes, setChanges] = useState<ShuffleChanges>({});
  const [withStudentIdentification, setWithStudentIdentification] = useState(true);

  const versions = versionShufflesOf(versionCount, preferences, changes);
  const verdict = canRegenerate(application, application.progress.corrections);

  const changeCount = (next: number) => {
    const count = Math.min(Math.max(next, 1), MAX_VERSIONS);
    setVersionCount(count);
    setChanges((current) => withinCount(current, count));
  };

  const run = () =>
    generate.mutate(
      { id: application.id, request: { versions, withStudentIdentification } },
      { onSuccess: () => void navigate(buildPath(ROUTES.applicationDetail, { id: application.id })) },
    );

  return (
    <div className="flex flex-col gap-6">
      <BackLink to={backTo}>Voltar</BackLink>

      <PageHeader
        help
        title={`Gerar PDF — ${examTitleOf(application)}`}
        description={`${sittingOf(application)}. Cada versão embaralha de um jeito, e cada aluno recebe uma folha com código próprio, que é o que a consulta de nota vai ler.`}
      />

      <GenerationNotice application={application} verdict={verdict} />

      <Card className="flex flex-col gap-5 p-6">
        <div data-tour="versions" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-title text-primary">Quantas versões</h2>
              <p className="mt-1 text-caption text-ink-subtle">Versões diferentes deixam quem senta ao lado com provas diferentes.</p>
            </div>
            <NumberInput
              value={versionCount}
              onValueChange={changeCount}
              min={1}
              max={MAX_VERSIONS}
              label="Quantas versões"
              className="w-24"
            />
          </div>
          <VersionShuffles
            versions={versions}
            onChange={(index, change) => setChanges((current) => withChange(current, index, change))}
          />
        </div>

        <fieldset className="flex flex-col gap-3 border-t border-line pt-5">
          <legend data-tour="identification" className="text-label text-ink-muted">
            Identificação, para a prova inteira
          </legend>
          <CheckboxField
            label="Imprimir o nome do aluno em cada folha"
            checked={withStudentIdentification}
            onChange={(event) => setWithStudentIdentification(event.target.checked)}
          />
          <p className="text-caption text-ink-subtle">
            Sem identificação, a folha sai só com o código e o aluno é atribuído na correção.
          </p>
        </fieldset>

        <p className="border-t border-line pt-5 text-caption text-ink-subtle">
          Cada questão sai inteira numa página, sem quebrar no meio (RF43). A prova de cada aluno que terminar num
          número ímpar de páginas ganha uma página em branco no fim, para imprimir frente e verso sem misturar alunos
          (RF44).
        </p>
      </Card>

      <SaveError error={generate.error} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={() => void navigate(backTo)}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          data-tour="generate"
          icon={generate.isPending ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <FileText size={18} aria-hidden />}
          disabled={!verdict.allowed || generate.isPending}
          onClick={run}
        >
          {generateLabel(generate.isPending, application.progress.versions > 0)}
        </Button>
      </div>

      {generate.isPending && (
        <p role="status" className="text-center text-caption text-ink-subtle">
          A geração roda em segundo plano. Você pode sair desta tela e voltar depois.
        </p>
      )}

      <Tour screen="applicationPdf" ready={verdict.allowed} />
    </div>
  );
}

function generateLabel(pending: boolean, alreadyPrinted: boolean): string {
  if (pending) return 'Gerando…';
  return alreadyPrinted ? 'Gerar de novo' : 'Gerar PDF';
}

/**
 * What stands before generating: the reason it is blocked, or, for an
 * application already printed, what printing again throws away. Both name the
 * application, so a teacher with two sittings of one exam knows which one.
 */
function GenerationNotice({
  application,
  verdict,
}: Readonly<{ application: ApplicationOverview; verdict: { allowed: boolean; reason?: string } }>) {
  if (!verdict.allowed) {
    return (
      <Card className="flex items-start gap-3 border-l-4 border-l-danger p-5">
        <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <div>
          <h2 className="text-label text-danger">Não é possível gerar agora</h2>
          <p role="alert" className="mt-1 text-body text-ink-muted">
            {verdict.reason}
          </p>
        </div>
      </Card>
    );
  }
  if (application.progress.versions === 0) return null;

  return (
    <Card className="flex items-start gap-3 border-l-4 border-l-accent p-5">
      <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
      <div>
        <h2 className="text-label text-ink">
          {examTitleOf(application)}, de {sittingOf(application)}, já foi gerada
        </h2>
        <p role="status" className="mt-1 text-body text-ink-muted">
          Gerar de novo substitui as {application.progress.versions} versões e todas as folhas. As folhas já impressas
          deixam de valer, porque os códigos mudam.
        </p>
      </div>
    </Card>
  );
}

/** One pair of switches per version (RF22), each starting from the preferences of the exam. */
function VersionShuffles({
  versions,
  onChange,
}: Readonly<{ versions: VersionShuffle[]; onChange: (index: number, change: Partial<VersionShuffle>) => void }>) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line">
      {versions.map((version, index) => (
        <li key={`version-${index + 1}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-label text-ink">Versão {index + 1}</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
            <CheckboxField
              label="Embaralhar questões"
              aria-label={`Embaralhar questões da versão ${index + 1}`}
              checked={version.shuffleQuestions}
              onChange={(event) => onChange(index, { shuffleQuestions: event.target.checked })}
            />
            <CheckboxField
              label="Embaralhar alternativas"
              aria-label={`Embaralhar alternativas da versão ${index + 1}`}
              checked={version.shuffleAlternatives}
              onChange={(event) => onChange(index, { shuffleAlternatives: event.target.checked })}
            />
          </div>
        </li>
      ))}
      <li className="px-4 py-3 text-caption text-ink-subtle">
        Herdado das preferências da prova. Uma questão marcada como de ordem fixa no banco não tem as alternativas
        embaralhadas, mesmo aqui.
      </li>
    </ul>
  );
}
