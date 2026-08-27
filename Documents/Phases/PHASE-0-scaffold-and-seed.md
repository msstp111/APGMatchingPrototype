# Phase 0 — Scaffold & Seed Data

**Depends on:** nothing. This is the first commit of application code.
**Delivers:** a running Angular app talking to a running ASP.NET Core API, over a deterministic,
realistic seed dataset.

## Objective

Stand the solution up and generate demo data good enough that every later phase can be judged by
looking at the screen. Bad seed data makes a good matching screen look broken, so this phase matters
more than its position suggests.

## Out of scope

Any UI inside the shell. No cards, no lists, no filters, no domain rules (Phase 1), no design work on
the matching screen itself (Phase 2). The **shell** — top bar and sidebar — is in scope and must look
like the real thing.

## Requirements

### 1. Solution scaffold

1.1 A .NET solution with three projects, matching the roadmap's repository layout:

```
src/Apg.Domain/          class library — pure rules. No EF, no ASP.NET references.
src/Apg.Api/             ASP.NET Core minimal API. References Apg.Domain.
tests/Apg.Domain.Tests/  xUnit. References Apg.Domain.
web/                     Angular application.
```

1.2 `Apg.Domain` is created near-empty in this phase apart from the entity types; Phase 1 fills it.
    Its project file must not reference EF Core or ASP.NET. Keeping it pure is what makes Phase 1
    testable, and it is easy to lose by accident.

1.3 `Apg.Api` — minimal API on .NET 9, EF Core with the SQLite provider, CORS configured for the
    Angular dev server.

1.4 `web/` — `ng new` with SCSS, standalone components, routing, no SSR. Add **Angular Material**
    (which brings `@angular/cdk` with it, needed for drag-and-drop in Phase 5). Configure a
    dev-server proxy so the client calls the API on a same-origin path.

1.5 A **custom Material theme** whose primary is the petrol blue sampled from
    `ExistingAppScreenshots/*.png`, with Roboto as the type family. Sample the actual hex from the
    PNGs — do not eyeball an approximation. Phase 2 refines the theme; this phase only needs it close
    enough that the shell reads as LMS.

1.6 A single documented way to run both halves together — two terminals, an npm script, or
    `dotnet watch` alongside `ng serve`. Whatever you choose, write it in CLAUDE.md.

### 2. Entity model and database

2.1 EF Core entities for `ProcessorSpace`, `LivestockAvailability`, `Match`, `Location`, `Farmer`
    and `PriceTableEntry`.

2.2 **`Match` is a first-class entity.** It has its own key and its own columns for
    `QuantityMatched`, `PricePerKg`, `TransportCompany`, `Status` and `CancellationReason`. It is
    never modelled as a foreign key hanging off either record.

2.3 **Store raw values only.** No computed quantity, matched sum, or derived status is ever
    persisted — those are computed in `Apg.Domain` on every read. If you find yourself adding a
    `QuantityMatched` column to `ProcessorSpace`, stop: that is the denormalisation the roadmap
    forbids.

2.4 SQLite, file-based, so a demo survives a restart. `EnsureCreated` at startup is sufficient and
    migrations are not needed for a prototype — but say which you chose.

2.5 A reset path that drops and re-seeds the database, exposed as an API endpoint now. The button
    that calls it arrives in Phase 8.

### 3. Seed configuration

One C# file holds every invented list, so replacing them with APG's real values is a single-file
edit. It must contain:

3.1 **Processors:** ANZCO, Alliance Group, SFF.

3.2 **Processor Space stock classes**, per processor, exactly as the spec lists them:
- ANZCO: Cows, Prime, Nat Beef - Ultra, Nat Beef - Premium, Bulls, Lamb, Mutton
- Alliance Group: Lamb, Mutton, Cattle, Deer
- SFF: Lambs, Prime, Cows

3.3 **Livestock Availability stock classes**, the single separate list:
GFNB ultra, GFNB premium, Prime, Cow, Sire Bull, Bull, Mixed Cattle, Lamb, Mutton

> These two lists do not map onto each other. Do not build a lookup between them.

3.4 **Plants per processor** — invent 3–5 plausible New Zealand plants each. Real-sounding place
names, correctly associated with each company's actual regions.

3.5 **Transport companies** — invent ~15 plausible NZ livestock carriers.

3.6 **Cancellation reasons:** Change from Agent/Farmer, Change from Processor, Internal decision by APG.

3.7 **Transaction types:** Finance Stock, Grazing Stock, Other.

### 4. Seeder

A seeder in `Apg.Api` that reads `Data/*.csv` and populates the database when it is empty.

4.1 **Determinism.** Use an explicit seeded PRNG written into the codebase — a small mulberry32 or
    xorshift — rather than `System.Random`, whose algorithm is not guaranteed stable across .NET
    versions. Two runs must produce identical data.

4.2 **Floating date anchor.** All dates are generated as fixed *offsets* from the Sunday of the
    current week, so the demo always looks current without the data changing shape. Never hard-code
    absolute dates.

    The anchor must be computed in **New Zealand local time**, not the server's UTC clock. Saturday
    13:00 UTC is already Sunday in New Zealand, so a UTC-derived anchor lands the whole dataset in
    the wrong week for twelve hours of every Saturday.

4.3 **Locations** — read all ~300 rows of `Data/locations.csv` (`id,name`).

4.4 **Farmers** — derive exactly one farmer per location (resolved question 10). Deterministically
    generate a plausible NZ farmer name and a mobile number per location id. A location's farmer
    never changes between runs.

4.5 **Processor Spaces** — about 40, spread across roughly six weeks starting one week before the
    current week. Each has: processor, a plant belonging to that processor, a stock class from that
    processor's list, quantity required (realistic per species — hundreds for lamb, tens for cattle),
    delivery date, optional free-text delivery time, optional notes. Status `Booked`.

4.6 **Livestock Availability** — about 50, with available-from dates spread across the same window,
    deliberately including several with early dates that remain unmatched, so Phase 3's carry-over
    cards have something to show. Each has: stock class from the availability list, quantity
    available, location, available-from date, optional availability details, transaction type,
    optional notes. Status `Booked`.

4.7 **Matches** — about 25, and they must demonstrate the shape of the domain:
- at least one Processor Space filled from **three different** Availability records
- at least one Availability record split across **three different** Processor Spaces
- at least one **over-filled** space (negative unmatched)
- at least one space at exactly its required quantity
- at least one Availability record fully matched with every match Confirmed
- a realistic mix of `Drafted` and `Confirmed`, plus one or two `Cancelled`
- matches that pair **mismatched-looking stock classes**, because a human made the call — e.g. an
  availability `Prime` filling an ANZCO `Nat Beef - Premium` space

4.8 **Price table** — `processor × Processor-Space stock class × week-commencing-Sunday`, covering the
    full seeded date range plus a few weeks either side. Realistic $/kg by species (roughly $7–9 for
    lamb, $5–7 for beef). Prices should mostly hold steady week to week and occasionally step, as the
    spec describes.

> The default price for a match is looked up using the **Processor Space** stock class, never the
> Availability stock class (resolved question 7).

### 5. One proving endpoint

5.1 A single read endpoint — say `GET /api/processor-spaces` — returning seeded records as JSON,
    plus the reset endpoint from 2.5.

5.2 This exists only to prove the wiring end to end. The real DTO contract, with its computed fields,
    is designed in Phase 1. Do not invent it here.

### 6. App shell — the real one, not a placeholder

Every screen this prototype builds sits inside the LMS shell, so build it now. Work from
`ExistingAppScreenshots/*.png`.

6.1 **Top bar** — full width, petrol blue. Hamburger toggle and an `LMS` wordmark on the left; the
    bold yellow `# DEV ENVIRONMENT #` flag on the right.

6.2 **Left sidebar** — fixed, roughly 200px. A header block in the same petrol blue carrying the
    user's name and a close button, over a white nav body. Each item is an outline icon plus a label;
    the active item takes a light grey full-width fill. A small grey footer block carries the version
    string and `Alpine Pastures © 2022`.

6.3 **Nav items** — the existing ones (Killsheets, Purchases, Adjustments, Locations, Admin, Logout)
    render exactly as they do today but are **inert**: they are there so the prototype reads as part
    of LMS, and they go nowhere. Add the booking module's own entry or entries below them, with the
    matching screen active. Make inert items look ordinary rather than disabled — a greyed-out
    sidebar would read as a broken app in a demo.

6.4 The hamburger collapses and expands the sidebar, as it does in the existing app.

6.5 Inside the shell, a content area with two empty labelled columns (Processor Spaces left,
    Livestock Availability right) rendering data fetched from 5.1. The **columns** are deliberately
    unstyled here — their visual language is Phase 2's job and Phase 3's build. The **shell** is not
    a placeholder; it should look right now, because every later phase is judged inside it.

### 7. CLAUDE.md

Record the chosen stack, the run/build/test commands for both halves, the proxy setup, the folder
conventions, and where the SQLite file lives. CLAUDE.md currently states that no stack has been
chosen; correct that.

## Acceptance criteria

- The API runs and serves seeded JSON.
- The Angular app runs, calls the API through the proxy, and renders the shell without console errors.
- **The shell is recognisably LMS** held next to `ExistingAppScreenshots/*.png`: petrol-blue top bar
  with the yellow dev flag, the sidebar with its blue header block and full nav list, the grey footer.
- The Material theme's primary is the hex sampled from the screenshots, not an approximation.
- The hamburger collapses and expands the sidebar.
- `dotnet build`, `dotnet test` and the Angular build all pass.
- Deleting the SQLite file and restarting reproduces identical seed data.
- `Apg.Domain` references neither EF Core nor ASP.NET.
- No computed value is persisted anywhere in the schema.
- The seed satisfies every case in 4.7 — proven by a test, not by eyeballing the database.
- CLAUDE.md documents how to run everything.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** determinism of the seeder, correctness of the date offsets
against the current week's Sunday, whether the seed genuinely contains every case in 4.7, whether any
computed value has crept into the schema, and whether `Apg.Domain` has stayed free of infrastructure
references.

**Record in `Documents/BUILD-LOG.md`:** the seed counts actually generated, the PRNG and seed value
used, the .NET, Angular and Material versions, how the two halves are run together, the proxy
configuration, any quirk in `Data/*.csv` you had to work around, and the entity names Phase 1 will
build on. Phase 1's tests are written against these numbers.

Also record **the exact hex values you sampled from the screenshots** and where the theme file lives.
Phase 2 builds the full palette on top of them and must not re-sample and get different answers.
