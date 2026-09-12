import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Clock, Loader2, Upload } from 'lucide-react';
import { Badge, Button, Card, PageHeader, QueryBoundary, Tour } from '@/components/ui';
import { buildPath, ROUTES } from '@/app/routes';
import { CORRECTION_STATUS } from '@/types/domain';
import { useGradingOverview, useReadSheets } from '../hooks/useGrading';

export function GradingUploadPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError } = useGradingOverview(id);
  const readSheets = useReadSheets();

  const [selected, setSelected] = useState<string[]>([]);

  const sheets = data?.sheets ?? [];
  const correctionBySheet = new Map(
    (data?.corrections ?? []).map((correction) => [correction.answerSheetId, correction]),
  );
  const studentName = new Map(
    (data?.students ?? []).map((student) => [student.id, student.fullName]),
  );
  const versionNumber = new Map(
    (data?.versions ?? []).map((version) => [version.id, version.versionNumber]),
  );

  const unread = sheets.filter((sheet) => !correctionBySheet.has(sheet.id));
  const allSelected = unread.length > 0 && selected.length === unread.length;

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

        <PageHeader
          title="Enviar folhas de respostas"
          description="Fotografe ou arraste as folhas. A leitura resolve as objetivas sozinha e deixa as discursivas para você."
        />

        {/*
          The phase reads demonstration sheets instead of photographs. A phone
          photo in base64 exceeds the storage this phase has, and pretending
          otherwise would produce a screen that works only until someone tries
          it. What is real is everything after the reading.
        */}
        <Card className="flex flex-col items-center gap-3 border-2 border-dashed border-line p-10 text-center">
          <Upload size={28} aria-hidden className="text-ink-subtle" />
          <p className="text-body text-ink">Arraste as fotos das folhas aqui</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button icon={<Camera size={18} aria-hidden />}>Fotografar</Button>
            <Button variant="secondary">Escolher arquivos</Button>
          </div>
          <p className="max-w-lg text-caption text-ink-subtle">
            Nesta fase a leitura é simulada com folhas de demonstração: escolha abaixo quais
            marcar como lidas. O envio real de imagens entra junto com o servidor.
          </p>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-title text-primary">Folhas desta aplicação</h2>
              <p className="mt-1 text-caption text-ink-subtle" aria-live="polite">
                {correctionBySheet.size} de {sheets.length} lidas
              </p>
            </div>
            {unread.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setSelected(allSelected ? [] : unread.map((sheet) => sheet.id))}
              >
                {allSelected ? 'Limpar seleção' : 'Selecionar todas as não lidas'}
              </Button>
            )}
          </div>

          {sheets.length === 0 ? (
            <p className="px-5 py-6 text-body text-ink-muted">
              Esta aplicação ainda não foi gerada, então não há folhas para ler.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {sheets.map((sheet) => {
                const correction = correctionBySheet.get(sheet.id);

                return (
                  <li key={sheet.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    {correction === undefined ? (
                      <input
                        type="checkbox"
                        checked={selected.includes(sheet.id)}
                        onChange={() => toggle(sheet.id)}
                        aria-label={`Marcar a folha ${sheet.sheetNumber} para leitura`}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                    ) : (
                      <span className="size-4" aria-hidden />
                    )}

                    <span className="text-label text-ink-subtle">#{sheet.sheetNumber}</span>

                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      {sheet.studentId === undefined
                        ? 'Sem identificação'
                        : (studentName.get(sheet.studentId) ?? 'Aluno removido')}
                      <span className="ml-2 text-caption text-ink-subtle">
                        versão {versionNumber.get(sheet.examVersionId) ?? '—'}
                      </span>
                    </span>

                    {correction === undefined ? (
                      <Badge>Não lida</Badge>
                    ) : correction.status === CORRECTION_STATUS.DONE ? (
                      <Badge tone="success" icon={<CheckCircle2 size={13} aria-hidden />}>
                        Corrigida · {correction.totalScore}
                      </Badge>
                    ) : (
                      <Badge tone="warning" icon={<Clock size={13} aria-hidden />}>
                        Em andamento · {correction.totalScore}
                      </Badge>
                    )}

                    {correction !== undefined && (
                      <Button variant="ghost">
                        <Link
                          to={buildPath(ROUTES.gradingSheet, {
                            id: id ?? '',
                            sheetId: sheet.id,
                          })}
                        >
                          Revisar
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={buildPath(ROUTES.unassignedCorrections, { id: id ?? '' })} className="text-label text-primary underline">
            Ver correções pendentes de atribuição
          </Link>
          <Button
            variant="primary"
            icon={
              readSheets.isPending ? (
                <Loader2 size={18} aria-hidden className="animate-spin" />
              ) : (
                <Upload size={18} aria-hidden />
              )
            }
            disabled={selected.length === 0 || readSheets.isPending}
            onClick={run}
          >
            {readSheets.isPending ? 'Lendo…' : `Ler ${selected.length} folhas`}
          </Button>
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
