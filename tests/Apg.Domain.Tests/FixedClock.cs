namespace Apg.Domain.Tests;

/// <summary>
/// A <see cref="TimeProvider"/> pinned to one instant. No test may read the real system clock: a
/// suite that depends on it is flaky one day a week, and the day it is flaky is the day the
/// New Zealand week has already turned over while UTC has not.
/// </summary>
public sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}
