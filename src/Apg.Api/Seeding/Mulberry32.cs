namespace Apg.Api.Seeding;

/// <summary>
/// A mulberry32 PRNG, written into the codebase on purpose.
/// </summary>
/// <remarks>
/// <see cref="System.Random"/> is explicitly <em>not</em> used here: its algorithm is not guaranteed
/// stable across .NET versions, so a framework upgrade would silently reshape the entire demo
/// dataset. Mulberry32 is thirty lines, has no dependencies, and gives byte-identical output
/// forever.
/// </remarks>
public sealed class Mulberry32
{
    private uint _state;

    public Mulberry32(uint seed) => _state = seed;

    /// <summary>The raw generator step. Uniform over the full 32-bit range.</summary>
    public uint NextUInt()
    {
        unchecked
        {
            _state += 0x6D2B79F5u;
            var z = _state;
            z = (z ^ (z >> 15)) * (z | 1u);
            z ^= z + (z ^ (z >> 7)) * (z | 61u);
            return z ^ (z >> 14);
        }
    }

    /// <summary>Uniform in [0, 1).</summary>
    public double NextDouble() => NextUInt() / 4294967296.0;

    /// <summary>Uniform integer in [minInclusive, maxExclusive).</summary>
    public int Next(int minInclusive, int maxExclusive)
    {
        if (maxExclusive <= minInclusive)
        {
            throw new ArgumentOutOfRangeException(
                nameof(maxExclusive), $"maxExclusive ({maxExclusive}) must exceed minInclusive ({minInclusive}).");
        }

        var range = (long)maxExclusive - minInclusive;
        return (int)(minInclusive + (long)(NextDouble() * range));
    }

    /// <summary>Uniform decimal in [min, max], rounded to <paramref name="decimals"/> places.</summary>
    public decimal NextDecimal(decimal min, decimal max, int decimals = 2) =>
        Math.Round(min + (decimal)NextDouble() * (max - min), decimals);

    /// <summary>True with probability <paramref name="probability"/>.</summary>
    public bool Chance(double probability) => NextDouble() < probability;

    public T Pick<T>(IReadOnlyList<T> items) => items[Next(0, items.Count)];

    /// <summary>Fisher-Yates, in place.</summary>
    public void Shuffle<T>(IList<T> items)
    {
        for (var i = items.Count - 1; i > 0; i--)
        {
            var j = Next(0, i + 1);
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
}
