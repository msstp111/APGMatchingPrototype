import {
  LivestockAvailabilityStatus,
  ProcessorSpaceStatus,
  TransactionType,
} from '../../api/models';

/**
 * The shape of each column's filter and sort state, and **the one place its defaults are written
 * down**.
 *
 * Requirement 4.2 asks for "a single exported constants module in `web/`" and requirement 6.1 asks
 * for a reset that returns a column to those defaults. Both the store's initial state and its
 * `reset()` read the constants below, so the two cannot drift apart — and `filter-defaults.spec.ts`
 * asserts exactly that by comparing against these objects rather than by restating the values, since
 * a test that repeats the numbers is simply a second copy of them.
 *
 * Everything here is frozen. A default that can be mutated in place is a default that lasts until
 * the first careless `filters.statuses.push(...)`.
 */

export type SortDirection = 'asc' | 'desc';

export interface Sort<TField extends string> {
  readonly field: TField;
  readonly direction: SortDirection;
}

/** Every field the demand card displays, plus the date its week band comes from. Requirement 4.1. */
export type DemandSortField =
  | 'deliveryDate'
  | 'processor'
  | 'plant'
  | 'stockClass'
  | 'deliveryTime'
  | 'quantityRequired'
  | 'unmatched'
  | 'matches'
  | 'status';

/** Likewise for supply, where `availableFrom` is the date the record is banded on. */
export type SupplySortField =
  | 'availableFrom'
  | 'locationName'
  | 'farmerName'
  | 'stockClass'
  | 'transactionType'
  | 'quantityAvailable'
  | 'unmatched'
  | 'matches'
  | 'status';

/**
 * An empty array means "no restriction", which is what lets a chip read `Stock class: All` without
 * needing a separate "all" sentinel among the values.
 */
export interface DemandFilters {
  readonly statuses: readonly ProcessorSpaceStatus[];
  readonly processors: readonly string[];
  readonly plants: readonly string[];
  readonly stockClasses: readonly string[];
  /** One week-commencing Sunday as an ISO `yyyy-MM-dd` string, or null for every week. */
  readonly weekCommencing: string | null;
  readonly hasUnmatched: boolean;
}

/**
 * **There is deliberately no week field here** (resolved question 17, PHASE-4 section 3).
 *
 * An availability record is a *state*, not an event: it becomes available on a date and stays
 * available until it is used up. Filtering supply to one week would hide every older record that
 * still holds unmatched stock — exactly the records the scroll-up backlog exists to surface — so the
 * filter would quietly remove matchable supply, which is worse than having no filter at all. A
 * cumulative "available by" variant was considered and declined for the same reason.
 *
 * `filter-defaults.spec.ts` fails if any key of `DEFAULT_SUPPLY_FILTERS` ever matches /week/i.
 */
export interface SupplyFilters {
  readonly statuses: readonly LivestockAvailabilityStatus[];
  readonly stockClasses: readonly string[];
  /** Location ids, not names: the id is what the record carries, and names need not be unique. */
  readonly locationIds: readonly number[];
  readonly transactionTypes: readonly TransactionType[];
  readonly hasUnmatched: boolean;
}

// ---------------------------------------------------------------------------------------------
// The defaults. Both columns open in these, and Reset returns a column to exactly these.
// ---------------------------------------------------------------------------------------------

/** `Status = Booked`, per the spec and design-system.md 12.2. */
export const DEFAULT_DEMAND_FILTERS: DemandFilters = Object.freeze({
  statuses: Object.freeze<ProcessorSpaceStatus[]>(['Booked']),
  processors: Object.freeze<string[]>([]),
  plants: Object.freeze<string[]>([]),
  stockClasses: Object.freeze<string[]>([]),
  weekCommencing: null,
  hasUnmatched: false,
});

/**
 * `Status in (Booked, Pending)` **and** `Unmatched > 0`.
 *
 * The `hasUnmatched` clause drops more than Confirmed records: a Pending record with all of its
 * supply allocated but some matches unconfirmed leaves the column too. On a *matching* screen that
 * is right, because there is nothing left to match. The backlog means "supply still to allocate",
 * not "everything unfinished".
 */
export const DEFAULT_SUPPLY_FILTERS: SupplyFilters = Object.freeze({
  statuses: Object.freeze<LivestockAvailabilityStatus[]>(['Booked', 'Pending']),
  stockClasses: Object.freeze<string[]>([]),
  locationIds: Object.freeze<number[]>([]),
  transactionTypes: Object.freeze<TransactionType[]>([]),
  hasUnmatched: true,
});

/**
 * Soonest first, by delivery date, ties breaking on id.
 *
 * Requirement 4.2's literal wording is "delivery date then delivery time". `deliveryTime` is free
 * text — `AM kill`, `Yard by 6:30am`, `Before midday` — so ordering by it alphabetically is not
 * chronological: it would put the 6:30am delivery last and read as a bug. Ties therefore break on
 * id, which is the server's own order. Delivery time is still offered as a sort field, because
 * requirement 4.1 asks for every displayed field, and its ordering is alphabetical. Genuinely
 * chronological delivery times need a sortable field on the record, which is a data change and not
 * a sort change.
 */
export const DEFAULT_DEMAND_SORT: Sort<DemandSortField> = Object.freeze({
  field: 'deliveryDate',
  direction: 'asc',
});

/** Soonest first, by available-from date. */
export const DEFAULT_SUPPLY_SORT: Sort<SupplySortField> = Object.freeze({
  field: 'availableFrom',
  direction: 'asc',
});

/** Processor Spaces on the left, per the spec. Flipping is the operator's to do (requirement 5). */
export const DEFAULT_FLIPPED = false;

// ---------------------------------------------------------------------------------------------
// "Clear filters" is not the same thing as "Reset to default"
// ---------------------------------------------------------------------------------------------

/**
 * Everything off, so every loaded record is shown.
 *
 * design-system.md 13 offers both `Clear filters` and `Reset to default` on the empty state, and the
 * two are genuinely different: clearing shows *everything*, including the Confirmed and Cancelled
 * records the default deliberately hides. An operator who has filtered themselves into an empty
 * column usually wants to see what is actually there, which is not the same as starting again.
 */
export const CLEARED_DEMAND_FILTERS: DemandFilters = Object.freeze({
  statuses: Object.freeze<ProcessorSpaceStatus[]>([]),
  processors: Object.freeze<string[]>([]),
  plants: Object.freeze<string[]>([]),
  stockClasses: Object.freeze<string[]>([]),
  weekCommencing: null,
  hasUnmatched: false,
});

export const CLEARED_SUPPLY_FILTERS: SupplyFilters = Object.freeze({
  statuses: Object.freeze<LivestockAvailabilityStatus[]>([]),
  stockClasses: Object.freeze<string[]>([]),
  locationIds: Object.freeze<number[]>([]),
  transactionTypes: Object.freeze<TransactionType[]>([]),
  hasUnmatched: false,
});

// ---------------------------------------------------------------------------------------------
// The sort menus
// ---------------------------------------------------------------------------------------------

export interface SortFieldOption<TField extends string> {
  readonly field: TField;
  readonly label: string;
  /** What ascending means in words, so the control reads `Soonest` rather than `asc`. */
  readonly ascending: string;
  readonly descending: string;
}

export const DEMAND_SORT_FIELDS: readonly SortFieldOption<DemandSortField>[] = Object.freeze([
  { field: 'deliveryDate', label: 'Delivery date', ascending: 'Soonest', descending: 'Latest' },
  { field: 'processor', label: 'Processor', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'plant', label: 'Plant', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'stockClass', label: 'Stock class', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'deliveryTime', label: 'Delivery time', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'quantityRequired', label: 'Required', ascending: 'Fewest', descending: 'Most' },
  { field: 'unmatched', label: 'Unmatched', ascending: 'Fewest', descending: 'Most' },
  { field: 'matches', label: 'Matches', ascending: 'Fewest', descending: 'Most' },
  { field: 'status', label: 'Status', ascending: 'Booked first', descending: 'Cancelled first' },
]);

export const SUPPLY_SORT_FIELDS: readonly SortFieldOption<SupplySortField>[] = Object.freeze([
  { field: 'availableFrom', label: 'Available from', ascending: 'Soonest', descending: 'Latest' },
  { field: 'locationName', label: 'Location', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'farmerName', label: 'Farmer', ascending: 'A to Z', descending: 'Z to A' },
  { field: 'stockClass', label: 'Stock class', ascending: 'A to Z', descending: 'Z to A' },
  {
    field: 'transactionType',
    label: 'Transaction type',
    ascending: 'A to Z',
    descending: 'Z to A',
  },
  { field: 'quantityAvailable', label: 'Available', ascending: 'Fewest', descending: 'Most' },
  { field: 'unmatched', label: 'Unmatched', ascending: 'Fewest', descending: 'Most' },
  { field: 'matches', label: 'Matches', ascending: 'Fewest', descending: 'Most' },
  { field: 'status', label: 'Status', ascending: 'Booked first', descending: 'Cancelled first' },
]);

/**
 * Every status either side can hold — the type's members, not the loaded data's.
 *
 * A status the working set happens not to contain today still belongs on the menu: an operator
 * ticking `Cancelled` and seeing nothing has learnt something, whereas a menu that quietly omits it
 * looks like the app cannot show cancelled records at all. Processor Space has no `Pending`
 * (resolved question 6), which is why the two lists differ.
 */
export const DEMAND_STATUSES: readonly ProcessorSpaceStatus[] = Object.freeze<
  ProcessorSpaceStatus[]
>(['Booked', 'Confirmed', 'Cancelled']);

export const SUPPLY_STATUSES: readonly LivestockAvailabilityStatus[] = Object.freeze<
  LivestockAvailabilityStatus[]
>(['Booked', 'Pending', 'Confirmed', 'Cancelled']);

/**
 * The transaction types, in one place for the same reason the statuses are.
 *
 * `matching-preferences.ts` validates stored values against this. A hand-typed copy there would
 * satisfy the compiler while silently rejecting any member added later, so the list lives here with
 * the other closed sets.
 */
export const TRANSACTION_TYPES: readonly TransactionType[] = Object.freeze<TransactionType[]>([
  'FinanceStock',
  'GrazingStock',
  'Other',
]);

/**
 * Lifecycle order, for the status sort. Alphabetical would read
 * `Booked, Cancelled, Confirmed, Pending`, which is no order at all.
 */
export const STATUS_RANK: ReadonlyMap<string, number> = new Map([
  ['Booked', 0],
  ['Pending', 1],
  ['Confirmed', 2],
  ['Cancelled', 3],
]);
