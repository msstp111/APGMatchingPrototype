import { buildBoard } from './matching-board';
import { anAvailability, aSpace, weeks } from '../testing/dto-fixtures';

/**
 * `buildBoard` places every record in exactly one band and decides where each column's list starts.
 *
 * The trim is the part worth testing hard. Each column begins at the week of its **own** earliest
 * surviving record, because a start week shared with the other column would hide a past-dated space
 * older than the earliest availability record with nothing on screen to say so. Only the leading run
 * of empty bands goes: a gap between two populated weeks is information.
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

      const bandsWithIt = board.demand.filter((b) => b.spaces.includes(space));

      expect(bandsWithIt).toHaveLength(1);
      expect(bandsWithIt[0].week.weekCommencing).toBe(homeWeek);
    });

    it('gives an availability record exactly one band and never repeats it', () => {
      const record = anAvailability({ weekCommencing: '2026-08-16', unmatched: 40 });
      const board = buildBoard(bands(), [], [record]);

      // Unmatched stock from an earlier week stays in its own band. Phase 3 reprinted it into every
      // later band; resolved question 17 replaced that with the backlog, found by scrolling up.
      const drawn = board.supply.filter((b) => b.availability.includes(record));

      expect(drawn).toHaveLength(1);
      expect(drawn[0].week.weekCommencing).toBe('2026-08-16');
    });

    it('preserves the server order within a band', () => {
      const first = aSpace({ id: 1, weekCommencing: homeWeek });
      const second = aSpace({ id: 2, weekCommencing: homeWeek });
      const board = buildBoard(bands(), [first, second], []);

      expect(board.demand[0].spaces.map((s) => s.id)).toEqual([1, 2]);
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
      expect(board.supply.every((b) => b.availability.length === 0)).toBe(true);
    });
  });

  describe('the leading trim', () => {
    it('starts each column at the week of its own earliest record', () => {
      const board = buildBoard(
        bands(),
        [aSpace({ weekCommencing: '2026-08-16' })],
        [anAvailability({ weekCommencing: homeWeek })],
      );

      expect(board.demand[0].week.weekCommencing).toBe('2026-08-16');
      expect(board.supply[0].week.weekCommencing).toBe(homeWeek);
    });

    /**
     * The reason the two columns no longer share one list. A Booked space three weeks older than
     * every availability record is exactly the record a shared start week would swallow.
     */
    it('shows a past-dated space that is older than every availability record', () => {
      const old = aSpace({ id: 9, weekCommencing: '2026-08-02' });
      const board = buildBoard(bands(), [old], [anAvailability({ weekCommencing: homeWeek })]);

      expect(board.demand[0].week.weekCommencing).toBe('2026-08-02');
      expect(board.demand[0].spaces).toEqual([old]);
      expect(board.supply[0].week.weekCommencing).toBe(homeWeek);
    });

    it('trims neither column by what the other one holds', () => {
      const spacesOnly = buildBoard(bands(), [aSpace({ weekCommencing: '2026-08-09' })], []);
      const withSupply = buildBoard(
        bands(),
        [aSpace({ weekCommencing: '2026-08-09' })],
        [anAvailability({ weekCommencing: '2026-09-06' })],
      );

      expect(withSupply.demand[0].week.weekCommencing).toBe(
        spacesOnly.demand[0].week.weekCommencing,
      );
    });

    it('never hides a record: every one is still drawn in the trimmed run', () => {
      const spaces = [
        aSpace({ id: 1, weekCommencing: '2026-08-02' }),
        aSpace({ id: 2, weekCommencing: '2026-09-06' }),
      ];
      const records = [
        anAvailability({ id: 1, weekCommencing: '2026-08-16' }),
        anAvailability({ id: 2, weekCommencing: homeWeek }),
      ];

      const board = buildBoard(bands(), spaces, records);

      expect(board.demand.flatMap((b) => b.spaces).map((s) => s.id)).toEqual([1, 2]);
      expect(board.supply.flatMap((b) => b.availability).map((a) => a.id)).toEqual([1, 2]);
    });

    it('keeps an empty week that sits between two populated ones', () => {
      const board = buildBoard(
        bands(),
        [
          aSpace({ id: 1, weekCommencing: '2026-08-16' }),
          aSpace({ id: 2, weekCommencing: '2026-08-30' }),
        ],
        [],
      );

      // 16 Aug, then the empty 23 Aug, then 30 Aug — a gap in the calendar is information, and
      // trimming both ends is not the same as dropping every empty band.
      expect(board.demand.map((b) => b.week.weekCommencing)).toEqual([
        '2026-08-16',
        '2026-08-23',
        '2026-08-30',
      ]);
      expect(board.demand[1].spaces).toEqual([]);
    });

    /**
     * **This overturns Phase 3b requirement 2.6**, which had the run always reach the current week so
     * a past-only column still showed where "now" is. A column now ends at its own last record: with
     * a week filter applied, running on to today produced a stack of empty headers below the only
     * band holding anything, which reads as missing data. The `Past` tag on every past band still
     * says which side of today a record falls on.
     */
    it('ends at the last populated week even when that is in the past', () => {
      const board = buildBoard(bands(), [aSpace({ weekCommencing: '2026-08-09' })], []);

      expect(board.demand.map((b) => b.week.weekCommencing)).toEqual(['2026-08-09']);
      expect(board.demand.some((b) => b.week.isCurrentWeek)).toBe(false);
    });

    it('shows an empty column the current week alone rather than rendering nothing', () => {
      const board = buildBoard(bands(), [], [anAvailability({ weekCommencing: homeWeek })]);

      expect(board.demand).toHaveLength(1);
      expect(board.demand[0].week.isCurrentWeek).toBe(true);
      expect(board.demand[0].spaces).toEqual([]);
    });

    it('falls back to the current week for both columns when there is nothing at all', () => {
      const board = buildBoard(bands(), [], []);

      expect(board.demand).toHaveLength(1);
      expect(board.supply).toHaveLength(1);
      expect(board.demand[0].week.isCurrentWeek).toBe(true);
      expect(board.supply[0].week.isCurrentWeek).toBe(true);
      expect(board.unplaced).toEqual([]);
    });

    /**
     * Phase 4 filters `buildBoard`'s inputs and calls it again. The trim point is computed from the
     * records it is handed, never cached, so removing the oldest record moves the first band forward.
     */
    it('recomputes the start week when the input list changes', () => {
      const old = aSpace({ id: 1, weekCommencing: '2026-08-02' });
      const recent = aSpace({ id: 2, weekCommencing: homeWeek });

      expect(buildBoard(bands(), [old, recent], []).demand[0].week.weekCommencing).toBe(
        '2026-08-02',
      );
      expect(buildBoard(bands(), [recent], []).demand[0].week.weekCommencing).toBe(homeWeek);
    });

    /**
     * The trailing half of the trim. Filtering the demand column to one delivery week is the case
     * this exists for: the column should show that band and nothing under it.
     */
    it('drops trailing empty weeks', () => {
      const board = buildBoard(bands(), [aSpace({ weekCommencing: '2026-08-30' })], []);

      expect(board.demand.map((b) => b.week.weekCommencing)).toEqual(['2026-08-30']);
    });

    /** Both ends move independently, and the two columns trim to their own records as before. */
    it('trims each end of each column separately', () => {
      const board = buildBoard(
        bands(),
        [aSpace({ weekCommencing: '2026-08-16' })],
        [anAvailability({ weekCommencing: '2026-09-06' })],
      );

      expect(board.demand.map((b) => b.week.weekCommencing)).toEqual(['2026-08-16']);
      expect(board.supply.map((b) => b.week.weekCommencing)).toEqual(['2026-09-06']);
    });

    it('hands both columns the same band objects, so nothing can drift between them', () => {
      const board = buildBoard(
        bands(),
        [aSpace({ weekCommencing: '2026-08-02' })],
        [anAvailability({ weekCommencing: '2026-08-02' })],
      );

      expect(Object.is(board.demand[0], board.supply[0])).toBe(true);
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

      const meta = board.demand[0].meta;

      expect(meta.spaceCount).toBe(2);
      expect(meta.spaceHead).toBe(350);
      expect(meta.availabilityCount).toBe(1);
      expect(meta.availabilityHead).toBe(90);
    });

    it('reports zeroes for an empty band rather than omitting the figures', () => {
      const board = buildBoard(
        bands(),
        [
          aSpace({ id: 1, weekCommencing: '2026-08-16' }),
          aSpace({ id: 2, weekCommencing: '2026-08-30' }),
        ],
        [],
      );

      const empty = board.demand[1].meta;

      expect(empty.spaceCount).toBe(0);
      expect(empty.spaceHead).toBe(0);
      expect(empty.availabilityCount).toBe(0);
      expect(empty.availabilityHead).toBe(0);
    });

    /**
     * Every record is drawn once, so the board's totals are the input's totals. Phase 3 needed a
     * guard against double-counting repeats; this is what replaces it.
     */
    it('counts each record exactly once across every band’s meta', () => {
      const records = [
        anAvailability({ id: 1, weekCommencing: '2026-08-09', quantityAvailable: 10 }),
        anAvailability({ id: 2, weekCommencing: '2026-08-16', quantityAvailable: 20 }),
        anAvailability({ id: 3, weekCommencing: homeWeek, quantityAvailable: 30 }),
      ];

      const board = buildBoard(bands(), [], records);
      const totalCount = board.supply.reduce((t, b) => t + b.meta.availabilityCount, 0);
      const totalHead = board.supply.reduce((t, b) => t + b.meta.availabilityHead, 0);

      expect(totalCount).toBe(3);
      expect(totalHead).toBe(60);
    });
  });
});
