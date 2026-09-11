using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// The stock-class compatibility table — the matching screen's "Filter on drag" aid.
/// </summary>
/// <remarks>
/// The pairings are asserted in both directions and by name, because the table is a judgement about
/// livestock rather than a computation: the only way it can be wrong is for a pairing to be wrong, and
/// the only way to check one is to read it. <c>Apg.Api.Tests</c> holds the other half — that every
/// class in either seeded vocabulary has an entry at all.
/// </remarks>
public class StockClassCompatibilityTests
{
    /// <summary>Space class, availability class — every pair the aid should keep on screen.</summary>
    [Theory]
    [InlineData("Lamb", "Lamb")]
    [InlineData("Mutton", "Mutton")]
    // ANZCO's three lamb programmes. Each meets its own name on the supply side, and each meets the
    // plain "Lamb" that Alliance Group and SFF book — which is the generic standing over all three.
    [InlineData("Lamb ABF", "Lamb ABF")]
    [InlineData("Lamb QA", "Lamb QA")]
    [InlineData("Lamb ANZCO-owned", "Lamb ANZCO-owned")]
    [InlineData("Lamb", "Lamb ABF")]
    [InlineData("Lamb", "Lamb QA")]
    [InlineData("Lamb", "Lamb ANZCO-owned")]
    // ANZCO's and SFF's specific cattle classes against the supply names for the same animals.
    [InlineData("Cows", "Cow")]
    [InlineData("Prime", "Prime")]
    [InlineData("Bulls", "Bull")]
    [InlineData("Bulls", "Sire Bull")]
    [InlineData("Nat Beef - Ultra", "GFNB ultra")]
    [InlineData("Nat Beef - Premium", "GFNB premium")]
    // A mixed mob fits any ungraded cattle slot.
    [InlineData("Cows", "Mixed Cattle")]
    [InlineData("Prime", "Mixed Cattle")]
    [InlineData("Bulls", "Mixed Cattle")]
    // Alliance Group's generic Cattle takes every bovine class, which is the whole reason the table
    // is tags and not a pair list.
    [InlineData("Cattle", "Cow")]
    [InlineData("Cattle", "Prime")]
    [InlineData("Cattle", "Bull")]
    [InlineData("Cattle", "Sire Bull")]
    [InlineData("Cattle", "Mixed Cattle")]
    [InlineData("Cattle", "GFNB ultra")]
    [InlineData("Cattle", "GFNB premium")]
    public void Compatible_classes_are_compatible_both_ways(string space, string availability)
    {
        Assert.True(StockClassCompatibility.AreCompatible(space, availability));
        Assert.True(StockClassCompatibility.AreCompatible(availability, space));
    }

    [Theory]
    // Sheep are not one class. Lamb and mutton are different products on different schedules, and
    // neither vocabulary has a class that spans them.
    [InlineData("Lamb", "Mutton")]
    [InlineData("Mutton", "Lamb")]
    // The three lamb programmes stay apart from one another. A QA line is not an ABF line, and the
    // reason APG asked for the split is that they have to tell ANZCO which one a load is.
    [InlineData("Lamb ABF", "Lamb QA")]
    [InlineData("Lamb QA", "Lamb ANZCO-owned")]
    [InlineData("Lamb ANZCO-owned", "Lamb ABF")]
    [InlineData("Lamb ABF", "Mutton")]
    // No species crossing.
    [InlineData("Lamb", "Cow")]
    [InlineData("Cows", "Lamb")]
    [InlineData("Deer", "Lamb")]
    // The graded beef programmes are specific: a Nat Beef space is not a home for a cow, a bull or a
    // mixed mob, and the two grades are not each other.
    [InlineData("Nat Beef - Ultra", "Cow")]
    [InlineData("Nat Beef - Ultra", "Mixed Cattle")]
    [InlineData("Nat Beef - Ultra", "GFNB premium")]
    [InlineData("Nat Beef - Premium", "GFNB ultra")]
    // Specific cattle classes stay apart from one another.
    [InlineData("Cows", "Bull")]
    [InlineData("Bulls", "Cow")]
    [InlineData("Prime", "Cow")]
    public void Incompatible_classes_are_incompatible(string one, string other)
    {
        Assert.False(StockClassCompatibility.AreCompatible(one, other));
    }

    /// <summary>
    /// Alliance Group's Deer class has nothing to meet it: the supply vocabulary has no deer.
    /// </summary>
    /// <remarks>
    /// Worth pinning because it is the one class that empties the far column, which is a real state
    /// the screen has to draw rather than a bug in this table.
    /// </remarks>
    [Fact]
    public void Deer_matches_nothing_on_the_supply_side()
    {
        string[] supply =
        [
            "GFNB ultra", "GFNB premium", "Prime", "Cow", "Sire Bull", "Bull", "Mixed Cattle",
            "Lamb", "Lamb ABF", "Lamb QA", "Lamb ANZCO-owned", "Mutton",
        ];

        Assert.All(supply, s => Assert.False(StockClassCompatibility.AreCompatible("Deer", s)));
    }

    /// <summary>
    /// A class the table has never heard of is compatible with everything.
    /// </summary>
    /// <remarks>
    /// The failure direction is the point. A record that has been filtered off the screen cannot be
    /// matched, so an unrecognised class — hand-typed on a debug form, or arriving when APG swap
    /// <c>SeedConfig</c> for their real lists — must fail towards being visible.
    /// </remarks>
    [Theory]
    [InlineData("Something APG added last week")]
    [InlineData("")]
    [InlineData(null)]
    public void An_unknown_stock_class_is_compatible_with_everything(string? unknown)
    {
        Assert.Equal(StockClassCompatibility.AllGroups, StockClassCompatibility.GroupsFor(unknown));
        Assert.True(StockClassCompatibility.AreCompatible(unknown, "Lamb"));
        Assert.True(StockClassCompatibility.AreCompatible("Deer", unknown));
        Assert.False(StockClassCompatibility.IsKnown(unknown));
    }

    /// <summary>
    /// The two vocabularies disagree about case already — <c>Nat Beef - Ultra</c> against
    /// <c>GFNB ultra</c> — so the lookup does not care about it either.
    /// </summary>
    [Fact]
    public void The_lookup_ignores_case_and_surrounding_space()
    {
        Assert.True(StockClassCompatibility.IsKnown(" lamb "));
        Assert.True(StockClassCompatibility.AreCompatible("LAMB", "lamb"));
        Assert.True(StockClassCompatibility.AreCompatible("Nat Beef - Ultra", "gfnb ultra"));
    }

    /// <summary>
    /// Every class carries at least one tag, and a known class never carries all of them.
    /// </summary>
    /// <remarks>
    /// The second half is the one that matters: <see cref="StockClassCompatibility.AllGroups"/> is the
    /// answer for an <em>unknown</em> class, so a known class that somehow held every tag would be
    /// indistinguishable from one the table had lost — and it would silently stop filtering.
    /// </remarks>
    [Theory]
    [InlineData("Lamb")]
    [InlineData("Lamb ABF")]
    [InlineData("Lamb QA")]
    [InlineData("Lamb ANZCO-owned")]
    [InlineData("Mutton")]
    [InlineData("Deer")]
    [InlineData("Cattle")]
    [InlineData("Cows")]
    [InlineData("Bulls")]
    [InlineData("Nat Beef - Ultra")]
    [InlineData("Nat Beef - Premium")]
    [InlineData("Cow")]
    [InlineData("Bull")]
    [InlineData("Sire Bull")]
    [InlineData("GFNB ultra")]
    [InlineData("GFNB premium")]
    [InlineData("Mixed Cattle")]
    [InlineData("Prime")]
    public void A_known_class_carries_some_tags_but_never_all_of_them(string stockClass)
    {
        var groups = StockClassCompatibility.GroupsFor(stockClass);

        Assert.True(StockClassCompatibility.IsKnown(stockClass));
        Assert.NotEmpty(groups);
        Assert.NotEqual(StockClassCompatibility.AllGroups.Count, groups.Count);
    }
}
