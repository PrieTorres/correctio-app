import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { hasSeenTour, markTourSeen, stepsOf, useTourRequests, type TourScreen } from '@/lib/tour';

interface TourProps {
  screen: TourScreen;
  /**
   * The tour waits for the screen to have content. An empty state already
   * teaches better than a caption pointing at a table with no rows.
   */
  ready: boolean;
  onClose?: () => void;
}

const HIGHLIGHT_CLASS = 'tour-target';

/**
 * The guided tour of one screen, one step at a time, pointing at what to click.
 *
 * It runs on the first visit to each screen rather than once at sign-in: a
 * teacher learns the grading screen when they go to grade, not weeks earlier.
 * The text and the element each step points at live in `lib/tour`, never here,
 * so the wording is reviewed in one place and its limits are a test.
 *
 * It never blocks: the screen stays usable underneath, `Esc` closes, and
 * skipping is always one click away. Focus moves to the step when it opens and
 * returns to where it was when it closes, which is the part a tour usually
 * gets wrong.
 */
export function Tour({ screen, ready, onClose }: Readonly<TourProps>) {
  const steps = stepsOf(screen);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [dockedAt, setDockedAt] = useState<'top' | 'bottom'>('bottom');
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const requests = useTourRequests();
  const lastRequest = useRef(requests);

  const step = steps[index];

  useEffect(() => {
    if (ready && !hasSeenTour(screen)) setOpen(true);
  }, [ready, screen]);

  /** Asking for help reopens this screen's tour from the beginning. */
  useEffect(() => {
    if (requests === lastRequest.current) return;
    lastRequest.current = requests;
    setIndex(0);
    setOpen(true);
  }, [requests]);

  const close = useCallback(() => {
    markTourSeen(screen);
    setOpen(false);
    opener.current?.focus();
    onClose?.();
  }, [screen, onClose]);

  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    /*
      Escape is listened for on the document rather than on the panel, so it
      still closes the tour after focus has moved to one of its buttons.
    */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  /**
   * Marks the element the step is about, and keeps the panel away from it.
   *
   * The outline is drawn on the element itself rather than as an overlay, so it
   * follows the element when the page scrolls and can never land in the wrong
   * place. The panel docks at whichever end of the screen the element is not
   * on: floating it beside the element read better but covered the controls
   * around it, which is worse than a hint that is merely further away.
   */
  useEffect(() => {
    if (!open || step === undefined) return;

    const target =
      step.target === undefined
        ? null
        : document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);

    if (target === null) {
      setDockedAt('bottom');
      return;
    }

    target.classList.add(HIGHLIGHT_CLASS);
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const keepClear = () => {
      const rect = target.getBoundingClientRect();
      setDockedAt(rect.top + rect.height / 2 > window.innerHeight / 2 ? 'top' : 'bottom');
    };

    keepClear();
    window.addEventListener('resize', keepClear);
    window.addEventListener('scroll', keepClear, true);

    return () => {
      target.classList.remove(HIGHLIGHT_CLASS);
      window.removeEventListener('resize', keepClear);
      window.removeEventListener('scroll', keepClear, true);
    };
  }, [open, step]);

  /**
   * The panel sits over whichever end of the page it docks at, so it reserves
   * its own height there: the last row of a list, or the header above it, stays
   * reachable while the tour is open rather than being covered until it is
   * dismissed.
   */
  useEffect(() => {
    if (!open) return;

    const reserved = `${(panel.current?.offsetHeight ?? 0) + 24}px`;
    const previous = document.body.style.padding;
    document.body.style.paddingTop = dockedAt === 'top' ? reserved : '';
    document.body.style.paddingBottom = dockedAt === 'bottom' ? reserved : '';

    return () => {
      document.body.style.padding = previous;
    };
  }, [open, dockedAt]);

  if (!open || step === undefined) return null;

  const isLast = index + 1 >= steps.length;

  return (
    <div
      ref={panel}
      /*
        A region rather than a dialog: it blocks nothing, traps no focus and
        leaves the screen usable underneath. Calling it a dialog would make a
        screen reader announce it as one, and would put it in front of every
        query looking for the real dialogs of the app.
      */
      role="region"
      aria-label={`Tour desta tela, passo ${index + 1} de ${steps.length}`}
      tabIndex={-1}
      className={`fixed inset-x-0 z-40 border-primary bg-surface p-4 shadow-[var(--shadow-overlay)] focus:outline-none sm:inset-x-auto sm:left-6 sm:w-[min(26rem,calc(100vw-3rem))] sm:rounded-[var(--radius-card)] sm:border-4 md:left-72 ${
        dockedAt === 'top' ? 'top-0 border-b-4 sm:top-6' : 'bottom-0 border-t-4 sm:bottom-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p aria-live="polite" className="text-body text-ink">
          {step.text}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar o tour"
          className="touch-target -mr-2 -mt-2 inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-surface-muted"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {/*
          The position is spelled out as well as shown: a row of dots carries
          the same information only for people who can see and distinguish them.
        */}
        <span className="text-caption text-ink-subtle">
          Passo {index + 1} de {steps.length}
        </span>

        <div className="flex gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="touch-target rounded-[var(--radius-control)] px-3 text-label text-ink-muted hover:bg-surface-muted"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="touch-target rounded-[var(--radius-control)] px-3 text-label text-ink-muted hover:bg-surface-muted"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close() : setIndex(index + 1))}
            className="touch-target rounded-[var(--radius-control)] bg-primary px-4 text-label text-on-primary hover:bg-primary-container"
          >
            {isLast ? 'Entendi' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
