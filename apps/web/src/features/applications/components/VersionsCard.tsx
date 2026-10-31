import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, SaveError } from '@/components/ui';
import type { ApplicationOverview, ExamVersion } from '@/types/domain';
import { shuffleOf } from '../application-labels';
import { usePublishAllAnswerKeys, usePublishAnswerKey } from '../hooks/useApplications';

/** What the student sees once a key is published, said before publishing (RF46). */
const WHAT_THE_STUDENT_SEES =
  'passa a ver as respostas certas ao ler o QR Code da própria folha. A nota continua escondida até você liberar as notas.';

const RELEASED_REASON = 'Recolha as notas para despublicar: a nota nunca aparece sem o gabarito.';

/** Which confirmation is open: one version, or all of them at once. */
type Publication = { kind: 'one'; version: ExamVersion } | { kind: 'all' };

/**
 * The printed versions and their answer keys. Publishing shows students
 * something, so it asks first, one version or all of them; taking a key back
 * only hides it again, so it does not. An archived application publishes
 * nothing until it is restored, and a key cannot be taken back while the
 * grades are out, which the buttons say instead of failing.
 */
export function VersionsCard({ application, versions }: Readonly<{ application: ApplicationOverview; versions: readonly ExamVersion[] }>) {
  const takeBack = usePublishAnswerKey();
  const [publication, setPublication] = useState<Publication | null>(null);
  const canPublishAll = application.status !== 'closed' && versions.some((version) => !version.answerKeyPublished);

  return (
    <Card data-tour="versions">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Versões</h2>
        {canPublishAll && (
          <Button variant="secondary" onClick={() => setPublication({ kind: 'all' })}>
            Publicar todos
          </Button>
        )}
      </div>
      {versions.length === 0 ? (
        <p className="px-5 py-6 text-body text-ink-muted">Nada foi gerado ainda. As versões aparecem aqui depois de gerar.</p>
      ) : (
        <ul className="divide-y divide-line">
          {versions.map((version) => (
            <li key={version.id}>
              <VersionRow
                version={version}
                blocked={blockedOf(version, application)}
                pending={takeBack.isPending}
                onPublish={() => setPublication({ kind: 'one', version })}
                onTakeBack={() => takeBack.mutate({ applicationId: application.id, versionId: version.id, published: false })}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 pb-4 empty:hidden">
        <SaveError error={takeBack.error} />
      </div>

      {publication !== null && (
        <PublicationDialog applicationId={application.id} publication={publication} onClose={() => setPublication(null)} />
      )}
    </Card>
  );
}

/**
 * What stops the button of a version, if anything. An archived application
 * publishes nothing, which the notice above the cards explains once rather
 * than on every row.
 */
function blockedOf(version: ExamVersion, application: ApplicationOverview): { reason?: string } | undefined {
  if (version.answerKeyPublished) return application.gradesReleased ? { reason: RELEASED_REASON } : undefined;
  return application.status === 'closed' ? {} : undefined;
}

/** The confirmation of a publication, saying who starts to see the answers. */
function PublicationDialog({
  applicationId,
  publication,
  onClose,
}: Readonly<{ applicationId: string; publication: Publication; onClose: () => void }>) {
  const publishOne = usePublishAnswerKey();
  const publishAll = usePublishAllAnswerKeys();
  const all = publication.kind === 'all';
  const number = publication.kind === 'one' ? publication.version.versionNumber : 0;

  const confirm = () => {
    if (publication.kind === 'all') publishAll.mutate(applicationId, { onSuccess: onClose });
    else publishOne.mutate({ applicationId, versionId: publication.version.id, published: true }, { onSuccess: onClose });
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={all ? 'Publicar o gabarito de todas as versões?' : `Publicar o gabarito da versão ${number}?`}
      description={all ? `Quem fez a prova, em qualquer versão, ${WHAT_THE_STUDENT_SEES}` : `Quem recebeu a versão ${number} ${WHAT_THE_STUDENT_SEES}`}
      confirmLabel={all ? 'Publicar todos' : 'Publicar gabarito'}
      pending={publishOne.isPending || publishAll.isPending}
      error={publishOne.error ?? publishAll.error}
      onConfirm={confirm}
    />
  );
}

function VersionRow({
  version,
  blocked,
  pending,
  onPublish,
  onTakeBack,
}: Readonly<{
  version: ExamVersion;
  blocked: { reason?: string } | undefined;
  pending: boolean;
  onPublish: () => void;
  onTakeBack: () => void;
}>) {
  const label = version.answerKeyPublished ? 'Despublicar gabarito' : 'Publicar gabarito';

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label text-ink">Versão {version.versionNumber}</span>
          {version.answerKeyPublished && <Badge tone="success">Gabarito publicado</Badge>}
          {!version.withStudentIdentification && <Badge>Sem identificação</Badge>}
        </div>
        <p className="mt-1 text-caption text-ink-subtle">
          {version.layout.questionOrder.length} questões · {shuffleOf(version)}
        </p>
        {blocked?.reason !== undefined && <p className="mt-1 text-caption text-ink-subtle">{blocked.reason}</p>}
      </div>
      <Button
        variant="ghost"
        className="shrink-0"
        aria-label={`${label} da versão ${version.versionNumber}`}
        disabled={pending || blocked !== undefined}
        onClick={version.answerKeyPublished ? onTakeBack : onPublish}
      >
        {label}
      </Button>
    </div>
  );
}
