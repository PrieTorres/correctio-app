import { useState } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import type { ApplicationOverview } from '@/types/domain';
import { describeGradeLinks } from '../grade-link-summary';
import { useSendGradeLinks } from '../hooks/useApplications';

/**
 * The opt-in step after the release: the teacher chooses to e-mail each
 * student the link to their own grade page. Never automatic, and it asks first,
 * saying that the message carries the link and not the grade. The counts stay
 * on screen after the dialog closes, since they are the only proof of what
 * went out.
 */
export function GradeLinksSection({ application }: Readonly<{ application: ApplicationOverview }>) {
  const send = useSendGradeLinks();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    send.reset();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="text-body text-ink-muted">
        Quer avisar a turma? Cada aluno com e-mail cadastrado recebe uma mensagem só dele, com o link da própria nota.
      </p>
      <Button variant="secondary" className="self-start" disabled={send.isPending || application.status === 'closed'} onClick={() => setConfirming(true)}>
        Enviar link por e-mail
      </Button>
      <p role="status" className="text-caption text-ink-muted">
        {send.data === undefined ? null : describeGradeLinks(send.data)}
      </p>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && close()}
        title="Enviar o link por e-mail?"
        description="Cada aluno com e-mail cadastrado recebe uma mensagem só dele, com o link da própria consulta. A mensagem não traz a nota. Quem está sem e-mail ou sem folha é pulado, e você vê quantos foram."
        confirmLabel="Enviar e-mails"
        pending={send.isPending}
        error={send.error}
        onConfirm={() => send.mutate(application.id, { onSuccess: () => setConfirming(false) })}
      />
    </div>
  );
}
