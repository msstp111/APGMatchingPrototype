import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  CLEARED_DEMAND_FILTERS,
  CLEARED_SUPPLY_FILTERS,
  DEFAULT_DEMAND_FILTERS,
  DEFAULT_DEMAND_SORT,
  DEFAULT_FLIPPED,
  DEFAULT_SUPPLY_FILTERS,
  DEFAULT_SUPPLY_SORT,
  DEMAND_SORT_FIELDS,
  SUPPLY_SORT_FIELDS,
} from './filter-defaults';
import { MatchingPreferences } from './matching-preferences';

/**
 * The defaults and the reset, and the one thing that must be true of them: **they cannot drift
 * apart**.
 *
 * The acceptance criterion asks for this to be asserted in a test rather than by hand, and the way to
 * do that is to compare against the exported constants themselves. A test that restated the values —
 * `expect(filters.statuses).toEqual(['Booked'])` — would simply be a second copy of the defaults,
 * and a second copy is the thing being guarded against.
 */
describe('Filter defaults', () => {
  function store(): MatchingPreferences {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    return TestBed.inject(MatchingPreferences);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('opens in exactly the exported defaults', () => {
    const preferences = store();

    expect(preferences.demandFilters()).toBe(DEFAULT_DEMAND_FILTERS);
    expect(preferences.demandSort()).toBe(DEFAULT_DEMAND_SORT);
    expect(preferences.supplyFilters()).toBe(DEFAULT_SUPPLY_FILTERS);
    expect(preferences.supplySort()).toBe(DEFAULT_SUPPLY_SORT);
    expect(preferences.flipped()).toBe(DEFAULT_FLIPPED);
  });

  it('resets the demand column to exactly the exported defaults, from any state', () => {
    const preferences = store();

    // Every field moved off its default, so a reset that missed one would be caught.
    preferences.setDemandFilters({
      statuses: ['Cancelled'],
      processors: ['ANZCO'],
      plants: ['Rangitikei'],
      stockClasses: ['Cows'],
      weekCommencing: '2026-08-23',
      hasUnmatched: true,
    });
    preferences.setDemandSort({ field: 'quantityRequired', direction: 'desc' });

    preferences.resetDemand();

    expect(preferences.demandFilters()).toEqual(DEFAULT_DEMAND_FILTERS);
    expect(preferences.demandSort()).toEqual(DEFAULT_DEMAND_SORT);
  });

  it('resets the supply column to exactly the exported defaults, from any state', () => {
    const preferences = store();

    preferences.setSupplyFilters({
      statuses: ['Confirmed'],
      stockClasses: ['Prime'],
      locationIds: [7],
      transactionTypes: ['GrazingStock'],
      hasUnmatched: false,
    });
    preferences.setSupplySort({ field: 'locationName', direction: 'desc' });

    preferences.resetSupply();

    expect(preferences.supplyFilters()).toEqual(DEFAULT_SUPPLY_FILTERS);
    expect(preferences.supplySort()).toEqual(DEFAULT_SUPPLY_SORT);
  });

  it('resets one column without touching the other, or the flip', () => {
    const preferences = store();

    preferences.setSupplyFilters({ ...DEFAULT_SUPPLY_FILTERS, stockClasses: ['Prime'] });
    preferences.toggleFlipped();
    preferences.resetDemand();

    expect(preferences.supplyFilters().stockClasses).toEqual(['Prime']);
    expect(preferences.flipped()).toBe(true);
  });

  /**
   * A filter field added without a default would otherwise be `undefined` on a fresh column and
   * absent from the reset, and nothing else in the suite would notice. Enumerating the keys is what
   * makes the constants module genuinely single-source.
   */
  it('gives every filter field a default on both sides', () => {
    const preferences = store();

    for (const key of Object.keys(preferences.demandFilters())) {
      expect(DEFAULT_DEMAND_FILTERS, key).toHaveProperty(key);
      expect(CLEARED_DEMAND_FILTERS, key).toHaveProperty(key);
    }

    for (const key of Object.keys(preferences.supplyFilters())) {
      expect(DEFAULT_SUPPLY_FILTERS, key).toHaveProperty(key);
      expect(CLEARED_SUPPLY_FILTERS, key).toHaveProperty(key);
    }
  });

  /**
   * Resolved question 17, guarded at the model rather than only at the control.
   *
   * The availability column has no week filter and must never grow one: supply is a state, not an
   * event, and filtering it to a single week hides every older record that still has unmatched
   * stock — the exact blindness the scroll-up backlog exists to prevent. A cumulative "available by"
   * variant was considered and declined too, which is why this matches the word rather than an exact
   * field name.
   */
  it('has no week filter of any kind on the supply side', () => {
    for (const key of Object.keys(DEFAULT_SUPPLY_FILTERS)) {
      expect(
        key,
        `supply filters must never gain a week filter, and ${key} looks like one`,
      ).not.toMatch(/week|available.?by/i);
    }

    // And the demand side does keep one: a delivery date genuinely is a single-week event.
    expect(DEFAULT_DEMAND_FILTERS).toHaveProperty('weekCommencing');
  });

  it('clears to a state that restricts nothing', () => {
    const preferences = store();

    preferences.clearDemand();
    preferences.clearSupply();

    expect(preferences.demandFilters()).toEqual(CLEARED_DEMAND_FILTERS);
    expect(preferences.supplyFilters()).toEqual(CLEARED_SUPPLY_FILTERS);

    // Clearing is not resetting: the defaults hide finished work, and clearing shows it.
    expect(preferences.supplyFilters().hasUnmatched).toBe(false);
    expect(preferences.demandFilters().statuses).toEqual([]);
  });

  it('offers a sort for every field either card displays', () => {
    // The default sort must be one of the fields the menu offers, or the control shows nothing.
    expect(DEMAND_SORT_FIELDS.map((option) => option.field)).toContain(DEFAULT_DEMAND_SORT.field);
    expect(SUPPLY_SORT_FIELDS.map((option) => option.field)).toContain(DEFAULT_SUPPLY_SORT.field);
  });

  it('freezes the defaults, so nothing can edit them in place', () => {
    expect(Object.isFrozen(DEFAULT_DEMAND_FILTERS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SUPPLY_FILTERS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_DEMAND_FILTERS.statuses)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SUPPLY_FILTERS.statuses)).toBe(true);
  });
});
