using System.Text.Json.Serialization;
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

// Enums go over the wire as strings so the client's own types stay readable.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

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

// A single read endpoint, to prove the wiring end to end. This is NOT the DTO contract: the real
// one, carrying every computed field, is designed in Phase 1. Do not build against this shape.
app.MapGet("/api/processor-spaces", async (ApgDbContext db) =>
    await db.ProcessorSpaces
        .OrderBy(s => s.DeliveryDate)
        .ThenBy(s => s.Id)
        .ToListAsync());

app.MapGet("/api/livestock-availability", async (ApgDbContext db) =>
    await db.LivestockAvailabilities
        .OrderBy(a => a.AvailableFrom)
        .ThenBy(a => a.Id)
        .ToListAsync());

app.MapPost("/api/dev/reset-database", async (DatabaseSeeder seeder) =>
{
    await seeder.ResetAsync();
    return Results.Ok(new { reset = true });
});

app.Run();
