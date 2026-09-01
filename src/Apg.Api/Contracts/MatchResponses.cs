namespace Apg.Api.Contracts;

/// <summary>
/// What every write endpoint sends back — the match ones, and from Phase 7 the record ones too.
/// </summary>
/// <remarks>
/// A class of its own rather than local functions in <c>Program.cs</c>, so every endpoint shares one
/// success shape per kind of write and <b>one error shape</b>, and the client has exactly one field to
/// read a message from however the write failed.
/// </remarks>
public static class MatchResponses
{
    public const string NoSuchPair =
        "That processor space or livestock availability record no longer exists";

    /// <summary>
    /// Both parents, re-read and re-projected after the write.
    /// </summary>
    /// <remarks>
    /// Re-read rather than adjusted in place: every figure the client then puts on screen is the same
    /// server-side computation as the ones it loaded with. A match changes both sides at once — both
    /// matched sums, both unmatched figures, both quantity states, and the availability record's
    /// derived status — so both come back together and the client updates two cards from one response.
    /// </remarks>
    public static async Task<IResult> WriteResultAsync(
        WorkingSetLoader loader,
        int spaceId,
        int availabilityId,
        int? matchId,
        CancellationToken cancellation)
    {
        var set = await loader.LoadAsync(cancellation);
        var space = MatchingProjection.SpaceById(set, spaceId);
        var availability = MatchingProjection.AvailabilityById(set, availabilityId);

        if (space is null || availability is null)
        {
            return Results.NotFound(Message(NoSuchPair));
        }

        return Results.Ok(new MatchWriteResultDto
        {
            // Taken off the parent rather than projected a second time, so the match on the card and
            // the match in the response cannot become two shapes of the same row.
            Match = matchId is null ? null : space.Matches.FirstOrDefault(m => m.Id == matchId),
            Space = space,
            Availability = availability,
        });
    }

    /// <summary>
    /// One space, re-read and re-projected after confirming it.
    /// </summary>
    /// <remarks>
    /// Deliberately <b>not</b> the two-parent shape. Confirming a Processor Space changes that space's
    /// stored status and nothing else: no match moves, and no availability record is touched. Returning
    /// an availability record alongside it would imply otherwise, on the one screen where what a write
    /// does and does not reach is the thing most easily misread.
    /// </remarks>
    public static async Task<IResult> SpaceResultAsync(
        WorkingSetLoader loader,
        int spaceId,
        CancellationToken cancellation)
    {
        var space = MatchingProjection.SpaceById(await loader.LoadAsync(cancellation), spaceId);

        return space is null
            ? Results.NotFound(Message(MatchWriter.NoSuchSpace))
            : Results.Ok(space);
    }


    /// <summary>
    /// One record, re-read and re-projected after a Phase 7 write, and the recomputed week calendar.
    /// </summary>
    /// <remarks>
    /// <para>
    /// One record and not both, because a record write touches one side. That is true even of a
    /// cancellation, which leaves every match — and so every counterparty record — exactly as it was.
    /// </para>
    /// <para>
    /// The calendar comes back with it because a create, or an edit that moves a date, can move the
    /// range of weeks the two columns are drawn on. A record whose week is not in the client's band
    /// list places nowhere and vanishes off the screen, and the client cannot name a new week itself
    /// without doing date arithmetic in the browser.
    /// </para>
    /// </remarks>
    public static async Task<IResult> RecordResultAsync(
        WorkingSetLoader loader,
        TimeProvider clock,
        int? spaceId,
        int? availabilityId,
        CancellationToken cancellation)
    {
        var set = await loader.LoadAsync(cancellation);
        var space = spaceId is null ? null : MatchingProjection.SpaceById(set, spaceId.Value);
        var availability = availabilityId is null
            ? null
            : MatchingProjection.AvailabilityById(set, availabilityId.Value);

        if (space is null && availability is null)
        {
            return Results.NotFound(Message(
                spaceId is null ? RecordWriter.NoSuchAvailability : MatchWriter.NoSuchSpace));
        }

        return Results.Ok(new RecordWriteResultDto
        {
            Space = space,
            Availability = availability,
            Weeks = MatchingProjection.WeekBands(set, clock),
        });
    }
    /// <summary>The one shape an error comes back in.</summary>
    public static object Message(string message) => new { message };
}
