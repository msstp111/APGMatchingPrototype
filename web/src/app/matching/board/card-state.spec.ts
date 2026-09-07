import { TestBed } from '@angular/core/testing';

import { CardStateStore } from './card-state';

/**
 * One drawer per column (2026-09-07), and the per-column part is the half worth testing.
 *
 * The exclusivity itself is a two-line change; the rule that it must NOT reach across the two
 * columns is a design decision that a later "simplification" could plausibly undo — clearing the
 * whole set on open is shorter code and would pass any test that only ever opens cards on one side.
 * These four cases are what stop that.
 */
describe('CardStateStore', () => {
  let store: CardStateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CardStateStore);
  });

  it('starts with nothing expanded', () => {
    expect(store.isExpanded('demand', 1)).toBe(false);
    expect(store.isExpanded('supply', 1)).toBe(false);
  });

  it('toggles a card open and closed again', () => {
    store.toggleExpanded('demand', 1);
    expect(store.isExpanded('demand', 1)).toBe(true);

    store.toggleExpanded('demand', 1);
    expect(store.isExpanded('demand', 1)).toBe(false);
  });

  it('opening a card closes the other card in the same column', () => {
    store.toggleExpanded('demand', 1);
    store.toggleExpanded('demand', 2);

    expect(store.isExpanded('demand', 1)).toBe(false);
    expect(store.isExpanded('demand', 2)).toBe(true);
  });

  // The reason the rule is per column and not per screen: comparing a space against an availability
  // record is the screen's central task.
  it('leaves the other column alone', () => {
    store.toggleExpanded('demand', 1);
    store.toggleExpanded('supply', 7);

    expect(store.isExpanded('demand', 1)).toBe(true);
    expect(store.isExpanded('supply', 7)).toBe(true);
  });

  it('closing a card does not disturb the other column', () => {
    store.toggleExpanded('demand', 1);
    store.toggleExpanded('supply', 7);
    store.toggleExpanded('demand', 1);

    expect(store.isExpanded('demand', 1)).toBe(false);
    expect(store.isExpanded('supply', 7)).toBe(true);
  });

  // A record id is not unique across the two lists, and the key is what keeps them apart.
  it('keeps the two sides apart when the ids collide', () => {
    store.toggleExpanded('demand', 5);
    store.toggleExpanded('supply', 5);

    expect(store.isExpanded('demand', 5)).toBe(true);
    expect(store.isExpanded('supply', 5)).toBe(true);
  });
});
