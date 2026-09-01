using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// Which Processor Spaces and which Livestock Availability records have been cancelled — the one piece
/// of knowledge every quantity rule needs and a bare match set cannot supply.
/// </summary>
/// <remarks>
/// <para>
/// <b>A match stops consuming the <em>other</em> record's quantity once its own record is cancelled.</b>
/// Cancelling a record still does not cascade — the match keeps its status, stays on both cards, and
/// has to be cancelled separately — but it stops holding stock on the side that is still trading. A
/// farmer whose 143 head were matched to a cancelled space has 143 head to sell again, and a screen
/// that says otherwise is hiding supply.
/// </para>
/// <para>
/// <b>The rule is deliberately asymmetric</b>, and reading it the other way round is the mistake to
/// avoid: it is the <em>counterparty's</em> status that decides. Tallying a space, a match is dropped
/// when its availability record is cancelled; tallying an availability record, when its space is. A
/// cancelled record's own figures are unchanged by its own cancellation, which is what keeps its card
/// readable while somebody deals with the matches it left behind.
/// </para>
/// <para>
/// It is a parameter rather than a lookup the quantity functions do for themselves so that the
/// knowledge is <b>visible in every signature that depends on it</b>. <see cref="None"/> is the honest
/// answer for a caller holding no records at all — a unit test over hand-built matches — and it
/// reproduces the arithmetic exactly as it stood before this rule existed.
/// </para>
/// </remarks>
public sealed class CancelledRecords
{
    /// <summary>Nothing is cancelled. What a test over hand-built matches means, and says so.</summary>
    public static readonly CancelledRecords None = new(new HashSet<int>(), new HashSet<int>());

    private readonly IReadOnlySet<int> _spaces;
    private readonly IReadOnlySet<int> _availabilities;

    private CancelledRecords(IReadOnlySet<int> spaces, IReadOnlySet<int> availabilities)
    {
        _spaces = spaces;
        _availabilities = availabilities;
    }

    /// <summary>Reads both stored statuses off a whole working set.</summary>
    /// <remarks>
    /// The <b>stored</b> availability status, never the derived one: the derivation asks which matches
    /// count, so deriving it here would be circular. Stored <c>Cancelled</c> is the only value that
    /// entity's status column carries any meaning in.
    /// </remarks>
    public static CancelledRecords In(
        IEnumerable<ProcessorSpace> spaces,
        IEnumerable<LivestockAvailability> availabilities) =>
        new(
            spaces.Where(s => s.Status == ProcessorSpaceStatus.Cancelled).Select(s => s.Id).ToHashSet(),
            availabilities
                .Where(a => a.Status == LivestockAvailabilityStatus.Cancelled)
                .Select(a => a.Id)
                .ToHashSet());

    /// <summary>Whether this match's <b>Processor Space</b> is cancelled — asked when tallying supply.</summary>
    public bool SpaceOf(Match match) => _spaces.Contains(match.ProcessorSpaceId);

    /// <summary>Whether this match's <b>availability record</b> is cancelled — asked when tallying demand.</summary>
    public bool AvailabilityOf(Match match) => _availabilities.Contains(match.LivestockAvailabilityId);
}
