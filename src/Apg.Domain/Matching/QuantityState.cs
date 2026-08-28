namespace Apg.Domain.Matching;

/// <summary>
/// How a record's matched quantity stands against its original quantity. A <em>semantic</em> value,
/// deliberately not a colour: the two sides map these onto different palettes (orange/green/blue for
/// a Processor Space, orange/green/<b>pink</b> for a Livestock Availability record) and that mapping
/// is Phase 2's to own.
/// </summary>
public enum QuantityState
{
    /// <summary>Matched less than the original quantity. Unmatched is positive.</summary>
    Under,

    /// <summary>Matched exactly the original quantity. Unmatched is zero.</summary>
    Exact,

    /// <summary>
    /// Matched more than the original quantity. Unmatched is negative. Permitted and expected on the
    /// demand side ("Over-filled"); on the supply side it should be unreachable, and the pink it
    /// renders as exists precisely to surface the bug if it ever happens.
    /// </summary>
    Over,
}

/// <summary>
/// Which side of the broker a record sits on. The quantity arithmetic is identical for both; only
/// the wording and the colour differ, so this exists to pick between two label sets rather than to
/// branch any rule.
/// </summary>
public enum MatchSide
{
    ProcessorSpace,
    LivestockAvailability,
}

/// <summary>
/// The words that go beside the fill meter. Here rather than in TypeScript for the same reason every
/// other derived value is: one implementation, no drift. Phase 2 may reword these — in this file.
/// </summary>
public static class QuantityStateLabels
{
    public static string For(QuantityState state, MatchSide side) => side switch
    {
        MatchSide.ProcessorSpace => state switch
        {
            QuantityState.Under => "Under-filled",
            QuantityState.Exact => "Filled",
            QuantityState.Over => "Over-filled",
            _ => throw new ArgumentOutOfRangeException(nameof(state), state, null),
        },
        MatchSide.LivestockAvailability => state switch
        {
            QuantityState.Under => "Under-committed",
            QuantityState.Exact => "Fully committed",
            // The roadmap pins this wording: it is a bug indicator, not a normal state.
            QuantityState.Over => "Over-committed",
            _ => throw new ArgumentOutOfRangeException(nameof(state), state, null),
        },
        _ => throw new ArgumentOutOfRangeException(nameof(side), side, null),
    };
}
