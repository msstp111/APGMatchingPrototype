using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// What a drag is allowed to produce: the quantity a new match defaults to, the ceiling the operator
/// may raise it to, and the one case where the answer is "no".
/// </summary>
/// <remarks>
/// <para>
/// <b>Over-filling is deliberately asymmetric</b> (resolved question 1). The quantity may exceed a
/// Processor Space's remaining need — a meatworks can be told more animals are coming than it asked
/// for, and the space simply reads as Over-filled. It may never exceed the Availability record's
/// remaining supply, because the farmer does not have the animals. So the demand side has no cap and
/// the supply side is hard-capped.
/// </para>
/// <para>
/// Nothing here dedupes or merges. Dropping a record onto a partner it already matches produces a
/// second, separate match (resolved question 8).
/// </para>
/// </remarks>
public static class MatchCreation
{
    /// <summary>
    /// The refusal message, spelled exactly once. The spec quotes it verbatim, so it lives as a
    /// constant rather than as a string a caller retypes.
    /// </summary>
    public const string NoUnmatchedQuantity = "There is no unmatched quantity";

    /// <summary>
    /// The quantity a new match opens at: the smaller of the two records' unmatched figures, so the
    /// default never over-fills the space or over-commits the farmer.
    /// </summary>
    public static int DefaultMatchQuantity(int spaceUnmatched, int availabilityUnmatched) =>
        Math.Min(spaceUnmatched, availabilityUnmatched);

    /// <summary>
    /// The ceiling on a <b>new</b> match: the availability record's remaining supply. The Processor
    /// Space side contributes no ceiling.
    /// </summary>
    public static int MaxMatchQuantity(int availabilityUnmatched) => availabilityUnmatched;

    /// <summary>
    /// The ceiling when <b>editing</b> an existing match: remaining supply plus the match's own
    /// current quantity (resolved question 13).
    /// </summary>
    /// <remarks>
    /// The match is already subtracted out of the record's unmatched figure, so without adding it
    /// back the operator could not even keep the quantity they already have. The spec's own wording —
    /// the availability record's <em>original</em> quantity — would instead permit the over-commit
    /// resolved question 1 forbids.
    /// <para>
    /// A Cancelled match consumed no supply in the first place, so nothing is added back for one;
    /// doing so would hand out the same animals twice.
    /// </para>
    /// </remarks>
    public static int MaxMatchQuantity(
        LivestockAvailability availability,
        IEnumerable<Match> availabilityMatches,
        Match existingMatch)
    {
        var unmatched = MatchQuantities.ForAvailability(availability, availabilityMatches).Unmatched;

        return MatchQuantities.IsLive(existingMatch)
            ? unmatched + existingMatch.QuantityMatched
            : unmatched;
    }

    /// <summary>
    /// The single entry point a drag goes through: either a permitted quantity and its ceiling, or a
    /// refusal carrying <see cref="NoUnmatchedQuantity"/>.
    /// </summary>
    /// <remarks>
    /// Both match collections may be the whole match set; each is scoped to its own record.
    /// </remarks>
    public static MatchQuantityProposal Propose(
        ProcessorSpace space,
        IEnumerable<Match> spaceMatches,
        LivestockAvailability availability,
        IEnumerable<Match> availabilityMatches)
    {
        var spaceUnmatched = MatchQuantities.ForSpace(space, spaceMatches).Unmatched;
        var availabilityUnmatched = MatchQuantities.ForAvailability(availability, availabilityMatches).Unmatched;

        var quantity = DefaultMatchQuantity(spaceUnmatched, availabilityUnmatched);

        // Less than one animal to move. This catches both an exhausted record and an already
        // over-filled space, whose unmatched figure is negative.
        return quantity < 1
            ? MatchQuantityProposal.Refused(NoUnmatchedQuantity)
            : MatchQuantityProposal.Allowed(quantity, MaxMatchQuantity(availabilityUnmatched));
    }
}

/// <summary>
/// The answer to "may these two be matched, and for how many?".
/// </summary>
/// <param name="IsAllowed">False when the pair has nothing left to match.</param>
/// <param name="Quantity">The quantity the prompt opens at. Zero on a refusal.</param>
/// <param name="Maximum">The highest quantity the operator may raise it to. Zero on a refusal.</param>
/// <param name="RefusalMessage">The message to show. Null when allowed.</param>
public readonly record struct MatchQuantityProposal(
    bool IsAllowed,
    int Quantity,
    int Maximum,
    string? RefusalMessage)
{
    public static MatchQuantityProposal Allowed(int quantity, int maximum) =>
        new(true, quantity, maximum, null);

    public static MatchQuantityProposal Refused(string message) => new(false, 0, 0, message);
}
