using System.Globalization;
using Apg.Domain.Time;

namespace Apg.Domain.Tests;

/// <summary>
/// Date handling, over-tested on purpose.
/// </summary>
/// <remarks>
/// <para>
/// Week banding is the spine of the matching screen. A record that lands in the wrong week does not
/// look like a bug — it is simply somewhere the operator is not looking, and they conclude it does
/// not exist. Every case below has a specific way of going wrong and all of them fail silently.
/// </para>
/// <para>
/// The sharpest edge is that New Zealand's two daylight-saving transitions fall on <b>Sundays</b>,
/// which is also our week boundary. Both of those Sundays are named explicitly here rather than
/// trusted to a happy-path week.
/// </para>
/// </remarks>
public class NzTimeTests
{
    // ---------------------------------------------------------------------------------------------
    // WeekCommencing basics
    // ---------------------------------------------------------------------------------------------

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
        var week = NzTime.WeekCommencing(DateOnly.Parse(date, CultureInfo.InvariantCulture));

        Assert.Equal(new DateOnly(2026, 8, 23), week);
    }

    [Fact]
    public void WeekCommencing_is_idempotent_and_always_lands_on_a_Sunday()
    {
        var date = new DateOnly(2026, 8, 27);

        var once = NzTime.WeekCommencing(date);
        var twice = NzTime.WeekCommencing(once);
        var thrice = NzTime.WeekCommencing(twice);

        Assert.Equal(DayOfWeek.Sunday, once.DayOfWeek);
        Assert.Equal(once, twice);
        Assert.Equal(once, thrice);
    }

    [Fact]
    public void A_Sunday_returns_itself()
    {
        var sunday = new DateOnly(2026, 8, 23);

        Assert.Equal(sunday, NzTime.WeekCommencing(sunday));
    }

    // ---------------------------------------------------------------------------------------------
    // Calendar boundaries — month, year, leap day
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void A_week_crossing_a_month_boundary_bands_into_the_previous_month()
    {
        // Tuesday 1 September 2026 belongs to the week that started Sunday 30 August.
        Assert.Equal(new DateOnly(2026, 8, 30), NzTime.WeekCommencing(new DateOnly(2026, 9, 1)));
    }

    [Fact]
    public void A_week_crossing_a_year_boundary_bands_into_the_previous_year()
    {
        // Thursday 1 January 2026 belongs to the week that started Sunday 28 December 2025.
        Assert.Equal(new DateOnly(2025, 12, 28), NzTime.WeekCommencing(new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void A_leap_day_bands_like_any_other_day()
    {
        // Tuesday 29 February 2028 belongs to the week that started Sunday 27 February.
        Assert.Equal(new DateOnly(2028, 2, 27), NzTime.WeekCommencing(new DateOnly(2028, 2, 29)));
    }

    [Fact]
    public void The_week_containing_a_leap_day_spans_February_into_March()
    {
        Assert.Equal(new DateOnly(2028, 2, 27), NzTime.WeekCommencing(new DateOnly(2028, 3, 4)));
    }

    // ---------------------------------------------------------------------------------------------
    // Daylight saving — the highest-risk cases, because New Zealand transitions on Sundays
    // ---------------------------------------------------------------------------------------------

    /// <summary>
    /// Daylight saving <b>starts</b> on the last Sunday in September — 27 September 2026, when
    /// 02:00 becomes 03:00 and the day is 23 hours long.
    /// </summary>
    [Fact]
    public void The_September_transition_Sunday_is_its_own_week_commencing()
    {
        var transition = new DateOnly(2026, 9, 27);

        Assert.Equal(DayOfWeek.Sunday, transition.DayOfWeek);
        Assert.Equal(transition, NzTime.WeekCommencing(transition));
    }

    [Fact]
    public void The_days_either_side_of_the_September_transition_band_where_they_should()
    {
        // Saturday 26 September is the last day of the previous week; Monday 28 September the second
        // day of the new one. A 23-hour Sunday must not pull either across the boundary.
        Assert.Equal(new DateOnly(2026, 9, 20), NzTime.WeekCommencing(new DateOnly(2026, 9, 26)));
        Assert.Equal(new DateOnly(2026, 9, 27), NzTime.WeekCommencing(new DateOnly(2026, 9, 28)));
    }

    /// <summary>
    /// Daylight saving <b>ends</b> on the first Sunday in April — 5 April 2026, when 03:00 becomes
    /// 02:00 and the day is 25 hours long with an hour that happens twice.
    /// </summary>
    [Fact]
    public void The_April_transition_Sunday_is_its_own_week_commencing()
    {
        var transition = new DateOnly(2026, 4, 5);

        Assert.Equal(DayOfWeek.Sunday, transition.DayOfWeek);
        Assert.Equal(transition, NzTime.WeekCommencing(transition));
    }

    [Fact]
    public void The_days_either_side_of_the_April_transition_band_where_they_should()
    {
        Assert.Equal(new DateOnly(2026, 3, 29), NzTime.WeekCommencing(new DateOnly(2026, 4, 4)));
        Assert.Equal(new DateOnly(2026, 4, 5), NzTime.WeekCommencing(new DateOnly(2026, 4, 6)));
    }

    [Fact]
    public void An_instant_inside_the_September_skipped_hour_still_resolves_to_that_Sunday()
    {
        // 2026-09-26T14:00Z is 02:00 NZST on 27 September — a wall-clock time that never happens,
        // because the clocks jump to 03:00 NZDT. As an instant it is unambiguous, and the date is
        // still the 27th.
        var instant = DateTimeOffset.Parse("2026-09-26T14:00:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 9, 27), NzTime.ToNzDate(instant));
        Assert.Equal(new DateOnly(2026, 9, 27), NzTime.WeekCommencing(NzTime.ToNzDate(instant)));
    }

    [Fact]
    public void Both_passes_through_the_April_repeated_hour_resolve_to_that_Sunday()
    {
        // 02:30 happens twice on 5 April 2026: once as NZDT (UTC+13) and once as NZST (UTC+12).
        var firstPass = DateTimeOffset.Parse("2026-04-04T13:30:00Z", CultureInfo.InvariantCulture);
        var secondPass = DateTimeOffset.Parse("2026-04-04T14:30:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 4, 5), NzTime.ToNzDate(firstPass));
        Assert.Equal(new DateOnly(2026, 4, 5), NzTime.ToNzDate(secondPass));
    }

    [Fact]
    public void The_instant_just_before_the_September_transition_is_still_the_Saturday()
    {
        // 2026-09-26T11:59Z is 23:59 NZST on Saturday 26 September, an hour before the jump.
        var instant = DateTimeOffset.Parse("2026-09-26T11:59:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 9, 26), NzTime.ToNzDate(instant));
        Assert.Equal(new DateOnly(2026, 9, 20), NzTime.WeekCommencing(NzTime.ToNzDate(instant)));
    }

    // ---------------------------------------------------------------------------------------------
    // UTC -> New Zealand conversion
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void ToNzDate_converts_before_taking_the_date_not_after()
    {
        // A real timestamp shape from Data/locations.csv. Taking .Date off the UTC value gives
        // 8 April, a full day early — and a full week early whenever the true date is a Sunday.
        var instant = DateTimeOffset.Parse("2026-04-08T21:19:23.875Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 4, 9), NzTime.ToNzDate(instant));
    }

    [Fact]
    public void ToNzDate_handles_both_New_Zealand_offsets()
    {
        // Identical UTC time of day, different local dates: NZDT is UTC+13, NZST is UTC+12. A naive
        // "+12 hours" constant passes the July case and fails the January one.
        Assert.Equal(
            new DateOnly(2026, 1, 16),
            NzTime.ToNzDate(DateTimeOffset.Parse("2026-01-15T11:30:00Z", CultureInfo.InvariantCulture)));
        Assert.Equal(
            new DateOnly(2026, 7, 15),
            NzTime.ToNzDate(DateTimeOffset.Parse("2026-07-15T11:30:00Z", CultureInfo.InvariantCulture)));
    }

    [Fact]
    public void An_instant_shortly_after_UTC_midnight_stays_on_the_same_New_Zealand_day()
    {
        // Confirms the conversion is a real timezone shift and not something that pushes every date
        // forward by one. 00:30 UTC on 15 July is 12:30 the same day here.
        var instant = DateTimeOffset.Parse("2026-07-15T00:30:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 7, 15), NzTime.ToNzDate(instant));
    }

    [Fact]
    public void An_instant_expressed_in_another_offset_converts_by_its_true_moment()
    {
        // Same instant as 2026-07-15T11:30Z, written as a New York offset. The conversion must key
        // off the moment, not off the text.
        var instant = DateTimeOffset.Parse("2026-07-15T07:30:00-04:00", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 7, 15), NzTime.ToNzDate(instant));
    }

    [Fact]
    public void A_late_evening_UTC_instant_is_already_the_next_New_Zealand_day()
    {
        var instant = DateTimeOffset.Parse("2026-07-15T23:00:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(new DateOnly(2026, 7, 16), NzTime.ToNzDate(instant));
    }

    // ---------------------------------------------------------------------------------------------
    // The clock, and "the current week"
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void CurrentWeekCommencing_follows_the_New_Zealand_week_not_the_UTC_one()
    {
        // Saturday 22 August 2026, 13:00 UTC — already Sunday 23 August in New Zealand. A
        // UTC-derived anchor would seed the whole dataset into the previous week here, and it would
        // do so for twelve hours of every Saturday: a window that includes Friday evening here,
        // when APG are most likely to be working.
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-22T13:00:00Z", CultureInfo.InvariantCulture));

        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.Today(clock));
        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void An_hour_earlier_that_same_Saturday_is_still_the_previous_week()
    {
        // 11:00 UTC is 23:00 Saturday here. The boundary is real and this is the other side of it.
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-22T11:00:00Z", CultureInfo.InvariantCulture));

        Assert.Equal(new DateOnly(2026, 8, 22), NzTime.Today(clock));
        Assert.Equal(new DateOnly(2026, 8, 16), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void CurrentWeekCommencing_on_a_New_Zealand_Sunday_returns_that_Sunday()
    {
        var clock = new FixedClock(
            DateTimeOffset.Parse("2026-08-22T22:00:00Z", CultureInfo.InvariantCulture)); // Sunday 10am NZ

        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void CurrentWeekCommencing_in_the_middle_of_a_week_returns_that_weeks_Sunday()
    {
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-27T02:00:00Z", CultureInfo.InvariantCulture));

        Assert.Equal(new DateOnly(2026, 8, 27), NzTime.Today(clock));
        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    // ---------------------------------------------------------------------------------------------
    // The time zone itself
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void The_New_Zealand_time_zone_resolves_by_its_IANA_id()
    {
        // .NET 6+ accepts IANA ids on Windows as well as Linux. The dev machine is Windows; if CI is
        // not, a passing local suite would otherwise prove nothing.
        Assert.NotNull(NzTime.TimeZone);
        Assert.Equal("Pacific/Auckland", NzTime.TimeZoneId);
    }

    [Fact]
    public void The_resolved_zone_carries_real_New_Zealand_offsets_in_both_seasons()
    {
        // Asserting the offsets rather than merely that a zone came back: a stub or misnamed zone
        // would satisfy the lookup and then quietly put every summer date in the wrong week.
        var summer = DateTimeOffset.Parse("2026-01-15T11:30:00Z", CultureInfo.InvariantCulture);
        var winter = DateTimeOffset.Parse("2026-07-15T11:30:00Z", CultureInfo.InvariantCulture);

        Assert.Equal(TimeSpan.FromHours(13), NzTime.TimeZone.GetUtcOffset(summer)); // NZDT
        Assert.Equal(TimeSpan.FromHours(12), NzTime.TimeZone.GetUtcOffset(winter)); // NZST
    }

    // ---------------------------------------------------------------------------------------------
    // AtNzTime — a wall-clock time on a business date, including the two transitions
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void AtNzTime_uses_the_offset_in_force_on_that_date()
    {
        var summer = NzTime.AtNzTime(new DateOnly(2026, 1, 15), TimeSpan.FromHours(9));
        var winter = NzTime.AtNzTime(new DateOnly(2026, 7, 15), TimeSpan.FromHours(9));

        Assert.Equal(TimeSpan.FromHours(13), summer.Offset);
        Assert.Equal(TimeSpan.FromHours(12), winter.Offset);
        Assert.Equal(new DateOnly(2026, 1, 15), NzTime.ToNzDate(summer));
        Assert.Equal(new DateOnly(2026, 7, 15), NzTime.ToNzDate(winter));
    }

    [Fact]
    public void AtNzTime_survives_the_hour_that_never_happens()
    {
        // 02:30 on 27 September 2026 does not exist: the clocks jump from 02:00 to 03:00. Rather
        // than produce an instant that maps back to a different local time, the time is advanced past
        // the gap — and the calendar date, which is what week banding uses, is unchanged.
        var instant = NzTime.AtNzTime(new DateOnly(2026, 9, 27), TimeSpan.FromMinutes(150));

        Assert.Equal(new DateOnly(2026, 9, 27), NzTime.ToNzDate(instant));
        Assert.Equal(TimeSpan.FromHours(13), instant.Offset);
    }

    [Fact]
    public void AtNzTime_resolves_the_hour_that_happens_twice_deterministically()
    {
        // 02:30 on 5 April 2026 happens twice. .NET resolves an ambiguous local time to the standard
        // offset, i.e. the second (NZST) pass. Either pass falls on the same calendar date, so no
        // week banding depends on the choice — only that it is stable.
        var first = NzTime.AtNzTime(new DateOnly(2026, 4, 5), TimeSpan.FromMinutes(150));
        var second = NzTime.AtNzTime(new DateOnly(2026, 4, 5), TimeSpan.FromMinutes(150));

        Assert.Equal(first, second);
        Assert.Equal(new DateOnly(2026, 4, 5), NzTime.ToNzDate(first));
    }

    // ---------------------------------------------------------------------------------------------
    // Display labels
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void A_date_label_is_the_format_the_existing_LMS_app_uses()
    {
        Assert.Equal("23-08-26", NzTime.DateLabel(new DateOnly(2026, 8, 23)));
        Assert.Equal("01-09-26", NzTime.DateLabel(new DateOnly(2026, 9, 1)));
    }

    [Fact]
    public void A_week_label_is_the_label_of_that_weeks_Sunday()
    {
        Assert.Equal("23-08-26", NzTime.WeekLabel(new DateOnly(2026, 8, 27)));
        Assert.Equal("30-08-26", NzTime.WeekLabel(new DateOnly(2026, 9, 1)));
    }

    [Fact]
    public void Date_labels_do_not_change_with_the_machines_locale()
    {
        // Formatted under the invariant culture. A machine set to en-US would otherwise emit
        // 08-23-26 and put the month where the client expects the day.
        var original = CultureInfo.CurrentCulture;

        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("en-US");
            Assert.Equal("23-08-26", NzTime.DateLabel(new DateOnly(2026, 8, 23)));

            CultureInfo.CurrentCulture = new CultureInfo("de-DE");
            Assert.Equal("23-08-26", NzTime.DateLabel(new DateOnly(2026, 8, 23)));
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Property test
    // ---------------------------------------------------------------------------------------------

    /// <summary>
    /// Hand-picked cases only catch the errors someone thought of. Walking a long run of consecutive
    /// dates catches whole classes of arithmetic error — a sign flip, a locale-dependent first day of
    /// week, an off-by-one at a month end.
    /// </summary>
    [Fact]
    public void WeekCommencing_always_returns_the_Sunday_at_or_up_to_six_days_before_any_date()
    {
        // 1 September 2025 through roughly the end of 2027: three daylight-saving transitions
        // (Sept 2025, April 2026, Sept 2026, April 2027, Sept 2027) and two year boundaries.
        var date = new DateOnly(2025, 9, 1);

        for (var i = 0; i < 850; i++)
        {
            var week = NzTime.WeekCommencing(date);

            Assert.Equal(DayOfWeek.Sunday, week.DayOfWeek);
            Assert.True(week <= date, $"{week} is after {date}");
            Assert.True(week >= date.AddDays(-6), $"{week} is more than six days before {date}");
            Assert.Equal(week, NzTime.WeekCommencing(week));

            date = date.AddDays(1);
        }
    }

    [Fact]
    public void Every_day_of_a_long_run_bands_into_a_week_of_exactly_seven_days()
    {
        // The complement of the test above: consecutive dates must produce a Sunday that either
        // repeats or advances by exactly seven, never by six or eight.
        var date = new DateOnly(2025, 9, 1);
        var previous = NzTime.WeekCommencing(date);

        for (var i = 0; i < 850; i++)
        {
            date = date.AddDays(1);
            var week = NzTime.WeekCommencing(date);

            Assert.True(
                week == previous || week == previous.AddDays(7),
                $"{date} banded to {week}, which is neither {previous} nor the Sunday after it");

            previous = week;
        }
    }
}
