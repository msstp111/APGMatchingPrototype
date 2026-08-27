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
    /// Processor Space stock classes, per processor, exactly as the requirements list them.
    /// These do <em>not</em> map onto <see cref="AvailabilityStockClasses"/>; a human judges
    /// compatibility during the drag. Do not build a lookup between the two.
    /// </summary>
    public static readonly (string Processor, string[] StockClasses)[] ProcessorSpaceStockClasses =
    [
        ("ANZCO", ["Cows", "Prime", "Nat Beef - Ultra", "Nat Beef - Premium", "Bulls", "Lamb", "Mutton"]),
        ("Alliance Group", ["Lamb", "Mutton", "Cattle", "Deer"]),
        ("SFF", ["Lambs", "Prime", "Cows"]),
    ];

    /// <summary>The single, separate supply-side list.</summary>
    public static readonly string[] AvailabilityStockClasses =
        ["GFNB ultra", "GFNB premium", "Prime", "Cow", "Sire Bull", "Bull", "Mixed Cattle", "Lamb", "Mutton"];

    /// <summary>
    /// Invented plants, placed in each company's actual operating regions: ANZCO through Canterbury,
    /// Rangitikei, Taranaki and Otago; Alliance through Southland, North Otago, Hawke's Bay and
    /// Nelson; SFF through South Otago, Hawke's Bay, South Canterbury and the Waikato.
    /// </summary>
    public static readonly (string Processor, string[] Plants)[] PlantsByProcessor =
    [
        ("ANZCO", ["Rakaia Plains", "Marton Junction", "Waitara North", "Kaiapoi Works"]),
        ("Alliance Group", ["Wallacetown", "Gore South", "Oamaru Downs", "Waipukurau", "Richmond Valley"]),
        ("SFF", ["Balclutha East", "Waipawa", "Timaru South", "Morrinsville"]),
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
        "Contract kill — do not substitute.",
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
        "Lamb" or "Lambs" => Species.Lamb,
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
