using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// What may be done to a match once it exists: deleted, confirmed, or cancelled with a reason.
/// </summary>
/// <remarks>
/// <para>
/// The three are <b>mutually exclusive by status</b>, and that is the whole rule. A
/// <see cref="MatchStatus.Drafted"/> match is plain-deleted — a mis-drag is simply removed, and no
/// reason is asked for (resolved question 3). Anything past Drafted has been communicated to somebody,
/// so it is cancelled with one of three reasons and kept. Nothing is ever both.
/// </para>
/// <para>
/// Confirming is <b>Drafted only</b>. Lifecycle in pass 1 is Drafted → Confirmed, because
/// <see cref="MatchStatus.Notified"/> has no UI transition into it (resolved question 2). Notified is
/// deliberately <em>not</em> accepted here as a second entry into Confirmed: were notifications to
/// arrive, a Notified match would need its own explicit step rather than inheriting this one silently.
/// </para>
/// <para>
/// Cancelling itself lives in <see cref="RecordCancellation.CancelMatch"/>, which stays the only path
/// that sets <see cref="MatchStatus.Cancelled"/>. This class decides <em>whether</em>; that one does it.
/// </para>
/// </remarks>
public static class MatchLifecycle
{
    /// <summary>Asked to delete a match that is past Drafted.</summary>
    public const string OnlyDraftedCanBeDeleted = "Only a drafted match can be deleted";

    /// <summary>Asked to confirm a match that is not Drafted.</summary>
    public const string OnlyDraftedCanBeConfirmed = "Only a drafted match can be confirmed";

    /// <summary>Asked to cancel a draft, which is deleted instead.</summary>
    public const string ADraftIsDeletedNotCancelled =
        "A drafted match is deleted rather than cancelled";

    /// <summary>Asked to cancel a match that is already cancelled.</summary>
    public const string AlreadyCancelled = "This match is already cancelled";

    /// <summary>Asked to cancel without choosing one of the three reasons.</summary>
    public const string ReasonRequired = "Choose why this match is being cancelled";

    /// <summary>A mis-drag is removed outright, so only a draft may be deleted.</summary>
    public static bool CanDelete(Match match) => match.Status == MatchStatus.Drafted;

    /// <summary>Drafted → Confirmed, and nothing else.</summary>
    public static bool CanConfirm(Match match) => match.Status == MatchStatus.Drafted;

    /// <summary>Past Drafted and still live: a draft is deleted, and a cancelled match is done.</summary>
    public static bool CanCancel(Match match) =>
        match.Status is not (MatchStatus.Drafted or MatchStatus.Cancelled);

    /// <summary>
    /// Confirms a match. Touches nothing but the match — confirming one match says nothing about its
    /// siblings, and a Processor Space is confirmed by its own explicit action rather than by this one.
    /// </summary>
    public static void Confirm(Match match) => match.Status = MatchStatus.Confirmed;
}
