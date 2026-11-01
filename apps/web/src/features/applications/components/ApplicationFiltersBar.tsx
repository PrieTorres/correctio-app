import { Button, FilterSelect, SearchInput, SegmentedControl, type FilterOption } from '@/components/ui';
import { APPLICATION_FILTER, type ApplicationFilter } from '../application-filter';
import {
  effectiveFilters,
  hasApplicationListFilters,
  offersPdfFilter,
  type ApplicationListFilters,
  type PdfFilter,
} from '../list-filters';

const FILTERS = [
  { value: APPLICATION_FILTER.ACTIVE, label: 'Ativas' },
  { value: APPLICATION_FILTER.ARCHIVED, label: 'Arquivadas' },
  { value: APPLICATION_FILTER.IN_PROGRESS, label: 'Correção em andamento' },
] as const satisfies readonly { value: ApplicationFilter; label: string }[];

const PDF_OPTIONS = [
  { value: 'draft', label: 'A gerar' },
  { value: 'generated', label: 'Gerada' },
] as const satisfies readonly { value: PdfFilter; label: string }[];

/** A value the select did not offer reads as no restriction, which is also what "Todas" sends. */
function pdfFilterOf(value: string): PdfFilter {
  return PDF_OPTIONS.find((option) => option.value === value)?.value ?? '';
}

interface ApplicationFiltersBarProps {
  filter: ApplicationFilter;
  onFilterChange: (filter: ApplicationFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  filters: ApplicationListFilters;
  onFiltersChange: <Key extends keyof ApplicationListFilters>(key: Key, value: ApplicationListFilters[Key]) => void;
  onClear: () => void;
  choices: { classes: readonly FilterOption[]; exams: readonly FilterOption[] };
}

/**
 * The filters of P11: the date search and the situation of #158, then the
 * class, the exam and, among the active applications only, the paper (#57).
 * "Limpar filtros" appears once a filter that applies here is on.
 */
export function ApplicationFiltersBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onClear,
  choices,
}: Readonly<ApplicationFiltersBarProps>) {
  return (
    <div data-tour="filters" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={onSearchChange} label="Buscar aplicações" placeholder="Buscar pela data" />
        <SegmentedControl segments={FILTERS} value={filter} onChange={onFilterChange} label="Filtrar por situação" />
      </div>

      <form
        aria-label="Filtros das aplicações"
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-3 sm:grid-cols-3"
      >
        <FilterSelect
          label="Turma"
          value={filters.classId}
          options={choices.classes}
          onChange={(value) => onFiltersChange('classId', value)}
        />
        <FilterSelect
          label="Prova"
          value={filters.examId}
          options={choices.exams}
          onChange={(value) => onFiltersChange('examId', value)}
        />
        {offersPdfFilter(filter) && (
          <FilterSelect
            label="Situação do PDF"
            value={filters.pdf}
            options={PDF_OPTIONS}
            onChange={(value) => onFiltersChange('pdf', pdfFilterOf(value))}
          />
        )}
        {hasApplicationListFilters(effectiveFilters(filter, filters)) && (
          <div className="sm:col-span-3">
            <Button type="button" variant="secondary" onClick={onClear}>
              Limpar filtros
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
