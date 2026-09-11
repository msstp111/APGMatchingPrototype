import { computed, Injectable, signal } from '@angular/core';
import {
  CLEARED_DEMAND_FILTERS,
  CLEARED_SUPPLY_FILTERS,
  DemandFilters,
  DemandSortField,
  DEFAULT_DEMAND_FILTERS,
  DEFAULT_DEMAND_SORT,
  DEFAULT_DRAG_ANYWHERE,
  DEFAULT_KEEP_GRIPS,
  DEFAULT_FILTER_ON_DRAG,
  DEFAULT_FLIPPED,
  DEFAULT_SUPPLY_FILTERS,
  DEFAULT_SUPPLY_SORT,
  DEMAND_SORT_FIELDS,
  DEMAND_STATUSES,
  Sort,
  SortDirection,
  SUPPLY_SORT_FIELDS,
  SUPPLY_STATUSES,
  SupplyFilters,
  SupplySortField,
  TRANSACTION_TYPES,
} from './filter-defaults';

/**
 * The operator's view preferences: what each column is filtered and sorted by, and which side sits on
 * the left.
 *
 * These are **UI preferences, not domain data** (requirement 7.1), which is the entire reason they
 * may live in the browser at all. Nothing here is a record, a match or a quantity; nothing here is
 * ever sent to the API. Card expansion deliberately stays in `CardStateStore` and stays session-only
 * — a filter still applied tomorrow is a convenience, a card still expanded tomorrow is a mystery.
 *
 * Root-provided, so the preferences survive navigating away from the matching screen and back.
 */

/** One key holds the lot, so a partial write cannot leave two halves disagreeing. */
export const PREFERENCES_STORAGE_KEY = 'apg.matching.preferences.v2';

const STORAGE_VERSION = 2;

export interface MatchingViewPreferences {
  readonly flipped: boolean;
  /**
   * Whether grabbing a card narrows the far column to the stock classes it could be matched with
   * (`drag/drag-narrowing.ts`).
   *
   * A view preference like every other field here — it hides nothing permanently, changes no record,
   * and is never sent to the API — which is why it may live in the browser at all. It sits beside
   * `flipped` rather than inside either column's filters because it belongs to neither: one switch
   * governs both directions, and it is set from the top bar rather than from a column's filter row.
   */
  readonly filterOnDrag: boolean;
  /**
   * Whether a card's middle region drags as well as expands (`drag/card-press.ts`).
   *
   * Beside `filterOnDrag` for the same reasons — one switch, both columns, set from the top bar — and
   * independent of it: either, neither or both. Off restores the row exactly as it has behaved since
   * 2026-09-07, with the grip as the only way to start a drag.
   */
  readonly dragAnywhere: boolean;
  /**
   * Whether the cards keep their drag grips while `dragAnywhere` is on.
   *
   * Only ever consulted through {@link MatchingPreferences.gripsVisible} — on its own it is half a
   * question, because with `dragAnywhere` off the grips are the only drag path and are shown
   * whatever this says.
   */
  readonly keepGrips: boolean;
  readonly demand: { readonly filters: DemandFilters; readonly sort: Sort<DemandSortField> };
  readonly supply: { readonly filters: SupplyFilters; readonly sort: Sort<SupplySortField> };
}

const DEFAULTS: MatchingViewPreferences = {
  flipped: DEFAULT_FLIPPED,
  filterOnDrag: DEFAULT_FILTER_ON_DRAG,
  dragAnywhere: DEFAULT_DRAG_ANYWHERE,
  keepGrips: DEFAULT_KEEP_GRIPS,
  demand: { filters: DEFAULT_DEMAND_FILTERS, sort: DEFAULT_DEMAND_SORT },
  supply: { filters: DEFAULT_SUPPLY_FILTERS, sort: DEFAULT_SUPPLY_SORT },
};

@Injectable({ providedIn: 'root' })
export class MatchingPreferences {
  private readonly state = signal<MatchingViewPreferences>(readStored());

  readonly flipped = computed(() => this.state().flipped);
  readonly filterOnDrag = computed(() => this.state().filterOnDrag);
  readonly dragAnywhere = computed(() => this.state().dragAnywhere);
  readonly keepGrips = computed(() => this.state().keepGrips);

  /**
   * Whether the cards draw their 30px drag grips — **the only question the cards should ask**.
   *
   * Derived here rather than in each card, because it is a safety rule and not a preference: a
   * screen where the grips are gone AND the middle region is inert has no way to start a drag at
   * all. Expressed as a conjunction, that state is unreachable however the two flags are set, and
   * it is unreachable in one place instead of two components that could drift.
   *
   * The grip therefore keeps its promise from 2026-09-07 in the only form that still means
   * anything: wherever it is drawn, it drags, unconditionally.
   */
  readonly gripsVisible = computed(() => !this.dragAnywhere() || this.keepGrips());
  readonly demandFilters = computed(() => this.state().demand.filters);
  readonly demandSort = computed(() => this.state().demand.sort);
  readonly supplyFilters = computed(() => this.state().supply.filters);
  readonly supplySort = computed(() => this.state().supply.sort);

  setDemandFilters(filters: DemandFilters): void {
    this.commit({ ...this.state(), demand: { ...this.state().demand, filters } });
  }

  setDemandSort(sort: Sort<DemandSortField>): void {
    this.commit({ ...this.state(), demand: { ...this.state().demand, sort } });
  }

  setSupplyFilters(filters: SupplyFilters): void {
    this.commit({ ...this.state(), supply: { ...this.state().supply, filters } });
  }

  setSupplySort(sort: Sort<SupplySortField>): void {
    this.commit({ ...this.state(), supply: { ...this.state().supply, sort } });
  }

  /** Purely presentational (requirement 5.2): nothing else in this object moves. */
  toggleFlipped(): void {
    this.commit({ ...this.state(), flipped: !this.state().flipped });
  }

  /**
   * Switches the drag-time stock-class narrowing on or off. Set from the top bar, next to
   * "Reset demo data" — it governs both columns, so it belongs to neither column's filter row.
   */
  toggleFilterOnDrag(): void {
    this.commit({ ...this.state(), filterOnDrag: !this.state().filterOnDrag });
  }

  /**
   * Switches the middle region's drag on or off. Set from the top bar beside "Filter on drag", and
   * for the same reason: it governs both columns, so it belongs to neither column's filter row.
   */
  toggleDragAnywhere(): void {
    this.commit({ ...this.state(), dragAnywhere: !this.state().dragAnywhere });
  }

  /**
   * Puts the grips back, or takes them away again, while "Drag anywhere" is on.
   *
   * Deliberately does **not** guard on `dragAnywhere`. The stored flag is the operator's standing
   * answer and it survives switching the drag off and on again; what guards the screen is
   * {@link gripsVisible}, and the top bar disables the control rather than letting a press mean
   * nothing.
   */
  toggleKeepGrips(): void {
    this.commit({ ...this.state(), keepGrips: !this.state().keepGrips });
  }

  /**
   * Requirement 6.1. Assigns the exported default constants themselves, so "the default state" and
   * "what reset produces" are the same objects and cannot drift apart.
   */
  resetDemand(): void {
    this.commit({
      ...this.state(),
      demand: { filters: DEFAULT_DEMAND_FILTERS, sort: DEFAULT_DEMAND_SORT },
    });
  }

  resetSupply(): void {
    this.commit({
      ...this.state(),
      supply: { filters: DEFAULT_SUPPLY_FILTERS, sort: DEFAULT_SUPPLY_SORT },
    });
  }

  /** The empty state's other way out: show everything, including what the default hides. */
  clearDemand(): void {
    this.setDemandFilters(CLEARED_DEMAND_FILTERS);
  }

  clearSupply(): void {
    this.setSupplyFilters(CLEARED_SUPPLY_FILTERS);
  }

  private commit(next: MatchingViewPreferences): void {
    this.state.set(next);
    write(next);
  }
}

// ---------------------------------------------------------------------------------------------
// Storage — defensive in both directions
// ---------------------------------------------------------------------------------------------

/**
 * Forgets every stored view preference, so the next load opens at the defaults.
 *
 * Exported as a plain function rather than a method because the caller is Phase 8's "Reset demo data"
 * control in the shell, which reloads the page immediately afterwards — there is no live store left
 * to update, and injecting one to clear a key it is about to lose would be ceremony. Requirement 1.1
 * asks the reset to clear the stored UI preferences as well as the database; this is that half.
 */
export function clearStoredPreferences(): void {
  try {
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    // Storage disabled: there was nothing stored to clear.
  }
}

function write(preferences: MatchingViewPreferences): void {
  try {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, ...preferences }),
    );
  } catch {
    // A browser with storage disabled still gets a working screen; it just forgets between visits.
  }
}

/**
 * Reads the stored preferences, falling back **field by field** rather than all or nothing.
 *
 * Everything in storage is untrusted: it survives a reseed, an upgrade and anyone with a devtools
 * console. A stock class that no longer exists is harmless — it filters nothing out and the empty
 * state restates it — but an unknown sort field would leave the column sorted by nothing at all, and
 * a malformed status array would filter out every record with no visible cause. So each field is
 * validated against the same constants the defaults come from, and anything unrecognised is replaced
 * by that field's default.
 */
function readStored(): MatchingViewPreferences {
  const raw = readRaw();
  if (raw === null) {
    return DEFAULTS;
  }

  const demand = record(raw['demand']);
  const supply = record(raw['supply']);

  return {
    flipped: boolean(raw['flipped'], DEFAULTS.flipped),
    filterOnDrag: boolean(raw['filterOnDrag'], DEFAULTS.filterOnDrag),
    dragAnywhere: boolean(raw['dragAnywhere'], DEFAULTS.dragAnywhere),
    keepGrips: boolean(raw['keepGrips'], DEFAULTS.keepGrips),
    demand: {
      filters: readDemandFilters(record(demand['filters'])),
      sort: readSort(record(demand['sort']), DEFAULT_DEMAND_SORT, knownDemandSortFields),
    },
    supply: {
      filters: readSupplyFilters(record(supply['filters'])),
      sort: readSort(record(supply['sort']), DEFAULT_SUPPLY_SORT, knownSupplySortFields),
    },
  };
}

function readRaw(): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);

    // A version this build does not know is not worth guessing at; the defaults are always safe.
    return isRecord(parsed) && parsed['version'] === STORAGE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function readDemandFilters(stored: Record<string, unknown>): DemandFilters {
  return {
    statuses: strings(stored['statuses'], DEMAND_STATUSES, DEFAULT_DEMAND_FILTERS.statuses),
    processors: freeStrings(stored['processors'], DEFAULT_DEMAND_FILTERS.processors),
    plants: freeStrings(stored['plants'], DEFAULT_DEMAND_FILTERS.plants),
    stockClasses: freeStrings(stored['stockClasses'], DEFAULT_DEMAND_FILTERS.stockClasses),
    weekCommencing:
      typeof stored['weekCommencing'] === 'string'
        ? stored['weekCommencing']
        : DEFAULT_DEMAND_FILTERS.weekCommencing,
    hasUnmatched: boolean(stored['hasUnmatched'], DEFAULT_DEMAND_FILTERS.hasUnmatched),
  };
}

function readSupplyFilters(stored: Record<string, unknown>): SupplyFilters {
  return {
    statuses: strings(stored['statuses'], SUPPLY_STATUSES, DEFAULT_SUPPLY_FILTERS.statuses),
    stockClasses: freeStrings(stored['stockClasses'], DEFAULT_SUPPLY_FILTERS.stockClasses),
    locationIds: numbers(stored['locationIds'], DEFAULT_SUPPLY_FILTERS.locationIds),
    transactionTypes: strings(
      stored['transactionTypes'],
      TRANSACTION_TYPES,
      DEFAULT_SUPPLY_FILTERS.transactionTypes,
    ),
    hasUnmatched: boolean(stored['hasUnmatched'], DEFAULT_SUPPLY_FILTERS.hasUnmatched),
  };
}

function readSort<TField extends string>(
  stored: Record<string, unknown>,
  fallback: Sort<TField>,
  known: readonly string[],
): Sort<TField> {
  const field = stored['field'];
  const direction = stored['direction'];

  if (typeof field !== 'string' || !known.includes(field)) {
    return fallback;
  }

  return {
    field: field as TField,
    direction: direction === 'asc' || direction === 'desc' ? (direction as SortDirection) : 'asc',
  };
}

const knownDemandSortFields = DEMAND_SORT_FIELDS.map((option) => option.field as string);
const knownSupplySortFields = SUPPLY_SORT_FIELDS.map((option) => option.field as string);

/** Values constrained to a known set — a status, a transaction type. Unknown members are dropped. */
function strings<T extends string>(
  stored: unknown,
  known: readonly T[],
  fallback: readonly T[],
): readonly T[] {
  if (!Array.isArray(stored)) {
    return fallback;
  }

  return stored.filter(
    (value): value is T => typeof value === 'string' && known.includes(value as T),
  );
}

/**
 * Values with no known set — a stock class, a processor, a plant.
 *
 * These are kept even when the loaded data no longer contains them. A stale value filters nothing in
 * rather than filtering everything out, the empty state restates it, and silently dropping a
 * selection the operator made is worse than showing one that matches nothing.
 */
function freeStrings(stored: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(stored)) {
    return fallback;
  }

  return stored.filter((value): value is string => typeof value === 'string');
}

function numbers(stored: unknown, fallback: readonly number[]): readonly number[] {
  if (!Array.isArray(stored)) {
    return fallback;
  }

  return stored.filter((value): value is number => typeof value === 'number' && isFinite(value));
}

function boolean(stored: unknown, fallback: boolean): boolean {
  return typeof stored === 'boolean' ? stored : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
