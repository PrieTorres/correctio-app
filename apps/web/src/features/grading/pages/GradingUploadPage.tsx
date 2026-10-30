import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Upload } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, QueryBoundary, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { CORRECTION_STATUS } from '@/types/domain';
import { useGradingOverview, useReadSheets } from '../hooks/useGrading';

type Overview = NonNullable<ReturnType<typeof useGradingOverview>['data']>;

type Sheet = Overview['sheets'][number];

type Correction = Overview['corrections'][number];

/**
 * The phase reads demonstration sheets instead of photographs. A phone photo in
 * base64 exceeds the storage this phase has, and pretending otherwise would
 * produce a screen that works only until someone tries it. What is real is
 * everything after the reading.
 */
export function GradingUploadPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError } = useGradingOverview(id);
  const readSheets = useReadSheets();

  const [selected, setSelected] = useState<string[]>([]);

  const sheets = data?.sheets ?? [];
  const correctionBySheet = new Map(
    (data?.corrections ?? []).map((correction) => [correction.answerSheetId, correction]),
  );
  const unread = sheets.filter((sheet) => !correctionBySheet.has(sheet.id));

  const toggle = (sheetId: string) =>
    setSelected((current) =>
      current.includes(sheetId)
        ? current.filter((item) => item !== sheetId)
        : [...current, sheetId],
    );

  const run = () => {
    if (id === undefined || selected.length === 0) return;
    readSheets.mutate({ applicationId: id, sheetIds: selected }, { onSuccess: () => setSelected([]) });
  };

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando folhas…">
      <div className="flex flex-col gap-6">
        <Link
          to={id === undefined ? ROUTES.applications : buildPath(ROUTES.applicationDetail, { id })}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Aplicação
        </Link>

        <PageHeader help
          title="Enviar folhas de respostas"
          description="Fotografe ou arraste as folhas. A leitura resolve as objetivas sozinha e deixa as discursivas para você."
        />

        <UploadArea />

        <Card>
          <SheetListHeader
            read={correctionBySheet.size}
            total={sheets.length}
            unread={unread}
            selected={selected}
            onSelect={setSelected}
          />
          {sheets.length === 0 ? (
            <p className="px-5 py-6 text-body text-ink-muted">
              Esta aplicação ainda não foi gerada, então não há folhas para ler.
            </p>
          ) : (
            <ul data-tour="list" className="divide-y divide-line">
              {sheets.map((sheet) => (
                <SheetRow
                  key={sheet.id}
                  applicationId={id ?? ''}
                  sheet={sheet}
                  correction={correctionBySheet.get(sheet.id)}
                  overview={data ?? undefined}
                  selected={selected.includes(sheet.id)}
                  onToggle={() => toggle(sheet.id)}
                />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={buildPath(ROUTES.unassignedCorrections, { id: id ?? '' })} className="text-label text-primary underline">
            Ver correções pendentes de atribuição
          </Link>
          <ReadButton count={selected.length} pending={readSheets.isPending} onRead={run} />
        </div>

        {readSheets.isPending && (
          <p role="status" className="text-center text-caption text-ink-subtle">
            A leitura roda em segundo plano. Você pode sair desta tela e voltar depois.
          </p>
        )}

        <Tour screen="grading" ready={sheets.length > 0} />
      </div>
    </QueryBoundary>
  );
}

function UploadArea() {
  return (
    <Card data-tour="upload" className="flex flex-col items-center gap-3 border-2 border-dashed border-line p-10 text-center">
      <Upload size={28} aria-hidden className="text-ink-subtle" />
      <p className="text-body text-ink">Arraste as fotos das folhas aqui</p>
      <p className="max-w-lg text-caption text-ink-subtle">
        No celular isto abre a câmera; no computador, aceita os arquivos arrastados. Nesta
        fase a leitura é simulada com folhas de demonstração: marque abaixo quais ler, e o
        sistema corrige as objetivas de cada uma. O envio real de imagens entra junto com o
        servidor.
      </p>
    </Card>
  );
}

/** How many sheets were read, and one button that selects every unread sheet or clears the selection. */
function SheetListHeader({
  read,
  total,
  unread,
  selected,
  onSelect,
}: Readonly<{ read: number; total: number; unread: Sheet[]; selected: string[]; onSelect: (ids: string[]) => void }>) {
  const allSelected = unread.length > 0 && selected.length === unread.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-title text-primary">Folhas desta aplicação</h2>
        <p className="mt-1 text-caption text-ink-subtle" aria-live="polite">
          {read} de {total} lidas
        </p>
      </div>
      {unread.length > 0 && (
        <Button variant="secondary" onClick={() => onSelect(allSelected ? [] : unread.map((sheet) => sheet.id))}>
          {allSelected ? 'Limpar seleção' : 'Selecionar todas as não lidas'}
        </Button>
      )}
    </div>
  );
}

/** Who a sheet belongs to: the student printed on it, nobody yet, or a student removed from the class since. */
function ownerOf(sheet: Sheet, overview: Overview | undefined): string {
  if (sheet.studentId === undefined) return 'Sem identificação';
  return overview?.students.find((student) => student.id === sheet.studentId)?.fullName ?? 'Aluno removido';
}

function CorrectionBadge({ correction }: Readonly<{ correction: Correction | undefined }>) {
  if (correction === undefined) return <Badge>Não lida</Badge>;
  if (correction.status === CORRECTION_STATUS.DONE) {
    return (
      <Badge tone="success" icon={<CheckCircle2 size={13} aria-hidden />}>
        Corrigida · {correction.totalScore}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" icon={<Clock size={13} aria-hidden />}>
      Em andamento · {correction.totalScore}
    </Badge>
  );
}

/** A sheet still unread can be picked for reading; one already read can be reviewed. */
function SheetRow({
  applicationId,
  sheet,
  correction,
  overview,
  selected,
  onToggle,
}: Readonly<{
  applicationId: string;
  sheet: Sheet;
  correction: Correction | undefined;
  overview: Overview | undefined;
  selected: boolean;
  onToggle: () => void;
}>) {
  const versionNumber = overview?.versions.find((version) => version.id === sheet.examVersionId)?.versionNumber;

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      {correction === undefined ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Marcar a folha ${sheet.sheetNumber} para leitura`}
          className="size-4 accent-[var(--color-primary)]"
        />
      ) : (
        <span className="size-4" aria-hidden />
      )}

      <span className="text-label text-ink-subtle">#{sheet.sheetNumber}</span>

      <span className="min-w-0 flex-1 truncate text-body text-ink">
        {ownerOf(sheet, overview)}
        <span className="ml-2 text-caption text-ink-subtle">versão {versionNumber ?? '—'}</span>
      </span>

      <CorrectionBadge correction={correction} />

      {correction !== undefined && (
        <ButtonLink
          variant="ghost"
          data-tour="confirm"
          to={buildPath(ROUTES.gradingSheet, { id: applicationId, sheetId: sheet.id })}
        >
          Revisar
        </ButtonLink>
      )}
    </li>
  );
}

function ReadButton({ count, pending, onRead }: Readonly<{ count: number; pending: boolean; onRead: () => void }>) {
  return (
    <Button
      variant="primary"
      icon={pending ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Upload size={18} aria-hidden />}
      disabled={count === 0 || pending}
      onClick={onRead}
    >
      {pending ? 'Lendo…' : `Ler ${count} folhas`}
    </Button>
  );
}
