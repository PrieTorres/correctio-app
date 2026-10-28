import { useState, type FormEvent } from 'react';
import { Button, Modal, SaveError } from '@/components/ui';
import type { ApplicationOverview } from '@/types/domain';
import { useSaveApplication } from '../hooks/useApplications';
import { ApplicationDateField } from './ApplicationDateField';

/**
 * Moves the day of an application (#163). Once printed, the day is the only
 * part of an application that changes: the sheets were made for that exam and
 * the students of that class, so the exam and the class stay as they are. The
 * PDF keeps the day it was printed with until it is generated again, which
 * the dialog says before the teacher saves.
 */
export function EditDateDialog({ application, onClose }: Readonly<{ application: ApplicationOverview; onClose: () => void }>) {
  const save = useSaveApplication();
  const [date, setDate] = useState(application.date);
  const printed = application.progress.versions > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { id: application.id, input: { examId: application.examId, classId: application.classId, date } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Editar a data" size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <ApplicationDateField
          id="application-new-date"
          value={date}
          onChange={setDate}
          error={date === '' ? 'Informe a data da aplicação' : undefined}
        />
        {printed && (
          <p className="text-caption text-ink-subtle">
            O PDF já gerado continua com a data antiga até você gerar de novo. A prova e a turma não mudam.
          </p>
        )}
        <SaveError error={save.error} />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={save.isPending || date === ''}>
            {save.isPending ? 'Salvando…' : 'Salvar data'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
