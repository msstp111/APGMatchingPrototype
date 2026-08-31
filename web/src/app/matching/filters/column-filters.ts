import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import {
  LivestockAvailabilityDto,
  LivestockAvailabilityStatus,
  ProcessorSpaceDto,
  ProcessorSpaceStatus,
  TransactionType,
} from '../../api/models';
import { MatchSide } from '../board/matching-board';
import {
  DEMAND_SORT_FIELDS,
  DemandSortField,
  SortFieldOption,
  SUPPLY_SORT_FIELDS,
  SupplySortField,
} from './filter-defaults';
import {
  demandFilterOptions,
  narrowDemandFilters,
  Option,
  supplyFilterOptions,
} from './filter-options';
import { demandMoreCount, supplyMoreCount } from './filter-service';
import { MatchingPreferences } from './matching-preferences';

/**
 * One column's 40px filter row (design-system.md 12.2).
 *
 * ```
 * [ Status: Booked ] [ Stock class: All ] [ Processor: All ] [ More (1) ]   Soonest
 * ```
 *
 * Every control is the same shape: a chip that shows its current value without being opened, and a
 * `mat-menu` behind it. That uniformity is deliberate on three counts. It keeps the whole row inside
 * 40px, which is the height Phase 3 reserved and the density arithmetic assumes; it means the two
 * columns are the same component with a different `side`, so their controls cannot drift apart; and
 * it avoids opening a `mat-select` inside a `mat-menu`, which is an overlay inside an overlay and the
 * one Material arrangement in this design that would have been fragile.
 *
 * **Deviation from design-system.md 12.2**, recorded rather than silent: the document describes
 * `More` as opening "a second row" of `appearance="fill"` selects. A second row costs 40px of a 596px
 * list — a card per column, which section 8.3 says to protect — so `More` opens a menu with a submenu
 * per field instead. The one form field in here is the location type-ahead, which is
 * `appearance="fill"` as the document requires.
 *
 * **There is no week filter on the supply side and there must never be one** (resolved question 17):
 * supply is a state, not an event, and filtering it to a week hides the older unmatched records the
 * backlog exists to surface. The demand side keeps its `Delivery week`, because a delivery date
 * genuinely is a single-week event.
 */
@Component({
  selector: 'app-column-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatMenuModule],
  templateUrl: './column-filters.html',
  styleUrl: './column-filters.scss',
})
export class ColumnFilters {
  private readonly preferences = inject(MatchingPreferences);

  readonly side = input.required<MatchSide>();

  /** Exactly one of these is set, matching the convention `app-card-expansion` already uses. */
  readonly spaces = input<readonly ProcessorSpaceDto[]>([]);
  readonly availability = input<readonly LivestockAvailabilityDto[]>([]);

  readonly isDemand = computed(() => this.side() === 'demand');

  /** Options come from the unfiltered working set, so ticking a box never empties the menus. */
  readonly demandOptions = computed(() =>
    demandFilterOptions(this.spaces(), this.preferences.demandFilters()),
  );

  readonly supplyOptions = computed(() => supplyFilterOptions(this.availability()));

  // --- status ---------------------------------------------------------------------------------

  readonly statusOptions = computed<readonly string[]>(() =>
    this.isDemand() ? this.demandOptions().statuses : this.supplyOptions().statuses,
  );

  readonly selectedStatuses = computed<readonly string[]>(() =>
    this.isDemand()
      ? this.preferences.demandFilters().statuses
      : this.preferences.supplyFilters().statuses,
  );

  readonly statusSummary = computed(() => summarise(this.selectedStatuses()));

  toggleStatus(status: string): void {
    if (this.isDemand()) {
      const filters = this.preferences.demandFilters();
      this.preferences.setDemandFilters({
        ...filters,
        statuses: toggle(filters.statuses, status as ProcessorSpaceStatus),
      });

      return;
    }

    const filters = this.preferences.supplyFilters();
    this.preferences.setSupplyFilters({
      ...filters,
      statuses: toggle(filters.statuses, status as LivestockAvailabilityStatus),
    });
  }

  // --- stock class ----------------------------------------------------------------------------

  readonly stockClassOptions = computed<readonly string[]>(() =>
    this.isDemand() ? this.demandOptions().stockClasses : this.supplyOptions().stockClasses,
  );

  readonly selectedStockClasses = computed<readonly string[]>(() =>
    this.isDemand()
      ? this.preferences.demandFilters().stockClasses
      : this.preferences.supplyFilters().stockClasses,
  );

  readonly stockClassSummary = computed(() => summarise(this.selectedStockClasses()));

  toggleStockClass(stockClass: string): void {
    if (this.isDemand()) {
      const filters = this.preferences.demandFilters();
      this.preferences.setDemandFilters({
        ...filters,
        stockClasses: toggle(filters.stockClasses, stockClass),
      });

      return;
    }

    const filters = this.preferences.supplyFilters();
    this.preferences.setSupplyFilters({
      ...filters,
      stockClasses: toggle(filters.stockClasses, stockClass),
    });
  }

  // --- has unmatched quantity: the one filter both sides share ---------------------------------

  /**
   * The same rule on both sides — `unmatched > 0` — so it has one field name, one label and one
   * handler. Only the default differs: off on demand, **on** on supply (requirement 2.5), which is
   * what makes the supply column a backlog of stock still to allocate.
   */
  readonly hasUnmatched = computed(() =>
    this.isDemand()
      ? this.preferences.demandFilters().hasUnmatched
      : this.preferences.supplyFilters().hasUnmatched,
  );

  toggleHasUnmatched(): void {
    if (this.isDemand()) {
      const filters = this.preferences.demandFilters();
      this.preferences.setDemandFilters({ ...filters, hasUnmatched: !filters.hasUnmatched });

      return;
    }

    const filters = this.preferences.supplyFilters();
    this.preferences.setSupplyFilters({ ...filters, hasUnmatched: !filters.hasUnmatched });
  }

  // --- more: plant and delivery week (demand) ---------------------------------------------------

  readonly moreCount = computed(() =>
    this.isDemand()
      ? demandMoreCount(this.preferences.demandFilters())
      : supplyMoreCount(this.preferences.supplyFilters()),
  );

  readonly selectedProcessors = computed(() => this.preferences.demandFilters().processors);
  readonly selectedPlants = computed(() => this.preferences.demandFilters().plants);
  readonly selectedWeek = computed(() => this.preferences.demandFilters().weekCommencing);

  readonly processorSummary = computed(() => summarise(this.selectedProcessors()));

  /**
   * Changing the processor selection prunes any plant or stock class it has just taken off the menu.
   *
   * Leaving them would apply a filter no visible control still offers, and the column would empty for
   * a reason nothing on screen explains — the misleading view this phase exists to avoid.
   */
  toggleProcessor(processor: string): void {
    const filters = this.preferences.demandFilters();
    const next = { ...filters, processors: toggle(filters.processors, processor) };

    this.preferences.setDemandFilters(narrowDemandFilters(next, this.spaces()));
  }

  togglePlant(plant: string): void {
    const filters = this.preferences.demandFilters();

    this.preferences.setDemandFilters({ ...filters, plants: toggle(filters.plants, plant) });
  }

  /** One week or every week — a delivery date is a single-week event, so this is not multi-select. */
  selectWeek(weekCommencing: string | null): void {
    this.preferences.setDemandFilters({
      ...this.preferences.demandFilters(),
      weekCommencing,
    });
  }

  // --- location (a chip of its own) and transaction type (supply) -------------------------------

  readonly selectedLocations = computed(() => this.preferences.supplyFilters().locationIds);
  readonly selectedTransactionTypes = computed(
    () => this.preferences.supplyFilters().transactionTypes,
  );

  /** Named, not counted, when one is chosen: `Location: Bracken Downs` reads better than `1`. */
  readonly locationSummary = computed(() => {
    const selected = this.selectedLocations();
    if (selected.length === 0) {
      return 'All';
    }

    const named = this.supplyOptions().locationNames.get(selected[0]);

    return selected.length === 1 ? (named ?? 'All') : `${selected.length} selected`;
  });

  /**
   * The type-ahead of requirement 2.3: with ~300 locations the control has to narrow its own
   * *options* so one can be picked. It is a selection aid for the filter, not a free-text search of
   * the cards — there is no such search on this screen.
   */
  readonly locationQuery = signal('');

  /** Every location matching what has been typed — the menu shows the first `LOCATION_MENU_LIMIT`. */
  private readonly matchingLocations = computed<readonly Option<number>[]>(() => {
    const query = this.locationQuery().trim().toLowerCase();
    const all = this.supplyOptions().locations;

    return query === '' ? all : all.filter((option) => option.label.toLowerCase().includes(query));
  });

  readonly visibleLocations = computed<readonly Option<number>[]>(() =>
    this.matchingLocations().slice(0, LOCATION_MENU_LIMIT),
  );

  /** How many matches the menu could not show, so a capped list never pretends to be the whole list. */
  readonly hiddenLocationCount = computed(() => countBeyondLimit(this.matchingLocations().length));

  setLocationQuery(value: string): void {
    this.locationQuery.set(value);
  }

  toggleLocation(locationId: number): void {
    const filters = this.preferences.supplyFilters();

    this.preferences.setSupplyFilters({
      ...filters,
      locationIds: toggle(filters.locationIds, locationId),
    });
  }

  toggleTransactionType(type: TransactionType): void {
    const filters = this.preferences.supplyFilters();

    this.preferences.setSupplyFilters({
      ...filters,
      transactionTypes: toggle(filters.transactionTypes, type),
    });
  }

  // --- sort -----------------------------------------------------------------------------------

  readonly sortFields = computed<readonly SortFieldOption<string>[]>(() =>
    this.isDemand() ? DEMAND_SORT_FIELDS : SUPPLY_SORT_FIELDS,
  );

  readonly sort = computed(() =>
    this.isDemand() ? this.preferences.demandSort() : this.preferences.supplySort(),
  );

  readonly activeSortField = computed(() =>
    this.sortFields().find((option) => option.field === this.sort().field),
  );

  /** `Soonest` / `Most` / `A to Z` — the direction said in the field's own words, not as `asc`. */
  readonly sortSummary = computed(() => {
    const field = this.activeSortField();
    if (field === undefined) {
      return '';
    }

    return this.sort().direction === 'asc' ? field.ascending : field.descending;
  });

  readonly sortGlyph = computed(() =>
    this.sort().direction === 'asc' ? 'arrow_downward' : 'arrow_upward',
  );

  selectSortField(field: string): void {
    if (this.isDemand()) {
      this.preferences.setDemandSort({
        field: field as DemandSortField,
        direction: this.preferences.demandSort().direction,
      });

      return;
    }

    this.preferences.setSupplySort({
      field: field as SupplySortField,
      direction: this.preferences.supplySort().direction,
    });
  }

  toggleSortDirection(): void {
    if (this.isDemand()) {
      const sort = this.preferences.demandSort();
      this.preferences.setDemandSort({
        ...sort,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });

      return;
    }

    const sort = this.preferences.supplySort();
    this.preferences.setSupplySort({
      ...sort,
      direction: sort.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  // --- shared -----------------------------------------------------------------------------------

  isSelected(values: readonly unknown[], value: unknown): boolean {
    return values.includes(value);
  }

  /** A ticked box, in the outline style LMS's own icons use. No hue: these are not quantities. */
  tickGlyph(on: boolean): string {
    return on ? 'check_box' : 'check_box_outline_blank';
  }
}

/** Enough of the menu to be useful without rendering 299 buttons every time it opens. */
const LOCATION_MENU_LIMIT = 60;

function countBeyondLimit(total: number): number {
  return total > LOCATION_MENU_LIMIT ? total - LOCATION_MENU_LIMIT : 0;
}

/** `All` / the single value / `n selected` — the chip must read its own state at a glance. */
function summarise(selected: readonly string[]): string {
  if (selected.length === 0) {
    return 'All';
  }

  return selected.length === 1 ? selected[0] : `${selected.length} selected`;
}

function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((existing) => existing !== value)
    : [...values, value];
}
