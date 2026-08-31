import {
  LivestockAvailabilityDto,
  LivestockAvailabilityStatus,
  ProcessorSpaceDto,
  ProcessorSpaceStatus,
  TransactionType,
} from '../../api/models';
import { transactionTypeLabel } from '../card/card-chrome';
import { DemandFilters, DEMAND_STATUSES, SUPPLY_STATUSES } from './filter-defaults';

/**
 * What each filter control offers, derived from the working set that is already loaded.
 *
 * **The options come from the data, not from a vocabulary endpoint.** Requirement 1.2 wants the
 * demand stock classes to narrow to the chosen processor's own list, and 1.4 the same for plants;
 * both fall out of the records themselves, because a space carries its processor, its plant and its
 * stock class. That keeps this phase to the client — it may not change the server — and it has the
 * side effect that no option is ever offered that would match nothing.
 *
 * The one place that rule is deliberately broken is status: `DEMAND_STATUSES` and `SUPPLY_STATUSES`
 * are the type's members rather than the data's, because a status the seed happens not to contain is
 * still a status, and a menu that quietly omits `Cancelled` looks like the app cannot show cancelled
 * records at all.
 *
 * Options are always derived from the **unfiltered** list, so ticking one box never makes the other
 * boxes disappear from under the pointer. Processor narrowing is the single exception, and it is
 * asked for by name.
 */

export interface Option<TValue> {
  readonly value: TValue;
  readonly label: string;
}

export interface DemandFilterOptions {
  readonly statuses: readonly ProcessorSpaceStatus[];
  readonly processors: readonly string[];
  /** Narrowed to the selected processors (requirement 1.4). */
  readonly plants: readonly string[];
  /** Narrowed to the selected processors' own vocabularies (requirement 1.2). */
  readonly stockClasses: readonly string[];
  readonly weeks: readonly Option<string>[];
  /** ISO week to the server's `dd-MM-yy` label, for restating the filter in words. */
  readonly weekLabels: ReadonlyMap<string, string>;
}

export interface SupplyFilterOptions {
  readonly statuses: readonly LivestockAvailabilityStatus[];
  readonly stockClasses: readonly string[];
  /** ~300 of them, which is why the control types ahead (requirement 2.3). */
  readonly locations: readonly Option<number>[];
  readonly transactionTypes: readonly Option<TransactionType>[];
  readonly locationNames: ReadonlyMap<number, string>;
  // There is no `weeks` here, and there must never be one: resolved question 17.
}

export function demandFilterOptions(
  spaces: readonly ProcessorSpaceDto[],
  filters: DemandFilters,
): DemandFilterOptions {
  const inScope = spacesOfSelectedProcessors(spaces, filters.processors);

  return {
    statuses: DEMAND_STATUSES,
    processors: distinctStrings(spaces.map((space) => space.processor)),
    plants: distinctStrings(inScope.map((space) => space.plant)),
    stockClasses: distinctStrings(inScope.map((space) => space.stockClass)),
    weeks: weekOptions(spaces),
    weekLabels: new Map(spaces.map((space) => [space.weekCommencing, space.weekCommencingLabel])),
  };
}

export function supplyFilterOptions(
  records: readonly LivestockAvailabilityDto[],
): SupplyFilterOptions {
  const locations = new Map<number, string>();

  for (const record of records) {
    locations.set(record.locationId, record.locationName ?? `Location #${record.locationId}`);
  }

  return {
    statuses: SUPPLY_STATUSES,
    stockClasses: distinctStrings(records.map((record) => record.stockClass)),
    locations: [...locations.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en-NZ', { sensitivity: 'base' })),
    transactionTypes: distinctTransactionTypes(records),
    locationNames: locations,
  };
}

/**
 * Drops plant and stock-class selections the processor filter has just taken off the menu.
 *
 * Without this, choosing `ANZCO` while `Lorneville` (an Alliance plant) is still selected leaves two
 * filters that cannot both be satisfied, and the column empties for a reason no control on screen is
 * showing. An empty column with a visible cause is fine; an empty column whose cause has been hidden
 * by another control is the misleading view this phase is meant to avoid.
 */
export function narrowDemandFilters(
  filters: DemandFilters,
  spaces: readonly ProcessorSpaceDto[],
): DemandFilters {
  const inScope = spacesOfSelectedProcessors(spaces, filters.processors);
  const plants = new Set(inScope.map((space) => space.plant));
  const stockClasses = new Set(inScope.map((space) => space.stockClass));

  return {
    ...filters,
    plants: filters.plants.filter((plant) => plants.has(plant)),
    stockClasses: filters.stockClasses.filter((stockClass) => stockClasses.has(stockClass)),
  };
}

/** The weeks the demand column's own records fall in, soonest first. ISO strings sort as dates. */
function weekOptions(spaces: readonly ProcessorSpaceDto[]): Option<string>[] {
  const weeks = new Map<string, string>();

  for (const space of spaces) {
    weeks.set(space.weekCommencing, space.weekCommencingLabel);
  }

  return [...weeks.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => (a.value < b.value ? -1 : 1));
}

function spacesOfSelectedProcessors(
  spaces: readonly ProcessorSpaceDto[],
  processors: readonly string[],
): readonly ProcessorSpaceDto[] {
  return processors.length === 0
    ? spaces
    : spaces.filter((space) => processors.includes(space.processor));
}

function distinctStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) =>
    a.localeCompare(b, 'en-NZ', { sensitivity: 'base', numeric: true }),
  );
}

function distinctTransactionTypes(
  records: readonly LivestockAvailabilityDto[],
): Option<TransactionType>[] {
  const types = new Set(records.map((record) => record.transactionType));

  return [...types]
    .map((value) => ({ value, label: transactionTypeLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-NZ', { sensitivity: 'base' }));
}
