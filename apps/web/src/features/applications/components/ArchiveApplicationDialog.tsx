import { ConfirmDialog } from '@/components/ui';
import type { Application } from '@/types/domain';
import { useArchiveApplication } from '../hooks/useApplications';

/** Archives an application, or restores it when the list on screen is the archived one. */
export function ArchiveApplicationDialog({
  application,
  restoring,
  onClose,
}: Readonly<{ application: Application; restoring: boolean; onClose: () => void }>) {
  const archiveApplication = useArchiveApplication();

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={restoring ? 'Restaurar esta aplicação?' : 'Arquivar esta aplicação?'}
      description={
        restoring
          ? 'A aplicação volta para a lista e pode ser gerada de novo.'
          : 'A aplicação sai da lista. As folhas já impressas e as correções continuam como estão, e você pode restaurá-la depois.'
      }
      confirmLabel={restoring ? 'Restaurar' : 'Arquivar'}
      pending={archiveApplication.isPending}
      onConfirm={() =>
        archiveApplication.mutate(
          { id: application.id, archive: !restoring },
          { onSettled: onClose },
        )
      }
    />
  );
}
