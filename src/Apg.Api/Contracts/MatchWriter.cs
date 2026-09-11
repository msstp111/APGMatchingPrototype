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

    /// <summary>Asked about a match that does not exist, or that is no longer on the screen.</summary>
    public const string NoSuchMatch = "There is no such match";

    /// <summary>Asked to confirm a Processor Space that does not exist.</summary>
    public const string NoSuchSpace = "There is no such processor space";

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
        var proposal = MatchCreation.Propose(space, set.Matches, availability, set.Matches, Cancelled(set));

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
        var proposal = MatchCreation.Propose(space, set.Matches, availability, set.Matches, Cancelled(set));

        if (!proposal.IsAllowed)
        {
            return proposal.RefusalMessage ?? MatchCreation.NoUnmatchedQuantity;
        }

        if (request.QuantityMatched < 1)
        {
            return BelowOneHead;
        }

        var unmatched = MatchQuantities.ForAvailability(availability, set.Matches, Cancelled(set)).Unmatched;
        var maximum = MatchCreation.MaxMatchQuantity(unmatched);

        return request.QuantityMatched > maximum
            ? $"Capped at {maximum}, which is all this livestock availability record has unmatched"
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
            ? NoSuchMatch
            : MatchLifecycle.CanDelete(match)
                ? null
                : MatchLifecycle.OnlyDraftedCanBeDeleted;

    /// <summary>
    /// Why a match may not be notified, or null when it may.
    /// </summary>
    /// <remarks>
    /// <para>
    /// An ANZCO match, still Drafted. <b>Nothing is sent.</b> The endpoint behind this writes a status
    /// and no message, because the notification mediums are deferred beyond pass 1; what the status
    /// buys is a board that says which matches have been put to the processor and are waiting on a
    /// reply.
    /// </para>
    /// <para>
    /// It takes the working set for the processor clause: the gate is about the Processor Space, and
    /// <see cref="Match"/> carries only its id. The client hides the button for the other two
    /// processors, and this exists because that is not a reason to trust it —
    /// <c>MatchLifecycle.NotifyBlockedReason</c> answers both with the same sentence.
    /// </para>
    /// </remarks>
    public static string? RejectNotify(WorkingSet set, Match? match)
    {
        if (match is null)
        {
            return NoSuchMatch;
        }

        var space = Space(set, match.ProcessorSpaceId);

        // A match whose space has vanished is not a lifecycle question. It cannot be notified, and
        // saying which processor does not receive notifications would mean naming one we cannot read.
        return space is null
            ? NoSuchSpace
            : MatchLifecycle.NotifyBlockedReason(match, space);
    }

    /// <summary>
    /// Why a match may not be confirmed, or null when it may.
    /// </summary>
    /// <remarks>
    /// Drafted or Notified, since 2026-09-11. Notifying is a step APG may take and not one it must,
    /// so a match that skipped it confirms in one move exactly as every match did before.
    /// </remarks>
    public static string? RejectConfirm(Match? match) =>
        match is null
            ? NoSuchMatch
            : MatchLifecycle.CanConfirm(match)
                ? null
                : MatchLifecycle.OnlyALiveMatchCanBeConfirmed;

    /// <summary>
    /// Why a match may not be cancelled, or null when it may.
    /// </summary>
    /// <remarks>
    /// Two gates, and both matter. A <b>drafted</b> match is deleted rather than cancelled (resolved
    /// question 3), so it is refused here rather than quietly accepted: the two acts leave different
    /// records behind. And a cancellation without one of the three reasons is refused, because a reason
    /// is required by the spec and a missing one would otherwise be stored as null forever.
    /// </remarks>
    public static string? RejectCancel(Match? match, MatchCancellationReason? reason)
    {
        if (match is null)
        {
            return NoSuchMatch;
        }

        if (match.Status == MatchStatus.Cancelled)
        {
            return MatchLifecycle.AlreadyCancelled;
        }

        if (!MatchLifecycle.CanCancel(match))
        {
            return MatchLifecycle.ADraftIsDeletedNotCancelled;
        }

        return reason is null ? MatchLifecycle.ReasonRequired : null;
    }

    /// <summary>
    /// The ceiling on editing <paramref name="match"/>: the availability record's remaining supply
    /// <b>plus this match's own current quantity</b> (resolved question 13).
    /// </summary>
    /// <remarks>
    /// The three-argument <c>MaxMatchQuantity</c>, never the one-argument one. The single-argument
    /// overload is for a <em>new</em> match and adds nothing back, so using it here would refuse the
    /// quantity the match already holds; the requirements document's "originally available" goes the
    /// other way and would permit an over-commit. Both are wrong, in opposite directions.
    /// </remarks>
    public static int EditCeiling(WorkingSet set, Match match)
    {
        var availability = Availability(set, match.LivestockAvailabilityId);

        return availability is null
            ? match.QuantityMatched
            : MatchCreation.MaxMatchQuantity(availability, set.Matches, match, Cancelled(set));
    }

    /// <summary>
    /// Why an edit may not be applied, or null when it may.
    /// </summary>
    /// <remarks>
    /// Minimum one head: reducing a match to nothing is a delete or a cancel, not an edit (Phase 6,
    /// 3.1). Maximum is <see cref="EditCeiling"/>. There is deliberately <b>no ceiling on the Processor
    /// Space side</b> — raising a match past what the space still needs is permitted and reads as
    /// "Over-filled".
    /// </remarks>
    public static string? RejectUpdate(WorkingSet set, Match? match, UpdateMatchRequest request)
    {
        if (match is null)
        {
            return NoSuchMatch;
        }

        if (request.QuantityMatched < 1)
        {
            return BelowOneHead;
        }

        var ceiling = EditCeiling(set, match);

        return request.QuantityMatched > ceiling
            ? $"Capped at {ceiling}, which is the availability record's remaining supply plus this match's own {match.QuantityMatched}"
            : null;
    }

    /// <summary>Writes the three editable fields onto <paramref name="match"/>. Status is untouched.</summary>
    public static void Apply(Match match, UpdateMatchRequest request)
    {
        match.QuantityMatched = request.QuantityMatched;
        match.PricePerKg = request.PricePerKg;
        match.TransportCompany = Trimmed(request.TransportCompany);
    }

    /// <summary>
    /// Why a Processor Space may not be confirmed, or null when it may.
    /// </summary>
    /// <remarks>
    /// The message is <c>ProcessorSpaceRules.ConfirmBlockedReason</c>'s — the same sentence the card
    /// prints beside the disabled button, so a crafted request and a greyed-out control give the same
    /// account of the same rule.
    /// </remarks>
    public static string? RejectSpaceConfirm(WorkingSet set, ProcessorSpace? space) =>
        space is null
            ? NoSuchSpace
            : ProcessorSpaceRules.ConfirmBlockedReason(space, set.Matches, Cancelled(set));

    /// <summary>
    /// Everything the match modal opens with, or null when there is no such match to open.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>By match id alone</b>, which is what makes the same match openable from its space and from
    /// its availability record without two code paths (Phase 6, 1.2).
    /// </para>
    /// <para>
    /// A <b>cancelled</b> match answers null as surely as a missing one. It is excluded from both
    /// parents' collections (resolved question 4), so it is not on the matching screen to be opened
    /// from, and pass 1 has no Match list view to open it anywhere else.
    /// </para>
    /// </remarks>
    public static MatchEditContextDto? EditContext(WorkingSet set, int matchId)
    {
        var match = set.Matches.FirstOrDefault(m => m.Id == matchId);

        if (match is null || !MatchQuantities.IsLive(match))
        {
            return null;
        }

        var space = MatchingProjection.SpaceById(set, match.ProcessorSpaceId);
        var availability = MatchingProjection.AvailabilityById(set, match.LivestockAvailabilityId);
        var dto = space?.Matches.FirstOrDefault(m => m.Id == matchId);

        if (space is null || availability is null || dto is null)
        {
            return null;
        }

        return new MatchEditContextDto
        {
            // Taken off the parent rather than projected a second time, so the match in the modal and
            // the match in the card's table cannot become two shapes of the same row.
            Match = dto,
            Space = space,
            Availability = availability,
            MaximumQuantity = EditCeiling(set, match),

            // The same gate the endpoint enforces, asked once so the footer and the write cannot
            // disagree about whether this processor is notified.
            CanNotify = RejectNotify(set, match) is null,
        };
    }

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

    /// <summary>Which records are cancelled, for the rules below.</summary>
    /// <remarks>
    /// A match tied to a cancelled record stops consuming the <b>other</b> record's quantity, so every
    /// figure this class validates against — the proposal, the supply cap, the edit ceiling — has to be
    /// computed knowing which records those are. Built per call rather than cached: this class is pure
    /// over a working set that is re-read after every write.
    /// </remarks>
    private static CancelledRecords Cancelled(WorkingSet set) =>
        CancelledRecords.In(set.Spaces, set.Availabilities);

    private static ProcessorSpace? Space(WorkingSet set, int id) =>
        set.Spaces.FirstOrDefault(s => s.Id == id);

    private static LivestockAvailability? Availability(WorkingSet set, int id) =>
        set.Availabilities.FirstOrDefault(a => a.Id == id);

    /// <summary>Transport company is optional at draft time; an empty box is no company, not "".</summary>
    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
