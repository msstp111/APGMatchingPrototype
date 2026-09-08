import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  DEFAULT_DEMAND_FILTERS,
  DEFAULT_DEMAND_SORT,
  DEFAULT_SUPPLY_FILTERS,
  DEFAULT_SUPPLY_SORT,
} from './filter-defaults';
import { MatchingPreferences, PREFERENCES_STORAGE_KEY } from './matching-preferences';

/**
 * What survives a reload, and what happens when what survived is nonsense.
 *
 * Filter and sort choices are UI preferences rather than domain data (requirement 7.1), which is why
 * they may live in the browser at all. Everything read back out of storage is untrusted: it outlives
 * a reseed, an upgrade and anyone with a devtools console.
 */
describe('Matching preferences', () => {
  function store(): MatchingPreferences {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    return TestBed.inject(MatchingPreferences);
  }

  function stored(): Record<string, any> {
    return JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}');
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('writes every choice under one versioned key', () => {
    const preferences = store();

    preferences.setDemandFilters({ ...DEFAULT_DEMAND_FILTERS, processors: ['SFF'] });
    preferences.setSupplySort({ field: 'quantityAvailable', direction: 'desc' });
    preferences.toggleFlipped();

    expect(stored()['version']).toBe(2);
    expect(stored()['demand'].filters.processors).toEqual(['SFF']);
    expect(stored()['supply'].sort).toEqual({ field: 'quantityAvailable', direction: 'desc' });
    expect(stored()['flipped']).toBe(true);
  });

  it('reads all of it back into a fresh store, as a reload would', () => {
    const first = store();
    first.setDemandFilters({
      ...DEFAULT_DEMAND_FILTERS,
      stockClasses: ['Cows'],
      hasUnmatched: true,
    });
    first.setSupplyFilters({ ...DEFAULT_SUPPLY_FILTERS, locationIds: [7, 9] });
    first.setDemandSort({ field: 'plant', direction: 'desc' });
    first.toggleFlipped();

    const second = store();

    expect(second.demandFilters().stockClasses).toEqual(['Cows']);
    expect(second.demandFilters().hasUnmatched).toBe(true);
    expect(second.supplyFilters().locationIds).toEqual([7, 9]);
    expect(second.demandSort()).toEqual({ field: 'plant', direction: 'desc' });
    expect(second.flipped()).toBe(true);
  });

  it('falls back to the defaults when there is nothing stored', () => {
    expect(store().demandFilters()).toBe(DEFAULT_DEMAND_FILTERS);
  });

  it('falls back to the defaults when the stored value is not JSON', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, 'not json at all');

    expect(store().supplyFilters()).toBe(DEFAULT_SUPPLY_FILTERS);
  });

  it('ignores a version it does not know', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 99, flipped: true, demand: {}, supply: {} }),
    );

    expect(store().flipped()).toBe(false);
  });

  /**
   * Field by field, not all or nothing. A stale stock class is harmless — it filters nothing out and
   * the empty state restates it — but an unknown sort field would leave a column sorted by nothing,
   * and a status array full of rubbish would hide every record with no visible cause.
   */
  it('repairs individual fields rather than throwing the whole thing away', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        flipped: 'yes please',
        demand: {
          filters: {
            statuses: ['Booked', 'NotAStatus'],
            processors: 'ANZCO',
            plants: ['Rangitikei'],
            stockClasses: ['Cows'],
            weekCommencing: 17,
            hasUnmatched: 'true',
          },
          sort: { field: 'notAField', direction: 'sideways' },
        },
        supply: {
          filters: { locationIds: [7, 'eight'], transactionTypes: ['FinanceStock', 'Nonsense'] },
          sort: { field: 'locationName', direction: 'sideways' },
        },
      }),
    );

    const preferences = store();

    // Kept: the values that were usable.
    expect(preferences.demandFilters().statuses).toEqual(['Booked']);
    expect(preferences.demandFilters().plants).toEqual(['Rangitikei']);
    expect(preferences.supplyFilters().locationIds).toEqual([7]);
    expect(preferences.supplyFilters().transactionTypes).toEqual(['FinanceStock']);

    // Repaired: the values that were not.
    expect(preferences.flipped()).toBe(false);
    expect(preferences.demandFilters().processors).toEqual(DEFAULT_DEMAND_FILTERS.processors);
    expect(preferences.demandFilters().weekCommencing).toBeNull();
    expect(preferences.demandFilters().hasUnmatched).toBe(false);
    expect(preferences.demandSort()).toEqual(DEFAULT_DEMAND_SORT);

    // A known field with an unusable direction keeps the field and sorts ascending.
    expect(preferences.supplySort()).toEqual({ field: 'locationName', direction: 'asc' });

    // And a filter the stored object omitted entirely falls back rather than becoming undefined.
    expect(preferences.supplyFilters().statuses).toEqual(DEFAULT_SUPPLY_FILTERS.statuses);
  });

  /**
   * Both toggles were added to the v2 object without bumping the version, which is only safe because
   * the reader falls back field by field: an object stored before either existed simply has no such
   * key. This is that claim, written down — the stored object above is exactly such an object.
   */
  it('gives an older stored object the defaults for toggles it predates', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 2, flipped: true }));

    const preferences = store();

    expect(preferences.flipped()).toBe(true);
    expect(preferences.filterOnDrag()).toBe(false);
    expect(preferences.dragAnywhere()).toBe(false);
  });

  it('carries both drag toggles across a reload, independently', () => {
    const first = store();
    first.toggleDragAnywhere();

    const reloaded = store();

    expect(reloaded.dragAnywhere()).toBe(true);
    expect(reloaded.filterOnDrag()).toBe(false);
  });

  /**
   * Stock classes, processors and plants have no known set to validate against, so a value that no
   * longer exists in the data is kept rather than silently dropped: it filters nothing in, the empty
   * state names it, and quietly discarding a selection the operator made is the worse failure.
   */
  it('keeps a selection whose value is no longer in the data', () => {
    const first = store();
    first.setDemandFilters({
      ...DEFAULT_DEMAND_FILTERS,
      stockClasses: ['A class from last season'],
    });

    expect(store().demandFilters().stockClasses).toEqual(['A class from last season']);
  });
});
