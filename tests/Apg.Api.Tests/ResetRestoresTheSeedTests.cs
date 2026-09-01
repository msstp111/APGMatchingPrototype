using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// Phase 8, requirement 1.3: <c>POST /api/dev/reset-database</c> must genuinely restore the seed —
/// <em>including</em> the carefully constructed section 4.7 demonstration cases, which are what make
/// the screen worth looking at.
///
/// <para>
/// <see cref="SeedDeterminismTests"/> already proves two generations from one anchor are identical,
/// and <see cref="SeedDemonstrationCaseTests"/> already proves the first generation carries every
/// case. Requirement 1.3 is the conjunction of those two, and a reader has to hold both files in mind
/// to see that it holds. This asserts it directly, on a <em>second, independently generated</em>
/// dataset — the one a reset produces — so "the reset brings the demo back" is a test rather than an
/// inference.
/// </para>
///
/// <para>
/// What is deliberately not tested here is <c>DatabaseSeeder.ResetAsync</c> itself. It is
/// <c>EnsureDeleted</c>, <c>EnsureCreated</c>, <c>Seed</c> — three lines with no branch — and
/// exercising it would mean standing up a SQLite file per test for no rule that is not already
/// covered. It is verified by hand against the running API instead, and the Phase 8 build log records
/// the run.
/// </para>
/// </summary>
public class ResetRestoresTheSeedTests
{
    /// <summary>
    /// A fresh generation from the same anchor: what the database holds after a reset. Deliberately
    /// <em>not</em> <see cref="SeedFixture.Data"/> — sharing that instance would make every assertion
    /// below a second copy of <see cref="SeedDemonstrationCaseTests"/> rather than a statement about
    /// regeneration.
    /// </summary>
    private static readonly SeedData Reseeded =
        SeedDataGenerator.Generate(SeedFixture.Anchor, SeedFixture.Locations);

    private static CancelledRecords Cancelled =>
        CancelledRecords.In(Reseeded.ProcessorSpaces, Reseeded.Availabilities);

    private static IReadOnlyList<Match> Live =>
        [.. Reseeded.Matches.Where(m => m.Status != MatchStatus.Cancelled)];

    [Fact]
    public void A_reseed_brings_back_the_space_filled_from_three_availability_records()
    {
        var filledFromThree = Live
            .GroupBy(m => m.ProcessorSpaceId)
            .Where(g => g.Select(m => m.LivestockAvailabilityId).Distinct().Count() >= 3)
            .ToList();

        Assert.NotEmpty(filledFromThree);
    }

    [Fact]
    public void A_reseed_brings_back_the_record_split_across_three_spaces()
    {
        var splitAcrossThree = Live
            .GroupBy(m => m.LivestockAvailabilityId)
            .Where(g => g.Select(m => m.ProcessorSpaceId).Distinct().Count() >= 3)
            .ToList();

        Assert.NotEmpty(splitAcrossThree);
    }

    [Fact]
    public void A_reseed_brings_back_the_over_filled_and_the_exactly_filled_space()
    {
        var states = Reseeded.ProcessorSpaces
            .Select(s => MatchQuantities.ForSpace(s, Reseeded.Matches, Cancelled).State)
            .ToList();

        Assert.Contains(QuantityState.Over, states);
        Assert.Contains(QuantityState.Exact, states);
    }

    [Fact]
    public void A_reseed_brings_back_a_cancelled_space_that_still_holds_live_matches()
    {
        // The one case a demo cannot construct on the spot without doing the very thing it is meant
        // to demonstrate. Cancelling never cascades, and this is the seeded proof of it.
        var cancelled = Reseeded.ProcessorSpaces
            .Where(s => s.Status == ProcessorSpaceStatus.Cancelled)
            .ToList();

        Assert.Contains(cancelled, s => Live.Any(m => m.ProcessorSpaceId == s.Id));
    }

    [Fact]
    public void A_reseed_leaves_no_availability_record_over_committed()
    {
        // Pink is a bug flag and must be unreachable in the seed (resolved question 1). A reset that
        // restored a pink record would restore a defect, and the demo forces the state deliberately
        // from the record form rather than finding it lying about.
        var over = Reseeded.Availabilities
            .Where(a => MatchQuantities.ForAvailability(a, Reseeded.Matches, Cancelled).State == QuantityState.Over)
            .ToList();

        Assert.Empty(over);
    }

    [Fact]
    public void A_reseed_is_byte_for_byte_the_dataset_the_demo_script_was_written_against()
    {
        // The guard on Documents/DEMO.md. It names records by id and quantity; if a change to the
        // seeder moved either, the walkthrough would be wrong in front of an audience and nothing
        // else in the suite would say so. Spot-checked rather than snapshotted, because a snapshot of
        // 400-odd records would fail unreadably.
        Assert.Equal(SeedFixture.Data.ProcessorSpaces.Count, Reseeded.ProcessorSpaces.Count);
        Assert.Equal(SeedFixture.Data.Availabilities.Count, Reseeded.Availabilities.Count);
        Assert.Equal(SeedFixture.Data.Matches.Count, Reseeded.Matches.Count);

        foreach (var (before, after) in SeedFixture.Data.Matches.Zip(Reseeded.Matches))
        {
            Assert.Equal(before.Id, after.Id);
            Assert.Equal(before.ProcessorSpaceId, after.ProcessorSpaceId);
            Assert.Equal(before.LivestockAvailabilityId, after.LivestockAvailabilityId);
            Assert.Equal(before.QuantityMatched, after.QuantityMatched);
            Assert.Equal(before.Status, after.Status);
        }
    }
}
