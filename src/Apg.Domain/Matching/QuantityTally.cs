namespace Apg.Domain.Matching;

/// <summary>
/// One record's quantity arithmetic, computed together so the three figures can never disagree.
/// </summary>
/// <remarks>
/// <para>
/// Two different sums over the same match set is the rule most likely to be got wrong, because the
/// difference between them is a single status:
/// </para>
/// <list type="bullet">
/// <item><description>
/// <see cref="MatchedInclDraft"/> counts every match that is not Cancelled — drafts included. It is
/// what APG sees, and it is what <see cref="Unmatched"/> is computed from, because a draft has
/// already spoken for the stock as far as the operator is concerned.
/// </description></item>
/// <item><description>
/// <see cref="MatchedExclDraft"/> additionally excludes Drafted matches. It is what a processor or
/// farmer would be shown, labelled simply "Quantity Matched", because a draft is not yet a
/// commitment anyone outside APG should be told about.
/// </description></item>
/// </list>
/// <para>
/// Neither is ever stored. A denormalised total is the thing that quietly disagrees with the match
/// set it was supposed to summarise.
/// </para>
/// </remarks>
/// <param name="Original">
/// The record's own quantity — required on a Processor Space, available on a Livestock Availability
/// record.
/// </param>
/// <param name="MatchedInclDraft">Sum of quantity matched across all matches that are not Cancelled.</param>
/// <param name="MatchedExclDraft">Sum across matches that are neither Cancelled nor Drafted.</param>
public readonly record struct QuantityTally(int Original, int MatchedInclDraft, int MatchedExclDraft)
{
    /// <summary>
    /// Original quantity minus the incl-Draft matched figure. Deliberately <b>not clamped</b>: it
    /// goes negative on an over-filled Processor Space, which is permitted, and it would go negative
    /// on an over-committed Availability record, which is a bug that must be visible rather than
    /// rounded away.
    /// </summary>
    public int Unmatched => Original - MatchedInclDraft;

    /// <summary>
    /// The fill state, read off the sign of <see cref="Unmatched"/> — so the number, the bar length
    /// and the colour on the card are three renderings of one calculation rather than three
    /// calculations.
    /// </summary>
    public QuantityState State =>
        Unmatched > 0 ? QuantityState.Under
        : Unmatched == 0 ? QuantityState.Exact
        : QuantityState.Over;
}
