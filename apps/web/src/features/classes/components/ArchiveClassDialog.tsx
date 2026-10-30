import { ConfirmDialog } from '@/components/ui';
import type { Class } from '@/types/domain';

/** Stays open when the API refuses, with the reason, instead of closing as if the archive or restore went through. */
export function ArchiveClassDialog({
  item,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: Readonly<{
  item: Class | null;
  pending: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}>) {
  const isArchiving = item?.status === 'active';

  return (
    <ConfirmDialog
      open={item !== null}
      onOpenChange={onOpenChange}
      title={isArchiving ? 'Arquivar esta turma?' : 'Restaurar esta turma?'}
      description={
        isArchiving
          ? 'A turma sai das listas ativas, mas continua nos relatórios e nas aplicações já feitas. Você pode restaurá-la depois.'
          : 'A turma volta para a lista de ativas e pode receber novas aplicações.'
      }
      confirmLabel={isArchiving ? 'Arquivar' : 'Restaurar'}
      pending={pending}
      error={error}
      onConfirm={onConfirm}
    />
  );
}
