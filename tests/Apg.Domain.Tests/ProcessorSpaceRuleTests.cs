using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// The Processor Space confirm gate, and the deliberate absence of a status derivation on this side.
/// </summary>
public class ProcessorSpaceRuleTests
{
    [Fact]
    public void A_space_with_no_matches_cannot_be_confirmed()
    {
        var space = Given.Space(quantityRequired: 100);

        Assert.False(ProcessorSpaceRules.CanConfirm(space, [], CancelledRecords.None));
    }

    [Fact]
    public void A_space_with_only_drafted_matches_cannot_be_confirmed()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((40, MatchStatus.Drafted), (30, MatchStatus.Drafted));

        Assert.False(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    /// <summary>
    /// One confirmed and one still drafted: there is something to confirm, but something is still
    /// provisional. Resolved question 12 names exactly this case as the reason for the second clause.
    /// </summary>
    [Fact]
    public void A_space_with_a_confirmed_match_and_a_draft_outstanding_cannot_be_confirmed()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Drafted));

        Assert.False(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    /// <summary>
    /// Notified is live and not yet agreed, so it blocks confirmation exactly as a draft does. The
    /// resolved question names only Drafted because it was written while Notified was out of scope.
    /// </summary>
    [Fact]
    public void A_notified_match_blocks_confirmation_just_as_a_draft_does()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Notified));

        Assert.False(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    [Fact]
    public void A_space_with_one_confirmed_match_alone_can_be_confirmed()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        Assert.True(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    [Fact]
    public void An_under_filled_space_may_still_be_confirmed()
    {
        // The gate is about the matches being settled, not about the space being full. APG may
        // confirm a partly filled space and arrange the rest separately.
        var space = Given.Space(quantityRequired: 500);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        Assert.Equal(QuantityState.Under, MatchQuantities.ForSpace(space, matches, CancelledRecords.None).State);
        Assert.True(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    [Fact]
    public void Cancelled_matches_neither_enable_nor_block_confirmation()
    {
        var space = Given.Space(quantityRequired: 100);
        var confirmedAndCancelled = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Cancelled));
        var cancelledOnly = Given.Matches((40, MatchStatus.Cancelled));

        Assert.True(ProcessorSpaceRules.CanConfirm(space, confirmedAndCancelled, CancelledRecords.None));
        Assert.False(ProcessorSpaceRules.CanConfirm(space, cancelledOnly, CancelledRecords.None));
    }

    [Theory]
    [InlineData(ProcessorSpaceStatus.Confirmed)]
    [InlineData(ProcessorSpaceStatus.Cancelled)]
    public void A_space_that_is_no_longer_Booked_cannot_be_confirmed(ProcessorSpaceStatus status)
    {
        // Without this clause a cancelled space would report that it could be confirmed, and the
        // suppression would have to live in the client — which is where rules go to drift.
        var space = Given.Space(quantityRequired: 100, status: status);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        Assert.False(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
    }

    [Fact]
    public void Matches_belonging_to_other_spaces_do_not_open_the_gate()
    {
        var space = Given.Space(quantityRequired: 100, id: 1);

        var otherSpacesMatches = new List<Match>
        {
            Given.Match(60, MatchStatus.Confirmed, id: 1, spaceId: 2),
        };

        Assert.False(ProcessorSpaceRules.CanConfirm(space, otherSpacesMatches, CancelledRecords.None));
    }

    /// <summary>
    /// Phase 6, 5.3: a Confirm button that greys out for unstated reasons is exactly what makes a
    /// non-technical operator conclude the application is broken. The three cases need three answers.
    /// </summary>
    [Fact]
    public void A_Booked_space_whose_matches_are_not_all_agreed_says_what_it_needs()
    {
        var space = Given.Space(quantityRequired: 100);

        Assert.Equal(
            ProcessorSpaceRules.NeedsConfirmedMatches,
            ProcessorSpaceRules.ConfirmBlockedReason(space, [], CancelledRecords.None));

        Assert.Equal(
            ProcessorSpaceRules.NeedsConfirmedMatches,
            ProcessorSpaceRules.ConfirmBlockedReason(
                space,
                Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Drafted)), CancelledRecords.None));
    }

    [Fact]
    public void An_already_confirmed_space_says_so_rather_than_blaming_its_matches()
    {
        var space = Given.Space(quantityRequired: 100, status: ProcessorSpaceStatus.Confirmed);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        Assert.Equal(
            ProcessorSpaceRules.AlreadyConfirmed,
            ProcessorSpaceRules.ConfirmBlockedReason(space, matches, CancelledRecords.None));
    }

    [Fact]
    public void A_cancelled_space_says_so_rather_than_blaming_its_matches()
    {
        var space = Given.Space(quantityRequired: 100, status: ProcessorSpaceStatus.Cancelled);
        var matches = Given.Matches((60, MatchStatus.Confirmed));

        Assert.Equal(
            ProcessorSpaceRules.SpaceIsCancelled,
            ProcessorSpaceRules.ConfirmBlockedReason(space, matches, CancelledRecords.None));
    }

    /// <summary>
    /// The gate and its explanation are one piece of logic, and this is what keeps them so: a second
    /// implementation of the clauses to produce the sentence is how the button and the reason would
    /// come to disagree — the button enabled, the reason still saying why it cannot be.
    /// </summary>
    [Theory]
    [InlineData(ProcessorSpaceStatus.Booked)]
    [InlineData(ProcessorSpaceStatus.Confirmed)]
    [InlineData(ProcessorSpaceStatus.Cancelled)]
    public void The_reason_is_null_exactly_when_the_space_can_be_confirmed(ProcessorSpaceStatus status)
    {
        var space = Given.Space(quantityRequired: 100, status: status);

        IEnumerable<List<Match>> cases =
        [
            [],
            Given.Matches((60, MatchStatus.Confirmed)),
            Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Drafted)),
            Given.Matches((40, MatchStatus.Cancelled)),
            Given.Matches((60, MatchStatus.Notified)),
        ];

        foreach (var matches in cases)
        {
            Assert.Equal(
                ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None),
                ProcessorSpaceRules.ConfirmBlockedReason(space, matches, CancelledRecords.None) is null);
        }
    }

    /// <summary>
    /// Requirement 3.2: a Processor Space's status is a decision, not a consequence. Providing a
    /// derivation would invite a later phase to call it and overwrite what a human chose.
    /// </summary>
    [Fact]
    public void Nothing_in_the_domain_derives_a_Processor_Space_status()
    {
        var offenders = typeof(ProcessorSpaceRules).Assembly
            .GetTypes()
            // The entity's own Status property is stored state, which is the whole point.
            .Where(t => t.Namespace != typeof(ProcessorSpace).Namespace)
            .SelectMany(t => t.GetMethods())
            .Where(m => !m.IsSpecialName)
            .Where(m => m.ReturnType == typeof(ProcessorSpaceStatus))
            .Select(m => $"{m.DeclaringType?.Name}.{m.Name}")
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"Processor Space status must not be derived anywhere: {string.Join(", ", offenders)}");
    }
}
