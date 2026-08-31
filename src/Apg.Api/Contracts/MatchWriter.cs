using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Apg.Domain.Pricing;

namespace Apg.Api.Contracts;

/// <summary>
/// The rules a drag has to satisfy, expressed over a loaded working set.
/// </summary>
/// <remarks>
/// <para>
/// <b>This class decides nothing.</b> Every answer comes from
/// <c>Apg.Domain.Matching.MatchCreation</c> and <c>Apg.Domain.Pricing.PriceTable</c>; what lives here
/// is the translation between those rules and the wire, and the messages an operator reads.
/// </para>
/// <para>
/// It is deliberately <b>pure and static over a <see cref="WorkingSet"/></b> rather than a service
/// over the <c>DbContext</c>, so the tests drive it off the real generated seed with no database at
/// all — the same shape <c>DtoProjectionTests</c> already uses. The endpoint loads, calls, saves.
/// </para>
/// </remarks>
public static class MatchWriter
{
    /// <summary>Asked for a quantity below one head.</summary>
    public const string BelowOneHead = "A match must be at least 1 head";

    /// <summary>
    /// The proposal for a pair, or null when either record does not exist.
    /// </summary>
    public static MatchProposalDto? Propose(
        WorkingSet set,
        PriceTable prices,
        int processorSpaceId,
        int livestockAvailabilityId)
    {
        var space = Space(set, processorSpaceId);
        var availability = Availability(set, livestockAvailabilityId);

        if (space is null || availability is null)
        {
            return null;
        }

        // One call, one rule. Propose is the single entry point Phase 1 built for a drag: it applies
        // the min() default, the supply-side ceiling and the refusal condition together, so there is
        // no way to get one of the three from here and the others from somewhere else.
        var proposal = MatchCreation.Propose(space, set.Matches, availability, set.Matches);

        return new MatchProposalDto
        {
            IsAllowed = proposal.IsAllowed,
            RefusalMessage = proposal.RefusalMessage,
            Quantity = proposal.Quantity,
            Maximum = proposal.Maximum,

            // The space's stock class, never the availability record's. The two vocabularies do not
            // map onto each other and it is the meatworks that prices the class it is buying, so a
            // lookup on the wrong side would return a plausible number for the wrong animal.
            DefaultPricePerKg = prices.DefaultPricePerKg(space),
        };
    }

    /// <summary>
    /// Why the request may not be created, or null when it may be.
    /// </summary>
    /// <remarks>
    /// The client's dialog enforces the same two bounds, and this exists because that is not a reason
    /// to trust them. Note there is <b>no ceiling on the Processor Space side</b>: a quantity beyond
    /// what the space still needs is accepted and the space reads as Over-filled.
    /// </remarks>
    public static string? Reject(WorkingSet set, CreateMatchRequest request)
    {
        var space = Space(set, request.ProcessorSpaceId);
        var availability = Availability(set, request.LivestockAvailabilityId);

        if (space is null || availability is null)
        {
            return MatchResponses.NoSuchPair;
        }

        // The same gate the drop uses. Without this, a POST could add head to a space whose unmatched
        // is already below 1 — Propose refuses that pair, and the write path must too.
        var proposal = MatchCreation.Propose(space, set.Matches, availability, set.Matches);

        if (!proposal.IsAllowed)
        {
            return proposal.RefusalMessage ?? MatchCreation.NoUnmatchedQuantity;
        }

        if (request.QuantityMatched < 1)
        {
            return BelowOneHead;
        }

        var unmatched = MatchQuantities.ForAvailability(availability, set.Matches).Unmatched;
        var maximum = MatchCreation.MaxMatchQuantity(unmatched);

        return request.QuantityMatched > maximum
            ? $"Capped at {maximum} — that is all this livestock availability record has unmatched"
            : null;
    }

    /// <summary>
    /// Why a delete may not proceed, or null when it may.
    /// </summary>
    /// <remarks>
    /// A drafted match is plain-deleted (resolved question 3). Anything past Drafted has to be
    /// cancelled with a reason, which is Phase 6 — this refuses rather than guessing.
    /// </remarks>
    public static string? RejectDelete(Match? match) =>
        match is null
            ? "There is no such match"
            : match.Status != MatchStatus.Drafted
                ? "Only a drafted match can be deleted"
                : null;

    /// <summary>
    /// The match a validated request becomes: always <see cref="MatchStatus.Drafted"/>, always new.
    /// </summary>
    /// <remarks>
    /// Every drag creates a <b>new</b> match (resolved question 8). Nothing here looks for an existing
    /// match between the same two records, because dropping a pair that already matches must produce a
    /// second, separate match rather than topping the first one up.
    /// </remarks>
    public static Match Drafted(CreateMatchRequest request, TimeProvider clock) =>
        new()
        {
            ProcessorSpaceId = request.ProcessorSpaceId,
            LivestockAvailabilityId = request.LivestockAvailabilityId,
            QuantityMatched = request.QuantityMatched,
            PricePerKg = request.PricePerKg,
            TransportCompany = Trimmed(request.TransportCompany),
            Status = MatchStatus.Drafted,
            CreatedAt = clock.GetUtcNow(),
        };

    private static ProcessorSpace? Space(WorkingSet set, int id) =>
        set.Spaces.FirstOrDefault(s => s.Id == id);

    private static LivestockAvailability? Availability(WorkingSet set, int id) =>
        set.Availabilities.FirstOrDefault(a => a.Id == id);

    /// <summary>Transport company is optional at draft time; an empty box is no company, not "".</summary>
    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
