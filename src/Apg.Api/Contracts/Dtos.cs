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

    public required string? DeliveryTime { get; init; }

    public required string? Notes { get; init; }

    /// <summary>Stored, never derived: Booked on creation, Confirmed or Cancelled by APG action.</summary>
    public required ProcessorSpaceStatus Status { get; init; }

    // --- computed in Apg.Domain ---

    /// <summary>Sum of live matches including drafts. APG-only.</summary>
    public required int MatchedInclDraft { get; init; }

    /// <summary>Sum excluding drafts. What a processor would be shown, as "Quantity Matched".</summary>
    public required int MatchedExclDraft { get; init; }

    /// <summary>Required minus incl-Draft matched. Negative when over-filled, which is permitted.</summary>
    public required int Unmatched { get; init; }

    public required QuantityState QuantityState { get; init; }

    /// <summary>"Under-filled" / "Filled" / "Over-filled".</summary>
    public required string QuantityStateLabel { get; init; }

    /// <summary>The Sunday of the delivery date's week. ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly WeekCommencing { get; init; }

    /// <summary>The same Sunday preformatted. Phase 3's band header composes "Week of …" around it.</summary>
    public required string WeekCommencingLabel { get; init; }

    /// <summary>Booked, at least one live match, and every live match Confirmed.</summary>
    public required bool CanConfirm { get; init; }

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
    /// The same date again in the prose form — <c>17 Aug</c>. The carry-over card reads "since 17 Aug",
    /// so the client supplies the word and this supplies the date.
    /// </summary>
    public required string AvailableFromShortLabel { get; init; }

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
    /// Available minus incl-Draft matched. Should never be negative — a match is hard-capped at
    /// remaining supply — and the Over state exists to make it visible if it ever is.
    /// </summary>
    public required int Unmatched { get; init; }

    public required QuantityState QuantityState { get; init; }

    /// <summary>"Under-committed" / "Fully committed" / "Over-committed".</summary>
    public required string QuantityStateLabel { get; init; }

    /// <summary>The Sunday of the available-from week. ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly WeekCommencing { get; init; }

    public required string WeekCommencingLabel { get; init; }

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
/// <c>weekCommencing</c> and places carry-overs by comparing positions in this array, so no date is
/// ever parsed or advanced in TypeScript.
/// </para>
/// <para>
/// It deliberately carries <b>no record ids</b>. A record's week is already on the record, and putting
/// the membership here as well would create a second place a record's identity lives — which is the
/// one thing the carry-over card cannot afford, since it is the same record rendered twice.
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

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly DeliveryDate { get; init; }

    public required string DeliveryDateLabel { get; init; }

    public required string? DeliveryTime { get; init; }

    // --- the supply side ---
    public required int LivestockAvailabilityId { get; init; }

    public required string? FarmerName { get; init; }

    public required string? LocationName { get; init; }

    public required string AvailabilityStockClass { get; init; }

    public required string? AvailabilityDetails { get; init; }

    /// <summary>ISO <c>yyyy-MM-dd</c>.</summary>
    public required DateOnly AvailableFrom { get; init; }

    public required string AvailableFromLabel { get; init; }
}
