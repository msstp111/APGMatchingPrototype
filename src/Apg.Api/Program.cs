using Apg.Api.Contracts;
using Apg.Api.Data;
using Apg.Api.Seeding;
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

app.MapPost("/api/dev/reset-database", async (DatabaseSeeder seeder) =>
{
    await seeder.ResetAsync();
    return Results.Ok(new { reset = true });
});

app.Run();
