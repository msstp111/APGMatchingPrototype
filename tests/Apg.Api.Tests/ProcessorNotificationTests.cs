using Apg.Api.Seeding;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// The coupling between a domain rule and an API vocabulary, which is the one thing neither project's
/// own tests can see.
/// </summary>
/// <remarks>
/// <c>ProcessorNotifications</c> holds processor <em>names</em>, because it is a rule and not a
/// vocabulary — the same shape <c>StockClassCompatibility</c> has. The cost of that shape is that a
/// typo, or a rename in <c>SeedConfig.Processors</c>, would leave the rule matching nobody: every
/// match would quietly lose its Notify button and nothing would fail. This is the test that fails
/// instead. It lives in the API project because that is where the two halves can both be seen.
/// </remarks>
public class ProcessorNotificationTests
{
    [Fact]
    public void Exactly_one_seeded_processor_receives_match_notifications()
    {
        var receiving = SeedConfig.Processors.Where(ProcessorNotifications.Receives).ToList();

        Assert.Equal(["ANZCO"], receiving);
    }

    /// <summary>
    /// Named individually as well, so a failure says which of the three moved rather than only that
    /// the count is wrong. Alliance Group sees no matches at all and SFF sees a restricted set only
    /// once the space is Confirmed, which is why neither has a notify step (see the class remarks on
    /// <c>ProcessorNotifications</c>).
    /// </summary>
    [Theory]
    [InlineData("ANZCO", true)]
    [InlineData("Alliance Group", false)]
    [InlineData("SFF", false)]
    public void The_three_processors_are_each_where_the_requirements_put_them(
        string processor,
        bool receives)
    {
        Assert.Contains(processor, SeedConfig.Processors);
        Assert.Equal(receives, ProcessorNotifications.Receives(processor));
    }

    /// <summary>
    /// A processor nobody has heard of does not get notified. This fails <em>closed</em>, unlike
    /// <c>StockClassCompatibility</c>, which fails towards showing more: an unrecognised stock class
    /// hidden from a drag is supply an operator cannot see, whereas an unrecognised processor offered
    /// a Notify button is APG telling a room that a meatworks gets notified when nobody has agreed it
    /// does.
    /// </summary>
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("Anzco Foods Limited")]
    public void An_unrecognised_processor_does_not_receive_notifications(string? processor) =>
        Assert.False(ProcessorNotifications.Receives(processor));

    /// <summary>
    /// Case and surrounding space are forgiven, because this is matched against a name typed into the
    /// Phase 7 record form rather than against an enum.
    /// </summary>
    [Theory]
    [InlineData("anzco")]
    [InlineData("ANZCO ")]
    [InlineData(" AnZcO")]
    public void The_name_match_forgives_case_and_padding(string processor) =>
        Assert.True(ProcessorNotifications.Receives(processor));
}
