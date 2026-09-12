import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, QrCode, XCircle } from 'lucide-react';
import { Badge, Card, QueryBoundary } from '@/components/ui';
import { ROUTES } from '@/app/routes';
import { formatDate } from '@/lib/utils';
import type { PublicLookup, PublicLookupHeader } from '@/types/domain';
import { usePublicLookup } from '../hooks/usePublicLookup';

/**
 * Keeps this page out of search results for as long as it is on screen.
 *
 * `robots.txt` asks crawlers not to fetch it; this tells the ones that fetched
 * anyway not to index what they found. A student's name beside their grade in a
 * search result is the outcome this page exists to avoid, and one line of
 * defence for it is not enough.
 */
function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(meta);

    return () => meta.remove();
  }, []);
}

export function PublicLookupPage() {
  const { code } = useParams<{ code: string }>();
  const { data, isPending, isError } = usePublicLookup(code);
  useNoIndex();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 p-4">
      <header className="flex items-center gap-2 pt-2">
        <QrCode size={20} aria-hidden className="text-primary" />
        <span className="text-label text-primary">Correctio</span>
      </header>

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Buscando…">
        <main className="flex flex-col gap-5">
          {data === undefined ? null : <Result lookup={data} />}
        </main>
      </QueryBoundary>

      <footer className="mt-auto pt-6 text-caption text-ink-subtle">
        <Link to={ROUTES.privacy} className="underline">
          Aviso de privacidade
        </Link>
      </footer>
    </div>
  );
}

function Result({ lookup }: Readonly<{ lookup: PublicLookup }>) {
  if (lookup.status === 'INVALID_CODE') {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <XCircle size={32} aria-hidden className="text-danger" />
        <h1 className="text-title text-primary">QR inválido</h1>
        <p className="text-body text-ink-muted">
          Este código não corresponde a nenhuma folha. Confira se leu o QR certo, ou peça ajuda ao
          professor da turma.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Header header={lookup.header} />

      {lookup.status === 'NOTHING_RELEASED' && (
        <Card className="p-6">
          <h2 className="text-title text-primary">Ainda não liberado</h2>
          <p className="mt-2 text-body text-ink-muted">
            O professor ainda não publicou o gabarito desta prova. Volte a ler este mesmo QR mais
            tarde.
          </p>
        </Card>
      )}

      {lookup.status === 'ANSWER_KEY_AND_SCORE' && (
        <Card className="flex flex-col items-center gap-1 p-6 text-center">
          <h2 className="text-label text-ink-muted">Sua nota</h2>
          <p className="text-display text-primary">{lookup.totalScore}</p>
        </Card>
      )}

      {lookup.status !== 'NOTHING_RELEASED' && (
        <Card className="p-6">
          <h2 className="text-title text-primary">Gabarito</h2>
          {lookup.status === 'ANSWER_KEY_ONLY' && (
            <p className="mt-2 text-body text-ink-muted">
              A nota ainda não foi liberada. O gabarito abaixo já está disponível.
            </p>
          )}
          <ol className="mt-4 flex flex-col gap-2">
            {lookup.answerKey.map((entry, index) => {
              const result =
                lookup.status === 'ANSWER_KEY_AND_SCORE'
                  ? lookup.objectiveResults.find((item) => item.questionId === entry.questionId)
                  : undefined;

              return (
                <li
                  key={entry.questionId}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2"
                >
                  <span className="text-body text-ink">Questão {index + 1}</span>
                  {result === undefined ? (
                    <Badge>Resposta correta registrada</Badge>
                  ) : (
                    <Badge
                      tone={result.correct ? 'success' : 'danger'}
                      icon={
                        result.correct ? (
                          <CheckCircle2 size={13} aria-hidden />
                        ) : (
                          <XCircle size={13} aria-hidden />
                        )
                      }
                    >
                      {result.correct ? 'Você acertou' : 'Você errou'}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}

function Header({ header }: Readonly<{ header: PublicLookupHeader }>) {
  return (
    <Card className="flex flex-col gap-1 p-6">
      <h1 className="text-title text-primary">{header.examTitle}</h1>
      <p className="text-body text-ink-muted">
        {header.className}
        {header.subject !== '' && ` · ${header.subject}`}
      </p>
      <p className="text-caption text-ink-subtle">Aplicada em {formatDate(header.date)}</p>
      <p className="mt-2 text-label text-ink">
        {header.identity.type === 'STUDENT'
          ? header.identity.fullName
          : `Folha ${header.identity.sheetNumber} · versão ${header.identity.versionNumber}`}
      </p>
    </Card>
  );
}
