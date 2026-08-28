/**
 * The DTO contract, mirroring `src/Apg.Api/Contracts/Dtos.cs` field for field.
 *
 * THE RULE THIS FILE EXISTS TO PROTECT: the client renders what it is given and **never recomputes a
 * domain value in TypeScript**. Every number a card displays already arrives here — both matched
 * sums, the unmatched figure, the quantity state, the derived availability status, the confirm gate,
 * the week-commencing Sunday. If a screen needs a figure that is not on these types, add it to the
 * C# DTO and compute it in `Apg.Domain`. The moment the same rule exists in both languages the two
 * drift and the numbers quietly disagree — which, for a tool APG uses to commit real livestock, is
 * the worst failure available.
 *
 * The same goes for dates. Every business date arrives twice: an ISO `yyyy-MM-dd` string and a
 * preformatted label. **Render the label. Never construct a JavaScript `Date` from the ISO value** —
 * that hands the browser's timezone a decision the server has already settled, and a record in the
 * wrong week does not look like a bug, it just looks like it does not exist.
 */

/** Matched against the record's own quantity. Hue is Phase 2's to assign. */
export type QuantityState = 'Under' | 'Exact' | 'Over';

/** Not derived: Booked on creation, Confirmed or Cancelled by an explicit APG action. */
export type ProcessorSpaceStatus = 'Booked' | 'Confirmed' | 'Cancelled';

/** Derived from the match set, except Cancelled which is stored. Note there is no `Pending` on the space side. */
export type LivestockAvailabilityStatus = 'Booked' | 'Pending' | 'Confirmed' | 'Cancelled';

/** `Notified` exists but is unreachable in pass 1. Cancelled matches never reach the client. */
export type MatchStatus = 'Drafted' | 'Notified' | 'Confirmed' | 'Cancelled';

export type MatchCancellationReason =
  | 'ChangeFromAgentOrFarmer'
  | 'ChangeFromProcessor'
  | 'InternalDecisionByApg';

export type TransactionType = 'FinanceStock' | 'GrazingStock' | 'Other';

/**
 * One match, carrying enough of *both* parents to render inside either one's expanded card — so the
 * same object hangs off a space and off an availability record without a second lookup.
 *
 * Both stock classes are here deliberately. The two vocabularies do not map onto each other, and
 * which class was matched to which is the substance of what an operator decided.
 */
export interface MatchDto {
  readonly id: number;
  readonly quantityMatched: number;
  readonly pricePerKg: number | null;
  readonly transportCompany: string | null;
  readonly status: MatchStatus;
  /** Always null here: cancelled matches are excluded from both DTOs in pass 1. */
  readonly cancellationReason: MatchCancellationReason | null;
  /** An instant, not a business date — this one genuinely has a time and a zone. */
  readonly createdAt: string;

  // the demand side
  readonly processorSpaceId: number;
  readonly processor: string;
  readonly plant: string;
  readonly spaceStockClass: string;
  /** ISO `yyyy-MM-dd`. Render `deliveryDateLabel` instead. */
  readonly deliveryDate: string;
  readonly deliveryDateLabel: string;
  readonly deliveryTime: string | null;

  // the supply side
  readonly livestockAvailabilityId: number;
  readonly farmerName: string | null;
  readonly locationName: string | null;
  readonly availabilityStockClass: string;
  readonly availabilityDetails: string | null;
  /** ISO `yyyy-MM-dd`. Render `availableFromLabel` instead. */
  readonly availableFrom: string;
  readonly availableFromLabel: string;
}

/**
 * One week of the banded timeline both columns are drawn on.
 *
 * This arrives from the server for the same reason every other date does: an interior empty week
 * still renders its header, and a week with no records in it cannot supply its own name. Building the
 * sequence here would mean adding seven days to an ISO string. With the ordered array in hand,
 * banding is string equality on `weekCommencing` and trimming each column's leading empty weeks is a
 * slice of it — no `Date` is ever constructed and no day arithmetic is ever done.
 *
 * It deliberately carries no record ids: a record's week is on the record, and a second home for that
 * membership would be a second place its identity lives.
 */
export interface WeekBandDto {
  /** ISO `yyyy-MM-dd` Sunday, and the band's identity. Compare as a string; never parse it. */
  readonly weekCommencing: string;
  /** LMS's `dd-MM-yy` form. */
  readonly weekCommencingLabel: string;
  /** The prose form — `16 Aug`. The header renders `Week of {{ weekOfLabel }}`. */
  readonly weekOfLabel: string;
  /** Exactly one band in the list has this set; the range always includes the current week. */
  readonly isCurrentWeek: boolean;
  /** Before the current week. De-emphasised, never hidden. */
  readonly isPastWeek: boolean;
}

/** A meatworks' committed slot: the demand side. */
export interface ProcessorSpaceDto {
  readonly id: number;
  readonly processor: string;
  readonly plant: string;
  readonly stockClass: string;
  readonly quantityRequired: number;
  /** ISO `yyyy-MM-dd`. Render `deliveryDateLabel` instead. */
  readonly deliveryDate: string;
  readonly deliveryDateLabel: string;
  readonly deliveryTime: string | null;
  readonly notes: string | null;
  readonly status: ProcessorSpaceStatus;

  /** Sum of live matches including drafts. APG-only. */
  readonly matchedInclDraft: number;
  /** Sum excluding drafts. What a processor would be shown, labelled simply "Quantity Matched". */
  readonly matchedExclDraft: number;
  /** Required minus incl-Draft matched. Negative when over-filled, which is permitted here. */
  readonly unmatched: number;
  readonly quantityState: QuantityState;
  /** "Under-filled" / "Filled" / "Over-filled". */
  readonly quantityStateLabel: string;
  /** The Sunday of the delivery week. ISO `yyyy-MM-dd`. */
  readonly weekCommencing: string;
  readonly weekCommencingLabel: string;
  /** Booked, at least one live match, and every live match Confirmed. */
  readonly canConfirm: boolean;
  /** Live matches only — cancelled ones never reach the client. */
  readonly matches: readonly MatchDto[];
}

/** A farmer's stock on offer: the supply side. */
export interface LivestockAvailabilityDto {
  readonly id: number;
  readonly stockClass: string;
  readonly quantityAvailable: number;
  readonly locationId: number;
  readonly locationName: string | null;
  /** Derived from the location: each location belongs to exactly one farmer. */
  readonly farmerId: number | null;
  readonly farmerName: string | null;
  readonly farmerMobile: string | null;
  /** ISO `yyyy-MM-dd`. Render `availableFromLabel` instead. */
  readonly availableFrom: string;
  readonly availableFromLabel: string;
  /**
   * The prose form — `17 Aug`, beside the `dd-MM-yy` one.
   *
   * Nothing renders it today — Phase 3b removed the one row that did. Kept on the contract
   * deliberately: dropping it is a wire-format change for no gain, and a compact date is exactly what
   * a Phase 4 filter chip would want.
   */
  readonly availableFromShortLabel: string;
  readonly availabilityDetails: string | null;
  readonly transactionType: TransactionType;
  readonly notes: string | null;

  /** Derived from the match set, not read from storage. */
  readonly status: LivestockAvailabilityStatus;
  readonly matchedInclDraft: number;
  readonly matchedExclDraft: number;
  /** Available minus incl-Draft matched. Should never be negative; `Over` flags a bug. */
  readonly unmatched: number;
  readonly quantityState: QuantityState;
  /** "Under-committed" / "Fully committed" / "Over-committed". */
  readonly quantityStateLabel: string;
  /** The Sunday of the available-from week. ISO `yyyy-MM-dd`. */
  readonly weekCommencing: string;
  readonly weekCommencingLabel: string;
  readonly matches: readonly MatchDto[];
}
