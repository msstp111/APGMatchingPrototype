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

  /**
   * A column at a known position. jsdom has no layout, so the rect is stubbed — but everything else
   * on the path is real: the store measures at pickup and reads the measurement on a pointer event,
   * exactly as it does in a browser.
   */
  function column(left: number, right: number): HTMLElement {
    const element = document.createElement('div');

    element.getBoundingClientRect = () =>
      ({ left, right, top: 0, bottom: 900, width: right - left, height: 900 }) as DOMRect;

    return element;
  }

  /** Moves the pointer, through the same document listener the store installs at pickup. */
  function moveTo(x: number): void {
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 400 }));
  }

  /** A drag from the demand column, with the pointer already across the gutter. */
  function armedDrag(): DragStore {
    const drag = store();

    drag.registerColumn('demand', column(0, 500));
    drag.registerColumn('supply', column(500, 1000));
    drag.begin(demand);
    moveTo(700);

    return drag;
  }

  describe('progressive disclosure', () => {
    /**
     * The heart of the Phase 9 change. Phase 5 lit every eligible card in the far column at pickup —
     * forty outlines for a gesture with no target yet — and this is where that stops.
     */
    it('says nothing about any card until the pointer crosses the gutter', () => {
      const drag = store();

      drag.registerColumn('demand', column(0, 500));
      drag.registerColumn('supply', column(500, 1000));
      drag.begin(demand);

      expect(drag.armed()).toBe(false);
      expect(drag.dropState('supply', 20)).toBe('none');
      expect(drag.dropState('supply', 0)).toBe('none');
      expect(drag.dropState('demand', 40)).toBe('none');

      // Still inside the source column: crossing means the far column, not merely moving.
      moveTo(300);

      expect(drag.armed()).toBe(false);
      expect(drag.dropState('supply', 20)).toBe('none');
    });

    it('arms on the crossing and stays armed for the rest of the drag', () => {
      const drag = armedDrag();

      expect(drag.armed()).toBe(true);
      expect(drag.dropState('supply', 20)).toBe('valid');

      // Back over the source column. A pointer that wanders has not un-learned where it is going,
      // and flickering the whole far column off would be worse than either state.
      moveTo(100);

      expect(drag.armed()).toBe(true);
      expect(drag.dropState('supply', 20)).toBe('valid');
    });

    it('disarms for the next drag rather than leaking the last one', () => {
      const drag = armedDrag();

      drag.end();
      drag.begin(demand);

      expect(drag.armed()).toBe(false);
      expect(drag.dropState('supply', 20)).toBe('none');
    });
  });

  describe('the drop states themselves', () => {
    it('highlights the opposite column and leaves the source column unmarked', () => {
      const drag = armedDrag();

      expect(drag.dropState('supply', 20)).toBe('valid');
      expect(drag.dropState('demand', 40)).toBe('same');
      expect(drag.isTargetSide('supply')).toBe(true);
      expect(drag.isTargetSide('demand')).toBe(false);
      expect(drag.isSource('demand', demand.space.id)).toBe(true);
      expect(drag.isSource('supply', supply.availability.id)).toBe(false);
    });

    it('marks a full record as blocked rather than silently swallowing the drop', () => {
      const drag = armedDrag();

      expect(drag.dropState('supply', 0)).toBe('blocked');
    });

    it('ignores the drop after Escape, and a later pickup is a fresh drag', () => {
      const drag = armedDrag();

      drag.cancel();

      expect(drag.cancelled()).toBe(true);
      expect(drag.active()).toBeNull();

      drag.end();
      drag.begin(supply);
      moveTo(300);

      expect(drag.cancelled()).toBe(false);
      expect(drag.dropState('demand', 10)).toBe('valid');
    });
  });

  describe('the card under the pointer', () => {
    it('is whichever card CDK last reported entering', () => {
      const drag = armedDrag();

      expect(drag.isHot('supply', supply.availability.id)).toBe(false);

      drag.enter(supply);

      expect(drag.isHot('supply', supply.availability.id)).toBe(true);
      expect(drag.isHot('demand', supply.availability.id)).toBe(false);
    });

    /**
     * CDK emits `entered` on the new list before `exited` on the old one when a pointer crosses
     * straight from one card to the next. An unguarded clear would blank the card just arrived at.
     */
    it('survives an exit arriving after the next card has already been entered', () => {
      const drag = armedDrag();
      const second = { side: 'supply' as const, availability: anAvailability({ id: 99 }) };

      drag.enter(supply);
      drag.enter(second);
      drag.leave('supply', supply.availability.id);

      expect(drag.isHot('supply', 99)).toBe(true);
    });

    it('is forgotten when the drag ends, so nothing stays lit afterwards', () => {
      const drag = armedDrag();

      drag.enter(supply);
      drag.end();

      expect(drag.isHot('supply', supply.availability.id)).toBe(false);
      expect(drag.hot()).toBeNull();
    });
  });

  describe('the one spotlight', () => {
    it('dims every card in the source column except the one that was picked up', () => {
      const drag = store();

      drag.registerColumn('demand', column(0, 500));
      drag.registerColumn('supply', column(500, 1000));
      drag.begin(demand);

      // From pickup, deliberately: this is the one thing that changes before the gutter is crossed,
      // and it answers "which row did this come from" at the moment the question is asked.
      expect(drag.isDimmed('demand', demand.space.id)).toBe(false);
      expect(drag.isDimmed('demand', 12345)).toBe(true);
    });

    /**
     * The 2026-09-09 change (drag-lab-2 idea 1), and the one most likely to be undone by a later hand
     * reaching for "a bit more feedback on the far side". Choosing a target means comparing those
     * rows against one another, and a scrim over all of them is the one device in this gesture that
     * takes reading away rather than adding a mark. The hot card is marked; nothing else is.
     */
    it('never dims the target column, hot card or not', () => {
      const drag = armedDrag();

      expect(drag.isDimmed('supply', 12345)).toBe(false);
      expect(drag.isColumnDimmed('supply')).toBe(false);

      drag.enter(supply);

      expect(drag.isDimmed('supply', supply.availability.id)).toBe(false);
      // The card three rows below the pointer reads exactly as it did before the drag began.
      expect(drag.isDimmed('supply', 12345)).toBe(false);
      expect(drag.isColumnDimmed('supply')).toBe(false);
    });

    it(`keeps the source column's scrim wherever the pointer goes`, () => {
      const drag = armedDrag();

      drag.enter(supply);
      moveTo(100);

      // The origin is still the origin, and it is still marked by subtraction.
      expect(drag.isDimmed('demand', 12345)).toBe(true);
      expect(drag.isColumnDimmed('demand')).toBe(true);
      expect(drag.isDimmed('demand', demand.space.id)).toBe(false);
    });

    it('dims nothing at all when no drag is in flight', () => {
      const drag = store();

      expect(drag.isDimmed('demand', 1)).toBe(false);
      expect(drag.isDimmed('supply', 1)).toBe(false);
      expect(drag.isColumnDimmed('demand')).toBe(false);
      expect(drag.isColumnDimmed('supply')).toBe(false);
    });
  });
});
