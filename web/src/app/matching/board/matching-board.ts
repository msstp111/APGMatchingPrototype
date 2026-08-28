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
  /** The demand column's bands, from the week of its own earliest space onward. */
  readonly demand: readonly BandView[];

  /**
   * The supply column's bands, from the week of its own earliest record onward.
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
 * Drops the leading run of bands this column has nothing in, so the column starts at the week of its
 * own earliest surviving record.
 *
 * **Each column trims from its own records only.** A shared start week would hide a past-dated space
 * older than the earliest availability record, with nothing on screen to say it had — which is the
 * whole reason one band list no longer serves both columns.
 *
 * Only the *leading* run goes. An empty week between two populated ones keeps its header, because a
 * gap in the calendar is information, and trailing weeks are left alone.
 *
 * Nothing is cached: Phase 4 filters the inputs and calls `buildBoard` again, and the first band has
 * to move forward when a filter removes the oldest record.
 */
function trim(
  bands: readonly BandView[],
  weeks: readonly WeekBandDto[],
  hasRecords: (band: BandView) => boolean,
): readonly BandView[] {
  const first = bands.findIndex(hasRecords);
  if (first >= 0) {
    return bands.slice(first);
  }

  // Nothing in this column at all. Rather than render nothing, start at the current week so the
  // operator still sees where "now" is; the empty-band rows then say the weeks are empty. The
  // endpoint always includes the current week, so the -1 fallback is defensive only.
  const current = weeks.findIndex((week) => week.isCurrentWeek);

  return bands.slice(current >= 0 ? current : 0);
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
