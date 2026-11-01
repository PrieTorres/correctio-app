import { useState } from 'react';
import { Button, Card, ConfirmDialog, SaveError } from '@/components/ui';
import { canReleaseGrades } from '@/lib/applications';
import type { ApplicationOverview } from '@/types/domain';
import { useReleaseGrades } from '../hooks/useApplications';

/**
 * Whether the students see their grades when they scan their sheets (RF33,
 * RF46). A button rather than a switch: a switch that asks for confirmation
 * already looks on before the teacher confirms. Releasing asks first and
 * says what the student starts to see; taking the grades back only hides
 * them, so it does not ask.
 *
 * The rule that blocks the release is the one the API applies, so the reason
 * under the disabled button is the one the server would answer; an archived
 * application says why in the notice above the cards instead.
 */
export function GradesCard({ application }: Readonly<{ application: ApplicationOverview }>) {
  const release = useReleaseGrades();
  const [confirming, setConfirming] = useState(false);
  const verdict = canReleaseGrades(application, application.progress);

  const close = () => {
    setConfirming(false);
    release.reset();
  };

  return (
    <Card data-tour="release" className="flex flex-col gap-3 p-6">
      <h2 className="text-title text-primary">Notas para os alunos</h2>
      <p className="text-body text-ink-muted" aria-live="polite">
        {application.gradesReleased
          ? 'As notas estão liberadas: quem ler o QR Code da própria folha vê a nota, junto do gabarito.'
          : 'As notas estão escondidas: quem ler o QR Code vê só o gabarito que você já publicou.'}
      </p>
      {application.gradesReleased ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={release.isPending}
          onClick={() => release.mutate({ id: application.id, released: false })}
        >
          Recolher notas
        </Button>
      ) : (
        <>
          <Button variant="secondary" className="self-start" disabled={!verdict.allowed} onClick={() => setConfirming(true)}>
            Liberar notas
          </Button>
          {!verdict.allowed && application.status !== 'closed' && <p className="text-caption text-ink-subtle">{verdict.reason}</p>}
        </>
      )}
      {!confirming && <SaveError error={release.error} />}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && close()}
        title="Liberar as notas?"
        description="Cada aluno passa a ver a própria nota, junto do gabarito, ao ler o QR Code da folha. Você pode recolher as notas depois."
        confirmLabel="Liberar notas"
        pending={release.isPending}
        error={release.error}
        onConfirm={() => release.mutate({ id: application.id, released: true }, { onSuccess: close })}
      />
    </Card>
  );
}
