import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aSpace, anAvailability } from '../testing/dto-fixtures';
import { DragStore } from './drag-state';

describe('Drag store', () => {
  function store(): DragStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: DOCUMENT, useValue: document }],
    });

    return TestBed.inject(DragStore);
  }

  const demand = { side: 'demand' as const, space: aSpace({ unmatched: 40 }) };
  const supply = { side: 'supply' as const, availability: anAvailability({ unmatched: 20 }) };

  it('highlights the opposite column and leaves the source column unmarked', () => {
    const drag = store();

    drag.begin(demand);

    expect(drag.dropState('supply', 20)).toBe('valid');
    expect(drag.dropState('demand', 40)).toBe('same');
    expect(drag.isTargetSide('supply')).toBe(true);
    expect(drag.isTargetSide('demand')).toBe(false);
    expect(drag.isSource('demand', demand.space.id)).toBe(true);
    expect(drag.isSource('supply', supply.availability.id)).toBe(false);
  });

  it('marks a full record as blocked rather than silently swallowing the drop', () => {
    const drag = store();

    drag.begin(demand);

    expect(drag.dropState('supply', 0)).toBe('blocked');
  });

  it('ignores the drop after Escape, and a later pickup is a fresh drag', () => {
    const drag = store();

    drag.begin(demand);
    drag.cancel();

    expect(drag.cancelled()).toBe(true);
    expect(drag.active()).toBeNull();

    drag.end();
    drag.begin(supply);

    expect(drag.cancelled()).toBe(false);
    expect(drag.dropState('demand', 10)).toBe('valid');
  });
});
