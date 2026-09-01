using Apg.Api.Contracts;
using Apg.Api.Data;
using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

const string AngularDevServer = "AngularDevServer";

// The SQLite file sits beside the project so a demo survives a restart. EnsureCreated rather than
// migrations: this is a prototype whose schema is reset wholesale, and migrations would be ceremony
// with no payoff. Phase 8's "reset demo data" button calls the reset endpoint below.
var databasePath = Path.Combine(builder.Environment.ContentRootPath, "apg.db");
builder.Services.AddDbContext<ApgDbContext>(options => options.UseSqlite($"Data Source={databasePath}"));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<DatabaseSeeder>();
builder.Services.AddScoped<WorkingSetLoader>();
builder.Services.AddScoped<PriceTableLoader>();

// The wire format lives in ApiJson so the serialisation tests assert against the same options the
// host actually uses, rather than against a second copy that could drift from it.
builder.Services.ConfigureHttpJsonOptions(options => ApiJson.Configure(options.SerializerOptions));

// The Angular dev server proxies /api to this host, so requests arrive same-origin. CORS is here as
// a belt-and-braces fallback for running the client without the proxy.
builder.Services.AddCors(options => options.AddPolicy(
    AngularDevServer,
    policy => policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors(AngularDevServer);

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<DatabaseSeeder>().EnsureSeededAsync();
}

// The two read endpoints of the DTO contract. Each returns the whole working set for its side,
// sorted soonest-first, with every computed field already on it — both matched sums, unmatched, the
// quantity state, the derived availability status, the confirm gate, the week-commencing Sunday, and
// a display label beside every date. The client renders what it is given; it recomputes nothing.
app.MapGet("/api/processor-spaces", async (WorkingSetLoader loader, CancellationToken cancellation) =>
    MatchingProjection.ProcessorSpaces(await loader.LoadAsync(cancellation)));

app.MapGet("/api/livestock-availability", async (WorkingSetLoader loader, CancellationToken cancellation) =>
    MatchingProjection.LivestockAvailability(await loader.LoadAsync(cancellation)));

// The week bands both columns are drawn on. Separate from the two record endpoints because it is a
// calendar, not a record set: an empty week still renders its header, so the client needs the name of
// a week no record can supply, and deriving it in the browser would mean advancing an ISO date there.
app.MapGet("/api/week-bands", async (
        WorkingSetLoader loader,
        TimeProvider clock,
        CancellationToken cancellation) =>
    MatchingProjection.WeekBands(await loader.LoadAsync(cancellation), clock));

// The list a match's transport-company picker offers. Optional at draft time, so this is a
// convenience rather than a vocabulary: the invented carriers live in SeedConfig with every other
// invented list, so APG's real ones are a one-file swap.
app.MapGet("/api/transport-companies", () => SeedConfig.TransportCompanies.Order().ToList());

// --- the write path: creating a match by dragging one record onto the other -------------------
//
// Two calls, in this order, and the split is deliberate. The proposal is asked for at the moment of
// the drop, before any dialog opens, because when there is nothing left to match the answer is a
// refusal and not a dialog with a disabled button (requirement 3.2). The create then revalidates
// everything the dialog allowed, because a client is not a source of truth about a domain rule.
app.MapGet("/api/match-proposal", async (
        int processorSpaceId,
        int livestockAvailabilityId,
        WorkingSetLoader loader,
        PriceTableLoader priceLoader,
        CancellationToken cancellation) =>
{
    var set = await loader.LoadAsync(cancellation);
    var prices = await priceLoader.LoadAsync(cancellation);

    var proposal = MatchWriter.Propose(set, prices, processorSpaceId, livestockAvailabilityId);

    return proposal is null
        ? Results.NotFound(MatchResponses.Message(MatchResponses.NoSuchPair))
        : Results.Ok(proposal);
});

app.MapPost("/api/matches", async (
        CreateMatchRequest request,
        ApgDbContext db,
        WorkingSetLoader loader,
        TimeProvider clock,
        CancellationToken cancellation) =>
{
    var rejection = MatchWriter.Reject(await loader.LoadAsync(cancellation), request);

    if (rejection is not null)
    {
        return Results.BadRequest(MatchResponses.Message(rejection));
    }

    // Unconditionally an insert. Dropping a pair that already matches produces a second, separate
    // match rather than topping the first one up (resolved question 8) — nothing here looks for one.
    var match = MatchWriter.Drafted(request, clock);

    db.Matches.Add(match);
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.WriteResultAsync(
        loader,
        match.ProcessorSpaceId,
        match.LivestockAvailabilityId,
        match.Id,
        cancellation);
});

// The undo behind the creation snack bar, and the same endpoint Phase 6's "Delete draft" needs. A
// drafted match is plain-deleted rather than cancelled (resolved question 3); anything past Drafted
// has to be cancelled with a reason, which is Phase 6's, so this refuses it rather than guessing.
app.MapDelete("/api/matches/{id:int}", async (
        int id,
        ApgDbContext db,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var match = await db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellation);
    var rejection = MatchWriter.RejectDelete(match);

    if (rejection is not null)
    {
        return match is null
            ? Results.NotFound(MatchResponses.Message(rejection))
            : Results.Conflict(MatchResponses.Message(rejection));
    }

    var spaceId = match!.ProcessorSpaceId;
    var availabilityId = match.LivestockAvailabilityId;

    db.Matches.Remove(match);
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.WriteResultAsync(loader, spaceId, availabilityId, matchId: null, cancellation);
});

// --- Phase 6: the rest of a match's life --------------------------------------------------------
//
// Every one of these is addressed by match id and nothing else, which is what makes the same match
// reachable from its Processor Space and from its Livestock Availability record without two code
// paths (requirement 1.2). None of them touches the parent records: cancelling a match must not
// change either record's status, and the non-cascade is the rule most likely to be "helpfully"
// broken, so it is visible here as the absence of any write to a parent.

// What the match modal opens with: the match, both parents in full, and the edit ceiling.
app.MapGet("/api/matches/{id:int}", async (
        int id,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var context = MatchWriter.EditContext(await loader.LoadAsync(cancellation), id);

    return context is null
        ? Results.NotFound(MatchResponses.Message(MatchWriter.NoSuchMatch))
        : Results.Ok(context);
});

// Editing the three editable fields, at any status. The prompt before changing a Confirmed match is
// the client's, because it is a question for a human; the ceiling and the minimum are enforced here
// whatever the dialog allowed.
app.MapPut("/api/matches/{id:int}", async (
        int id,
        UpdateMatchRequest request,
        ApgDbContext db,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var match = await db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellation);
    var rejection = MatchWriter.RejectUpdate(await loader.LoadAsync(cancellation), match, request);

    if (rejection is not null)
    {
        return match is null
            ? Results.NotFound(MatchResponses.Message(rejection))
            : Results.BadRequest(MatchResponses.Message(rejection));
    }

    MatchWriter.Apply(match!, request);
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.WriteResultAsync(
        loader,
        match!.ProcessorSpaceId,
        match.LivestockAvailabilityId,
        match.Id,
        cancellation);
});

// Drafted to Confirmed, in one step, because Notified has no UI transition in pass 1 (resolved
// question 2).
//
// It takes the edit body so that a match with unsaved changes confirms in a single validated write
// rather than in two chained calls with a half-applied state between them. A pristine form sends the
// values the match already holds, which is a no-op.
app.MapPost("/api/matches/{id:int}/confirm", async (
        int id,
        UpdateMatchRequest request,
        ApgDbContext db,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var match = await db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellation);
    var set = await loader.LoadAsync(cancellation);

    // Two gates with two different answers. A status gate is a conflict — the match is not in a state
    // that can be confirmed, and no body would fix it. A ceiling or a minimum is a bad request, and it
    // is the same rejection the plain edit returns, so it comes back with the same status code.
    if (MatchWriter.RejectConfirm(match) is { } blocked)
    {
        return match is null
            ? Results.NotFound(MatchResponses.Message(blocked))
            : Results.Conflict(MatchResponses.Message(blocked));
    }

    if (MatchWriter.RejectUpdate(set, match, request) is { } invalid)
    {
        return Results.BadRequest(MatchResponses.Message(invalid));
    }

    MatchWriter.Apply(match!, request);
    MatchLifecycle.Confirm(match!);
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.WriteResultAsync(
        loader,
        match!.ProcessorSpaceId,
        match.LivestockAvailabilityId,
        match.Id,
        cancellation);
});

// Cancelling a match past Drafted, with one of exactly three reasons.
//
// The match is kept, with its reason, and disappears from the matching screen because a cancelled
// match is excluded from both parents' collections (resolved question 4) - which is why the response
// carries no match. Both parent records keep their own status: this endpoint writes to the match and
// to nothing else.
app.MapPost("/api/matches/{id:int}/cancel", async (
        int id,
        CancelMatchRequest request,
        ApgDbContext db,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var match = await db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellation);
    var rejection = MatchWriter.RejectCancel(match, request.Reason);

    if (rejection is not null)
    {
        return match is null
            ? Results.NotFound(MatchResponses.Message(rejection))
            : Results.Conflict(MatchResponses.Message(rejection));
    }

    var spaceId = match!.ProcessorSpaceId;
    var availabilityId = match.LivestockAvailabilityId;

    RecordCancellation.CancelMatch(match, request.Reason!.Value);
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.WriteResultAsync(loader, spaceId, availabilityId, matchId: null, cancellation);
});

// Confirming a Processor Space. Its status is STORED, not derived - this is the explicit APG action
// that sets it, and there is no function anywhere that computes it. The gate and the sentence
// explaining a refusal are both ProcessorSpaceRules', so the disabled button on the card and a
// crafted request give the same account of the same rule.
app.MapPost("/api/processor-spaces/{id:int}/confirm", async (
        int id,
        ApgDbContext db,
        WorkingSetLoader loader,
        CancellationToken cancellation) =>
{
    var space = await db.ProcessorSpaces.FirstOrDefaultAsync(s => s.Id == id, cancellation);
    var rejection = MatchWriter.RejectSpaceConfirm(await loader.LoadAsync(cancellation), space);

    if (rejection is not null)
    {
        return space is null
            ? Results.NotFound(MatchResponses.Message(rejection))
            : Results.Conflict(MatchResponses.Message(rejection));
    }

    space!.Status = ProcessorSpaceStatus.Confirmed;
    await db.SaveChangesAsync(cancellation);

    return await MatchResponses.SpaceResultAsync(loader, id, cancellation);
});

app.MapPost("/api/dev/reset-database", async (DatabaseSeeder seeder) =>
{
    await seeder.ResetAsync();
    return Results.Ok(new { reset = true });
});

app.Run();
