using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// Which processors have match notification in their lifecycle at all.
/// </summary>
/// <remarks>
/// <para>
/// <b>ANZCO, and no one else</b> (Mark, 2026-09-11). Notifying is not a step APG omits for Alliance
/// Group and SFF — it is not part of how those two work, so the button is absent rather than
/// disabled: a greyed control invites the operator to find the condition that would enable it, and
/// here there is none.
/// </para>
/// <para>
/// It is consistent with the per-processor visibility model the requirements already describe, which
/// is the reason to believe it rather than treat it as an arbitrary carve-out. <b>Alliance Group sees
/// no matches at all</b>, so a notification about one would point at something they can never open;
/// <b>SFF sees a restricted set only once the space is Confirmed</b>, so a notification at
/// <see cref="MatchStatus.Drafted"/> — the only status it can be sent from — would arrive before
/// there is anything for them to look at. ANZCO sees the most, and is the only one for whom the
/// message would land on something visible.
/// </para>
/// <para>
/// <b>An unknown processor does not receive notifications.</b> This is the opposite of
/// <see cref="StockClassCompatibility"/>, which fails towards showing more, and the two differ
/// because of what the failure costs: an unrecognised stock class hidden from a drag is supply an
/// operator cannot see, whereas an unrecognised processor offered a Notify button is APG telling a
/// room that a meatworks gets notified when nobody has agreed that it does. Receiving notifications
/// is a commercial arrangement, and a processor not named here has not made one.
/// </para>
/// <para>
/// The name list lives here rather than in the API's <c>SeedConfig</c> because it is a rule and not a
/// vocabulary — the same reason <see cref="StockClassCompatibility"/>'s table does. The names must
/// still match <c>SeedConfig.Processors</c> exactly or the rule silently applies to nobody, which is
/// what <c>ProcessorNotificationTests</c> in the API test project exists to catch.
/// </para>
/// </remarks>
public static class ProcessorNotifications
{
    /// <summary>
    /// The processors APG notifies. Case-insensitive, because this is matched against a name typed
    /// into a record form rather than against an enum.
    /// </summary>
    private static readonly HashSet<string> Receiving =
        new(StringComparer.OrdinalIgnoreCase) { "ANZCO" };

    /// <summary>Whether <paramref name="processor"/> has notification in its match lifecycle.</summary>
    public static bool Receives(string? processor) =>
        !string.IsNullOrWhiteSpace(processor) && Receiving.Contains(processor.Trim());

    /// <summary>
    /// Why a match against this processor cannot be notified. It names the processor, because "this
    /// match cannot be notified" in front of an operator who has notified a dozen ANZCO matches today
    /// reads as a fault rather than as a difference between two meatworks.
    /// </summary>
    public static string NotifyingIsNotPartOfTheirProcess(string processor) =>
        $"{processor} does not receive match notifications";
}
