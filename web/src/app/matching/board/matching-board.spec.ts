import { buildBoard } from './matching-board';
import { CARRY_OVER_HORIZON_WEEKS } from './carry-over';
import { anAvailability, aSpace, weeks } from '../testing/dto-fixtures';

/**
 * The carry-over rule, which is the reason Phase 3 stands alone.
 *
 * An availability record appears in full in its home week band, then reappears — visually demoted — at
 * the top of every later band while it still has unmatched quantity. It is **the same record**, not a
 * copy, and it must never double-count in any total or count on the screen.
 *
 * `buildBoard` is pure, so all of that is checkable here rather than by eye in a browser.
 */
describe('buildBoard', () => {
  // Six bands, 2 Aug to 6 Sep, with 23 Aug (index 3) as the current week.
  const CURRENT = 3;
  const bands = () => weeks(CURRENT);

  const homeWeek = '2026-08-23';

  describe('placement', () => {
    it('puts a space in the band of its own week and in no other', () => {
      const space = aSpace({ weekCommencing: homeWeek });
      const board = buildBoard(bands(), [space], []);

      const bandsWithIt = board.bands.filter((b) => b.spaces.includes(space));

      expect(bandsWithIt).toHaveLength(1);
      expect(bandsWithIt[0].week.weekCommencing).toBe(homeWeek);
    });

    /**
     * A space belongs to one delivery day, so it never carries over. Only supply persists: stock stays
     * available until it is used up, a slot on a Thursday does not.
     */
    it('never carries a space over, however much of it is unfilled', () => {
      const board = buildBoard(bands(), [aSpace({ weekCommencing: homeWeek, unmatched: 100 })], []);

      expect(board.bands.every((b) => b.carryOver.length === 0)).toBe(true);
    });

    it('gives an availability record exactly one native band', () => {
      const record = anAvailability({ weekCommencing: homeWeek });
      const board = buildBoard(bands(), [], [record]);

      const native = board.bands.filter((b) => b.availability.includes(record));

      expect(native).toHaveLength(1);
      expect(native[0].week.weekCommencing).toBe(homeWeek);
    });

    it('preserves the server order within a band', () => {
      const first = aSpace({ id: 1, weekCommencing: homeWeek });
      const second = aSpace({ id: 2, weekCommencing: homeWeek });
      const board = buildBoard(bands(), [first, second], []);

      expect(board.bands[CURRENT].spaces.map((s) => s.id)).toEqual([1, 2]);
    });

    it('keeps every band, including the ones nothing falls in', () => {
      const board = buildBoard(bands(), [aSpace({ weekCommencing: homeWeek })], []);

      // Requirement 1.6: an empty week is information. Six in, six out.
      expect(board.bands).toHaveLength(6);
      expect(board.bands.map((b) => b.week.weekCommencing)).toEqual(
        bands().map((b) => b.weekCommencing),
      );
    });

    it('reports nothing unplaced when every record has a band', () => {
      const board = buildBoard(
        bands(),
        [aSpace({ weekCommencing: homeWeek })],
        [anAvailability({ weekCommencing: '2026-08-09' })],
      );

      expect(board.unplaced).toEqual([]);
    });

    /**
     * The server derives the band range from the same working set, so this cannot happen. It is
     * reported rather than dropped so that if it ever does, a test says so instead of a record
     * silently vanishing off a screen APG is committing livestock on.
     */
    it('reports a record whose week has no band rather than dropping it', () => {
      const orphan = anAvailability({ weekCommencing: '2029-01-07' });
      const board = buildBoard(bands(), [], [orphan]);

      expect(board.unplaced).toEqual([orphan]);
      expect(board.bands.every((b) => b.availability.length === 0)).toBe(true);
    });
  });

  describe('carry-over identity', () => {
    /**
     * The whole phase turns on this. Not a deep-equal copy — the same object, so expanding a carry-over
     * shows the same matches by construction, and Phase 5's drag hits the same record.
     */
    it('carries over the very same object as the home band holds', () => {
      const record = anAvailability({ weekCommencing: '2026-08-16', unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      const home = board.bands[2].availability[0];
      const repeats = board.bands.filter((b) => b.carryOver.length > 0);

      expect(repeats.length).toBeGreaterThan(0);
      expect(Object.is(home, record)).toBe(true);

      for (const band of repeats) {
        expect(Object.is(band.carryOver[0], record)).toBe(true);
      }
    });

    it('shows the same matches on the repeat as on the home card, because they are one object', () => {
      const record = anAvailability({ weekCommencing: '2026-08-16', unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      const repeat = board.bands[CURRENT].carryOver[0];

      expect(repeat.matches).toBe(board.bands[2].availability[0].matches);
    });
  });

  describe('carry-over placement', () => {
    it('does not repeat a record in its own home band', () => {
      const record = anAvailability({ weekCommencing: homeWeek, unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      expect(board.bands[CURRENT].carryOver).toEqual([]);
    });

    /**
     * A record cannot be carried over into the past. Its home band is week 9 Aug, two weeks before the
     * current one, and the weeks between are gone — repeating it there would invite an operator to
     * match stock into a week that has already happened.
     */
    it('never places a carry-over before the current week', () => {
      const record = anAvailability({ weekCommencing: '2026-08-09', unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      expect(board.bands[0].carryOver).toEqual([]);
      expect(board.bands[1].carryOver).toEqual([]);
      expect(board.bands[2].carryOver).toEqual([]);
      expect(board.bands[CURRENT].carryOver).toHaveLength(1);
    });

    it('starts at the band after home when home is in the future', () => {
      // Home is 30 Aug, one week ahead of the current 23 Aug. The repeat starts at 6 Sep, and the
      // current week — which is BEFORE the record exists — gets nothing.
      const record = anAvailability({ weekCommencing: '2026-08-30', unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      expect(board.bands[CURRENT].carryOver).toEqual([]);
      expect(board.bands[4].carryOver).toEqual([]);
      expect(board.bands[5].carryOver).toHaveLength(1);
    });

    it('stops at the horizon rather than repeating forever', () => {
      // Nine bands from the current week, and a horizon of four.
      const many = weeks(0, 8);
      const record = anAvailability({ weekCommencing: many[0].weekCommencing, unmatched: 40 });
      const board = buildBoard(many, [], [record]);

      const repeated = board.bands
        .map((b, i) => ({ i, count: b.carryOver.length }))
        .filter((b) => b.count > 0)
        .map((b) => b.i);

      expect(repeated).toEqual([1, 2, 3, 4]);
      expect(repeated).toHaveLength(CARRY_OVER_HORIZON_WEEKS);
    });

    it('stops carrying over the moment the record is fully matched', () => {
      const record = anAvailability({ weekCommencing: '2026-08-16', unmatched: 0 });
      const board = buildBoard(bands(), [], [record]);

      // Still in its home band — a fully matched record is history worth seeing in its own week.
      expect(board.bands[2].availability).toHaveLength(1);
      expect(board.bands.every((b) => b.carryOver.length === 0)).toBe(true);
    });

    /**
     * Over-committed supply is a bug indicator rather than a matching opportunity, and a negative
     * unmatched figure means there is nothing left to offer. Repeating it would invite an operator to
     * commit stock that is already over-committed.
     */
    it('does not carry over a record whose unmatched figure is negative', () => {
      const record = anAvailability({
        weekCommencing: '2026-08-16',
        unmatched: -5,
        quantityState: 'Over',
      });
      const board = buildBoard(bands(), [], [record]);

      expect(board.bands.every((b) => b.carryOver.length === 0)).toBe(true);
    });

    it('carries nothing over when no band is the current week', () => {
      // Defensive: the server always includes the current week, so currentIndex is never -1. If that
      // ever changes, no carry-over is a safer failure than every carry-over in the wrong place.
      const noCurrent = weeks(-1);
      const record = anAvailability({ weekCommencing: '2026-08-16', unmatched: 40 });
      const board = buildBoard(noCurrent, [], [record]);

      expect(board.bands.every((b) => b.carryOver.length === 0)).toBe(true);
      expect(board.bands[2].availability).toHaveLength(1);
    });
  });

  describe('band meta', () => {
    it('counts and sums the band’s own records', () => {
      const board = buildBoard(
        bands(),
        [
          aSpace({ id: 1, weekCommencing: homeWeek, quantityRequired: 100 }),
          aSpace({ id: 2, weekCommencing: homeWeek, quantityRequired: 250 }),
        ],
        [anAvailability({ id: 1, weekCommencing: homeWeek, quantityAvailable: 90 })],
      );

      const meta = board.bands[CURRENT].meta;

      expect(meta.spaceCount).toBe(2);
      expect(meta.spaceHead).toBe(350);
      expect(meta.availabilityCount).toBe(1);
      expect(meta.availabilityHead).toBe(90);
    });

    /**
     * The one plausible double-count on this design: a carried-over record is already counted in its
     * home band, so counting it again in every later band would inflate every total on the screen.
     */
    it('leaves a band’s own totals untouched by the carry-overs sitting above them', () => {
      const carried = anAvailability({
        id: 1,
        weekCommencing: '2026-08-16',
        quantityAvailable: 90,
        unmatched: 40,
      });
      const native = anAvailability({
        id: 2,
        weekCommencing: homeWeek,
        quantityAvailable: 25,
        unmatched: 25,
      });

      const board = buildBoard(bands(), [], [carried, native]);
      const meta = board.bands[CURRENT].meta;

      expect(board.bands[CURRENT].carryOver).toHaveLength(1);
      expect(meta.availabilityCount).toBe(1);
      expect(meta.availabilityHead).toBe(25);
    });

    it('rolls the carry-over strip up on unmatched, not on quantity available', () => {
      // What is left is the only figure that matters this week; the original quantity is history.
      const board = buildBoard(
        bands(),
        [],
        [
          anAvailability({ id: 1, weekCommencing: '2026-08-16', quantityAvailable: 90, unmatched: 40 }),
          anAvailability({ id: 2, weekCommencing: '2026-08-16', quantityAvailable: 60, unmatched: 15 }),
        ],
      );

      const meta = board.bands[CURRENT].meta;

      expect(meta.carryOverCount).toBe(2);
      expect(meta.carryOverHead).toBe(55);
    });

    it('reports zeroes for an empty band rather than omitting the figures', () => {
      const meta = buildBoard(bands(), [], []).bands[0].meta;

      expect(meta.spaceCount).toBe(0);
      expect(meta.spaceHead).toBe(0);
      expect(meta.carryOverHead).toBe(0);
    });
  });

  describe('totals across the whole board', () => {
    /**
     * The guarantee the screen rests on: however many times a record is drawn, it is counted once.
     */
    it('counts each record exactly once across every band’s meta', () => {
      const records = [
        anAvailability({ id: 1, weekCommencing: '2026-08-09', quantityAvailable: 10, unmatched: 10 }),
        anAvailability({ id: 2, weekCommencing: '2026-08-16', quantityAvailable: 20, unmatched: 20 }),
        anAvailability({ id: 3, weekCommencing: homeWeek, quantityAvailable: 30, unmatched: 30 }),
      ];

      const board = buildBoard(bands(), [], records);
      const totalCount = board.bands.reduce((t, b) => t + b.meta.availabilityCount, 0);
      const totalHead = board.bands.reduce((t, b) => t + b.meta.availabilityHead, 0);

      expect(totalCount).toBe(3);
      expect(totalHead).toBe(60);

      // And they really are being drawn more than once, or the assertion above proves nothing.
      expect(board.bands.reduce((t, b) => t + b.carryOver.length, 0)).toBeGreaterThan(3);
    });
  });
});
