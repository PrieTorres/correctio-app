import { Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SaveError } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { canRegenerate } from '@/lib/applications';
import type { ApplicationOverview } from '@/types/domain';
import { fromDetailOf } from '../generation-origin';
import { useDownloadApplicationPdf } from '../hooks/useApplications';

/**
 * The paper of an application: the PDF to download once it exists, the way to
 * generate it while it does not, and why it cannot be generated again when
 * that is the case, so the teacher learns it here rather than on P13. An
 * archived application says why once, in the notice above the cards.
 *
 * Without a server there is no PDF at all: the demo prints versions and sheets
 * in the browser, and says so instead of offering a download that cannot work.
 */
export function PdfCard({ application }: Readonly<{ application: ApplicationOverview }>) {
  const navigate = useNavigate();
  const download = useDownloadApplicationPdf();
  const printed = application.progress.versions > 0;
  const verdict = canRegenerate(application, application.progress.corrections);

  const generate = () =>
    void navigate(buildPath(ROUTES.applicationPdf, { id: application.id }), { state: fromDetailOf(application.id) });

  return (
    <Card data-tour="pdf" className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileText size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
          <div>
            <h2 className="text-title text-primary">PDF para impressão</h2>
            <p className="mt-1 text-body text-ink-muted">{paperSummary(application)}</p>
          </div>
        </div>
        {application.pdfUrl !== undefined && (
          <Button
            variant="primary"
            icon={<Download size={18} aria-hidden />}
            disabled={download.isPending}
            onClick={() => download.mutate(application.id)}
          >
            {download.isPending ? 'Baixando…' : 'Baixar PDF'}
          </Button>
        )}
        {!printed && verdict.allowed && (
          <Button variant="primary" icon={<FileText size={18} aria-hidden />} onClick={generate}>
            Gerar PDF
          </Button>
        )}
      </div>
      {printed && !verdict.allowed && application.status !== 'closed' && (
        <p className="text-caption text-ink-subtle">Gerar de novo está bloqueado: {verdict.reason}</p>
      )}
      <SaveError error={download.error} />
    </Card>
  );
}

function paperSummary({ pdfUrl, progress }: ApplicationOverview): string {
  if (progress.versions === 0) return 'Gere a aplicação para produzir o PDF, com uma folha por aluno.';
  if (pdfUrl === undefined) {
    return `${progress.sheets} folhas geradas. Nesta demonstração não há servidor, então o PDF não é montado.`;
  }
  return `${progress.sheets} folhas prontas para imprimir, em um arquivo só.`;
}
