using Apg.Domain.Time;

namespace Apg.Domain.Tests;

/// <summary>
/// The handful of date cases Phase 0's seeder actually depends on. Phase 1 owns the exhaustive
/// matrix — both daylight-saving Sundays, the NZDT/NZST pair, month/year/leap boundaries and the
/// property test — and should extend this file rather than start a second one.
/// </summary>
public class NzTimeTests
{
    [Theory]
    [InlineData("2026-08-23")] // Sunday
    [InlineData("2026-08-24")] // Monday
    [InlineData("2026-08-25")]
    [InlineData("2026-08-26")]
    [InlineData("2026-08-27")]
    [InlineData("2026-08-28")]
    [InlineData("2026-08-29")] // Saturday
    public void WeekCommencing_returns_the_same_Sunday_for_every_day_of_a_week(string date)
    {
        var week = NzTime.WeekCommencing(DateOnly.Parse(date));

        Assert.Equal(new DateOnly(2026, 8, 23), week);
    }

    [Fact]
    public void WeekCommencing_is_idempotent_and_always_lands_on_a_Sunday()
    {
        var date = new DateOnly(2026, 8, 27);

        var once = NzTime.WeekCommencing(date);
        var twice = NzTime.WeekCommencing(once);

        Assert.Equal(DayOfWeek.Sunday, once.DayOfWeek);
        Assert.Equal(once, twice);
    }

    [Fact]
    public void ToNzDate_converts_before_taking_the_date_not_after()
    {
        // A real timestamp shape from Data/locations.csv. Taking .Date off the UTC value gives
        // 8 April, a full day early — and a full week early whenever the true date is a Sunday.
        var instant = DateTimeOffset.Parse("2026-04-08T21:19:23.875Z");

        Assert.Equal(new DateOnly(2026, 4, 9), NzTime.ToNzDate(instant));
    }

    [Fact]
    public void ToNzDate_handles_both_New_Zealand_offsets()
    {
        // Identical UTC time of day, different local dates: NZDT is UTC+13, NZST is UTC+12. A naive
        // "+12 hours" constant passes the July case and fails the January one.
        Assert.Equal(new DateOnly(2026, 1, 16), NzTime.ToNzDate(DateTimeOffset.Parse("2026-01-15T11:30:00Z")));
        Assert.Equal(new DateOnly(2026, 7, 15), NzTime.ToNzDate(DateTimeOffset.Parse("2026-07-15T11:30:00Z")));
    }

    [Fact]
    public void CurrentWeekCommencing_follows_the_New_Zealand_week_not_the_UTC_one()
    {
        // Saturday 22 August 2026, 13:00 UTC — already Sunday 23 August in New Zealand. A
        // UTC-derived anchor would seed the whole dataset into the previous week here, and it would
        // do so for twelve hours of every Saturday.
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-22T13:00:00Z"));

        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void CurrentWeekCommencing_on_a_New_Zealand_Sunday_returns_that_Sunday()
    {
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-22T22:00:00Z")); // Sunday 10am NZ

        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void The_New_Zealand_time_zone_resolves_by_its_IANA_id()
    {
        // .NET 6+ accepts IANA ids on Windows as well as Linux. The dev machine is Windows; if CI is
        // not, a passing local suite would otherwise prove nothing.
        Assert.NotNull(NzTime.TimeZone);
        Assert.Equal("Pacific/Auckland", NzTime.TimeZoneId);
    }
}
