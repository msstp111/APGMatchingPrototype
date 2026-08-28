import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../../api/models';
import { CARRY_OVER_HORIZON_WEEKS } from './carry-over';

/**
 * Turns three flat lists from the API into the banded shape the screen renders.
 *
 * A pure function, deliberately: the whole of this phase's hard logic — which band a record belongs
 * to, and which later bands it reappears in — is testable without a DOM. It is also the seam Phase 4
 * attaches to. Filtering does not go inside this function; Phase 4 filters the *inputs* and calls it
 * again, and the band meta below then reflects the filtered set for free.
 *
 * **No date arithmetic happens here or anywhere else in `web/`.** Bands arrive from the server already
 * ordered, named and flagged, so placing a record is a `Map` lookup on an ISO string and placing a
 * carry-over is a comparison of positions in that array. Nothing parses a date; nothing constructs a
 * `Date`.
 */

/** Which column a card belongs to. The columns swap position in Phase 4, so this is not "left". */
export type MatchSide = 'demand' | 'supply';

/** One week, with everything the two columns draw in it. */
export interface BandView {
  readonly week: WeekBandDto;

  /** Spaces whose delivery date falls in this week, in the server's soonest-first order. */
  readonly spaces: readonly ProcessorSpaceDto[];

  /** Availability records whose available-from date falls in this week: their one full card. */
  readonly availability: readonly LivestockAvailabilityDto[];

  /**
   * Records still holding unmatched stock from an earlier band.
   *
   * These are **the same objects** as in some earlier band's `availability` — not copies, not clones.
   * Expanding a carry-over therefore shows the same matches by construction rather than by
   * convention, and Phase 5's drag will hit the same record.
   */
  readonly carryOver: readonly LivestockAvailabilityDto[];

  /**
   * The band header's right-hand meta. Counts and sums the band's **native** records only — a
   * carry-over is already counted in its home band, and counting it twice is the one arithmetic error
   * on this screen that would look entirely plausible.
   */
  readonly meta: BandMeta;
}

export interface BandMeta {
  readonly spaceCount: number;
  readonly spaceHead: number;
  readonly availabilityCount: number;
  readonly availabilityHead: number;
  readonly carryOverCount: number;
  /** Unmatched head, not available head: what is left is the only figure that matters this week. */
  readonly carryOverHead: number;
}

export interface BoardView {
  readonly bands: readonly BandView[];

  /**
   * Records whose week has no band. Always empty — the server derives the band range from the same
   * working set — and it exists so that if it ever stops being empty, a test says so rather than a
   * record silently vanishing off the screen.
   */
  readonly unplaced: readonly (ProcessorSpaceDto | LivestockAvailabilityDto)[];
}

/** A mutable band under construction. `BandView` is the frozen result. */
interface BandBuilder {
  readonly week: WeekBandDto;
  readonly spaces: ProcessorSpaceDto[];
  readonly availability: LivestockAvailabilityDto[];
  readonly carryOver: LivestockAvailabilityDto[];
}

export function buildBoard(
  weeks: readonly WeekBandDto[],
  spaces: readonly ProcessorSpaceDto[],
  availability: readonly LivestockAvailabilityDto[],
): BoardView {
  const bands: BandBuilder[] = weeks.map((week) => ({
    week,
    spaces: [],
    availability: [],
    carryOver: [],
  }));

  const indexOfWeek = new Map(weeks.map((week, index) => [week.weekCommencing, index]));
  const currentIndex = weeks.findIndex((week) => week.isCurrentWeek);
  const unplaced: (ProcessorSpaceDto | LivestockAvailabilityDto)[] = [];

  // A space belongs to exactly one band: the week of its delivery date. It is a slot on a day.
  for (const space of spaces) {
    const home = indexOfWeek.get(space.weekCommencing);
    if (home === undefined) {
      unplaced.push(space);
      continue;
    }

    bands[home].spaces.push(space);
  }

  for (const record of availability) {
    const home = indexOfWeek.get(record.weekCommencing);
    if (home === undefined) {
      unplaced.push(record);
      continue;
    }

    bands[home].availability.push(record);
    addCarryOvers(bands, record, home, currentIndex);
  }

  return {
    bands: bands.map(freeze),
    unplaced,
  };
}

/**
 * A record becomes available on a date and stays available until it is used up, so it reappears at the
 * top of every later band while it still has unmatched stock.
 *
 * Three bounds, all of them from design-system.md 9.3:
 *
 * - never in its own home band, which already has its full card;
 * - never before the current week — a record cannot be carried over into the past;
 * - never more than `CARRY_OVER_HORIZON_WEEKS` forward of the current week.
 *
 * `unmatched > 0` is a comparison against a figure the server computed, not a computation. When a drag
 * in Phase 5 takes it to zero the carry-overs simply stop being produced, which is the visible
 * confirmation that the drag worked.
 */
function addCarryOvers(
  bands: readonly BandBuilder[],
  record: LivestockAvailabilityDto,
  home: number,
  currentIndex: number,
): void {
  if (record.unmatched <= 0 || currentIndex < 0) {
    return;
  }

  const from = Math.max(home + 1, currentIndex);
  const to = Math.min(bands.length - 1, currentIndex + CARRY_OVER_HORIZON_WEEKS);

  for (let i = from; i <= to; i++) {
    bands[i].carryOver.push(record);
  }
}

function freeze(band: BandBuilder): BandView {
  return {
    week: band.week,
    spaces: band.spaces,
    availability: band.availability,
    carryOver: band.carryOver,
    meta: {
      spaceCount: band.spaces.length,
      spaceHead: sum(band.spaces.map((s) => s.quantityRequired)),
      availabilityCount: band.availability.length,
      availabilityHead: sum(band.availability.map((a) => a.quantityAvailable)),
      carryOverCount: band.carryOver.length,
      carryOverHead: sum(band.carryOver.map((a) => a.unmatched)),
    },
  };
}

/**
 * The band header's totals, and one of only two places anything in `web/` does arithmetic.
 *
 * This is a presentation roll-up over a list, not a domain rule: it adds up figures the server already
 * computed, and it has to happen here because Phase 4's filters change which records are in the list.
 * A per-band total shipped on the DTO would be right today and wrong the moment a filter is applied.
 * `no-domain-arithmetic.spec.ts` allow-lists this file by name for exactly this reason.
 */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
