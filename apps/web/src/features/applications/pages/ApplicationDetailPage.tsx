import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft } from 'lucide-react';
import { ActionMenu, Badge, Button, Card, PageHeader, QueryBoundary, Tour, type MenuAction } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { canRegenerate } from '@/lib/applications';
import { useStudents } from '@/features/classes';
import type { ApplicationOverview } from '@/types/domain';
import { APPLICATION_STATUS_LABEL, examTitleOf, sittingOf } from '../application-labels';
import { ArchiveApplicationDialog } from '../components/ArchiveApplicationDialog';
import { EditDateDialog } from '../components/EditDateDialog';
import { GradesCard } from '../components/GradesCard';
import { PdfCard } from '../components/PdfCard';
import { SheetsCard } from '../components/SheetsCard';
import { VersionsCard } from '../components/VersionsCard';
import { fromDetailOf } from '../generation-origin';
import { useApplication, usePrintedPaper } from '../hooks/useApplications';

/** The dialogs P14 opens from its menu and from the notice of an archived application. */
type DetailDialog = 'edit-date' | 'archive' | 'restore';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: application, isPending, isError } = useApplication(id);

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando aplicação…">
      {application === null || application === undefined ? <NotFound /> : <ApplicationDetail application={application} />}
    </QueryBoundary>
  );
}

function NotFound() {
  return (
    <Card className="p-6">
      <p className="text-body text-ink-muted">Aplicação não encontrada.</p>
      <Link to={ROUTES.applications} className="mt-3 inline-block text-label text-primary underline">
        Voltar para aplicações
      </Link>
    </Card>
  );
}

/**
 * The detail of an application (P14). The header says which exam, which class
 * and which day, and keeps the actions that change the application itself in
 * its menu; the cards below follow what the teacher does next: the paper, the
 * answer keys, the sheets, the correction and the grades.
 *
 * The versions and the sheets read as empty when they fail to load, since a
 * draft has none either, and the cards already say "nothing was generated".
 */
function ApplicationDetail({ application }: Readonly<{ application: ApplicationOverview }>) {
  const { versions, sheets } = usePrintedPaper(application.id);
  const { data: students = [] } = useStudents(application.classId);
  const [dialog, setDialog] = useState<DetailDialog | null>(null);
  const studentName = new Map(students.map((student) => [student.id, student.fullName]));

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.applications}
        className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden />
        Aplicações
      </Link>

      <div className="flex flex-col gap-3">
        <PageHeader
          help
          title={examTitleOf(application)}
          description={sittingOf(application)}
          actions={<ApplicationMenu application={application} onOpen={setDialog} />}
        />
        <StatusBadges application={application} />
      </div>

      {application.status === 'closed' && <ArchivedNotice onRestore={() => setDialog('restore')} />}

      <PdfCard application={application} />
      <VersionsCard application={application} versions={versions} />
      <SheetsCard sheets={sheets} versions={versions} studentName={studentName} />
      <CorrectionCard application={application} />
      <GradesCard application={application} />

      {dialog !== null && <DetailDialogs application={application} dialog={dialog} onClose={() => setDialog(null)} />}

      <Tour screen="applicationDetail" ready={versions.length > 0} />
    </div>
  );
}

function StatusBadges({ application }: Readonly<{ application: ApplicationOverview }>) {
  const status = APPLICATION_STATUS_LABEL[application.status];

  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={status.tone}>{status.label}</Badge>
      {application.gradesReleased && <Badge tone="info">Notas liberadas</Badge>}
    </div>
  );
}

function DetailDialogs({
  application,
  dialog,
  onClose,
}: Readonly<{ application: ApplicationOverview; dialog: DetailDialog; onClose: () => void }>) {
  if (dialog === 'edit-date') return <EditDateDialog application={application} onClose={onClose} />;
  return <ArchiveApplicationDialog application={application} restoring={dialog === 'restore'} onClose={onClose} />;
}

/**
 * What changes the application itself. "Regenerar PDF" stays in the menu when
 * it is blocked, with the reason under it, so the teacher learns why here
 * rather than after opening P13.
 */
function ApplicationMenu({
  application,
  onOpen,
}: Readonly<{ application: ApplicationOverview; onOpen: (dialog: DetailDialog) => void }>) {
  const navigate = useNavigate();
  const archived = application.status === 'closed';
  const regeneration = canRegenerate(application, application.progress.corrections);

  const actions: MenuAction[] = [
    {
      label: 'Editar data',
      onSelect: () => onOpen('edit-date'),
      disabledReason: archived ? 'Restaure a aplicação para editar a data.' : undefined,
    },
    {
      label: application.progress.versions > 0 ? 'Regenerar PDF' : 'Gerar PDF',
      onSelect: () =>
        void navigate(buildPath(ROUTES.applicationPdf, { id: application.id }), { state: fromDetailOf(application.id) }),
      disabledReason: regeneration.allowed ? undefined : regeneration.reason,
    },
    archived
      ? { label: 'Restaurar', onSelect: () => onOpen('restore') }
      : { label: 'Arquivar', onSelect: () => onOpen('archive') },
  ];

  return <ActionMenu label="Ações" actions={actions} />;
}

/** Why the buttons that show students something are off, and the way back. */
function ArchivedNotice({ onRestore }: Readonly<{ onRestore: () => void }>) {
  return (
    <Card className="flex flex-col gap-3 border-l-4 border-l-accent p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Archive size={20} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
        <p className="text-body text-ink-muted">
          Esta aplicação está arquivada. Para gerar, editar, publicar o gabarito ou liberar as notas, restaure-a.
          Despublicar o gabarito e recolher as notas continuam disponíveis.
        </p>
      </div>
      <Button variant="secondary" className="shrink-0" onClick={onRestore}>
        Restaurar
      </Button>
    </Card>
  );
}

/**
 * How far the correction has gone, counting only the sheets whose correction
 * the teacher confirmed: one still waiting for an open-ended score is not
 * corrected yet.
 */
function CorrectionCard({ application }: Readonly<{ application: ApplicationOverview }>) {
  const navigate = useNavigate();
  const { correctedSheets, sheets } = application.progress;

  return (
    <Card className="flex flex-col gap-3 p-6">
      <h2 className="text-title text-primary">Correção</h2>
      <p className="text-body text-ink-muted" aria-live="polite">
        {correctedSheets} de {sheets} folhas corrigidas
      </p>
      <Button
        variant="secondary"
        className="self-start"
        data-tour="grading"
        onClick={() => void navigate(buildPath(ROUTES.grading, { id: application.id }))}
      >
        Corrigir folhas
      </Button>
    </Card>
  );
}
