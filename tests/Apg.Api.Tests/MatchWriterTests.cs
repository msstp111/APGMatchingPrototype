using Apg.Api.Contracts;
using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Apg.Domain.Pricing;

namespace Apg.Api.Tests;

/// <summary>
/// The write path a drag goes through, driven off the real generated seed with no database.
/// </summary>
/// <remarks>
/// Every answer here is <c>Apg.Domain</c>'s. These tests prove the translation: the default, the
/// supply-side ceiling, the deliberately absent demand-side ceiling, the exact refusal, the price
/// key, and that a repeat pairing is a second match.
/// </remarks>
public class MatchWriterTests
{
    private static readonly WorkingSet Set = new(
        SeedFixture.Data.ProcessorSpaces,
        SeedFixture.Data.Availabilities,
        SeedFixture.Data.Matches,
        SeedFixture.Data.Locations,
        SeedFixture.Data.Farmers);

    private static readonly PriceTable Prices = new(SeedFixture.Data.Prices);

    [Fact]
    public void The_default_is_the_smaller_of_the_two_unmatched_figures_and_the_ceiling_is_supply()
    {
        var (space, availability) = FirstAllowedPair();
        var proposal = MatchWriter.Propose(Set, Prices, space.Id, availability.Id);

        Assert.NotNull(proposal);
        Assert.True(proposal.IsAllowed);

        var spaceUnmatched = MatchQuantities.ForSpace(space, Set.Matches).Unmatched;
        var availabilityUnmatched = MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched;

        Assert.Equal(Math.Min(spaceUnmatched, availabilityUnmatched), proposal.Quantity);
        Assert.Equal(availabilityUnmatched, proposal.Maximum);
        Assert.Null(proposal.RefusalMessage);
    }

    [Fact]
    public void A_pair_with_nothing_left_is_refused_with_the_exact_domain_message()
    {
        var exhausted = Set.Availabilities.First(availability =>
            MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched < 1);
        var space = Set.Spaces.First();

        var proposal = MatchWriter.Propose(Set, Prices, space.Id, exhausted.Id);

        Assert.NotNull(proposal);
        Assert.False(proposal.IsAllowed);
        Assert.Equal(MatchCreation.NoUnmatchedQuantity, proposal.RefusalMessage);
        Assert.Equal(0, proposal.Quantity);
        Assert.Equal(0, proposal.Maximum);

        // The write path uses the same gate: a POST of 1 head must not sneak past a refused pair.
        Assert.Equal(
            MatchCreation.NoUnmatchedQuantity,
            MatchWriter.Reject(Set, Request(space.Id, exhausted.Id, quantity: 1)));
    }

    /// <summary>
    /// Resolved question 7. The two vocabularies do not map, so a lookup on the availability class
    /// is a plausible number for the wrong animal — and that is how a wrong-side key hides.
    /// </summary>
    [Fact]
    public void The_default_price_is_keyed_on_the_processor_space_stock_class()
    {
        var (space, availability, proposal) = FirstDifferingClassPair();

        var expected = Prices.DefaultPricePerKg(space);
        var wrongSide = Prices.DefaultPricePerKg(
            space.Processor,
            availability.StockClass,
            space.DeliveryDate);

        Assert.Equal(expected, proposal.DefaultPricePerKg);
        Assert.NotEqual(wrongSide, proposal.DefaultPricePerKg);
        Assert.NotEqual(space.StockClass, availability.StockClass);
    }

    [Fact]
    public void Validation_refuses_zero_and_anything_above_the_availability_unmatched()
    {
        var (space, availability) = FirstAllowedPair();
        var maximum = MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched;

        Assert.Equal(
            MatchWriter.BelowOneHead,
            MatchWriter.Reject(Set, Request(space.Id, availability.Id, quantity: 0)));

        Assert.NotNull(MatchWriter.Reject(Set, Request(space.Id, availability.Id, quantity: maximum + 1)));
    }

    [Fact]
    public void Validation_refuses_a_pair_whose_space_is_already_over_filled()
    {
        var overFilled = Set.Spaces.First(space =>
            MatchQuantities.ForSpace(space, Set.Matches).Unmatched < 1);
        var availability = Set.Availabilities.First(availability =>
            MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched >= 1);

        Assert.Equal(
            MatchCreation.NoUnmatchedQuantity,
            MatchWriter.Reject(Set, Request(overFilled.Id, availability.Id, quantity: 1)));
    }

    [Fact]
    public void Validation_accepts_a_quantity_that_over_fills_the_space()
    {
        var (space, availability) = FirstPairWhereSupplyExceedsDemand();
        var spaceUnmatched = MatchQuantities.ForSpace(space, Set.Matches).Unmatched;
        var availabilityUnmatched = MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched;

        Assert.True(availabilityUnmatched > spaceUnmatched);

        var rejection = MatchWriter.Reject(
            Set,
            Request(space.Id, availability.Id, quantity: availabilityUnmatched));

        Assert.Null(rejection);
    }

    [Fact]
    public void A_repeat_pairing_is_still_allowed_and_a_second_draft_adds_to_the_incl_draft_sum()
    {
        var alreadyMatched = Set.Matches.First(match =>
            MatchQuantities.IsLive(match)
            && MatchQuantities.ForSpace(Set.Spaces.First(s => s.Id == match.ProcessorSpaceId), Set.Matches)
                .Unmatched >= 1
            && MatchQuantities.ForAvailability(
                    Set.Availabilities.First(a => a.Id == match.LivestockAvailabilityId),
                    Set.Matches)
                .Unmatched >= 1);

        var proposal = MatchWriter.Propose(
            Set,
            Prices,
            alreadyMatched.ProcessorSpaceId,
            alreadyMatched.LivestockAvailabilityId);

        Assert.NotNull(proposal);
        Assert.True(proposal.IsAllowed);
        Assert.Null(MatchWriter.Reject(
            Set,
            Request(alreadyMatched.ProcessorSpaceId, alreadyMatched.LivestockAvailabilityId, quantity: 1)));

        var extra = MatchWriter.Drafted(
            Request(alreadyMatched.ProcessorSpaceId, alreadyMatched.LivestockAvailabilityId, quantity: 1),
            new FixedClock(new DateTimeOffset(2026, 8, 31, 10, 0, 0, TimeSpan.FromHours(12))));

        var space = Set.Spaces.First(s => s.Id == alreadyMatched.ProcessorSpaceId);
        var before = MatchQuantities.ForSpace(space, Set.Matches).MatchedInclDraft;
        var after = MatchQuantities.ForSpace(space, Set.Matches.Append(extra)).MatchedInclDraft;

        Assert.Equal(before + extra.QuantityMatched, after);
        Assert.Equal(2, Set.Matches.Count(m =>
            MatchQuantities.IsLive(m)
            && m.ProcessorSpaceId == alreadyMatched.ProcessorSpaceId
            && m.LivestockAvailabilityId == alreadyMatched.LivestockAvailabilityId) + 1);
    }

    [Fact]
    public void Delete_is_refused_for_anything_past_Drafted()
    {
        var drafted = Set.Matches.First(match => match.Status == MatchStatus.Drafted);
        var confirmed = Set.Matches.First(match => match.Status == MatchStatus.Confirmed);

        Assert.Null(MatchWriter.RejectDelete(drafted));
        Assert.Equal("Only a drafted match can be deleted", MatchWriter.RejectDelete(confirmed));
        Assert.Equal("There is no such match", MatchWriter.RejectDelete(null));
    }

    [Fact]
    public void A_missing_record_is_not_a_proposal()
    {
        Assert.Null(MatchWriter.Propose(Set, Prices, processorSpaceId: 0, livestockAvailabilityId: 1));
        Assert.Equal(
            MatchResponses.NoSuchPair,
            MatchWriter.Reject(Set, Request(0, 1, quantity: 1)));
    }

    private static (ProcessorSpace Space, LivestockAvailability Availability) FirstAllowedPair()
    {
        foreach (var space in Set.Spaces)
        {
            foreach (var availability in Set.Availabilities)
            {
                var proposal = MatchWriter.Propose(Set, Prices, space.Id, availability.Id);

                if (proposal is { IsAllowed: true })
                {
                    return (space, availability);
                }
            }
        }

        throw new InvalidOperationException("The seed has no pair that can still be matched.");
    }

    private static (ProcessorSpace Space, LivestockAvailability Availability, MatchProposalDto Proposal)
        FirstDifferingClassPair()
    {
        foreach (var space in Set.Spaces)
        {
            foreach (var availability in Set.Availabilities)
            {
                if (space.StockClass == availability.StockClass)
                {
                    continue;
                }

                var proposal = MatchWriter.Propose(Set, Prices, space.Id, availability.Id);

                if (proposal is not { IsAllowed: true })
                {
                    continue;
                }

                var expected = Prices.DefaultPricePerKg(space);
                var wrongSide = Prices.DefaultPricePerKg(
                    space.Processor,
                    availability.StockClass,
                    space.DeliveryDate);

                if (!Equals(expected, wrongSide))
                {
                    return (space, availability, proposal);
                }
            }
        }

        throw new InvalidOperationException(
            "The seed has no allowed pair whose two stock classes produce different price lookups.");
    }

    private static (ProcessorSpace Space, LivestockAvailability Availability) FirstPairWhereSupplyExceedsDemand()
    {
        foreach (var space in Set.Spaces)
        {
            var spaceUnmatched = MatchQuantities.ForSpace(space, Set.Matches).Unmatched;

            if (spaceUnmatched < 1)
            {
                continue;
            }

            foreach (var availability in Set.Availabilities)
            {
                var availabilityUnmatched = MatchQuantities.ForAvailability(availability, Set.Matches).Unmatched;

                if (availabilityUnmatched > spaceUnmatched)
                {
                    return (space, availability);
                }
            }
        }

        throw new InvalidOperationException(
            "The seed has no pair whose remaining supply exceeds remaining demand.");
    }

    private static CreateMatchRequest Request(int spaceId, int availabilityId, int quantity) =>
        new()
        {
            ProcessorSpaceId = spaceId,
            LivestockAvailabilityId = availabilityId,
            QuantityMatched = quantity,
        };
}
