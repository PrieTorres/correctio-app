import { useId, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, Clock, FolderOpen, Loader2 } from 'lucide-react';
import { BackLink, Badge, Button, ButtonLink, Card, PageHeader, QueryBoundary, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { discursiveQuestionIdsOf, gradeObjectives } from '@/lib/grading';
import { formatDate } from '@/lib/utils';
import type { ReadFailure, SheetImageUpload } from '@/lib/schemas';
import { CORRECTION_STATUS, type AnswerSheet, type Correction, type ExamVersion, type Student } from '@/types/domain';
import { useGradingOverview, useReadFailures, useSheetUploads, useUploadSheetPhoto, type SheetUpload } from '../hooks/useGrading';
import { PHOTO_PARAM } from '../review-model';

type Overview = NonNullable<ReturnType<typeof useGradingOverview>['data']>;

/** A link that looks like the secondary button, for "Revisar" in every list of the screen. */
/** What a file field looks like when its label is the button: the field stays focusable, and its focus shows on the label. */
const FILE_BUTTON =
  'touch-target inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-label font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary';

function reviewPath(applicationId: string, sheetId: string, photoId?: string): string {
  const path = buildPath(ROUTES.gradingSheet, { id: applicationId, sheetId });
  return photoId === undefined ? path : `${path}?${PHOTO_PARAM}=${encodeURIComponent(photoId)}`;
}

/** Who the sheet is printed for, or its version when it carries no name (P15). */
function holderOf(sheet: AnswerSheet, students: readonly Student[], versions: readonly ExamVersion[]): string {
  if (sheet.studentId !== undefined) return students.find((student) => student.id === sheet.studentId)?.fullName ?? 'Aluno removido';
  const version = versions.find((item) => item.id === sheet.examVersionId);
  return `Versão ${version?.versionNumber ?? '—'}, sem identificação`;
}

/**
 * Sending the photos of the answer sheets (P15). Each photo goes on its own
 * and comes back with its reading, so the screen never waits for a batch
 * (RF41): the teacher keeps photographing while the earlier ones are read.
 * Nothing here is a grade; every reading opens the review (RF28).
 */
export function GradingUploadPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isPending, isError } = useGradingOverview(id);

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando folhas…">
      <div className="flex flex-col gap-6">
        <BackLink to={buildPath(ROUTES.applicationDetail, { id })}>Aplicação</BackLink>

        <PageHeader
          help
          title="Enviar folhas de respostas"
          description="Fotografe as folhas, uma por vez. A leitura identifica a folha pelo QR Code, marca as objetivas e deixa as discursivas para você."
        />

        {data === null || data === undefined || data.sheets.length === 0 ? (
          <Card className="p-6">
            <p className="text-body text-ink-muted">Esta aplicação ainda não foi gerada, então não há folhas para corrigir.</p>
          </Card>
        ) : (
          <UploadArea applicationId={id} overview={data} />
        )}
      </div>
    </QueryBoundary>
  );
}

function UploadArea({ applicationId, overview }: Readonly<{ applicationId: string; overview: Overview }>) {
  const uploads = useSheetUploads(applicationId);

  return (
    <>
      <PhotoPicker applicationId={applicationId} />
      {uploads.length > 0 && <UploadsCard applicationId={applicationId} uploads={uploads} overview={overview} />}
      <ReadFailuresCard applicationId={applicationId} overview={overview} />
      <ManualEntryCard applicationId={applicationId} overview={overview} />
      <SheetsCard applicationId={applicationId} overview={overview} />

      <Link to={buildPath(ROUTES.unassignedCorrections, { id: applicationId })} className="link-target text-label text-primary underline">
        Ver correções pendentes de atribuição
      </Link>

      <Tour screen="grading" ready />
    </>
  );
}

/**
 * Two ways in, both a real file field behind a label that looks like a button.
 * On a phone, "Fotografar folha" opens the back camera (`capture`); on a
 * computer, "Escolher arquivos" takes several at once, each sent on its own.
 * The field is cleared after each choice: the iPhone names every photo
 * `image.jpg`, and the same name twice would not fire the next change.
 */
function PhotoPicker({ applicationId }: Readonly<{ applicationId: string }>) {
  const upload = useUploadSheetPhoto(applicationId);
  const cameraId = useId();
  const filesId = useId();

  const send = (event: ChangeEvent<HTMLInputElement>) => {
    for (const photo of Array.from(event.target.files ?? [])) upload.mutate(photo);
    event.target.value = '';
  };

  return (
    <Card data-tour="upload" className="flex flex-col items-center gap-4 border-2 border-dashed border-line p-8 text-center">
      <div className="flex flex-wrap justify-center gap-3">
        <span>
          <input id={cameraId} type="file" accept="image/*" capture="environment" className="peer sr-only" onChange={send} />
          <label htmlFor={cameraId} className={`${FILE_BUTTON} bg-accent text-on-accent hover:bg-accent-hover`}>
            <Camera size={18} aria-hidden />
            Fotografar folha
          </label>
        </span>
        <span>
          <input id={filesId} type="file" accept="image/*" multiple className="peer sr-only" onChange={send} />
          <label htmlFor={filesId} className={`${FILE_BUTTON} border border-primary bg-surface text-primary hover:bg-surface-muted`}>
            <FolderOpen size={18} aria-hidden />
            Escolher arquivos
          </label>
        </span>
      </div>
      <p className="max-w-lg text-caption text-ink-subtle">
        Fotografe de cima, com a folha inteira e os quatro quadrados dos cantos aparecendo. JPG, PNG ou WebP, até 10 MB.
        Você pode sair desta tela enquanto as fotos são lidas.
      </p>
    </Card>
  );
}

/** The photos sent from this screen, the newest first, each with how its reading went (P15). */
function UploadsCard({ applicationId, uploads, overview }: Readonly<{ applicationId: string; uploads: SheetUpload[]; overview: Overview }>) {
  return (
    <Card data-tour="uploads">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Fotos enviadas</h2>
      </div>
      <ul className="divide-y divide-line" aria-live="polite">
        {uploads.map((upload) => (
          <li key={upload.key} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="min-w-0 flex-1 truncate text-caption text-ink-subtle">{upload.fileName}</span>
            <UploadOutcome applicationId={applicationId} upload={upload} overview={overview} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UploadOutcome({ applicationId, upload, overview }: Readonly<{ applicationId: string; upload: SheetUpload; overview: Overview }>) {
  if (upload.state === 'pending' || upload.state === 'idle') {
    return (
      <Badge icon={<Loader2 size={13} aria-hidden className="animate-spin" />}>Processando</Badge>
    );
  }
  if (upload.reading === undefined) {
    return (
      <p role="alert" className="text-caption text-danger">
        Não foi enviada: {upload.error ?? 'tente de novo.'}
      </p>
    );
  }
  return <ReadingOutcome applicationId={applicationId} reading={upload.reading} overview={overview} />;
}

/**
 * What a reading allows next: a sheet that was read shows its holder and a
 * preliminary grade of the objective questions, marked "Em andamento" when
 * open-ended ones wait for the teacher (RF48); a photo of no known sheet asks
 * which sheet it is. Every one of them opens the review.
 */
function ReadingOutcome({ applicationId, reading, overview }: Readonly<{ applicationId: string; reading: SheetImageUpload; overview: Overview }>) {
  if (reading.status === 'QR_NOT_RECOGNIZED') {
    return (
      <>
        <Badge tone="warning">QR não reconhecido</Badge>
        <SheetChooser applicationId={applicationId} overview={overview} photoId={reading.imageId} label="Qual folha é esta foto?" />
      </>
    );
  }

  const sheet = overview.sheets.find((item) => item.id === reading.answerSheetId);
  return (
    <>
      <span className="text-body text-ink">
        Folha {sheet?.sheetNumber ?? '—'} · {sheet === undefined ? '' : holderOf(sheet, overview.students, overview.versions)}
      </span>
      {reading.status === 'READ' ? <ReadBadges overview={overview} reading={reading} /> : <Badge tone="danger">Falha na leitura</Badge>}
      <ButtonLink
        to={reviewPath(applicationId, reading.answerSheetId, reading.imageId)}
        aria-label={`Revisar a folha ${sheet?.sheetNumber ?? '—'}`}
      >
        Revisar
      </ButtonLink>
    </>
  );
}

function ReadBadges({ overview, reading }: Readonly<{ overview: Overview; reading: Extract<SheetImageUpload, { status: 'READ' }> }>) {
  if (overview.exam === null) return <Badge tone="success">Lido</Badge>;
  const preview = gradeObjectives(overview.exam, overview.bank, reading.answers).score;
  const waitsForTeacher = discursiveQuestionIdsOf(overview.exam, overview.bank).length > 0;

  return (
    <>
      <Badge tone="success" icon={<CheckCircle2 size={13} aria-hidden />}>
        Lido · nota prévia {preview}
      </Badge>
      {waitsForTeacher && (
        <Badge tone="warning" icon={<Clock size={13} aria-hidden />}>
          Em andamento
        </Badge>
      )}
    </>
  );
}

/** The failures the server keeps, so a photo sent earlier or from another device is not forgotten (P15). */
function ReadFailuresCard({ applicationId, overview }: Readonly<{ applicationId: string; overview: Overview }>) {
  const failures = useReadFailures(applicationId);
  const corrected = new Set(overview.corrections.map((correction) => correction.answerSheetId));
  const open = (failures.data ?? []).filter((failure) => failure.answerSheetId === undefined || !corrected.has(failure.answerSheetId));
  if (open.length === 0) return null;

  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Fotos que não foram lidas</h2>
        <p className="mt-1 text-caption text-ink-subtle">Escolha a folha, quando o QR não foi reconhecido, e lance a correção à mão.</p>
      </div>
      <ul className="divide-y divide-line">
        {open.map((failure) => (
          <li key={failure.imageId} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="text-caption text-ink-subtle">Enviada em {formatDate(failure.createdAt)}</span>
            <FailureOutcome applicationId={applicationId} failure={failure} overview={overview} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FailureOutcome({ applicationId, failure, overview }: Readonly<{ applicationId: string; failure: ReadFailure; overview: Overview }>) {
  if (failure.answerSheetId === undefined) {
    return (
      <>
        <Badge tone="warning">QR não reconhecido</Badge>
        <SheetChooser applicationId={applicationId} overview={overview} photoId={failure.imageId} label="Qual folha é esta foto?" />
      </>
    );
  }
  const sheet = overview.sheets.find((item) => item.id === failure.answerSheetId);
  return (
    <>
      <span className="text-body text-ink">Folha {sheet?.sheetNumber ?? '—'}</span>
      <Badge tone="danger">Falha na leitura</Badge>
      <ButtonLink
        to={reviewPath(applicationId, failure.answerSheetId, failure.imageId)}
        aria-label={`Revisar a folha ${sheet?.sheetNumber ?? '—'}`}
      >
        Revisar
      </ButtonLink>
    </>
  );
}

/**
 * Picks a sheet by its printed number or its student and opens the review:
 * for a photo whose QR Code was not recognized, and for a correction typed
 * without any photo (RF30). The sheet decides the version.
 */
function SheetChooser({ applicationId, overview, photoId, label }: Readonly<{ applicationId: string; overview: Overview; photoId?: string; label: string }>) {
  const navigate = useNavigate();
  const fieldId = useId();
  const [sheetId, setSheetId] = useState('');

  return (
    <span className="flex flex-wrap items-center gap-2">
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <select
        id={fieldId}
        value={sheetId}
        onChange={(event) => setSheetId(event.target.value)}
        className="touch-target rounded-[var(--radius-control)] border border-line bg-surface px-3 text-body focus:outline-none focus-visible:border-primary"
      >
        <option value="">{label}</option>
        {overview.sheets.map((sheet) => (
          <option key={sheet.id} value={sheet.id}>
            Folha {sheet.sheetNumber} · {holderOf(sheet, overview.students, overview.versions)}
          </option>
        ))}
      </select>
      <Button disabled={sheetId === ''} onClick={() => void navigate(reviewPath(applicationId, sheetId, photoId))}>
        Revisar
      </Button>
    </span>
  );
}

/** RF30: a sheet whose photo will not read, or that was never photographed, is graded by typing what is on it. */
function ManualEntryCard({ applicationId, overview }: Readonly<{ applicationId: string; overview: Overview }>) {
  return (
    <Card data-tour="manual" className="flex flex-col gap-3 p-5">
      <h2 className="text-title text-primary">Inserir correção manualmente</h2>
      <p className="text-caption text-ink-subtle">Sem foto: escolha a folha pelo número impresso ou pelo aluno e marque as respostas à mão.</p>
      <SheetChooser applicationId={applicationId} overview={overview} label="Escolha a folha" />
    </Card>
  );
}

/** Every sheet of the application and where its correction stands. */
function SheetsCard({ applicationId, overview }: Readonly<{ applicationId: string; overview: Overview }>) {
  const correctionBySheet = new Map(overview.corrections.map((correction) => [correction.answerSheetId, correction]));

  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Folhas desta aplicação</h2>
        <p className="mt-1 text-caption text-ink-subtle" aria-live="polite">
          {correctionBySheet.size} de {overview.sheets.length} corrigidas
        </p>
      </div>
      <ul data-tour="list" className="divide-y divide-line">
        {overview.sheets.map((sheet) => {
          const correction = correctionBySheet.get(sheet.id);
          return (
            <li key={sheet.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="text-label text-ink-subtle">#{sheet.sheetNumber}</span>
              <span className="min-w-0 flex-1 truncate text-body text-ink">{holderOf(sheet, overview.students, overview.versions)}</span>
              <CorrectionBadge correction={correction} />
              {correction !== undefined && (
                <ButtonLink
                  to={reviewPath(applicationId, sheet.id)}
                  aria-label={`Revisar a folha ${sheet.sheetNumber}, ${holderOf(sheet, overview.students, overview.versions)}`}
                >
                  Revisar
                </ButtonLink>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CorrectionBadge({ correction }: Readonly<{ correction: Correction | undefined }>) {
  if (correction === undefined) return <Badge>Não corrigida</Badge>;
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
