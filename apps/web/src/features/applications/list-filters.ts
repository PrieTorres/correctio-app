import type { FilterOption } from '@/components/ui';
import { compareByLocale } from '@/lib/utils';
import type { ApplicationListParams } from '@/lib/repositories/application-repository';
import { LARGEST_PAGE } from '@/lib/repositories/read-every-page';
import { APPLICATION_FILTER, type ApplicationFilter } from './application-filter';

/**
 * What narrows P11 beyond the situation chosen above it (#158). An empty
 * string means "no restriction", which is also what an absent URL parameter
 * reads as, so the unfiltered list needs no special case.
 */
export interface ApplicationListFilters {
  classId: string;
  examId: string;
  /** Whether the paper exists: `draft` reads "A gerar" and `generated` reads "Gerada". */
  pdf: PdfFilter;
}

export type PdfFilter = '' | 'draft' | 'generated';

export const NO_APPLICATION_LIST_FILTERS: ApplicationListFilters = { classId: '', examId: '', pdf: '' };

/**
 * The URL parameter of each filter, so a filtered list survives a reload and
 * can be sent as a link, as the situation (`status`) and the filters of the
 * consolidated report already are.
 */
export const APPLICATION_LIST_FILTER_PARAMS: Readonly<Record<keyof ApplicationListFilters, string>> = {
  classId: 'class',
  examId: 'exam',
  pdf: 'pdf',
};

/** How many applications a page of P11 shows; the API answers the page already filtered and sorted. */
export const APPLICATION_PAGE_SIZE = 20;

const PDF_FILTERS: readonly PdfFilter[] = ['draft', 'generated'];

/** A `pdf` value the list does not know reads as no restriction, as an unknown situation does. */
export function readApplicationListFilters(params: URLSearchParams): ApplicationListFilters {
  const pdf = params.get(APPLICATION_LIST_FILTER_PARAMS.pdf) ?? '';
  return {
    classId: params.get(APPLICATION_LIST_FILTER_PARAMS.classId) ?? '',
    examId: params.get(APPLICATION_LIST_FILTER_PARAMS.examId) ?? '',
    pdf: PDF_FILTERS.find((known) => known === pdf) ?? '',
  };
}

/**
 * Only the active applications are split by their paper. An archived one is
 * `closed` whatever paper it had, and one with a correction in progress was
 * necessarily printed, so offering the filter there would only lead to an
 * empty list (and the API refuses `draft` or `generated` among the archived).
 */
export function offersPdfFilter(filter: ApplicationFilter): boolean {
  return filter === APPLICATION_FILTER.ACTIVE;
}

/**
 * The filters that apply under a situation. A paper filter chosen among the
 * active ones stays in the URL when the teacher switches to the archived, so it
 * is back on returning, but meanwhile it neither filters nor counts as on.
 */
export function effectiveFilters(filter: ApplicationFilter, filters: ApplicationListFilters): ApplicationListFilters {
  return offersPdfFilter(filter) ? filters : { ...filters, pdf: '' };
}

export function hasApplicationListFilters(filters: ApplicationListFilters): boolean {
  return Object.values(filters).some((value) => value !== '');
}

/** What P11 has on screen, as the repository is asked for it. */
export interface ApplicationListQuery {
  filter: ApplicationFilter;
  filters: ApplicationListFilters;
  search: string;
  page: number;
}

/**
 * The filters go to the server, which pages after filtering. The corrections
 * in progress are the exception: they still live in this browser (#48), so
 * that view asks for every match at once and keeps the ones in progress here,
 * paging what is left on this side.
 */
export function listParamsOf({ filter, filters, search, page }: ApplicationListQuery): ApplicationListParams {
  const inProgress = filter === APPLICATION_FILTER.IN_PROGRESS;
  const { classId, examId, pdf } = effectiveFilters(filter, filters);

  return {
    search,
    archived: filter === APPLICATION_FILTER.ARCHIVED,
    ...(classId !== '' && { classId }),
    ...(examId !== '' && { examId }),
    ...(pdf !== '' && { status: pdf }),
    page: inProgress ? 1 : page,
    pageSize: inProgress ? LARGEST_PAGE : APPLICATION_PAGE_SIZE,
  };
}

/** One page of a list already filtered on this side, numbered from 1 as the API numbers its pages. */
export function pageOf<Item>(items: readonly Item[], page: number): Item[] {
  const start = (page - 1) * APPLICATION_PAGE_SIZE;
  return items.slice(start, start + APPLICATION_PAGE_SIZE);
}

/**
 * The classes or exams a teacher can filter by, archived ones included: an
 * application keeps its class and exam when they are archived later, and the
 * teacher still looks for it by them. The archived ones say so, since two
 * terms of the same subject often share a name.
 */
export function filterOptionsOf<Item extends { id: string; status: string }>(
  items: readonly Item[],
  labelOf: (item: Item) => string,
): FilterOption[] {
  return items
    .map((item) => {
      const archived = item.status === 'archived' || item.status === 'closed';
      return { value: item.id, label: archived ? `${labelOf(item)} (arquivada)` : labelOf(item) };
    })
    .toSorted((a, b) => compareByLocale(a.label, b.label));
}
