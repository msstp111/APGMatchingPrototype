using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// One test per demonstration case in the phase document's section 4.7. The seed is what every later
/// phase is judged against, so these cases are proven here rather than eyeballed in the database.
/// </summary>
/// <remarks>
/// Every quantity assertion here goes through <c>Apg.Domain</c>. Phase 0 restated the incl-Draft sum
/// inside this test project because the real rule did not exist yet; Phase 1 deleted that copy, so
/// these tests now fail if the seed and the rules ever disagree — which is the only way that
/// disagreement would ever be noticed.
/// </remarks>
public class SeedDemonstrationCaseTests
{
    [Fact]
    public void At_least_one_space_is_filled_from_three_different_availability_records()
    {
        var offenders = SeedFixture.Data.Matches
            .Where(m => m.Status != MatchStatus.Cancelled)
            .GroupBy(m => m.ProcessorSpaceId)
            .Where(g => g.Select(m => m.LivestockAvailabilityId).Distinct().Count() >= 3)
            .ToList();

        Assert.NotEmpty(offenders);
    }

    [Fact]
    public void At_least_one_availability_record_is_split_across_three_different_spaces()
    {
        var split = SeedFixture.Data.Matches
            .Where(m => m.Status != MatchStatus.Cancelled)
            .GroupBy(m => m.LivestockAvailabilityId)
            .Where(g => g.Select(m => m.ProcessorSpaceId).Distinct().Count() >= 3)
            .ToList();

        Assert.NotEmpty(split);
    }

    [Fact]
    public void At_least_one_space_is_over_filled()
    {
        var overFilled = SeedFixture.Data.ProcessorSpaces
            .Where(s => MatchQuantities.ForSpace(s, SeedFixture.Data.Matches).State == QuantityState.Over)
            .ToList();

        Assert.NotEmpty(overFilled);
    }

    [Fact]
    public void At_least_one_space_is_matched_to_exactly_its_required_quantity()
    {
        var exact = SeedFixture.Data.ProcessorSpaces
            .Where(s => SeedFixture.MatchesForSpace(s.Id).Count > 0)
            .Where(s => MatchQuantities.ForSpace(s, SeedFixture.Data.Matches).State == QuantityState.Exact)
            .ToList();

        Assert.NotEmpty(exact);
    }

    [Fact]
    public void At_least_one_availability_record_is_fully_matched_with_every_match_confirmed()
    {
        // Asserted through the real derivation rather than by restating it: this is the one
        // combination that derives an availability status of Confirmed, and the seed exists partly to
        // give that branch a worked example.
        var fullyConfirmed = SeedFixture.Data.Availabilities
            .Where(a => AvailabilityStatus.Derive(a, SeedFixture.Data.Matches)
                == LivestockAvailabilityStatus.Confirmed)
            .ToList();

        Assert.NotEmpty(fullyConfirmed);
    }

    [Fact]
    public void The_match_set_mixes_drafted_and_confirmed_and_includes_one_or_two_cancelled()
    {
        var byStatus = SeedFixture.Data.Matches
            .GroupBy(m => m.Status)
            .ToDictionary(g => g.Key, g => g.Count());

        Assert.True(byStatus.GetValueOrDefault(MatchStatus.Drafted) >= 5, "Expected a realistic run of drafts.");
        Assert.True(byStatus.GetValueOrDefault(MatchStatus.Confirmed) >= 5, "Expected a realistic run of confirmations.");
        Assert.InRange(byStatus.GetValueOrDefault(MatchStatus.Cancelled), 1, 2);

        // Notified is in the enum but unreachable in pass 1 (resolved question 2).
        Assert.Equal(0, byStatus.GetValueOrDefault(MatchStatus.Notified));
    }

    [Fact]
    public void Cancelled_matches_carry_a_reason_and_live_matches_do_not()
    {
        foreach (var match in SeedFixture.Data.Matches)
        {
            if (match.Status == MatchStatus.Cancelled)
            {
                Assert.NotNull(match.CancellationReason);
            }
            else
            {
                Assert.Null(match.CancellationReason);
            }
        }

        // Two different reasons, so the demo shows more than one.
        var reasons = SeedFixture.Data.Matches
            .Where(m => m.Status == MatchStatus.Cancelled)
            .Select(m => m.CancellationReason)
            .Distinct()
            .ToList();

        Assert.True(reasons.Count >= 2, "Expected the cancelled matches to use different reasons.");
    }

    [Fact]
    public void At_least_one_match_pairs_an_availability_Prime_with_an_ANZCO_Nat_Beef_Premium_space()
    {
        // The two stock class vocabularies do not map onto each other. A human judged this pairing
        // during the drag, and the seed has to show that, or the matching screen looks like it is
        // joining on stock class.
        var spaces = SeedFixture.Data.ProcessorSpaces.ToDictionary(s => s.Id);
        var availabilities = SeedFixture.Data.Availabilities.ToDictionary(a => a.Id);

        var deliberateMismatch = SeedFixture.Data.Matches.Any(m =>
            availabilities[m.LivestockAvailabilityId].StockClass == "Prime"
            && spaces[m.ProcessorSpaceId] is { Processor: "ANZCO", StockClass: "Nat Beef - Premium" });

        Assert.True(deliberateMismatch, "Expected the seeded Prime -> Nat Beef - Premium pairing.");
    }

    [Fact]
    public void Many_matches_pair_stock_classes_that_do_not_look_alike()
    {
        var spaces = SeedFixture.Data.ProcessorSpaces.ToDictionary(s => s.Id);
        var availabilities = SeedFixture.Data.Availabilities.ToDictionary(a => a.Id);

        var differing = SeedFixture.Data.Matches.Count(m =>
            !string.Equals(
                availabilities[m.LivestockAvailabilityId].StockClass,
                spaces[m.ProcessorSpaceId].StockClass,
                StringComparison.OrdinalIgnoreCase));

        Assert.True(differing >= 10, $"Only {differing} matches cross the two vocabularies.");
    }

    [Fact]
    public void Several_early_availability_records_stay_completely_unmatched()
    {
        // These are the backlog: records above the current week with stock still to allocate. They
        // sit in their own band and are found by scrolling up, never reprinted into later weeks.
        var backlog = SeedFixture.Data.Availabilities
            .Where(a => a.AvailableFrom < SeedFixture.Anchor)
            .Where(a => SeedFixture.MatchesForAvailability(a.Id).Count == 0)
            .ToList();

        Assert.True(
            backlog.Count >= SeedDataGenerator.BacklogAvailabilityCount,
            $"Expected at least {SeedDataGenerator.BacklogAvailabilityCount} unmatched early records; found {backlog.Count}.");
    }

    [Fact]
    public void Some_spaces_have_no_matches_at_all()
    {
        var untouched = SeedFixture.Data.ProcessorSpaces
            .Count(s => SeedFixture.MatchesForSpace(s.Id).Count == 0);

        Assert.True(untouched >= 5, $"Only {untouched} spaces are unmatched; the demo needs empty ones too.");
    }

    [Fact]
    public void No_availability_record_is_ever_over_committed()
    {
        // Over-filling demand is permitted and deliberate; over-committing supply is not, and is
        // hard-capped (resolved question 1). The pink state exists only as a bug indicator.
        foreach (var availability in SeedFixture.Data.Availabilities)
        {
            var tally = MatchQuantities.ForAvailability(availability, SeedFixture.Data.Matches);

            Assert.True(
                tally.State != QuantityState.Over,
                $"Availability {availability.Id} is over-committed: "
                + $"{tally.MatchedInclDraft} of {availability.QuantityAvailable}.");
        }
    }

    [Fact]
    public void Every_match_carries_a_positive_quantity()
    {
        Assert.All(SeedFixture.Data.Matches, m => Assert.True(m.QuantityMatched >= 1));
    }
}
