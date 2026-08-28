using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// Cancelling a record must not touch its matches. This is deliberate — it lets APG arrange
/// alternatives before anyone is notified their booking has gone — and it is the single most likely
/// rule for a future chat to "helpfully" break, because a cascade looks tidier than its absence.
/// </summary>
public class CancellationTests
{
    private static List<Match> LiveMatches() =>
    [
        Given.Match(60, MatchStatus.Confirmed, id: 1, spaceId: 1, availabilityId: 1),
        Given.Match(40, MatchStatus.Drafted, id: 2, spaceId: 1, availabilityId: 1),
    ];

    private static List<(int Id, int Quantity, MatchStatus Status, MatchCancellationReason? Reason)> Snapshot(
        IEnumerable<Match> matches) =>
        matches.Select(m => (m.Id, m.QuantityMatched, m.Status, m.CancellationReason)).ToList();

    [Fact]
    public void Cancelling_a_Processor_Space_leaves_its_matches_untouched()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = LiveMatches();
        var before = Snapshot(matches);

        RecordCancellation.CancelProcessorSpace(space);

        Assert.Equal(ProcessorSpaceStatus.Cancelled, space.Status);
        Assert.Equal(before, Snapshot(matches));
    }

    [Fact]
    public void Cancelling_an_Availability_record_leaves_its_matches_untouched()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = LiveMatches();
        var before = Snapshot(matches);

        RecordCancellation.CancelAvailability(availability);

        Assert.Equal(LivestockAvailabilityStatus.Cancelled, availability.Status);
        Assert.Equal(before, Snapshot(matches));
    }

    [Fact]
    public void A_cancelled_record_keeps_reporting_the_quantities_its_live_matches_account_for()
    {
        // The matches are still real commitments until they are cancelled separately, so the
        // arithmetic must not change either.
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = LiveMatches();

        RecordCancellation.CancelAvailability(availability);
        var tally = MatchQuantities.ForAvailability(availability, matches);

        Assert.Equal(100, tally.MatchedInclDraft);
        Assert.Equal(60, tally.MatchedExclDraft);
        Assert.Equal(0, tally.Unmatched);
    }

    [Fact]
    public void Cancelling_a_match_records_its_reason()
    {
        var match = Given.Match(60, MatchStatus.Confirmed);

        RecordCancellation.CancelMatch(match, MatchCancellationReason.ChangeFromProcessor);

        Assert.Equal(MatchStatus.Cancelled, match.Status);
        Assert.Equal(MatchCancellationReason.ChangeFromProcessor, match.CancellationReason);
    }

    [Fact]
    public void Cancelling_one_match_does_not_touch_its_siblings()
    {
        var matches = LiveMatches();

        RecordCancellation.CancelMatch(matches[0], MatchCancellationReason.InternalDecisionByApg);

        Assert.Equal(MatchStatus.Drafted, matches[1].Status);
        Assert.Null(matches[1].CancellationReason);
    }

    /// <summary>
    /// The structural half of the guarantee: neither record helper is even given a match collection,
    /// so it has nothing to cascade to. If this test fails, someone has widened a signature — which
    /// is the step that comes just before the cascade itself.
    /// </summary>
    [Fact]
    public void Neither_record_cancel_helper_accepts_a_match_collection()
    {
        var parameters = typeof(RecordCancellation)
            .GetMethods()
            .Where(m => m.Name is nameof(RecordCancellation.CancelProcessorSpace)
                or nameof(RecordCancellation.CancelAvailability))
            .SelectMany(m => m.GetParameters())
            .ToList();

        Assert.NotEmpty(parameters);
        Assert.DoesNotContain(parameters, p => typeof(IEnumerable<Match>).IsAssignableFrom(p.ParameterType));
    }
}
