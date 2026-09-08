import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchingPreferences } from '../filters/matching-preferences';
import { aSpace, anAvailability } from '../testing/dto-fixtures';
import { DragNarrowing } from './drag-narrowing';
import { DragCard } from './drag-state';

/**
 * "Filter on drag": what a grabbed card does to the far column, and — as much to the point — what it
 * does to its own.
 */
describe('Drag narrowing', () => {
  function harness(): { narrowing: DragNarrowing; preferences: MatchingPreferences } {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: DOCUMENT, useValue: document }],
    });

    return {
      narrowing: TestBed.inject(DragNarrowing),
      preferences: TestBed.inject(MatchingPreferences),
    };
  }

  /** Tags, not stock classes: which class pairs with which is the domain's, and is tested there. */
  const spaces = [
    aSpace({ id: 1, stockClass: 'Lamb', stockClassGroups: ['lamb'] }),
    aSpace({ id: 2, stockClass: 'Cows', stockClassGroups: ['beef-cow'] }),
    aSpace({ id: 3, stockClass: 'Cattle', stockClassGroups: ['beef-cow', 'beef-bull'] }),
  ];

  const records = [
    anAvailability({ id: 10, stockClass: 'Lamb', stockClassGroups: ['lamb'] }),
    anAvailability({ id: 11, stockClass: 'Cow', stockClassGroups: ['beef-cow'] }),
  ];

  const lambRecord: DragCard = { side: 'supply', availability: records[0] };
  const cowsSpace: DragCard = { side: 'demand', space: spaces[1] };

  /** The pointer coming up, through the same document listener the service installs on the grab. */
  function pointerUp(): void {
    document.dispatchEvent(new Event('pointerup'));
  }

  /** Presses the grip at the origin. Narrows nothing on its own — that is the point of the press. */
  function press(narrowing: DragNarrowing, card: DragCard): void {
    narrowing.grab(card, new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }));
  }

  /** Moves the pointer, through the same document listener the press installed. */
  function moveBy(distance: number): void {
    document.dispatchEvent(
      new MouseEvent('pointermove', { clientX: distance, clientY: 0 }),
    );
  }

  /** A press followed by enough travel to be a drag — CDK's threshold is 5. */
  function drag(narrowing: DragNarrowing, card: DragCard): void {
    press(narrowing, card);
    moveBy(40);
  }

  it('does nothing at all until it is switched on', () => {
    const { narrowing } = harness();

    drag(narrowing, lambRecord);

    expect(narrowing.enabled()).toBe(false);
    expect(narrowing.narrows('demand')).toBe(false);
    expect(narrowing.narrowedTo('demand')).toBeNull();
    expect(narrowing.spaces(spaces)).toEqual(spaces);
  });

  it('narrows the far column to the compatible records while a card is held', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);

    expect(narrowing.narrows('demand')).toBe(true);
    expect(narrowing.narrowedTo('demand')).toBe('Lamb');
    expect(narrowing.spaces(spaces).map((s) => s.id)).toEqual([1]);
  });

  /**
   * The column the card came from is untouched, and that is not a detail: the grabbed card has to stay
   * on screen under the pointer, and CDK has already measured the row it is being dragged out of.
   */
  it('never narrows the column the card was grabbed from', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);

    expect(narrowing.narrows('supply')).toBe(false);
    expect(narrowing.narrowedTo('supply')).toBeNull();
    expect(narrowing.availability(records)).toEqual(records);
  });

  it('works the same way in the other direction', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, cowsSpace);

    expect(narrowing.narrowedTo('supply')).toBe('Cows');
    expect(narrowing.availability(records).map((r) => r.id)).toEqual([11]);
    expect(narrowing.spaces(spaces)).toEqual(spaces);
  });

  /**
   * The fault this replaced: a click on a grip is not a drag, and until 2026-09-09 it narrowed the far
   * column anyway — so every stray click emptied half the other side and filled it back in.
   */
  it('narrows nothing when the grip is merely pressed', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    press(narrowing, lambRecord);

    expect(narrowing.narrows('demand')).toBe(false);
    expect(narrowing.spaces(spaces)).toEqual(spaces);
  });

  it('narrows nothing when the pointer wobbles short of the drag threshold', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    press(narrowing, lambRecord);
    moveBy(4);

    expect(narrowing.narrows('demand')).toBe(false);

    // And the watch is still live: the same press becoming a real drag still narrows.
    moveBy(6);

    expect(narrowing.narrows('demand')).toBe(true);
  });

  it('leaves nothing listening after a press that never became a drag', () => {
    const { narrowing, preferences } = harness();
    const remove = vi.spyOn(document, 'removeEventListener');

    preferences.toggleFilterOnDrag();
    press(narrowing, lambRecord);
    pointerUp();

    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('pointerup', expect.any(Function));

    // A later move must not narrow a column for a gesture that is over.
    moveBy(40);
    expect(narrowing.narrows('demand')).toBe(false);

    remove.mockRestore();
  });

  /**
   * A grip pressed and released without a drag emits nothing from CDK, so the release cannot hang off
   * `cdkDragEnded`: it hangs off the pointer, which always comes up.
   */
  it('restores the column when the pointer comes up, drag or no drag', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);
    pointerUp();

    expect(narrowing.narrows('demand')).toBe(false);
    expect(narrowing.spaces(spaces)).toEqual(spaces);
  });

  it('restores the column on Escape, while the pointer is still down', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(narrowing.narrows('demand')).toBe(false);
  });

  it('stops listening once released, so a later pointer-up is not still handled', () => {
    const { narrowing, preferences } = harness();
    const remove = vi.spyOn(document, 'removeEventListener');

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);
    pointerUp();

    expect(remove).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));

    remove.mockRestore();
  });

  /**
   * Switching the aid off is not "stop narrowing the next card": every reader goes through one
   * computed, so an aid switched off mid-session cannot leave a narrowing in force anywhere.
   */
  it('drops an active narrowing the moment the switch goes off', () => {
    const { narrowing, preferences } = harness();

    preferences.toggleFilterOnDrag();
    drag(narrowing, lambRecord);
    preferences.toggleFilterOnDrag();

    expect(narrowing.narrows('demand')).toBe(false);
    expect(narrowing.spaces(spaces)).toEqual(spaces);
  });

  /** Alliance Group's Deer spaces: nothing in the supply vocabulary can fill one. */
  it('can narrow a column to nothing', () => {
    const { narrowing, preferences } = harness();
    const deer: DragCard = {
      side: 'demand',
      space: aSpace({ id: 4, stockClass: 'Deer', stockClassGroups: ['deer'] }),
    };

    preferences.toggleFilterOnDrag();
    drag(narrowing, deer);

    expect(narrowing.availability(records)).toEqual([]);
    expect(narrowing.narrowedTo('supply')).toBe('Deer');
  });

  /** The switch is a view preference like the flip: it outlives the session it was set in. */
  it('remembers the switch across a reload', () => {
    const first = harness();

    first.preferences.toggleFilterOnDrag();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    expect(TestBed.inject(MatchingPreferences).filterOnDrag()).toBe(true);
  });
});
