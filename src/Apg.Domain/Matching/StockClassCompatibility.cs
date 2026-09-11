namespace Apg.Domain.Matching;

/// <summary>
/// Which Processor Space stock classes a Livestock Availability stock class could plausibly fill, and
/// the other way round.
/// </summary>
/// <remarks>
/// <para>
/// <b>This is an aid, never a gate.</b> The two vocabularies do not map onto one another — processor
/// classes are each processor's own list, availability classes are one separate list — and the whole
/// design says a human judges compatibility during the drag. Nothing in the API refuses a match on
/// these grounds and nothing ever should: the table exists so the matching screen can *hide the
/// obvious mismatches while a card is in the operator's hand*, and switching that off must put every
/// record back.
/// </para>
/// <para>
/// The relation is expressed as <b>group tags</b> rather than as a pair list, and compatibility is
/// "the two tag sets intersect". That is what lets one generic class sit over several specific ones
/// without writing the cross product down: an unqualified <c>Lamb</c> carries every lamb tag, so it
/// is offered for ANZCO's <c>Lamb ABF</c>, <c>Lamb QA</c> and <c>Lamb ANZCO-owned</c> spaces as well
/// as for the plain <c>Lamb</c> that Alliance Group and SFF book, and none of those four had to know
/// it exists. A generic cattle class works the same way over the bovine tags.
/// </para>
/// <para>
/// <b>One table serves both sides.</b> The names barely overlap — <c>Cows</c> against <c>Cow</c>,
/// <c>Nat Beef - Ultra</c> against <c>GFNB ultra</c> — and where a name *does* appear on both sides
/// (<c>Prime</c>, <c>Lamb</c>, <c>Mutton</c>) it means the same animal on both, so a single
/// name-keyed table is honest rather than a shortcut. It also means a future unification of the two
/// vocabularies shrinks this file instead of breaking it.
/// </para>
/// <para>
/// <b>An unrecognised class is compatible with everything</b> (<see cref="GroupsFor"/>). The failure
/// direction matters: a class the table has never heard of — hand-typed on a debug form, or added
/// when APG swap <c>SeedConfig</c>'s lists for their real ones — must not be quietly filtered off the
/// screen, because a record that cannot be seen cannot be matched. It is worth knowing that this
/// makes the table's coverage silent when it lapses, which is why an API test asserts that every
/// seeded class on both sides has an explicit entry.
/// </para>
/// <para>
/// Lamb and Mutton are deliberately <b>not</b> interchangeable, though both are sheep. They are
/// different products on different price schedules (the seeded bands are $7–9 against $4.50–5.80),
/// and neither vocabulary has a class that spans them; an operator who wants to put lamb into a
/// mutton space turns the aid off, which takes one click.
/// </para>
/// </remarks>
public static class StockClassCompatibility
{
    // The tags. Species where species is all that is being said; the beef programmes separately,
    // because a Nat Beef / GFNB slot is a graded programme and not simply "some cattle".
    public const string Lamb = "lamb";

    // ANZCO's three lamb programmes, each its own tag. They deliberately do NOT share a single
    // "lamb" tag: compatibility is set intersection, so one shared tag would make ABF, QA and
    // ANZCO-owned compatible with each other as well as with the generic class — the opposite of
    // what the aid is for. The generic class reaches all three by carrying all four tags, exactly
    // as a generic cattle class carries every bovine one.
    public const string LambAbf = "lamb-abf";
    public const string LambQa = "lamb-qa";
    public const string LambAnzcoOwned = "lamb-anzco-owned";
    public const string Mutton = "mutton";
    public const string Deer = "deer";
    public const string BeefPrime = "beef-prime";
    public const string BeefCow = "beef-cow";
    public const string BeefBull = "beef-bull";
    public const string BeefUltra = "beef-ultra";
    public const string BeefPremium = "beef-premium";

    /// <summary>Every tag, which is what an unrecognised class is given. See the remarks.</summary>
    public static readonly IReadOnlyList<string> AllGroups =
    [
        Lamb, LambAbf, LambQa, LambAnzcoOwned, Mutton, Deer,
        BeefPrime, BeefCow, BeefBull, BeefUltra, BeefPremium,
    ];

    /// <summary>Every lamb tag — what an unqualified <c>Lamb</c> class carries, on either side.</summary>
    private static readonly string[] AnyLamb = [Lamb, LambAbf, LambQa, LambAnzcoOwned];

    /// <summary>Every bovine tag — what a generic cattle class carries.</summary>
    private static readonly string[] AnyCattle =
        [BeefPrime, BeefCow, BeefBull, BeefUltra, BeefPremium];

    /// <summary>
    /// Stock class name to tags, for both vocabularies at once.
    /// </summary>
    /// <remarks>
    /// Case-insensitive because the two lists disagree about it already: ANZCO's
    /// <c>Nat Beef - Ultra</c> against the supply side's <c>GFNB ultra</c>. A table that cared would
    /// be a table that broke the first time someone typed <c>lamb</c> into the debug form.
    /// </remarks>
    private static readonly Dictionary<string, string[]> Table = new(StringComparer.OrdinalIgnoreCase)
    {
        // --- sheep, on both sides ---
        // Unqualified Lamb is the generic: it stands over the three ANZCO programmes, so a plain
        // lamb line is offered for an ABF, QA or ANZCO-owned space, and a record of any of those
        // three is offered for every plain Lamb space — which is what Alliance Group and SFF book.
        // The three programmes do not reach one another.
        ["Lamb"] = AnyLamb,
        ["Lambs"] = AnyLamb,
        ["Lamb ABF"] = [LambAbf],
        ["Lamb QA"] = [LambQa],
        ["Lamb ANZCO-owned"] = [LambAnzcoOwned],
        ["Mutton"] = [Mutton],

        // --- deer: Alliance Group's demand class, with no supply class to meet it ---
        ["Deer"] = [Deer],

        // --- cattle, demand side ---
        // Alliance Group's list carried a generic "Cattle" until APG replaced it with Cow, Prime and
        // Sire Bull (2026-09-11). The entry stays: GroupsFor fails open, so a class the table has
        // never heard of is hidden by nothing, and keeping the generic costs one line against the
        // day a processor books one again.
        ["Cattle"] = AnyCattle,
        ["Cows"] = [BeefCow],
        ["Bulls"] = [BeefBull],
        ["Nat Beef - Ultra"] = [BeefUltra],
        ["Nat Beef - Premium"] = [BeefPremium],

        // --- cattle, supply side ---
        ["Cow"] = [BeefCow],
        ["Bull"] = [BeefBull],
        ["Sire Bull"] = [BeefBull],
        ["GFNB ultra"] = [BeefUltra],
        ["GFNB premium"] = [BeefPremium],
        // A mixed line goes to a generic cattle slot or to any of the ungraded specific ones. It is
        // not offered for the two Nat Beef / GFNB programmes: those are graded lines, and a mixed
        // mob is the one thing they are not.
        ["Mixed Cattle"] = [BeefPrime, BeefCow, BeefBull],

        // --- on both sides, same animal ---
        ["Prime"] = [BeefPrime],
    };

    /// <summary>
    /// The tags a class carries, or every tag when the class is not in the table.
    /// </summary>
    public static IReadOnlyList<string> GroupsFor(string? stockClass) =>
        stockClass is not null && Table.TryGetValue(stockClass.Trim(), out var groups)
            ? groups
            : AllGroups;

    /// <summary>
    /// Whether the table has an opinion about this class at all.
    /// </summary>
    /// <remarks>
    /// Exists for the coverage test rather than for the screen. <see cref="GroupsFor"/> fails open, so
    /// a missing entry costs nothing at runtime and shows up nowhere — the only way to notice is to
    /// ask.
    /// </remarks>
    public static bool IsKnown(string? stockClass) =>
        stockClass is not null && Table.ContainsKey(stockClass.Trim());

    /// <summary>
    /// Whether two stock classes — one from each vocabulary — could plausibly be matched.
    /// </summary>
    /// <remarks>
    /// The client asks the same question of the two tag lists on the DTOs rather than calling home
    /// per card, because it asks it forty times per pointer-down. This is the same rule, and the tests
    /// pin it here.
    /// </remarks>
    public static bool AreCompatible(string? spaceStockClass, string? availabilityStockClass)
    {
        var space = GroupsFor(spaceStockClass);

        return GroupsFor(availabilityStockClass).Any(space.Contains);
    }
}
