using Apg.Domain.Entities;

namespace Apg.Api.Seeding;

/// <summary>
/// Every invented list in the prototype, in one file, so replacing them with APG's real values is a
/// single-file edit (resolved question 11). Nothing here is derived from <c>Data/*.csv</c>: that
/// export comes from APG's livestock <em>forecasting</em> system and its vocabularies do not match
/// the booking module's.
/// </summary>
public static class SeedConfig
{
    /// <summary>
    /// Fixed PRNG seed. Change this and the entire demo dataset changes shape; the numbers recorded
    /// in the build log and asserted in the seed tests are the ones this value produces.
    /// </summary>
    public const uint PrngSeed = 0x41504730; // "APG0"

    public static readonly string[] Processors = ["ANZCO", "Alliance Group", "SFF"];

    /// <summary>
    /// How the Processor Spaces divide between the three processors, as a share of the total.
    /// Roughly 70 / 20 / 10, which is the real-world mix APG sees. The seeder builds the exact counts
    /// from these weights and shuffles them.
    /// </summary>
    /// <remarks>
    /// This replaced a <c>Processors[i % 3]</c> cycle that aliased with the <c>i % 6</c> week spread,
    /// so that every week held exactly one processor and always would. What the shuffle removes is
    /// that <em>structural</em> guarantee — it does not promise a mixed week. With ANZCO at 70% and
    /// seven spaces in a week, an all-ANZCO week is perfectly ordinary, and the current seed has one.
    /// A genuinely guaranteed mix would need the assignment to know about the week, which is the
    /// coupling that caused the original bug.
    /// </remarks>
    public static readonly (string Processor, int Weight)[] ProcessorMix =
    [
        ("ANZCO", 70),
        ("Alliance Group", 20),
        ("SFF", 10),
    ];

    /// <summary>
    /// Processor Space stock classes, per processor, exactly as the requirements list them.
    /// These do <em>not</em> map onto <see cref="AvailabilityStockClasses"/>; a human judges
    /// compatibility during the drag. Do not build a lookup between the two.
    /// </summary>
    /// <remarks>
    /// Revised 2026-09-11 from the demo session with David Earl and Dougal Innes:
    /// <list type="bullet">
    /// <item><description>
    /// ANZCO's lamb splits three ways — <c>Lamb ABF</c>, <c>Lamb QA</c>, <c>Lamb ANZCO-owned</c>.
    /// APG has to identify which programme a line belongs to when advising stock to ANZCO's rep, so
    /// it cannot be a note on the record. The three are <b>ANZCO's alone</b>: Alliance Group and SFF
    /// book plain <c>Lamb</c>, and SFF's is the single "100% standard" class.
    /// </description></item>
    /// <item><description>
    /// Alliance Group's generic <c>Cattle</c> is gone, replaced by <c>Cow</c>, <c>Prime</c> and
    /// <c>Sire Bull</c> — the classes Dougal named. <c>Deer</c> stays on the list for now although
    /// APG have not traded deer in some years.
    /// </description></item>
    /// </list>
    /// Both changes are carried in <see cref="Apg.Domain.Matching.StockClassCompatibility"/> too, or
    /// the drag aid would have no opinion about the new names and show every record for all of them.
    /// </remarks>
    public static readonly (string Processor, string[] StockClasses)[] ProcessorSpaceStockClasses =
    [
        ("ANZCO", [
            "Cows", "Prime", "Nat Beef - Ultra", "Nat Beef - Premium", "Bulls",
            "Lamb", "Lamb ABF", "Lamb QA", "Lamb ANZCO-owned", "Mutton",
        ]),
        ("Alliance Group", ["Lamb", "Mutton", "Cow", "Prime", "Sire Bull", "Deer"]),
        // SFF's list said "Lambs" until APG confirmed it is "Lamb", like everyone else's.
        ("SFF", ["Lamb", "Prime", "Cows"]),
    ];

    /// <summary>The single, separate supply-side list.</summary>
    /// <remarks>
    /// The three ANZCO lamb programmes appear here as well (2026-09-11). They are a property of the
    /// stock, not of the processor, so the farmer or agent picks one when the availability record is
    /// created rather than APG deciding it at match time — David Earl: "just have it for both sides
    /// would be easiest". Plain <c>Lamb</c> remains, and is what an uncommitted line is.
    /// </remarks>
    public static readonly string[] AvailabilityStockClasses =
    [
        "GFNB ultra", "GFNB premium", "Prime", "Cow", "Sire Bull", "Bull", "Mixed Cattle",
        "Lamb", "Lamb ABF", "Lamb QA", "Lamb ANZCO-owned", "Mutton",
    ];

    /// <summary>
    /// APG's real plant names, transcribed from <c>Data/Plants.csv</c>. That file uses the code
    /// <c>AGL</c> where this module uses <c>Alliance Group</c>, and it spells Alliance's Nelson plant
    /// "Nelxon"; both are reconciled here. The CSV remains the source of record — if APG revise the
    /// list, edit it there and re-transcribe.
    /// </summary>
    public static readonly (string Processor, string[] Plants)[] PlantsByProcessor =
    [
        ("ANZCO", ["Canterbury", "Eltham", "Kokiri", "Manawatu", "Marlborough", "Rakaia", "Rangitikei"]),
        ("Alliance Group", ["Dannevirke", "Levin", "Lorneville", "Mataura", "Nelson", "Pukeuri", "Smithfield"]),
        ("SFF", ["Belfast", "Finegand", "Pacific", "Pareora", "Waitane"]),
    ];

    /// <summary>Invented New Zealand livestock carriers.</summary>
    public static readonly string[] TransportCompanies =
    [
        "Southern Cross Livestock", "Tussock Transport", "Rangitata Carriers", "Kaimai Livestock Haulage",
        "Clutha Valley Transport", "Te Anau Stock Carriers", "Waikato Stock Movers", "Highfield Livestock",
        "Manawatu Rural Carriers", "Alpine Freight Lines", "Coastal Stock Transport", "Otago Peninsula Haulage",
        "Rimu Rural Transport", "Kahurangi Carriers", "Silverstream Livestock",
    ];

    public static readonly MatchCancellationReason[] CancellationReasons =
    [
        MatchCancellationReason.ChangeFromAgentOrFarmer,
        MatchCancellationReason.ChangeFromProcessor,
        MatchCancellationReason.InternalDecisionByApg,
    ];

    public static readonly TransactionType[] TransactionTypes =
        [TransactionType.FinanceStock, TransactionType.GrazingStock, TransactionType.Other];

    public static readonly string[] FarmerGivenNames =
    [
        "Bruce", "Hamish", "Rangi", "Gavin", "Tania", "Wiremu", "Sandra", "Callum", "Ngaire", "Duncan",
        "Moana", "Trevor", "Kelly", "Angus", "Hinemoa", "Ross", "Fiona", "Tama", "Marcus", "Aroha",
        "Barry", "Lisa", "Hone", "Craig", "Jocelyn", "Rhys", "Whetu", "Nigel", "Karen", "Tipene",
    ];

    public static readonly string[] FarmerFamilyNames =
    [
        "McKenzie", "Thornton", "Ngata", "Cameron", "Whitaker", "Te Rangi", "Bishop", "Fraser", "Hape",
        "Sinclair", "Ruawai", "Hollows", "Blackwood", "Paterson", "Kereopa", "Tremaine", "Osborne",
        "Rakena", "Cardno", "Nicholls", "Waikari", "Ferguson", "Hislop", "Manaia", "Sutcliffe",
        "Pomare", "Aldridge", "Kingi", "Struthers", "Doolan",
    ];

    /// <summary>Mobile prefixes, so a generated number reads as a real New Zealand one.</summary>
    public static readonly string[] MobilePrefixes = ["021", "027", "022", "020"];

    public static readonly string[] DeliveryTimes =
    [
        "AM kill", "PM kill", "First draft, 7am", "Yard by 6:30am", "Before midday", "Second shift",
    ];

    public static readonly string[] SpaceNotes =
    [
        "Chilled order, needs to hold weight.",
        "Repeat booking for the same customer.",
        "Confirm tally the day before.",
        "Space may extend if supply allows.",
        "Contract kill. Do not substitute.",
        "Prefer even lines, no stragglers.",
    ];

    public static readonly string[] AvailabilityDetailsOptions =
    [
        "Shorn six weeks ago.", "Off winter crop, well grown.", "All NAIT tagged.",
        "Held on hill country, quiet to handle.", "Weighed last Tuesday.", "Second draft off the same mob.",
        "Grazing block clearing out.", "Even line, one sire group.",
    ];

    public static readonly string[] AvailabilityNotes =
    [
        "Farmer can hold a fortnight if needed.",
        "Truck access is tight after rain.",
        "Agent booked this on the farmer's behalf.",
        "Prefer a single pickup.",
        "Two-hour cartage to the works.",
    ];

    /// <summary>
    /// Species grouping for the two vocabularies, used only to pick realistic quantities and prices.
    /// It is emphatically <em>not</em> a mapping between the demand and supply stock class lists.
    /// </summary>
    public enum Species
    {
        Lamb,
        Mutton,
        Cattle,
        Deer,
    }

    public static Species SpeciesOf(string stockClass) => stockClass switch
    {
        // The three ANZCO programmes are lamb for every purpose this enum serves — head counts and
        // price bands. They are listed rather than matched on a "Lamb" prefix so that a future class
        // whose name merely begins with the word does not silently inherit a lamb's arithmetic.
        "Lamb" or "Lambs" or "Lamb ABF" or "Lamb QA" or "Lamb ANZCO-owned" => Species.Lamb,
        "Mutton" => Species.Mutton,
        "Deer" => Species.Deer,
        _ => Species.Cattle,
    };

    /// <summary>Realistic head counts: hundreds for sheep, tens for cattle and deer.</summary>
    public static (int Min, int Max) QuantityRange(string stockClass) => SpeciesOf(stockClass) switch
    {
        Species.Lamb => (220, 1200),
        Species.Mutton => (150, 800),
        Species.Deer => (20, 120),
        _ => stockClass == "Sire Bull" ? (2, 12) : (20, 150),
    };

    /// <summary>Realistic $/kg bands by species, from which the seeded price series starts.</summary>
    public static (decimal Min, decimal Max) PriceRange(string processorSpaceStockClass) =>
        SpeciesOf(processorSpaceStockClass) switch
        {
            Species.Lamb => (7.00m, 9.00m),
            Species.Mutton => (4.50m, 5.80m),
            Species.Deer => (8.00m, 10.00m),
            _ => (5.00m, 7.00m),
        };
}
