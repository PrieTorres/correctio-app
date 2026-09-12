import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  hasSeenTour,
  markTourSeen,
  TOUR_STEPS,
  useTourRequests,
  type TourScreen,
} from '@/lib/tour';

interface TourProps {
  screen: TourScreen;
  /**
   * The tour waits for the screen to have content. An empty state already
   * teaches better than a caption pointing at a table with no rows.
   */
  ready: boolean;
  onClose?: () => void;
}

/**
 * The guided tour of one screen, two to four sentences at a time.
 *
 * It sits at the bottom left on a wide screen, clear of the sidebar and clear
 * of the primary actions, which are right-aligned everywhere in this app: a
 * hint that covers the button the screen exists for is worse than no hint.
 *
 * It runs on the first visit to each screen rather than once at sign-in: a
 * teacher learns the grading screen when they go to grade, not weeks earlier.
 * The text lives in `lib/tour`, never here, so the wording is reviewed in one
 * place and its limits are a test.
 *
 * It never blocks: the screen stays usable underneath, `Esc` closes, and
 * skipping is always one click away. Focus moves to the step when it opens and
 * returns to where it was when it closes, which is the part a tour usually
 * gets wrong.
 */
export function Tour({ screen, ready, onClose }: Readonly<TourProps>) {
  const steps = TOUR_STEPS[screen];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const requests = useTourRequests();
  const firstRequest = useRef(requests);

  useEffect(() => {
    if (ready && !hasSeenTour(screen)) setOpen(true);
  }, [ready, screen]);

  /** Asking for help reopens this screen's tour from the beginning. */
  useEffect(() => {
    if (requests === firstRequest.current) return;
    firstRequest.current = requests;
    setIndex(0);
    setOpen(true);
  }, [requests]);

  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    /*
      Escape is listened for on the document rather than on the panel, so it
      still closes the tour after focus has moved to one of its buttons.
    */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      markTourSeen(screen);
      setOpen(false);
      opener.current?.focus();
      onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);

    /*
      The panel is docked, so it sits over whatever is at the bottom of the
      page. Reserving its height means the last row of a list or the button at
      the end of a form can still be scrolled to and clicked while the tour is
      open, rather than being unreachable until it is dismissed.
    */
    const reserved = panel.current?.offsetHeight ?? 0;
    const previousPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${reserved + 24}px`;

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.paddingBottom = previousPadding;
    };
  }, [open, screen, onClose]);

  const close = () => {
    markTourSeen(screen);
    setOpen(false);
    opener.current?.focus();
    onClose?.();
  };

  const advance = () => {
    if (index + 1 >= steps.length) {
      close();
      return;
    }
    setIndex(index + 1);
  };

  if (!open) return null;

  const step = steps[index];
  if (step === undefined) return null;

  return (
    <div
      ref={panel}
      /*
        A region rather than a dialog: it blocks nothing, traps no focus and
        leaves the screen usable underneath. Calling it a dialog would make a
        screen reader announce it as one, and would put it in the way of every
        query looking for the real dialogs of the app.
      */
      role="region"
      aria-label={`Tour desta tela, passo ${index + 1} de ${steps.length}`}
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-t-primary bg-surface p-4 shadow-[var(--shadow-overlay)] focus:outline-none sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(26rem,calc(100vw-3rem))] sm:rounded-[var(--radius-card)] sm:border-4 md:left-72"
    >
      <div className="flex items-start justify-between gap-3">
        <p aria-live="polite" className="text-body text-ink">
          {step}
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
          <button
            type="button"
            onClick={close}
            className="touch-target rounded-[var(--radius-control)] px-3 text-label text-ink-muted hover:bg-surface-muted"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={advance}
            className="touch-target rounded-[var(--radius-control)] bg-primary px-4 text-label text-on-primary hover:bg-primary-container"
          >
            {index + 1 >= steps.length ? 'Entendi' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
