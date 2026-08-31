namespace Apg.Api.Contracts;

/// <summary>
/// What the two match-write endpoints send back.
/// </summary>
/// <remarks>
/// A class of its own rather than local functions in <c>Program.cs</c>, so both endpoints share one
/// success shape and one error shape and the client has exactly one field to read a message from.
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

    /// <summary>The one shape an error comes back in.</summary>
    public static object Message(string message) => new { message };
}
