using System.Globalization;

namespace Apg.Domain.Time;

/// <summary>
/// The one place New Zealand time is resolved, the one place a week boundary is decided, and the one
/// place a business date is turned into a display string.
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
/// New Zealand runs two offsets — NZST is UTC+12, NZDT is UTC+13 — and it switches between them on a
/// <em>Sunday</em>, which is also our week boundary. That coincidence is the single most likely
/// source of an off-by-one-week error in this codebase, which is why the tests name both transition
/// Sundays explicitly rather than trusting a happy-path week.
/// </para>
/// <para>
/// This is the only home for date rules. A second copy anywhere else is the drift the roadmap
/// forbids: extend this file.
/// </para>
/// </remarks>
public static class NzTime
{
    /// <summary>
    /// IANA id. .NET 6+ accepts IANA ids on Windows as well as Linux, so one id serves both.
    /// </summary>
    public const string TimeZoneId = "Pacific/Auckland";

    /// <summary>
    /// The format the existing LMS app renders dates in — sampled from the Purchases screen, where
    /// 23 August 2026 reads <c>23-08-26</c>. Formatted under the invariant culture so the machine's
    /// locale cannot change what goes over the wire.
    /// </summary>
    public const string DateLabelFormat = "dd-MM-yy";

    /// <summary>
    /// The friendlier form the matching screen's week bands and carry-over cards read in — <c>16 Aug</c>,
    /// <c>1 Sep</c>. LMS's own <see cref="DateLabelFormat"/> is right for a table of dates but wrong for
    /// prose, and the band header and carry-over card are both prose: "Week of 16 Aug", "since 17 Aug".
    /// One format serves both, so there is still exactly one place either string's date is formatted.
    /// </summary>
    public const string ShortDateLabelFormat = "d MMM";

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
    /// <remarks>
    /// A <see cref="TimeProvider"/> rather than <c>DateTime.Today</c>: a suite that reads the real
    /// clock is flaky one day a week, and the day it is flaky is the day the New Zealand week has
    /// already turned over while UTC has not.
    /// </remarks>
    public static DateOnly Today(TimeProvider clock) => ToNzDate(clock.GetUtcNow());

    /// <summary>
    /// The Sunday that starts the current New Zealand week. This is the seeder's date anchor: a
    /// UTC-derived anchor would put the whole dataset in the wrong week for twelve hours of every
    /// Saturday, a window that includes Friday evening here.
    /// </summary>
    public static DateOnly CurrentWeekCommencing(TimeProvider clock) => WeekCommencing(Today(clock));

    /// <summary>
    /// A business date as the client should display it — <c>dd-MM-yy</c>, matching LMS.
    /// </summary>
    /// <remarks>
    /// Every DTO carrying a date carries its label too, so the client renders a string it was given
    /// and never constructs a JavaScript <c>Date</c> from the ISO value. Doing so would reintroduce
    /// the browser's timezone into a decision this design deliberately settles on the server.
    /// </remarks>
    public static string DateLabel(DateOnly date) =>
        date.ToString(DateLabelFormat, CultureInfo.InvariantCulture);

    /// <summary>
    /// The label for the week a date falls in — the same format, applied to its Sunday. Phase 3's
    /// band header composes its own wording around this ("Week of 23-08-26"); the date itself is
    /// formatted here so no phase formats one in TypeScript.
    /// </summary>
    public static string WeekLabel(DateOnly date) => DateLabel(WeekCommencing(date));

    /// <summary>
    /// A business date in the short prose form — <c>16 Aug</c>. The client puts the surrounding words
    /// there ("Week of", "since"), because the week rail stacks them on separate lines and a single
    /// preformatted sentence could not be split.
    /// </summary>
    public static string ShortDateLabel(DateOnly date) =>
        date.ToString(ShortDateLabelFormat, CultureInfo.InvariantCulture);

    /// <summary>
    /// Every Sunday from <paramref name="first"/>'s week to <paramref name="last"/>'s week inclusive,
    /// in order and with no gaps.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the matching screen's week banding, and the reason it lives here rather than in the
    /// client is requirement 1.6: a week with no records in it still renders its header, so the screen
    /// needs the name of a week that no record can supply. Working that out in the browser would mean
    /// adding seven days to an ISO string — the one thing the date rules exist to keep out of
    /// TypeScript.
    /// </para>
    /// <para>
    /// Both ends are normalised through <see cref="WeekCommencing"/>, so a caller may pass any date in
    /// the week it means. A <paramref name="last"/> before <paramref name="first"/> yields an empty
    /// sequence rather than throwing: the caller composing a range out of min and max cannot produce
    /// that case, and an empty band list renders as an empty screen rather than a failed request.
    /// </para>
    /// </remarks>
    public static IReadOnlyList<DateOnly> WeeksFrom(DateOnly first, DateOnly last)
    {
        var start = WeekCommencing(first);
        var end = WeekCommencing(last);
        var weeks = new List<DateOnly>();

        for (var week = start; week <= end; week = week.AddDays(7))
        {
            weeks.Add(week);
        }

        return weeks;
    }

    /// <summary>
    /// A New Zealand wall-clock time on a business date, as an instant. Used for seeded audit
    /// timestamps so they too are anchored to the current week rather than to an absolute date.
    /// </summary>
    /// <remarks>
    /// The two daylight-saving Sundays make some local times unreal and others doubled:
    /// <list type="bullet">
    /// <item><description>
    /// <b>Invalid</b> — the 02:00–03:00 that never happens on the September Sunday. There is no
    /// instant to return, so the time is advanced past the gap to the first that does exist.
    /// </description></item>
    /// <item><description>
    /// <b>Ambiguous</b> — the 02:00–03:00 that happens twice on the April Sunday. .NET's
    /// <see cref="TimeZoneInfo.GetUtcOffset(DateTime)"/> resolves these to the <em>standard</em>
    /// offset, i.e. the second (NZST) occurrence. That is deterministic, which is what matters here;
    /// both occurrences fall on the same calendar date, so no week banding depends on the choice.
    /// </description></item>
    /// </list>
    /// </remarks>
    public static DateTimeOffset AtNzTime(DateOnly date, TimeSpan timeOfDay)
    {
        var local = date.ToDateTime(TimeOnly.FromTimeSpan(timeOfDay), DateTimeKind.Unspecified);

        while (Zone.IsInvalidTime(local))
        {
            local = local.AddMinutes(1);
        }

        return new DateTimeOffset(local, Zone.GetUtcOffset(local));
    }
}
