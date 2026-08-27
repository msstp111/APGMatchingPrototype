namespace Apg.Api.Tests;

/// <summary>A <see cref="TimeProvider"/> pinned to one instant. No test reads the real clock.</summary>
public sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}
