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
  'ChangeFromAgentOrFarmer' | 'ChangeFromProcessor' | 'InternalDecisionByApg';

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
  /**
   * The Processor Space's stored status, and below it the availability record's derived one.
   *
   * Both parents' statuses ride on a match because a match is rendered inside the *other* record's
   * card, which holds none of its counterparty's own fields. Cancelling a record never cascades, so a
   * live match under a cancelled parent is a normal state — and the far side has to be able to say so
   * rather than leave it to be inferred.
   */
  readonly spaceStatus: ProcessorSpaceStatus;
  /** ISO `yyyy-MM-dd`. Render `deliveryDateLabel` instead. */
  readonly deliveryDate: string;
  readonly deliveryDateLabel: string;
  readonly deliveryTime: string | null;

  // the supply side
  readonly livestockAvailabilityId: number;
  readonly farmerName: string | null;
  readonly locationName: string | null;
  readonly availabilityStockClass: string;
  readonly availabilityStatus: LivestockAvailabilityStatus;
  readonly availabilityDetails: string | null;
  /** ISO `yyyy-MM-dd`. Render `availableFromLabel` instead. */
  readonly availableFrom: string;
  readonly availableFromLabel: string;
}

/**
 * The answer to "may these two records be matched, and on what terms?", asked at the moment of the
 * drop and before any dialog opens.
 *
 * Every figure on it is the server's: the default quantity, the ceiling, the refusal message and the
 * default price. **The client does not work out a match quantity** — `min(unmatched, unmatched)`, the
 * supply-side cap and the deliberately absent demand-side cap are domain rules with one
 * implementation, in C#.
 */
export interface MatchProposalDto {
  readonly isAllowed: boolean;
  /** Exactly the domain's constant when refused, and rendered as given. Null when allowed. */
  readonly refusalMessage: string | null;
  readonly quantity: number;
  /** The availability record's unmatched figure. There is no ceiling on the space side. */
  readonly maximum: number;
  /** Keyed on the **Processor Space** stock class. Null when the table has no entry. */
  readonly defaultPricePerKg: number | null;
}

/** A new match, as the quantity prompt submits it. Always created at status `Drafted`. */
export interface CreateMatchRequest {
  readonly processorSpaceId: number;
  readonly livestockAvailabilityId: number;
  readonly quantityMatched: number;
  readonly pricePerKg: number | null;
  readonly transportCompany: string | null;
}

/**
 * What creating or deleting a match returns: the match, and **both** parents recomputed.
 *
 * Both sides come back together because a match changes both at once, and they are the server's own
 * recomputation rather than an adjustment made here. The screen replaces the two records it holds by
 * id, and every derived figure on both cards moves with them.
 */
export interface MatchWriteResultDto {
  /**
   * The match as it now stands, or null when there is no longer one to show.
   *
   * Null for two different acts with the same visible consequence: the match was **deleted** (a
   * drafted mis-drag, removed outright), or it was **cancelled** — kept, with its reason, but excluded
   * from both parents' collections, which is precisely what makes it leave the matching screen. Pass 1
   * has no Match list view, so a cancelled match is then not visible anywhere.
   */
  readonly match: MatchDto | null;
  readonly space: ProcessorSpaceDto;
  readonly availability: LivestockAvailabilityDto;
}

/**
 * Everything the match modal opens with: the match, **both** parents in full, and the edit ceiling.
 *
 * Both parents ship whole rather than as the denormalised fields already on `MatchDto`, because the
 * modal shows each parent's status, original quantity and unmatched figure and none of those is on the
 * match. It is fetched **by match id alone**, which is what makes the same match openable from its
 * space and from its availability record without two code paths.
 *
 * `maximumQuantity` is the availability's unmatched quantity **plus this match's own current
 * quantity** (resolved question 13) — the match is already subtracted out of that unmatched figure, so
 * without adding it back the operator could not even keep what they have. It arrives computed for the
 * usual reason and one more: working it out here would be `availability.unmatched +
 * match.quantityMatched`, which is domain arithmetic in TypeScript.
 */
export interface MatchEditContextDto {
  readonly match: MatchDto;
  readonly space: ProcessorSpaceDto;
  readonly availability: LivestockAvailabilityDto;
  /** The highest quantity this match may be edited to. There is no ceiling on the demand side. */
  readonly maximumQuantity: number;
}

/**
 * The three editable fields of an existing match, as the modal submits them.
 *
 * The same body goes to the confirm endpoint, so a match with unsaved edits confirms in one validated
 * write rather than in two chained calls that can half-fail.
 */
export interface UpdateMatchRequest {
  readonly quantityMatched: number;
  readonly pricePerKg: number | null;
  readonly transportCompany: string | null;
}

/** Why a match is being cancelled. One of exactly three reasons, and never absent. */
export interface CancelMatchRequest {
  readonly reason: MatchCancellationReason;
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
  /**
   * Why Confirm is unavailable, or null when it is available — never both null and `canConfirm` false.
   *
   * Printed beside the disabled button. A control that greys out for unstated reasons is exactly what
   * makes a non-technical operator conclude the application is broken, and the three answers
   * ("already confirmed", "this space is cancelled", "needs at least one confirmed match and no
   * drafts") are not recoverable from a boolean. The wording is the domain's.
   */
  readonly confirmBlockedReason: string | null;
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

// -------------------------------------------------------------------------------------------------
// Phase 7 — debug record creation. Mirrors `src/Apg.Api/Contracts/Dtos.cs`, field for field.
// -------------------------------------------------------------------------------------------------

/**
 * The vocabularies the two debug forms pick from.
 *
 * **Not derived from the loaded records**, unlike the filter row's options: a stock class no record
 * happens to use is still a valid choice for a new one. These come from `SeedConfig` on the server,
 * the single home for every invented list, so APG's real values stay a one-file swap.
 *
 * The two stock-class vocabularies sit side by side here and are never cross-referenced. A processor's
 * classes are its own; supply has one separate list; there is no mapping and nothing may build one.
 */
export interface ReferenceDataDto {
  readonly processors: readonly ProcessorOptionDto[];
  readonly availabilityStockClasses: readonly string[];
  readonly transactionTypes: readonly TransactionType[];
}

/** One processor with the two lists that are its own — choosing it selects both. */
export interface ProcessorOptionDto {
  readonly name: string;
  readonly plants: readonly string[];
  readonly stockClasses: readonly string[];
}

/**
 * A location and the farmer it belongs to. Picking the location settles the farmer (resolved question
 * 10), and the name comes back so the form can show who was chosen.
 */
export interface LocationOptionDto {
  readonly id: number;
  readonly name: string;
  readonly farmerName: string | null;
  readonly farmerMobile: string | null;
}

/**
 * What a record write returns: the one record it touched, and the recomputed week calendar.
 *
 * **`weeks` is not optional bookkeeping.** A record is placed into a band by string equality on its
 * week-commencing Sunday against the calendar, so a record whose week is not in the list places
 * nowhere and disappears. A create — or an edit that moves a date — can move that range, and naming a
 * new week in TypeScript would mean advancing a date here, which the architecture forbids.
 */
export interface RecordWriteResultDto {
  readonly space: ProcessorSpaceDto | null;
  readonly availability: LivestockAvailabilityDto | null;
  readonly weeks: readonly WeekBandDto[];
}

/** A new Processor Space. Status is absent: a space is `Booked` on creation and moves by APG action. */
export interface CreateProcessorSpaceRequest {
  readonly processor: string;
  readonly plant: string;
  readonly stockClass: string;
  readonly quantityRequired: number;
  /** ISO `yyyy-MM-dd`, straight off a native date input. Past dates are allowed. */
  readonly deliveryDate: string;
  readonly deliveryTime: string | null;
  readonly notes: string | null;
}

/**
 * The editable fields of an existing space (requirement 4.2).
 *
 * **Processor and stock class are deliberately absent**: they are what the meatworks booked, and
 * re-pointing a slot at another processor would re-key its default price and invalidate its plant.
 */
export interface UpdateProcessorSpaceRequest {
  readonly plant: string;
  readonly quantityRequired: number;
  readonly deliveryDate: string;
  readonly deliveryTime: string | null;
  readonly notes: string | null;
}

/**
 * A new Livestock Availability record.
 *
 * Transaction type is a plain value: choosing `FinanceStock` opens no Purchase list and draws nothing
 * down against `purchases.csv`. That linkage is deferred past pass 1 and its absence is deliberate.
 */
export interface CreateLivestockAvailabilityRequest {
  readonly stockClass: string;
  readonly quantityAvailable: number;
  readonly locationId: number;
  readonly availableFrom: string;
  readonly availabilityDetails: string | null;
  readonly transactionType: TransactionType;
  readonly notes: string | null;
}

/** Every attribute of an existing availability record (requirement 4.3), which really is every one. */
export interface UpdateLivestockAvailabilityRequest {
  readonly stockClass: string;
  readonly quantityAvailable: number;
  readonly locationId: number;
  readonly availableFrom: string;
  readonly availabilityDetails: string | null;
  readonly transactionType: TransactionType;
  readonly notes: string | null;
}
