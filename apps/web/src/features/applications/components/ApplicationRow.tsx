import { Link, useNavigate } from 'react-router-dom';
import { Archive, RotateCcw } from 'lucide-react';
import { ActionMenu, Badge, Button, Card, type MenuAction } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { canRegenerate } from '@/lib/applications';
import type { ApplicationOverview } from '@/types/domain';
import {
  answerKeyBadgeOf,
  APPLICATION_STATUS_LABEL,
  correctionBlockerOf,
  examTitleOf,
  sittingOf,
} from '../application-labels';

/**
 * One application of P11: which exam, class and day, whether the paper and the
 * answer keys exist, how far the correction has gone, and what to do next. The
 * names and the counts come with the application from the API, one query for
 * the whole page, so an exam or a class archived later still shows its name.
 *
 * The card leads to P14; the menu and the archive button sit above that link.
 * Both repeat on every card, so each names the application after its visible
 * word, the way the screen reader tells one "Arquivar" from the next (#145).
 */
export function ApplicationRow({
  application,
  onArchive,
}: Readonly<{ application: ApplicationOverview; onArchive: () => void }>) {
  const archived = application.status === 'closed';
  const archiveLabel = archived ? 'Restaurar' : 'Arquivar';
  const status = APPLICATION_STATUS_LABEL[application.status];
  const answerKey = answerKeyBadgeOf(application.progress);
  const { correctedSheets, sheets } = application.progress;

  return (
    <Card interactive className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {answerKey !== null && <Badge tone={answerKey.tone}>{answerKey.label}</Badge>}
          {application.gradesReleased && <Badge tone="info">Notas liberadas</Badge>}
        </div>

        <Link
          to={buildPath(ROUTES.applicationDetail, { id: application.id })}
          className="card-link text-title text-primary group-hover:underline"
        >
          {examTitleOf(application)}
        </Link>

        <p className="mt-1 text-caption text-ink-subtle">{sittingOf(application)}</p>
        {sheets > 0 && (
          <p className="mt-1 text-caption text-ink-muted">
            {correctedSheets} de {sheets} folhas corrigidas
          </p>
        )}
      </div>

      <div className="above-card-link flex shrink-0 flex-wrap gap-1">
        <RowMenu application={application} />
        <Button
          variant="ghost"
          icon={archived ? <RotateCcw size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
          aria-label={`${archiveLabel} a aplicação ${examTitleOf(application)}, ${sittingOf(application)}`}
          onClick={onArchive}
        >
          {archiveLabel}
        </Button>
      </div>
    </Card>
  );
}

/**
 * The next steps of an application, as the specification lists them for P11.
 * A step that cannot start stays in the menu, disabled, with the reason under
 * it, by the same rules P14 applies, so the teacher learns why on the list.
 */
function RowMenu({ application }: Readonly<{ application: ApplicationOverview }>) {
  const navigate = useNavigate();
  const regeneration = canRegenerate(application, application.progress.corrections);
  const goTo = (route: string) => () => void navigate(buildPath(route, { id: application.id }));

  const actions: MenuAction[] = [
    { label: 'Ver detalhes', onSelect: goTo(ROUTES.applicationDetail) },
    {
      label: application.progress.versions > 0 ? 'Regenerar PDF' : 'Gerar PDF',
      onSelect: goTo(ROUTES.applicationPdf),
      disabledReason: regeneration.allowed ? undefined : regeneration.reason,
    },
    { label: 'Corrigir folhas', onSelect: goTo(ROUTES.grading), disabledReason: correctionBlockerOf(application) },
  ];

  return (
    <ActionMenu
      label="Ações"
      accessibleName={`Ações de ${examTitleOf(application)}, ${sittingOf(application)}`}
      actions={actions}
    />
  );
}
