import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../../api/models';

/**
 * Turns three flat lists from the API into the banded shape the screen renders.
 *
 * A pure function, deliberately: which band a record belongs to, and where each column's list starts,
 * are testable without a DOM. It is also the seam Phase 4 attaches to. Filtering does not go inside
 * this function; Phase 4 filters the *inputs* and calls it again, and both the band meta and the
 * per-column trim below then reflect the filtered set for free.
 *
 * **No date arithmetic happens here or anywhere else in `web/`.** Bands arrive from the server already
 * ordered, named and flagged, so placing a record is a `Map` lookup on an ISO string and trimming is
 * choosing where to start reading an ordered array. Nothing parses a date; nothing constructs a
 * `Date`.
 */

/** Which column a card belongs to. The columns swap position in Phase 4, so this is not "left". */
export type MatchSide = 'demand' | 'supply';

/** One week, with everything the two columns draw in it. */
export interface BandView {
  readonly week: WeekBandDto;

  /** Spaces whose delivery date falls in this week, in the server's soonest-first order. */
  readonly spaces: readonly ProcessorSpaceDto[];

  /**
   * Availability records whose available-from date falls in this week.
   *
   * A record appears here and nowhere else. Supply still unmatched from an earlier week is found by
   * scrolling up into the backlog, not by being reprinted in later weeks (resolved question 17).
   */
  readonly availability: readonly LivestockAvailabilityDto[];

  /** The band header's right-hand meta, over the records this band actually holds. */
  readonly meta: BandMeta;
}

export interface BandMeta {
  readonly spaceCount: number;
  readonly spaceHead: number;
  readonly availabilityCount: number;
  readonly availabilityHead: number;
}

export interface BoardView {
  /** The demand column's bands: the week of its earliest space to the week of its latest. */
  readonly demand: readonly BandView[];

  /**
   * The supply column's bands, spanning the weeks its own records occupy.
   *
   * Often a different week from `demand`'s, so the two rails legitimately show different weeks at the
   * same height. They scroll independently and each trims to its own data.
   */
  readonly supply: readonly BandView[];

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
  }));

  const indexOfWeek = new Map(weeks.map((week, index) => [week.weekCommencing, index]));
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

  // And so does an availability record, once — in the week its stock became available.
  for (const record of availability) {
    const home = indexOfWeek.get(record.weekCommencing);
    if (home === undefined) {
      unplaced.push(record);
      continue;
    }

    bands[home].availability.push(record);
  }

  const view = bands.map(freeze);

  return {
    demand: trim(view, weeks, (band) => band.spaces.length > 0),
    supply: trim(view, weeks, (band) => band.availability.length > 0),
    unplaced,
  };
}

/**
 * Cuts the column down to the span its own records actually occupy: from the week of its earliest
 * surviving record to the week of its latest.
 *
 * **Each column trims from its own records only.** A shared start week would hide a past-dated space
 * older than the earliest availability record, with nothing on screen to say it had — which is the
 * whole reason one band list no longer serves both columns.
 *
 * Only the runs at each *end* go. An empty week between two populated ones keeps its header, because
 * a gap in the calendar is information — trimming both ends is not the same as dropping every empty
 * band.
 *
 * **The trailing trim overturns Phase 3b's requirement 2.6**, which guaranteed the run always reached
 * the current week so a column whose records were all in the past still showed where "now" is. With
 * a week filter on the demand column that guarantee produced a run of empty headers below the only
 * band holding anything, which reads as missing data rather than as a calendar. What 2.6 was
 * protecting is still carried: every past band has a grey `Past` tag on its rail and no future band
 * does, so "am I looking at old stock" does not depend on the current week being on screen.
 *
 * Nothing is cached: filtering rebuilds the board, so both ends move when a filter changes which
 * records survive.
 */
function trim(
  bands: readonly BandView[],
  weeks: readonly WeekBandDto[],
  hasRecords: (band: BandView) => boolean,
): readonly BandView[] {
  const first = bands.findIndex(hasRecords);
  if (first >= 0) {
    return bands.slice(first, lastIndexOf(bands, hasRecords) + 1);
  }

  // Nothing in this column at all. Rather than render nothing, show the current week alone so the
  // operator still sees where "now" is; its empty-band row then says the week is empty. The endpoint
  // always includes the current week, so the -1 fallback is defensive only.
  const current = weeks.findIndex((week) => week.isCurrentWeek);
  const only = current >= 0 ? current : 0;

  return bands.slice(only, only + 1);
}

/** `Array.prototype.findLastIndex` is ES2023; this codebase does not assume that lib. */
function lastIndexOf(
  bands: readonly BandView[],
  hasRecords: (band: BandView) => boolean,
): number {
  for (let i = bands.length - 1; i >= 0; i--) {
    if (hasRecords(bands[i])) {
      return i;
    }
  }

  return -1;
}

function freeze(band: BandBuilder): BandView {
  return {
    week: band.week,
    spaces: band.spaces,
    availability: band.availability,
    meta: {
      spaceCount: band.spaces.length,
      spaceHead: sum(band.spaces.map((s) => s.quantityRequired)),
      availabilityCount: band.availability.length,
      availabilityHead: sum(band.availability.map((a) => a.quantityAvailable)),
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
