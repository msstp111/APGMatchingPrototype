namespace Apg.Domain.Time;

/// <summary>
/// The one place New Zealand time is resolved and the one place a week boundary is decided.
/// </summary>
/// <remarks>
/// <para>
/// Week banding is the spine of the matching screen, and a date landing in the wrong week does not
/// look like a bug: the record is simply somewhere else and the operator concludes it does not
/// exist. So every business date is a <see cref="DateOnly"/>, every UTC instant is converted to New
/// Zealand local time <em>before</em> a date is taken off it, and "today" is a New Zealand concept —
/// Saturday 13:00 UTC is already Sunday here.
/// </para>
/// <para>
/// Phase 0 needs only the seed anchor. Phase 1 owns hardening this type and the full DST / boundary
/// test matrix; extend it here rather than writing a second copy anywhere else.
/// </para>
/// </remarks>
public static class NzTime
{
    /// <summary>
    /// IANA id. .NET 6+ accepts IANA ids on Windows as well as Linux, so one id serves both.
    /// </summary>
    public const string TimeZoneId = "Pacific/Auckland";

    private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    /// <summary>The New Zealand time zone, resolved exactly once.</summary>
    public static TimeZoneInfo TimeZone => Zone;

    /// <summary>
    /// The Sunday at or before <paramref name="date"/>. Idempotent: a Sunday returns itself.
    /// <c>DayOfWeek.Sunday</c> is 0 in .NET, which is what makes this a plain subtraction.
    /// </summary>
    public static DateOnly WeekCommencing(DateOnly date) => date.AddDays(-(int)date.DayOfWeek);

    /// <summary>
    /// The New Zealand calendar date on which <paramref name="instant"/> falls. Converting first and
    /// taking the date second is the whole point: <c>2026-04-08T21:19:23.875Z</c> is 9 April here,
    /// and taking <c>.Date</c> off the UTC value would yield 8 April.
    /// </summary>
    public static DateOnly ToNzDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, Zone).DateTime);

    /// <summary>Today's date in New Zealand, according to the supplied clock.</summary>
    public static DateOnly Today(TimeProvider clock) => ToNzDate(clock.GetUtcNow());

    /// <summary>
    /// The Sunday that starts the current New Zealand week. This is the seeder's date anchor: a
    /// UTC-derived anchor would put the whole dataset in the wrong week for twelve hours of every
    /// Saturday, a window that includes Friday evening here.
    /// </summary>
    public static DateOnly CurrentWeekCommencing(TimeProvider clock) => WeekCommencing(Today(clock));

    /// <summary>
    /// A New Zealand wall-clock time on a business date, as an instant. Used for seeded audit
    /// timestamps so they too are anchored to the current week rather than to an absolute date.
    /// </summary>
    public static DateTimeOffset AtNzTime(DateOnly date, TimeSpan timeOfDay)
    {
        var local = date.ToDateTime(TimeOnly.FromTimeSpan(timeOfDay), DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Zone.GetUtcOffset(local));
    }
}
