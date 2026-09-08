import { aSpace, anAvailability } from '../testing/dto-fixtures';
import { DragCard } from './drag-state';
import {
  compatibleWith,
  dragStockClassGroups,
  sharesStockClassGroup,
} from './stock-class-affinity';

/**
 * The client half of "Filter on drag".
 *
 * **There are no stock class names in this file's assertions on purpose.** Which class goes with
 * which is the domain's judgement, pinned in `StockClassCompatibilityTests` and reaching the client
 * only as tags — so a spec here that asserted "Lamb narrows to the lamb spaces" would be a second,
 * silent copy of the table, and the two would drift the first time APG changed one pairing. What is
 * client-side, and is what these tests cover, is the set test and the narrowing built on it.
 */
describe('Stock class affinity', () => {
  const space = (groups: string[], id = 1) => aSpace({ id, stockClassGroups: groups });
  const record = (groups: string[], id = 1) => anAvailability({ id, stockClassGroups: groups });

  describe('sharesStockClassGroup', () => {
    it('is true when the two sets share a tag and false when they do not', () => {
      expect(sharesStockClassGroup(['a'], ['a'])).toBe(true);
      expect(sharesStockClassGroup(['a', 'b'], ['b', 'c'])).toBe(true);
      expect(sharesStockClassGroup(['a'], ['b'])).toBe(false);
    });

    /**
     * The generic-class case, and the reason the wire carries tags rather than a list of the other
     * vocabulary's names: one class holding several tags meets every specific class under it without
     * either side naming the other.
     */
    it('lets one many-tagged class meet every single-tagged one under it', () => {
      const generic = ['a', 'b', 'c'];

      expect(sharesStockClassGroup(generic, ['a'])).toBe(true);
      expect(sharesStockClassGroup(generic, ['b'])).toBe(true);
      expect(sharesStockClassGroup(generic, ['c'])).toBe(true);
      expect(sharesStockClassGroup(generic, ['d'])).toBe(false);
    });

    /**
     * Fails towards visible. An empty tag list is not something the API produces — an unrecognised
     * class is given every tag — but a hand-built record or a half-deployed wire format can, and a
     * record hidden from the screen cannot be matched at all.
     */
    it('treats an empty tag list as no opinion rather than as no compatibility', () => {
      expect(sharesStockClassGroup([], ['a'])).toBe(true);
      expect(sharesStockClassGroup(['a'], [])).toBe(true);
      expect(sharesStockClassGroup([], [])).toBe(true);
    });

    it('is symmetric', () => {
      expect(sharesStockClassGroup(['a', 'b'], ['b'])).toBe(
        sharesStockClassGroup(['b'], ['a', 'b']),
      );
      expect(sharesStockClassGroup(['a'], ['z'])).toBe(sharesStockClassGroup(['z'], ['a']));
    });
  });

  describe('compatibleWith', () => {
    it('keeps the compatible records, in the order they were given', () => {
      const grabbed: DragCard = { side: 'supply', availability: record(['a']) };
      const spaces = [space(['b'], 1), space(['a'], 2), space(['a', 'b'], 3), space(['c'], 4)];

      expect(compatibleWith(spaces, grabbed).map((s) => s.id)).toEqual([2, 3]);
    });

    /** One function, both directions — the same reason `pairFromDrop` is one function. */
    it('narrows supply against a grabbed space the same way', () => {
      const grabbed: DragCard = { side: 'demand', space: space(['a']) };
      const records = [record(['a'], 1), record(['b'], 2), record(['a', 'c'], 3)];

      expect(compatibleWith(records, grabbed).map((r) => r.id)).toEqual([1, 3]);
    });

    it('can narrow to nothing, which is a real answer and not an error', () => {
      const grabbed: DragCard = { side: 'demand', space: space(['deer-shaped']) };

      expect(compatibleWith([record(['a']), record(['b'])], grabbed)).toEqual([]);
    });

    it('reads the tags off whichever side the card came from', () => {
      expect(dragStockClassGroups({ side: 'demand', space: space(['a']) })).toEqual(['a']);
      expect(dragStockClassGroups({ side: 'supply', availability: record(['b']) })).toEqual(['b']);
    });
  });
});
