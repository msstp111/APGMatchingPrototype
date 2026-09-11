import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { transactionTypeLabel } from '../card/card-chrome';
import {
  DemandFilters,
  DemandSortField,
  DEFAULT_DEMAND_FILTERS,
  DEFAULT_DEMAND_SORT,
  DEFAULT_SUPPLY_FILTERS,
  DEFAULT_SUPPLY_SORT,
  Sort,
  STATUS_RANK,
  SupplyFilters,
  SupplySortField,
} from './filter-defaults';

/**
 * Filtering and sorting, as pure functions over lists the API already returned.
 *
 * Requirement 7.4: filtering never mutates a record, never calls the API and never touches a match.
 * Every function here copies before it sorts and returns a new array; the DTOs themselves are passed
 * through by reference, untouched.
 *
 * **Nothing here computes a domain value.** A filter is a comparison against a figure the server
 * worked out (`record.unmatched > 0`), and a sort is a comparison between two of them. Note the
 * comparators use `<` and `>` rather than the usual `a - b`: subtraction on a quantity field is
 * arithmetic on a domain value, `no-domain-arithmetic.spec.ts` rightly fails it, and this file is not
 * on that allow-list.
 *
 * Dates are compared as their ISO `yyyy-MM-dd` strings, which sort chronologically as text. No
 * `Date` is constructed here or anywhere else in `web/`.
 */

// ---------------------------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------------------------

export function filterSpaces(
  spaces: readonly ProcessorSpaceDto[],
  filters: DemandFilters,
): ProcessorSpaceDto[] {
  return spaces.filter(
    (space) =>
      matchesAny(filters.statuses, space.status) &&
      matchesAny(filters.processors, space.processor) &&
      matchesAny(filters.plants, space.plant) &&
      matchesAny(filters.stockClasses, space.stockClass) &&
      (filters.weekCommencing === null || space.weekCommencing === filters.weekCommencing) &&
      (!filters.hasUnmatched || space.unmatched > 0),
  );
}

export function filterAvailability(
  records: readonly LivestockAvailabilityDto[],
  filters: SupplyFilters,
): LivestockAvailabilityDto[] {
  return records.filter(
    (record) =>
      matchesAny(filters.statuses, record.status) &&
      matchesAny(filters.stockClasses, record.stockClass) &&
      matchesAny(filters.locationIds, record.locationId) &&
      matchesAny(filters.transactionTypes, record.transactionType) &&
      (!filters.hasUnmatched || record.unmatched > 0),
  );
}

/** An empty selection is "no restriction" rather than "match nothing" (see `filter-defaults.ts`). */
function matchesAny<T>(selected: readonly T[], value: T): boolean {
  return selected.length === 0 || selected.includes(value);
}

// ---------------------------------------------------------------------------------------------
// Revealing one record the filters are hiding (2026-09-10)
//
// Clicking a match's counterparty name scrolls the other column to that record — and the other
// column is very often not showing it. The default filters are demand `Status = Booked` and supply
// `Status in (Booked, Pending)` with `unmatched > 0`, so a confirmed match's space and a fully
// allocated availability record are both outside them — which is to say: exactly the records a
// finished match points at.
//
// So the reveal has to be able to widen the far column. Two rules govern how, and both come from
// decisions that already existed rather than from this feature:
//
//   * **It widens only what is actually excluding the record**, clause by clause, and ADDS to each
//     list rather than replacing it — the same shape as Phase 7's `SHOW IT`, which ticks
//     `Cancelled` into a status filter without disturbing anything else the operator set.
//   * **It never fires on its own.** design-system.md 12.3 forbids hidden or timed changes to a
//     filter, so the caller offers this through a snack action and applies it only when asked.
//
// Pure, and returning new filter objects, which is what makes the decision testable without a DOM:
// the spec can assert that widening makes exactly this record visible and leaves every other clause
// alone. The scroll and the flash are the caller's problem.
// ---------------------------------------------------------------------------------------------

/**
 * The clauses of `filters` that exclude `space`, in the order they are declared.
 *
 * Empty when the record is already visible. Clause names rather than a boolean, because the snack
 * has to say what it would change: "hidden by this column's filters" is not something an operator
 * can act on.
 */
export function clausesHidingSpace(
  space: ProcessorSpaceDto,
  filters: DemandFilters,
): readonly (keyof DemandFilters)[] {
  const hiding: (keyof DemandFilters)[] = [];

  if (!matchesAny(filters.statuses, space.status)) {
    hiding.push('statuses');
  }

  if (!matchesAny(filters.processors, space.processor)) {
    hiding.push('processors');
  }

  if (!matchesAny(filters.plants, space.plant)) {
    hiding.push('plants');
  }

  if (!matchesAny(filters.stockClasses, space.stockClass)) {
    hiding.push('stockClasses');
  }

  if (filters.weekCommencing !== null && space.weekCommencing !== filters.weekCommencing) {
    hiding.push('weekCommencing');
  }

  // A comparison against a figure the server computed, in the same shape as the filter clause
  // itself. No arithmetic — see the note at the top of this file.
  if (filters.hasUnmatched && space.unmatched <= 0) {
    hiding.push('hasUnmatched');
  }

  return hiding;
}

/** @see clausesHidingSpace */
export function clausesHidingAvailability(
  record: LivestockAvailabilityDto,
  filters: SupplyFilters,
): readonly (keyof SupplyFilters)[] {
  const hiding: (keyof SupplyFilters)[] = [];

  if (!matchesAny(filters.statuses, record.status)) {
    hiding.push('statuses');
  }

  if (!matchesAny(filters.stockClasses, record.stockClass)) {
    hiding.push('stockClasses');
  }

  if (!matchesAny(filters.locationIds, record.locationId)) {
    hiding.push('locationIds');
  }

  if (!matchesAny(filters.transactionTypes, record.transactionType)) {
    hiding.push('transactionTypes');
  }

  if (filters.hasUnmatched && record.unmatched <= 0) {
    hiding.push('hasUnmatched');
  }

  return hiding;
}

/**
 * `filters`, widened by the least that makes `space` visible.
 *
 * Every list clause gains the record's own value and keeps everything already in it, so a column
 * filtered to ANZCO's Kokiri spaces still shows them after revealing an Alliance Group one.
 *
 * `weekCommencing` and `hasUnmatched` cannot be widened by addition and are cleared instead: one
 * delivery week and "must have unmatched quantity" are both all-or-nothing clauses, and clearing is
 * the smallest change that can make the record visible at all.
 */
export function widenForSpace(space: ProcessorSpaceDto, filters: DemandFilters): DemandFilters {
  const hiding = new Set(clausesHidingSpace(space, filters));

  return {
    statuses: hiding.has('statuses') ? [...filters.statuses, space.status] : filters.statuses,
    processors: hiding.has('processors')
      ? [...filters.processors, space.processor]
      : filters.processors,
    plants: hiding.has('plants') ? [...filters.plants, space.plant] : filters.plants,
    stockClasses: hiding.has('stockClasses')
      ? [...filters.stockClasses, space.stockClass]
      : filters.stockClasses,
    weekCommencing: hiding.has('weekCommencing') ? null : filters.weekCommencing,
    hasUnmatched: hiding.has('hasUnmatched') ? false : filters.hasUnmatched,
  };
}

/** @see widenForSpace */
export function widenForAvailability(
  record: LivestockAvailabilityDto,
  filters: SupplyFilters,
): SupplyFilters {
  const hiding = new Set(clausesHidingAvailability(record, filters));

  return {
    statuses: hiding.has('statuses') ? [...filters.statuses, record.status] : filters.statuses,
    stockClasses: hiding.has('stockClasses')
      ? [...filters.stockClasses, record.stockClass]
      : filters.stockClasses,
    locationIds: hiding.has('locationIds')
      ? [...filters.locationIds, record.locationId]
      : filters.locationIds,
    transactionTypes: hiding.has('transactionTypes')
      ? [...filters.transactionTypes, record.transactionType]
      : filters.transactionTypes,
    hasUnmatched: hiding.has('hasUnmatched') ? false : filters.hasUnmatched,
  };
}

// ---------------------------------------------------------------------------------------------
// Sorting — always within the week bands, never across them
// ---------------------------------------------------------------------------------------------

/**
 * Sorting is applied to the flat list *before* `buildBoard` bands it, and `buildBoard` preserves the
 * order it is given inside each band. So a sort reorders the cards **inside** each week and can never
 * dissolve the bands (requirement 4.3): the band sequence comes from the server's calendar and has
 * nothing to do with this file.
 *
 * There is deliberately no "ungrouped" mode. 4.3 permits offering one; the chronological band order
 * is the spine of the screen and the backlog above the current week only means anything while the
 * bands are intact.
 */
export function sortSpaces(
  spaces: readonly ProcessorSpaceDto[],
  sort: Sort<DemandSortField>,
): ProcessorSpaceDto[] {
  return sorted(spaces, sort.direction, (a, b) =>
    compare(spaceKey(a, sort.field), spaceKey(b, sort.field)),
  );
}

export function sortAvailability(
  records: readonly LivestockAvailabilityDto[],
  sort: Sort<SupplySortField>,
): LivestockAvailabilityDto[] {
  return sorted(records, sort.direction, (a, b) =>
    compare(availabilityKey(a, sort.field), availabilityKey(b, sort.field)),
  );
}

/**
 * Ties always break on id, ascending, whichever way the sort runs.
 *
 * That is the server's own order, so an unsorted-by-that-field group keeps the arrangement it
 * arrived in, and two runs over the same data always produce the same screen.
 */
function sorted<T extends { readonly id: number }>(
  items: readonly T[],
  direction: 'asc' | 'desc',
  compareItems: (a: T, b: T) => number,
): T[] {
  const factor = direction === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    const primary = compareItems(a, b);

    return primary === 0 ? compare(a.id, b.id) : primary * factor;
  });
}

/** The value a record sorts on. A null string sorts as empty, so blanks group at one end. */
function spaceKey(space: ProcessorSpaceDto, field: DemandSortField): string | number {
  switch (field) {
    case 'processor':
      return space.processor;
    case 'plant':
      return space.plant;
    case 'stockClass':
      return space.stockClass;
    case 'deliveryTime':
      return space.deliveryTime ?? '';
    case 'quantityRequired':
      return space.quantityRequired;
    case 'unmatched':
      return space.unmatched;
    case 'matches':
      return space.matches.length;
    case 'status':
      return statusRank(space.status);
    default:
      return space.deliveryDate;
  }
}

function availabilityKey(
  record: LivestockAvailabilityDto,
  field: SupplySortField,
): string | number {
  switch (field) {
    case 'locationName':
      return record.locationName ?? '';
    case 'farmerName':
      return record.farmerName ?? '';
    case 'stockClass':
      return record.stockClass;
    case 'transactionType':
      return transactionTypeLabel(record.transactionType);
    case 'quantityAvailable':
      return record.quantityAvailable;
    case 'unmatched':
      return record.unmatched;
    case 'matches':
      return record.matches.length;
    case 'status':
      return statusRank(record.status);
    default:
      return record.availableFrom;
  }
}

/** Unknown statuses sort last rather than throwing: a screen is not the place to police an enum. */
function statusRank(status: string): number {
  return STATUS_RANK.get(status) ?? STATUS_RANK.size;
}

/**
 * `<` and `>`, never `a - b`. Subtraction on `unmatched` or `quantityRequired` is arithmetic on a
 * domain value and `no-domain-arithmetic.spec.ts` fails it — correctly, because that is exactly the
 * shape of accidentally recomputing one.
 *
 * Strings compare with `localeCompare` so case and the macrons in New Zealand place names sort the
 * way a reader expects rather than the way their code points do.
 */
function compare(a: string | number, b: string | number): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'en-NZ', { sensitivity: 'base', numeric: true });
  }

  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
// Reading filter state back: away-from-default, the More count, and the empty state's summary
// ---------------------------------------------------------------------------------------------

/**
 * Whether a column is in its default state, which is what decides the `Filtered` chip and the
 * `Reset` button (requirement 6.2, design-system.md 12.3).
 *
 * Selections compare as sets. Picking `Pending` and then `Booked` leaves `['Pending', 'Booked']`,
 * which is the supply default in a different order and must not read as "filtered" — an operator who
 * has arrived back at the defaults by hand is at the defaults.
 */
export function isDemandDefault(filters: DemandFilters, sort: Sort<DemandSortField>): boolean {
  return (
    sameValues(filters.statuses, DEFAULT_DEMAND_FILTERS.statuses) &&
    sameValues(filters.processors, DEFAULT_DEMAND_FILTERS.processors) &&
    sameValues(filters.plants, DEFAULT_DEMAND_FILTERS.plants) &&
    sameValues(filters.stockClasses, DEFAULT_DEMAND_FILTERS.stockClasses) &&
    filters.weekCommencing === DEFAULT_DEMAND_FILTERS.weekCommencing &&
    filters.hasUnmatched === DEFAULT_DEMAND_FILTERS.hasUnmatched &&
    sameSort(sort, DEFAULT_DEMAND_SORT)
  );
}

export function isSupplyDefault(filters: SupplyFilters, sort: Sort<SupplySortField>): boolean {
  return (
    sameValues(filters.statuses, DEFAULT_SUPPLY_FILTERS.statuses) &&
    sameValues(filters.stockClasses, DEFAULT_SUPPLY_FILTERS.stockClasses) &&
    sameValues(filters.locationIds, DEFAULT_SUPPLY_FILTERS.locationIds) &&
    sameValues(filters.transactionTypes, DEFAULT_SUPPLY_FILTERS.transactionTypes) &&
    filters.hasUnmatched === DEFAULT_SUPPLY_FILTERS.hasUnmatched &&
    sameSort(sort, DEFAULT_SUPPLY_SORT)
  );
}

function sameValues<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function sameSort<TField extends string>(a: Sort<TField>, b: Sort<TField>): boolean {
  return a.field === b.field && a.direction === b.direction;
}

/**
 * How many of the filters behind the `More` chip are currently restricting the list.
 *
 * **Only the ones actually inside `More`.** Processor (demand) and Location (supply) have chips of
 * their own on the row and show their own state there, so counting them here would say a filter is
 * hidden when it is in plain sight. Every control has exactly one home.
 *
 * "Restricting", not "away from default": the supply column opens with `Has unmatched quantity` on,
 * so it opens reading `More (1)`. That is the honest number — it is the one default that actually
 * hides records, and design-system.md 12.2 wants the defaults visible on the chip faces precisely so
 * nobody concludes a record has vanished.
 */
export function demandMoreCount(filters: DemandFilters): number {
  return countActive([
    filters.plants.length > 0,
    filters.weekCommencing !== null,
    filters.hasUnmatched,
  ]);
}

export function supplyMoreCount(filters: SupplyFilters): number {
  return countActive([filters.transactionTypes.length > 0, filters.hasUnmatched]);
}

function countActive(flags: readonly boolean[]): number {
  return flags.filter(Boolean).length;
}

/** One line of the empty state's restated filters: `Status` / `Booked, Confirmed`. */
export interface ActiveFilter {
  readonly label: string;
  readonly value: string;
}

/**
 * The active filters, in words, for design-system.md 13's empty state.
 *
 * "No results" without the reason is how an operator concludes the app is broken, so the state
 * restates what is actually being applied — including the defaults, which are the likeliest cause of
 * a record appearing to have vanished.
 *
 * The week takes a lookup rather than the raw ISO value: `2026-08-23` is not a thing to show a
 * person, and the label beside it is the server's (`23-08-26`). Nothing here formats a date.
 */
export function activeDemandFilters(
  filters: DemandFilters,
  weekLabels: ReadonlyMap<string, string>,
): ActiveFilter[] {
  const active: ActiveFilter[] = [];

  addList(active, 'Status', filters.statuses);
  addList(active, 'Processor', filters.processors);
  addList(active, 'Plant', filters.plants);
  addList(active, 'Stock class', filters.stockClasses);

  if (filters.weekCommencing !== null) {
    active.push({
      label: 'Delivery week',
      value: weekLabels.get(filters.weekCommencing) ?? filters.weekCommencing,
    });
  }

  if (filters.hasUnmatched) {
    active.push({ label: 'Quantity unmatched', value: 'more than zero' });
  }

  return active;
}

export function activeSupplyFilters(
  filters: SupplyFilters,
  locationNames: ReadonlyMap<number, string>,
): ActiveFilter[] {
  const active: ActiveFilter[] = [];

  addList(active, 'Status', filters.statuses);
  addList(active, 'Stock class', filters.stockClasses);
  addList(
    active,
    'Location',
    filters.locationIds.map((id) => locationNames.get(id) ?? `#${id}`),
  );
  addList(active, 'Transaction type', filters.transactionTypes.map(transactionTypeLabel));

  if (filters.hasUnmatched) {
    active.push({ label: 'Quantity unmatched', value: 'more than zero' });
  }

  return active;
}

function addList(into: ActiveFilter[], label: string, values: readonly string[]): void {
  if (values.length > 0) {
    into.push({ label, value: values.join(', ') });
  }
}
