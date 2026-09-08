using System.Globalization;

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
    /// The part of <see cref="MatchedInclDraft"/> that is still only drafted — the difference between
    /// the two sums, which is exactly the quantity held by Drafted matches.
    /// </summary>
    /// <remarks>
    /// It exists because it is the figure the Processor Space confirm gate turns on
    /// (<see cref="ProcessorSpaceRules.CanConfirm"/> refuses while any match is Drafted) and the one
    /// the expanded card had no way to state: the meter draws it as the alpha band's width and named
    /// it nowhere, so an operator had to add up the match table by hand. Derived here rather than in
    /// the client, where subtracting one DTO quantity from another is banned outright
    /// (<c>no-domain-arithmetic.spec.ts</c>).
    /// </remarks>
    public int Drafted => MatchedInclDraft - MatchedExclDraft;

    /// <summary>
    /// <see cref="Unmatched"/> as it is <b>printed</b>: its magnitude, with no sign.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The minus is dropped deliberately (2026-09-08). An over-run is already stated three times over
    /// — the ramp's blue or pink ink, the word (<c>Over-filled</c> / <c>Over-committed</c>), and the
    /// meter's over-run cap past the end of its track — and a fourth statement of it spends a
    /// character in the narrowest numeral column on the screen. <c>9</c> beside <c>Over-filled</c>
    /// says what <c>-9</c> said.
    /// </para>
    /// <para>
    /// It is a string, and it is here rather than in TypeScript, for the reason every other label on
    /// the wire is: the client must not derive a displayed figure from a domain value.
    /// <c>Math.abs(dto.unmatched)</c> in a template is the same class of mistake as recomputing a sum,
    /// and it would put the formatting rule in two languages the moment a second surface needed it —
    /// which is exactly what happened: the two cards, both expansions, the match modal and the
    /// quantity prompt all print this figure.
    /// </para>
    /// <para>
    /// The signed <see cref="Unmatched"/> is still the value every rule reads, and still the one the
    /// meter's hover string prints, where the sign is the truth and there is room to say it.
    /// </para>
    /// </remarks>
    public string UnmatchedLabel => Math.Abs(Unmatched).ToString(CultureInfo.InvariantCulture);

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
