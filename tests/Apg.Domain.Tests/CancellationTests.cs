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

    /// <summary>
    /// The other direction, and the one Phase 6 adds: cancelling a <b>match</b> must not touch either
    /// parent record. The file proved record-to-match before this; a cascade the other way is just as
    /// tempting and just as wrong, since a space whose only match was cancelled has not itself been
    /// cancelled — APG's next act is to find it different stock.
    /// </summary>
    [Fact]
    public void Cancelling_a_match_leaves_both_parent_records_untouched()
    {
        var space = Given.Space(quantityRequired: 100);
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = LiveMatches();

        RecordCancellation.CancelMatch(matches[0], MatchCancellationReason.ChangeFromProcessor);

        // The stored statuses, and — the part a cascade would actually get wrong — the derived one:
        // the record has not become Cancelled because its match did. It has become *less* committed,
        // which is a quantity, not a status.
        Assert.Equal(ProcessorSpaceStatus.Booked, space.Status);
        Assert.Equal(LivestockAvailabilityStatus.Booked, availability.Status);
        Assert.Equal(
            LivestockAvailabilityStatus.Pending,
            AvailabilityStatus.Derive(availability, matches));
        Assert.Equal(40, MatchQuantities.ForAvailability(availability, matches).MatchedInclDraft);
        Assert.Equal(60, MatchQuantities.ForAvailability(availability, matches).Unmatched);
    }

    /// <summary>
    /// Cancelling the <em>last</em> live match is the case a cascade would look most reasonable in —
    /// the space now has nothing matched to it at all — and it still must not change the space's
    /// stored status. That status is a decision, and nobody has taken it.
    /// </summary>
    [Fact]
    public void Cancelling_the_last_live_match_still_leaves_the_space_Booked()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        RecordCancellation.CancelMatch(matches[0], MatchCancellationReason.ChangeFromAgentOrFarmer);

        Assert.DoesNotContain(matches, MatchQuantities.IsLive);
        Assert.Equal(ProcessorSpaceStatus.Booked, space.Status);
    }

    /// <summary>
    /// The signature half of the same guarantee, mirroring
    /// <see cref="Neither_record_cancel_helper_accepts_a_match_collection"/>: cancelling a match is
    /// given no record to reach, so it cannot reach one.
    /// </summary>
    [Fact]
    public void Cancelling_a_match_accepts_neither_parent_record()
    {
        var parameters = typeof(RecordCancellation)
            .GetMethod(nameof(RecordCancellation.CancelMatch))!
            .GetParameters()
            .Select(p => p.ParameterType)
            .ToList();

        Assert.DoesNotContain(typeof(ProcessorSpace), parameters);
        Assert.DoesNotContain(typeof(LivestockAvailability), parameters);
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
