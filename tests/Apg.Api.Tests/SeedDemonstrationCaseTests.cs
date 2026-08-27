using Apg.Api.Seeding;
using Apg.Domain.Entities;

namespace Apg.Api.Tests;

/// <summary>
/// One test per demonstration case in the phase document's section 4.7. The seed is what every later
/// phase is judged against, so these cases are proven here rather than eyeballed in the database.
/// </summary>
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
            .Where(s => s.QuantityRequired - SeedFixture.MatchedInclDraft(SeedFixture.MatchesForSpace(s.Id)) < 0)
            .ToList();

        Assert.NotEmpty(overFilled);
    }

    [Fact]
    public void At_least_one_space_is_matched_to_exactly_its_required_quantity()
    {
        var exact = SeedFixture.Data.ProcessorSpaces
            .Where(s => SeedFixture.MatchesForSpace(s.Id).Count > 0)
            .Where(s => SeedFixture.MatchedInclDraft(SeedFixture.MatchesForSpace(s.Id)) == s.QuantityRequired)
            .ToList();

        Assert.NotEmpty(exact);
    }

    [Fact]
    public void At_least_one_availability_record_is_fully_matched_with_every_match_confirmed()
    {
        var fullyConfirmed = SeedFixture.Data.Availabilities
            .Select(a => (Availability: a, Matches: SeedFixture.MatchesForAvailability(a.Id)))
            .Where(x => x.Matches.Count > 0)
            .Where(x => SeedFixture.MatchedInclDraft(x.Matches) == x.Availability.QuantityAvailable)
            .Where(x => x.Matches.All(m => m.Status == MatchStatus.Confirmed))
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
        // Phase 3 renders these as muted, dashed carry-over cards at the top of every later week.
        var carriedOver = SeedFixture.Data.Availabilities
            .Where(a => a.AvailableFrom < SeedFixture.Anchor)
            .Where(a => SeedFixture.MatchesForAvailability(a.Id).Count == 0)
            .ToList();

        Assert.True(
            carriedOver.Count >= SeedDataGenerator.CarryOverAvailabilityCount,
            $"Expected at least {SeedDataGenerator.CarryOverAvailabilityCount} unmatched early records; found {carriedOver.Count}.");
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
            var matched = SeedFixture.MatchedInclDraft(SeedFixture.MatchesForAvailability(availability.Id));

            Assert.True(
                matched <= availability.QuantityAvailable,
                $"Availability {availability.Id} is over-committed: {matched} of {availability.QuantityAvailable}.");
        }
    }

    [Fact]
    public void Every_match_carries_a_positive_quantity()
    {
        Assert.All(SeedFixture.Data.Matches, m => Assert.True(m.QuantityMatched >= 1));
    }
}
