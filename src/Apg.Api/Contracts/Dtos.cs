using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Contracts;

/// <summary>
/// The DTO contract every phase from 3 onwards codes against.
/// </summary>
/// <remarks>
/// <para>
/// <b>Every number a card displays arrives here already computed.</b> The Angular client renders what
/// it is given and never recomputes a domain value in TypeScript — the moment the same rule exists in
/// both languages the two drift and the numbers quietly disagree. If a later phase finds itself
/// needing a figure that is not on these types, the fix is to add it here and compute it in
/// <c>Apg.Domain</c>, never to work it out in the browser.
/// </para>
/// <para>
/// <b>Every business date ships twice</b>: as an ISO <c>yyyy-MM-dd</c> string and as a preformatted
/// display label. The client renders the label. It must not construct a JavaScript <c>Date</c> from
/// the ISO value, because that hands the browser's timezone a decision this design settles on the
/// server.
/// </para>
/// </remarks>
public sealed record ProcessorSpaceDto
{
    // --- stored ---
    public required int Id { get; init; }

    public required string Processor { get; init; }

    public required string Plant { get; init; }

    /// <summary>From this processor's own list. Does not map onto an availability stock class.</summary>
    public required string StockClass { get; init; }

    public required int QuantityRequired { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly DeliveryDate { get; init; }

    /// <summary>The same date preformatted for display, in LMS's <c>dd-MM-yy</c>.</summary>
    public required string DeliveryDateLabel { get; init; }

    /// <summary>
    /// The day of the month alone — <c>26</c>. The matching card's date cell splits the date over the
    /// two lines the card already has: this on line 1, <see cref="DeliveryMonthLabel"/> directly
    /// beneath it. Both halves ship because neither is derivable client-side and the pair replaces one
    /// clipped <c>dd-MM-yy</c> in a 50px cell.
    /// </summary>
    public required string DeliveryDayLabel { get; init; }

    /// <summary>The abbreviated month — <c>Aug</c>. The card upper-cases it; the wire does not.</summary>
    public required string DeliveryMonthLabel { get; init; }

    public required string? DeliveryTime { get; init; }

    public required string? Notes { get; init; }

    /// <summary>Stored, never derived: Booked on creation, Confirmed or Cancelled by APG action.</summary>
    public required ProcessorSpaceStatus Status { get; init; }

    // --- computed in Apg.Domain ---

    /// <summary>Sum of live matches including drafts. APG-only.</summary>
    public required int MatchedInclDraft { get; init; }

    /// <summary>Sum excluding drafts. What a processor would be shown, as "Quantity Matched".</summary>
    public required int MatchedExclDraft { get; init; }

    /// <summary>
    /// The difference between the two sums — the quantity held by Drafted matches alone. The expanded
    /// card names it beside the incl-Draft figure, and it is the number the space's confirm gate turns
    /// on. On the wire rather than composed client-side because that would be arithmetic on two DTO
    /// quantity fields.
    /// </summary>
    public required int DraftedQuantity { get; init; }

    /// <summary>Required minus incl-Draft matched. Negative when over-filled, which is permitted.</summary>
    public required int Unmatched { get; init; }

    /// <summary>
    /// The unmatched figure as it is <b>printed</b>: its magnitude, no sign. Over-filled is stated by
    /// the ramp's ink, by <see cref="QuantityStateLabel"/> and by the meter's over-run cap, so the
    /// minus was a fourth statement of it spending a character in the narrowest column on the screen.
    /// Every surface that prints this figure renders this field; <see cref="Unmatched"/> stays signed
    /// for the rules and for the meter's hover string.
    /// </summary>
    public required string UnmatchedLabel { get; init; }

    public required QuantityState QuantityState { get; init; }

    /// <summary>"Under-filled" / "Filled" / "Over-filled".</summary>
    public required string QuantityStateLabel { get; init; }

    /// <summary>The Sunday of the delivery date's week. ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly WeekCommencing { get; init; }

    /// <summary>The same Sunday preformatted. Phase 3's band header composes "Week of …" around it.</summary>
    public required string WeekCommencingLabel { get; init; }

    /// <summary>Booked, at least one live match, and every live match Confirmed.</summary>
    public required bool CanConfirm { get; init; }

    /// <summary>
    /// Why Confirm is unavailable, or null when it is available. Never both null and
    /// <see cref="CanConfirm"/> false.
    /// </summary>
    /// <remarks>
    /// It ships beside the flag because a disabled control that cannot say why is what makes a
    /// non-technical operator conclude the application is broken (Phase 6, 5.3) — and because the three
    /// answers ("already confirmed", "this space is cancelled", "needs at least one confirmed match and
    /// no drafts") are not distinguishable from a boolean. The wording is
    /// <c>ProcessorSpaceRules</c>'s, so the gate and its explanation are one piece of logic.
    /// </remarks>
    public required string? ConfirmBlockedReason { get; init; }

    /// <summary>
    /// The stock-class compatibility tags, from <c>StockClassCompatibility</c> — what the matching
    /// screen's "Filter on drag" aid compares between a grabbed card and the cards on the far side.
    /// </summary>
    /// <remarks>
    /// Tags rather than a list of the other vocabulary's class names, because one generic class
    /// (Alliance Group's <c>Cattle</c>) stands over several specific ones and the cross product does
    /// not belong on the wire. Two records are compatible when their two tag lists intersect, which is
    /// the only test the client performs on them; the table itself, the fail-open rule for a class it
    /// has never heard of, and the decision that Lamb and Mutton are not interchangeable all stay in
    /// the domain. <b>Nothing is gated on this.</b> Compatibility is a human judgement — the two
    /// vocabularies do not map onto each other — so no endpoint refuses a match for disagreeing with
    /// it, and turning the aid off puts every record back.
    /// </remarks>
    public required IReadOnlyList<string> StockClassGroups { get; init; }

    /// <summary>Live matches only — cancelled ones are excluded (resolved question 4).</summary>
    public required IReadOnlyList<MatchDto> Matches { get; init; }
}

/// <inheritdoc cref="ProcessorSpaceDto"/>
public sealed record LivestockAvailabilityDto
{
    // --- stored ---
    public required int Id { get; init; }

    /// <summary>From the single availability list. Does not map onto a processor's list.</summary>
    public required string StockClass { get; init; }

    public required int QuantityAvailable { get; init; }

    public required int LocationId { get; init; }

    public required string? LocationName { get; init; }

    /// <summary>Derived from the location: each location belongs to exactly one farmer.</summary>
    public required int? FarmerId { get; init; }

    public required string? FarmerName { get; init; }

    public required string? FarmerMobile { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly AvailableFrom { get; init; }

    /// <summary>The same date preformatted for display, in LMS's <c>dd-MM-yy</c>.</summary>
    public required string AvailableFromLabel { get; init; }

    /// <summary>
    /// The same date again in the prose form — <c>17 Aug</c>.
    /// </summary>
    /// <remarks>
    /// Nothing on the client renders it since Phase 3b, which removed the one row that did. Kept on the
    /// contract deliberately — dropping it is a wire-format change for no gain, and a compact date is
    /// what a Phase 4 filter chip would want.
    /// </remarks>
    public required string AvailableFromShortLabel { get; init; }

    /// <summary>
    /// The day of the month alone — <c>24</c> — for the card's split date cell. The supply card and the
    /// demand card share one geometry, so both sides carry both halves.
    /// </summary>
    public required string AvailableFromDayLabel { get; init; }

    /// <summary>The abbreviated month — <c>Aug</c>. The card upper-cases it; the wire does not.</summary>
    public required string AvailableFromMonthLabel { get; init; }

    public required string? AvailabilityDetails { get; init; }

    public required TransactionType TransactionType { get; init; }

    public required string? Notes { get; init; }

    // --- computed in Apg.Domain ---

    /// <summary>
    /// <b>Derived from the match set</b>, not the stored column: Booked with no live matches, Pending
    /// while matching is underway, Confirmed only when unmatched is exactly zero and every match is
    /// Confirmed or Cancelled. Cancelled when explicitly cancelled.
    /// </summary>
    public required LivestockAvailabilityStatus Status { get; init; }

    public required int MatchedInclDraft { get; init; }

    public required int MatchedExclDraft { get; init; }

    /// <summary>
    /// The difference between the two sums — the quantity held by Drafted matches alone. The expanded
    /// card names it beside the incl-Draft figure, so how much of this record's commitment is still
    /// provisional is stated rather than added up off the match table. On the wire rather than
    /// composed client-side because that would be arithmetic on two DTO quantity fields.
    /// </summary>
    public required int DraftedQuantity { get; init; }

    /// <summary>
    /// Available minus incl-Draft matched. Should never be negative — a match is hard-capped at
    /// remaining supply — and the Over state exists to make it visible if it ever is.
    /// </summary>
    public required int Unmatched { get; init; }

    /// <summary>
    /// The unmatched figure as it is <b>printed</b>: its magnitude, no sign. Over-filled is stated by
    /// the ramp's ink, by <see cref="QuantityStateLabel"/> and by the meter's over-run cap, so the
    /// minus was a fourth statement of it spending a character in the narrowest column on the screen.
    /// Every surface that prints this figure renders this field; <see cref="Unmatched"/> stays signed
    /// for the rules and for the meter's hover string.
    /// </summary>
    public required string UnmatchedLabel { get; init; }

    public required QuantityState QuantityState { get; init; }

    /// <summary>"Under-committed" / "Fully committed" / "Over-committed".</summary>
    public required string QuantityStateLabel { get; init; }

    /// <summary>The Sunday of the available-from week. ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly WeekCommencing { get; init; }

    public required string WeekCommencingLabel { get; init; }

    /// <summary>
    /// The stock-class compatibility tags, from <c>StockClassCompatibility</c> — what the matching
    /// screen's "Filter on drag" aid compares between a grabbed card and the cards on the far side.
    /// </summary>
    /// <remarks>
    /// Tags rather than a list of the other vocabulary's class names, because one generic class
    /// (Alliance Group's <c>Cattle</c>) stands over several specific ones and the cross product does
    /// not belong on the wire. Two records are compatible when their two tag lists intersect, which is
    /// the only test the client performs on them; the table itself, the fail-open rule for a class it
    /// has never heard of, and the decision that Lamb and Mutton are not interchangeable all stay in
    /// the domain. <b>Nothing is gated on this.</b> Compatibility is a human judgement — the two
    /// vocabularies do not map onto each other — so no endpoint refuses a match for disagreeing with
    /// it, and turning the aid off puts every record back.
    /// </remarks>
    public required IReadOnlyList<string> StockClassGroups { get; init; }

    /// <summary>Live matches only — cancelled ones are excluded (resolved question 4).</summary>
    public required IReadOnlyList<MatchDto> Matches { get; init; }
}

/// <summary>
/// One week of the matching screen's banded timeline.
/// </summary>
/// <remarks>
/// <para>
/// The band list is a <b>calendar scaffold</b>, and it exists because an empty week still has to
/// render its header. A week with no records in it cannot supply its own name, so if the client built
/// the sequence it would have to add seven days to an ISO string — the exact date arithmetic that
/// belongs on the server. With the ordered list in hand the client bands records by string equality on
/// <c>weekCommencing</c> and trims each column's leading empty weeks by slicing this array, so no
/// date is ever parsed or advanced in TypeScript.
/// </para>
/// <para>
/// It deliberately carries <b>no record ids</b>. A record's week is already on the record, and putting
/// the membership here as well would create a second place a record's identity lives. Band membership
/// is a property of the record, and exactly one band draws it.
/// </para>
/// </remarks>
public sealed record WeekBandDto
{
    /// <summary>The Sunday the week commences. ISO <c>yyyy-MM-dd</c>, and the band's identity.</summary>
    public required DateOnly WeekCommencing { get; init; }

    /// <summary>LMS's <c>dd-MM-yy</c> form, for anywhere the band appears as a value.</summary>
    public required string WeekCommencingLabel { get; init; }

    /// <summary>
    /// The prose form — <c>16 Aug</c>. The band header and the week rail put "Week of" in front of it
    /// themselves, because the rail stacks the two on separate lines.
    /// </summary>
    public required string WeekOfLabel { get; init; }

    /// <summary>
    /// The week containing today in New Zealand. Exactly one band in the list has this set: the range
    /// always includes the current week, even when no record falls in it.
    /// </summary>
    public required bool IsCurrentWeek { get; init; }

    /// <summary>
    /// Before the current week. Past weeks are de-emphasised, never hidden — their records are still
    /// live and still matchable.
    /// </summary>
    public required bool IsPastWeek { get; init; }
}

/// <summary>
/// The answer to "may these two records be matched, and on what terms?" — computed at the moment of
/// the drop, before any dialog opens.
/// </summary>
/// <remarks>
/// <para>
/// It exists so the client never works out a match quantity. The default, the ceiling and the refusal
/// are <c>Apg.Domain.Matching.MatchCreation</c>'s answers, and the refusal message is its constant
/// rather than a sentence composed in TypeScript.
/// </para>
/// <para>
/// <b><see cref="Maximum"/> is the availability record's remaining supply and there is no ceiling on
/// the Processor Space side</b> (resolved question 1). Over-filling demand is permitted and reads as
/// "Over-filled"; over-committing supply is not, because the farmer does not have the animals.
/// </para>
/// </remarks>
public sealed record MatchProposalDto
{
    /// <summary>False when the pair has nothing left to match. Nothing else on the record is useful.</summary>
    public required bool IsAllowed { get; init; }

    /// <summary>
    /// Exactly <c>MatchCreation.NoUnmatchedQuantity</c> when refused, null otherwise. The client shows
    /// this string; it does not compose one.
    /// </summary>
    public required string? RefusalMessage { get; init; }

    /// <summary>The quantity the prompt opens at: the smaller of the two unmatched figures.</summary>
    public required int Quantity { get; init; }

    /// <summary>The highest quantity the operator may enter — the availability's unmatched figure.</summary>
    public required int Maximum { get; init; }

    /// <summary>
    /// From the price table, keyed on processor x <b>Processor Space</b> stock class x week commencing
    /// (resolved question 7). Null when the table has no entry, which the prompt says plainly rather
    /// than showing a blank or a zero.
    /// </summary>
    public required decimal? DefaultPricePerKg { get; init; }
}

/// <summary>
/// A new match, as the drag's dialog submits it.
/// </summary>
/// <remarks>
/// Nothing here is <c>required</c>: a malformed body should come back as this API's own validation
/// message rather than as a serialiser exception. The server revalidates every field regardless of
/// what the dialog allowed.
/// </remarks>
public sealed record CreateMatchRequest
{
    public int ProcessorSpaceId { get; init; }

    public int LivestockAvailabilityId { get; init; }

    public int QuantityMatched { get; init; }

    public decimal? PricePerKg { get; init; }

    public string? TransportCompany { get; init; }
}

/// <summary>
/// What a write to the match set returns: the match, and <b>both</b> parents recomputed.
/// </summary>
/// <remarks>
/// Both parents ship together because a match changes both sides at once — both matched sums, both
/// unmatched figures, both quantity states, and the availability record's derived status. Returning
/// them lets the client update both columns from one response instead of refetching two lists, and
/// keeps the figures on screen the server's own rather than a client-side adjustment of them.
/// </remarks>
public sealed record MatchWriteResultDto
{
    /// <summary>
    /// The match as it now stands, or null when there is no longer one to show.
    /// </summary>
    /// <remarks>
    /// Null in two cases, and they are different acts with the same visible consequence: the match was
    /// <b>deleted</b> (a drafted mis-drag, removed outright), or it was <b>cancelled</b> — a cancelled
    /// match is kept but excluded from both parents' collections (resolved question 4), which is
    /// precisely what makes it leave the matching screen. Pass 1 has no Match list view, so a cancelled
    /// match is then not visible anywhere.
    /// </remarks>
    public required MatchDto? Match { get; init; }

    public required ProcessorSpaceDto Space { get; init; }

    public required LivestockAvailabilityDto Availability { get; init; }
}

/// <summary>
/// One match, carrying enough of <b>both</b> parents to render inside either one's expanded card.
/// </summary>
/// <remarks>
/// One type rather than two counterparty-specific ones. The same object hangs off both parents, so a
/// drag creates a single shape that both cards can show, and Phase 6's match dialog has everything on
/// one object. It costs a few redundant bytes per match. Both stock classes are carried deliberately:
/// the two vocabularies not lining up is the point of the screen, and showing only one side's class
/// would force a lookup to see what was actually matched to what.
/// </remarks>
public sealed record MatchDto
{
    public required int Id { get; init; }

    public required int QuantityMatched { get; init; }

    /// <summary>Defaulted from the price table at draft time, editable thereafter. Null when unpriced.</summary>
    public required decimal? PricePerKg { get; init; }

    public required string? TransportCompany { get; init; }

    public required MatchStatus Status { get; init; }

    /// <summary>
    /// Always null on these two endpoints, since cancelled matches are excluded from both DTOs. It is
    /// here so Phase 6's cancel response has somewhere to put it without reshaping the contract.
    /// </summary>
    public required MatchCancellationReason? CancellationReason { get; init; }

    /// <summary>An instant, not a business date — this one genuinely has a time and a zone.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    // --- the demand side ---
    public required int ProcessorSpaceId { get; init; }

    public required string Processor { get; init; }

    public required string Plant { get; init; }

    public required string SpaceStockClass { get; init; }

    /// <summary>
    /// The Processor Space's <b>stored</b> status.
    /// </summary>
    /// <remarks>
    /// Denormalised here for the same reason the plant and the delivery date are: a match is rendered
    /// inside the <em>other</em> record's card, which holds none of its counterparty's own fields.
    /// Phase 7 needs it because cancelling a record never cascades — a live match hanging off a
    /// cancelled parent is a normal, deliberate state, and the card on the far side has to be able to
    /// say so rather than leave it to be inferred.
    /// </remarks>
    public required ProcessorSpaceStatus SpaceStatus { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly DeliveryDate { get; init; }

    public required string DeliveryDateLabel { get; init; }

    public required string? DeliveryTime { get; init; }

    // --- the supply side ---
    public required int LivestockAvailabilityId { get; init; }

    public required string? FarmerName { get; init; }

    public required string? LocationName { get; init; }

    public required string AvailabilityStockClass { get; init; }

    /// <summary>
    /// The availability record's <b>derived</b> status — the same value its own DTO carries, computed
    /// the same way. See <see cref="SpaceStatus"/> for why both sides' statuses ride on a match.
    /// </summary>
    public required LivestockAvailabilityStatus AvailabilityStatus { get; init; }

    public required string? AvailabilityDetails { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly AvailableFrom { get; init; }

    public required string AvailableFromLabel { get; init; }
}

/// <summary>
/// Everything the match modal opens with: the match, <b>both</b> parents in full, and the ceiling on
/// an edit.
/// </summary>
/// <remarks>
/// <para>
/// Both parents ship whole rather than as the denormalised fields already on <see cref="MatchDto"/>,
/// because the modal shows each parent's <em>status, original quantity and unmatched figure</em>
/// (Phase 6, 2.1 and 2.2) and none of those are on the match. It is fetched by match id alone, which
/// is what makes requirement 1.2 — the same match openable from its space and from its availability
/// record — true by construction rather than by two code paths.
/// </para>
/// <para>
/// <b><see cref="MaximumQuantity"/> is the availability's unmatched quantity plus this match's own
/// current quantity</b> (resolved question 13). The match is already subtracted out of that unmatched
/// figure, so without adding it back the operator could not even keep the quantity they have. The
/// requirements document says the availability record's <em>original</em> quantity; that is wrong, and
/// following it would permit the over-commit the pink "Over-committed" state exists to flag.
/// </para>
/// <para>
/// It is on the wire for the usual reason and one more: composing it in the client would be
/// <c>availability.unmatched + match.quantityMatched</c>, which is domain arithmetic in TypeScript and
/// which <c>no-domain-arithmetic.spec.ts</c> fails, correctly.
/// </para>
/// </remarks>
public sealed record MatchEditContextDto
{
    public required MatchDto Match { get; init; }

    public required ProcessorSpaceDto Space { get; init; }

    public required LivestockAvailabilityDto Availability { get; init; }

    /// <summary>The highest quantity this match may be edited to. There is no ceiling on demand.</summary>
    public required int MaximumQuantity { get; init; }
}

/// <summary>
/// The three editable fields of an existing match, as the modal submits them.
/// </summary>
/// <remarks>
/// <para>
/// All three are editable at every status (Phase 6, 3.1 to 3.3). The <em>prompt</em> before changing a
/// Confirmed match's quantity or transport is the client's, because it is a question for a human about
/// consequences rather than a rule about validity; the server's job is to enforce the ceiling and the
/// minimum whatever the dialog allowed.
/// </para>
/// <para>
/// The same body is posted to the confirm endpoint, so a match with unsaved edits confirms in one
/// validated write rather than in two chained calls that can half-fail.
/// </para>
/// </remarks>
public sealed record UpdateMatchRequest
{
    public int QuantityMatched { get; init; }

    public decimal? PricePerKg { get; init; }

    public string? TransportCompany { get; init; }
}

/// <summary>
/// Why a match is being cancelled — one of exactly three reasons.
/// </summary>
/// <remarks>
/// Nullable so that a body with no reason comes back as this API's own message ("choose why this match
/// is being cancelled") rather than as a serialiser exception. A cancellation without a reason is not a
/// cancellation.
/// </remarks>
public sealed record CancelMatchRequest
{
    public MatchCancellationReason? Reason { get; init; }
}

// -------------------------------------------------------------------------------------------------
// Phase 7 — debug record creation.
//
// These types serve the "+ Add" forms, which are demo scaffolding rather than the farmer/agent
// submission journey (deferred past pass 1). The endpoints behind them are nonetheless as strict as
// the match ones: a form is not a source of truth about a vocabulary.
// -------------------------------------------------------------------------------------------------

/// <summary>
/// The vocabularies a create form picks from.
/// </summary>
/// <remarks>
/// <para>
/// The filter row derives its options from the records that are loaded, which is right for a filter
/// and wrong for a form: a stock class no record happens to use is still a valid choice for a new one.
/// So these come from <c>SeedConfig</c>, the single file the roadmap designates for every invented
/// list (resolved question 11), and swapping in APG's real values stays a one-file edit.
/// </para>
/// <para>
/// <b>The two stock-class vocabularies ship side by side and are never cross-referenced.</b> A
/// Processor Space's classes are that processor's own; an availability record's come from one separate
/// list; there is no mapping between them and nothing here may grow one.
/// </para>
/// </remarks>
public sealed record ReferenceDataDto
{
    public required IReadOnlyList<ProcessorOptionDto> Processors { get; init; }

    /// <summary>The single supply-side list. Not a processor's, and never validated against one.</summary>
    public required IReadOnlyList<string> AvailabilityStockClasses { get; init; }

    public required IReadOnlyList<TransactionType> TransactionTypes { get; init; }
}

/// <summary>One processor, with the two lists that are its own: its plants and its stock classes.</summary>
/// <remarks>
/// Nested rather than three parallel maps so the pickers cannot come to disagree about which plant
/// belongs to whom — choosing a processor selects one object and both dependent lists with it.
/// </remarks>
public sealed record ProcessorOptionDto
{
    public required string Name { get; init; }

    public required IReadOnlyList<string> Plants { get; init; }

    public required IReadOnlyList<string> StockClasses { get; init; }
}

/// <summary>
/// A location and the farmer it belongs to, for the availability form's location picker.
/// </summary>
/// <remarks>
/// Each location belongs to exactly one farmer (resolved question 10), so picking the location settles
/// the farmer. The farmer's name and mobile ride along so the form can show back who was just chosen
/// without a call per keystroke.
/// </remarks>
public sealed record LocationOptionDto
{
    public required int Id { get; init; }

    public required string Name { get; init; }

    public required string? FarmerName { get; init; }

    public required string? FarmerMobile { get; init; }
}

/// <summary>
/// What a record write returns: the record it touched, and the recomputed week calendar.
/// </summary>
/// <remarks>
/// <para>
/// One record, not both. Creating, editing or cancelling a Processor Space touches no availability
/// record, and the reverse — including on a cancellation, which deliberately leaves every match, and
/// therefore every counterparty record, exactly as it was.
/// </para>
/// <para>
/// <b><see cref="Weeks"/> is the load-bearing field.</b> The client places a record into a band by
/// string equality on its week-commencing Sunday against the calendar from
/// <c>GET /api/week-bands</c>, and a record whose week is not in that list places nowhere and
/// disappears off the screen. A create — or an edit that moves a date — can extend or shrink the run,
/// so the recomputed calendar comes back with every write. The alternative is a second round trip, or
/// advancing a date in TypeScript, which the architecture forbids.
/// </para>
/// </remarks>
public sealed record RecordWriteResultDto
{
    public required ProcessorSpaceDto? Space { get; init; }

    public required LivestockAvailabilityDto? Availability { get; init; }

    public required IReadOnlyList<WeekBandDto> Weeks { get; init; }
}

/// <summary>
/// A new Processor Space, as the debug form submits it.
/// </summary>
/// <remarks>
/// Nothing is <c>required</c> and the date is nullable, so a missing field comes back as this API's own
/// validation message rather than as a serialiser exception. <b>Status is not here</b>: a space is
/// <c>Booked</c> on creation and moves only by explicit APG action (requirement 2.8).
/// </remarks>
public sealed record CreateProcessorSpaceRequest
{
    public string? Processor { get; init; }

    public string? Plant { get; init; }

    public string? StockClass { get; init; }

    public int QuantityRequired { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>. Past dates are allowed — APG enter records after the fact.</summary>
    public DateOnly? DeliveryDate { get; init; }

    /// <summary>One optional free-text field in pass 1 (resolved question 9).</summary>
    public string? DeliveryTime { get; init; }

    public string? Notes { get; init; }
}

/// <summary>
/// The editable fields of an existing Processor Space (requirement 4.2).
/// </summary>
/// <remarks>
/// <b>Processor and stock class are absent on purpose.</b> Requirement 4.2 lists quantity required,
/// plant, delivery date, delivery time and notes and no more: the processor and the class are what the
/// meatworks booked, and re-pointing an existing slot at a different processor would silently re-key
/// its default price and invalidate the plant on it. The form renders both read-only.
/// </remarks>
public sealed record UpdateProcessorSpaceRequest
{
    public string? Plant { get; init; }

    public int QuantityRequired { get; init; }

    public DateOnly? DeliveryDate { get; init; }

    public string? DeliveryTime { get; init; }

    public string? Notes { get; init; }
}

/// <summary>A new Livestock Availability record, as the debug form submits it.</summary>
/// <remarks>
/// <b>Transaction type is captured as a plain value.</b> Selecting <c>FinanceStock</c> opens no
/// Purchase list and draws nothing down against <c>purchases.csv</c> — that linkage is deferred past
/// pass 1, and its absence here is deliberate rather than unfinished.
/// </remarks>
public sealed record CreateLivestockAvailabilityRequest
{
    public string? StockClass { get; init; }

    public int QuantityAvailable { get; init; }

    /// <summary>The farmer follows from this (resolved question 10); no farmer id is stored.</summary>
    public int LocationId { get; init; }

    public DateOnly? AvailableFrom { get; init; }

    public string? AvailabilityDetails { get; init; }

    public TransactionType? TransactionType { get; init; }

    public string? Notes { get; init; }
}

/// <summary>
/// Every attribute of an existing availability record (requirement 4.3), which really is every one.
/// </summary>
/// <remarks>
/// The same fields as the create request, and a separate type anyway: the two coincide today by
/// accident of the spec rather than by rule, and sharing one would make requirement 4.2's deliberately
/// shorter demand-side list look like an oversight instead of a decision.
/// </remarks>
public sealed record UpdateLivestockAvailabilityRequest
{
    public string? StockClass { get; init; }

    public int QuantityAvailable { get; init; }

    public int LocationId { get; init; }

    public DateOnly? AvailableFrom { get; init; }

    public string? AvailabilityDetails { get; init; }

    public TransactionType? TransactionType { get; init; }

    public string? Notes { get; init; }
}
