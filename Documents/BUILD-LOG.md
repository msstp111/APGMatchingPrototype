# Build Log

**Every phase chat reads this file before planning, and appends to it before finishing.**

The roadmap says what we intended. The phase documents say what each phase should do. This file is the
only record of what actually happened — the decisions taken mid-build that no document could have
anticipated, and that every later phase is bound by.

Write entries for someone with **no memory of the conversation that produced them**. That is exactly
who reads them.

Newest entries at the bottom. Do not edit earlier entries; if a later phase overturns an earlier
decision, say so in the later entry and note which one it replaces.

---

## Entry template

```markdown
## Phase N — <name>
**Completed:** <date>
**Status:** Complete | Complete with caveats | Partially complete

### What shipped
Two or three sentences. What a later phase can now rely on existing.

### Decisions made during the build
Anything decided here that a later phase is bound by and could not have read in the roadmap or the
phase document. Name the thing, the choice, and the reason. This is the most valuable section —
if it is empty, check again, because it rarely is.

### Deviations from the phase document
What was specified but not built, or built differently, and why. If nothing deviated, say so.

### Review findings
The sonnet review's findings, and what happened to each: fixed, deliberately not fixed (with reason),
or deferred to a later phase (say which).

### Watch out for
What the next phase will trip over. Sharp edges, half-truths in the docs, things that look wrong but
are correct, things that look right but are fragile.

### New commands, dependencies, conventions
Anything added that a future chat needs. These also belong in CLAUDE.md; repeat them here so the log
reads standalone.
```

---

<!-- Phase entries begin below this line. -->

## Phase 0 — Scaffold & Seed Data

**Completed:** 2026-08-28
**Status:** Complete

### What shipped

A four-project .NET 9 solution plus an Angular 22 client, talking over a dev-server proxy, on top of a
deterministic SQLite seed. `Apg.Domain` holds the six entity types, the status enums and one small
date helper, and references neither EF Core nor ASP.NET. `Apg.Api` owns the EF Core context, the
seeder and two raw read endpoints. `web/` renders the real LMS shell — petrol-blue band with the
yellow-green dev flag, the full sidebar with its nav list and grey version footer, a working
hamburger — around a deliberately unstyled two-column matching screen.

Later phases can rely on: the entity types and their property names, `NzTime`, the seed being
identical on every run, and the shell being the real thing rather than a placeholder.

### Seed as generated

Anchored on the Sunday of the current **New Zealand** week; every date is a fixed day-offset from it.

| Set | Count |
| --- | --- |
| Locations | 299 — every row of `Data/locations.csv` |
| Farmers | 299 — one per location, id equal to the location id |
| Processor Spaces | 40 — ANZCO 14, Alliance Group 13, SFF 13 |
| Livestock Availability | 50 |
| Matches | 25 — 8 Drafted, 15 Confirmed, 2 Cancelled, 0 Notified |
| Price table rows | 182 — 14 processor x stock-class series across 13 weeks |

Record dates span week −1 to week +4 relative to the anchor (six weeks). Delivery dates fall on
weekdays; available-from dates on any day. The price table runs week −4 to week +8 so a lookup never
misses.

**PRNG:** mulberry32, written into the codebase at `src/Apg.Api/Seeding/Mulberry32.cs`. Seed
`0x41504730` ("APG0"), the constant `SeedConfig.PrngSeed`. `System.Random` is deliberately not used —
its algorithm is not guaranteed stable across .NET versions, so a framework upgrade would silently
reshape the whole demo dataset. `SeedConfigurationTests` pins three golden values so that would fail
loudly rather than quietly.

Farmers are generated from a *separate* PRNG seeded with `PrngSeed ^ locationId`, not drawn from the
shared stream, so a location's farmer survives a different anchor and any reordering elsewhere in the
seeder.

### Versions

.NET SDK 9.0.317 · `Microsoft.EntityFrameworkCore.Sqlite` 9.0.19 · xUnit 2.9.2 ·
Node 24.19.0 · Angular 22.1 · Angular Material / CDK 22.1.4 · TypeScript 6.0 · vitest 4.0
(Angular's current default runner — **not** Karma; `ng new` no longer scaffolds it).

Neither the .NET SDK nor Node was installed on this machine. Both were installed with
`winget install --id Microsoft.DotNet.SDK.9 -e` and `winget install --id OpenJS.NodeJS.LTS -e`. They
land at `C:\Program Files\dotnet` and `C:\Program Files\nodejs`; a shell opened before the install
will not see them until it re-reads the machine `PATH`.

### Running the two halves

`.\dev.ps1` from the repo root starts the API as a background job and the Angular dev server in the
foreground. Two terminals works equally well and gives you the API log:
`dotnet run --project src/Apg.Api --launch-profile http`, and `npm start` in `web/`.

**Proxy:** `web/proxy.conf.json` maps `/api` to `http://localhost:5286`, wired in as
`projects.web.architect.serve.options.proxyConfig` in `angular.json`. The client therefore only ever
calls same-origin paths and there is no base URL to configure. CORS for `http://localhost:4200` is
also configured in the API, as a fallback for running the client without the proxy.

The API port is pinned to 5286 in `src/Apg.Api/Properties/launchSettings.json`. The generated `https`
profile was removed — one profile, one port, no development-certificate prompt.

### Sampled hex values — Phase 2 must not re-sample

Taken from the pixels of `ExistingAppScreenshots/*.png` with `System.Drawing`, not eyeballed. They
live in **`web/src/styles/_lms-tokens.scss`** as both SCSS variables and CSS custom properties.

| Token | Hex | Where in LMS |
| --- | --- | --- |
| Petrol blue (primary) | `#00567E` | top bar, sidebar header block, create FAB |
| Dev-environment flag | `#CCD457` | `# DEV ENVIRONMENT #` — a yellow-**green**, not a pure yellow |
| Content background | `#FAFAFA` | page body behind the content area |
| Active nav fill | `#F6F6F6` | selected sidebar item, full width |
| Zebra stripe | `#EEEEEE` | alternate table rows |
| Sidebar footer | `#EBEBEB` | version / copyright block |
| Divider | `#E0E0E0` | sidebar edge, row rules |
| Text primary | `#212121` | body |
| Text muted | `#757575` | small uppercase column headers, footer |

The screenshots are at a device pixel ratio of about 1.75, so the metrics are the measured pixel
counts divided by that: **sidebar 190px**, **top bar 52px**, nav item 48px, dense row 44px. Type is
Roboto throughout; there is no serif anywhere in LMS.

Material's own palettes were generated from the same source colour with
`ng generate @angular/material:theme-color --primary-color="#00567E"` into
`web/src/styles/_theme-colors.scss`. **Material 3 tonal palettes do not reproduce a source colour
exactly** — tone 40 of the generated primary is `#1D648D`, not `#00567E` — so the shell's own chrome
paints with the sampled hex directly and only Material *components* take the generated palette. Phase
2 should keep that split.

### Entity names Phase 1 builds on

In `src/Apg.Domain/Entities/`:

- `ProcessorSpace` — `Id, Processor, Plant, StockClass, QuantityRequired, DeliveryDate (DateOnly), DeliveryTime (string?), Notes, Status`
- `LivestockAvailability` — `Id, StockClass, QuantityAvailable, LocationId, AvailableFrom (DateOnly), AvailabilityDetails, TransactionType, Notes, Status`
- `Match` — `Id, ProcessorSpaceId, LivestockAvailabilityId, QuantityMatched, PricePerKg (decimal?), TransportCompany, Status, CancellationReason, CreatedAt (DateTimeOffset)`
- `Location` — `Id, Name`; `Farmer` — `Id, LocationId, Name, Mobile`
- `PriceTableEntry` — `Id, Processor, StockClass, WeekCommencing (DateOnly), PricePerKg`
- Enums: `MatchStatus`, `ProcessorSpaceStatus`, `LivestockAvailabilityStatus`, `MatchCancellationReason`, `TransactionType`

In `src/Apg.Domain/Time/NzTime.cs` — `TimeZoneId`, `TimeZone`, `WeekCommencing(DateOnly)`,
`ToNzDate(DateTimeOffset)`, `Today(TimeProvider)`, `CurrentWeekCommencing(TimeProvider)`,
`AtNzTime(DateOnly, TimeSpan)`.

There are **no EF navigation properties** on any entity. The relationship is many-to-many through
`Match`, and hanging collections off the parents invites exactly the foreign-key modelling the
roadmap rules out. Both of `Match`'s foreign keys are indexed.

### Decisions made during the build

1. **A fourth project, `tests/Apg.Api.Tests`.** The phase document specifies three, but requirement
   4.7 has to be proven by a test and the seeder lives in `Apg.Api`. Making `Apg.Domain.Tests`
   reference `Apg.Api` would have pulled EF Core into the pure domain test project's dependency
   graph. Confirmed with Mark before building.
2. **`SeedDataGenerator` is pure.** It takes `(DateOnly anchor, IReadOnlyList<Location>)` and returns
   a `SeedData` object graph with no `DbContext` in sight. `DatabaseSeeder` is the only thing that
   touches EF. This is what makes the 4.7 cases testable at all.
3. **The demonstration cases are scripted, not hoped for.** `BuildDemonstrationSpine` constructs each
   4.7 case deliberately on records reserved for the purpose, and only then does the PRNG fill the
   remainder up to 25 matches. A random pass that happens to produce an over-filled space today may
   not produce one tomorrow.
4. **A case that cannot be built throws.** `Required(...)` raises an `InvalidOperationException`
   naming the case. A seed that silently drops, say, its over-filled space is worse than one that
   refuses to build. See "Review findings" below — this came out of the review.
5. **Stock class coverage is guaranteed, not random.** Each processor's first few spaces walk its own
   stock class list before the PRNG takes over, and likewise the first nine availability records walk
   the availability list. Without this, an ANZCO `Nat Beef - Premium` space — needed for the
   deliberate mismatched pairing — is merely likely rather than certain.
6. **`NzTime` lives in `Apg.Domain` now, not in the seeder.** The anchor needs it in Phase 0 and Phase
   1 owns the date rules; putting a copy in `Apg.Api` would have been the exact drift the roadmap
   forbids. It is deliberately minimal. **Phase 1 must extend this file, not start a second one.**
7. **`EnsureCreated`, not migrations** (the phase document allows either but asks that the choice be
   recorded). The prototype's schema is reset wholesale; migrations would be ceremony with no payoff.
8. **Entity ids are assigned explicitly by the seeder**, but the model leaves EF's default
   `ValueGeneratedOnAdd` rather than switching to `ValueGeneratedNever`, so Phase 7's create flows
   still get generated ids for free. EF inserts a non-zero key as given.
9. **`Matching` sits above `Logout` in the sidebar**, not below it. The phase document says to add the
   booking entries "below" the existing ones, but `Logout` is visually last in the live app and moving
   it would have made the shell look wrong.
10. **Two read endpoints, not one.** Requirement 5.1 asks for one; requirement 6.5 asks for two
    populated columns. `GET /api/livestock-availability` was added alongside
    `GET /api/processor-spaces`. Both return **raw stored records** and are explicitly *not* the DTO
    contract — `web/src/app/api/models.ts` says so at the top. Phase 1 replaces them.
11. **A hard supply cap in `MatchContext.Add`.** A live match is clamped to the availability record's
    remaining supply; the demand side is uncapped. That is resolved question 1 enforced at the point
    of construction, and a test asserts no record is ever over-committed.

### Deviations from the phase document

- The fourth test project (decision 1) and the second read endpoint (decision 10), both above.
- Nothing else. All of sections 1 to 7 were built.

### Review findings

A sonnet subagent reviewed the phase against the phase document and the roadmap. Its verdict on
determinism, date handling, schema purity and `Apg.Domain`'s references was clean: it found no hidden
ordering dependence, no `System.Random`, no persisted computed value, and confirmed the mulberry32
arithmetic matches the reference algorithm. Five findings, and what happened to each:

1. **No build log entry** — this entry. The reviewer ran before it was written; not a defect.
2. **`LockAvailability` ran outside the success branch** (medium) — **fixed.** For two cases the lock
   fired whether or not the destination search had succeeded, which would have burned the record for
   the filler pass too, losing both the demonstration and the record. It is now called only after the
   matches exist.
3. **The 4.7 cases were "hoped for", guarded by silent `if (x is not null)` skips** (medium) —
   **fixed**, and this was the most valuable finding. Every lookup now goes through `Required(...)`,
   which throws an exception naming the case that could not be built. The tests still assert every
   case, but a failure now points at the construction step rather than at a generic "not found". The
   over-filled and exactly-filled cases were also folded into one `BuildTwoSourceFill` helper, since
   they differed only in their target quantity.
4. **No responsive handling in the top bar** (low) — **partially fixed.** `overflow: hidden` on
   `.top-bar` means a very narrow viewport clips rather than pushing the layout wide. No breakpoint
   was added: LMS is a desktop application, the prototype has no mobile requirement, and the visual
   language is Phase 2's to set.
5. **Inert nav items took the same hover fill as the active route** (low) — **fixed.** Hover is now
   scoped to `a.nav-item`, so LMS's own inert entries look ordinary but not navigable.

The fixes did not change the generated data: the seeded JSON is byte-identical before and after.

### Watch out for

- **`SeedFixture.MatchedInclDraft` restates a domain rule inside `tests/Apg.Api.Tests`.** It is
  commented as temporary. Phase 1 should point the seed tests at the real `Apg.Domain` implementation
  and delete the copy. It exists only because the rule did not exist yet.
- **The seed counts above are asserted by a test.**
  `The_generated_counts_are_the_ones_the_build_log_records` fails if any of them stops being true,
  including the match status split. Change the seed and update this entry in the same breath.
- **Changing `SeedConfig.PrngSeed`, the record counts or the quantity ranges can make a demonstration
  case unbuildable**, and the seeder will then throw at startup with the case named. That is by
  design. Tune until it builds; do not soften `Required(...)` into a skip.
- **The demonstration cases lock their records during generation.** `MatchContext` keeps
  `_lockedSpaces` and `_lockedAvailabilities`, and the filler pass skips them, so the arithmetic on
  those records stays exactly as scripted. The lock applies only while generating — a later phase
  adding matches through the UI will of course change those records, and that is fine.
- **Five availability records dated in week −1 are held out of matching entirely**
  (`SeedDataGenerator.CarryOverAvailabilityCount`), specifically so Phase 3's carry-over cards have
  something to carry over.
- **`AtNzTime` calls `TimeZoneInfo.GetUtcOffset` on a local time.** Seeded `CreatedAt` values use
  08:00 plus up to nine hours, which never lands in the 02:00–03:00 daylight-saving gap. If a later
  phase reuses the helper for arbitrary times, that assumption needs revisiting.
- **The Material palettes do not equal the sampled blue** — see the hex table above. Do not "fix" the
  shell chrome to use `--mat-sys-primary`; it would come out `#1D648D`.
- **`Documents/build-plan.html` carries an unrelated pre-existing working-copy modification** that
  Phase 0 did not make and did not touch.
- **The repo still has no commits.** Nothing has been committed; the working tree holds everything.
- **Material icons load from Google Fonts** in `web/src/index.html` (Material Symbols Outlined, to
  match LMS's outline icons). A fully offline demo would lose the icons; bundle the font locally if
  that ever matters.
- **The API locks `Apg.Domain.dll` while it runs.** `dotnet build` fails with MSB3027 if you forget to
  stop it first.

### CSV quirks worked around

`Data/locations.csv` turned out clean: 299 data rows, three columns, no quoting, no ragged rows, no
duplicate ids — but the ids are **non-contiguous and run up to 451**, so nothing may assume
`id == index`. `CsvReader` handles quoted fields anyway, since the other exports use them.
`LoadLocations` sorts by id explicitly so file row order cannot influence the seed. Only
`locations.csv` is read: the rest of `Data/` comes from the forecasting system and its vocabularies do
not match the booking module's.

### New commands, dependencies, conventions

All recorded in CLAUDE.md as well; repeated here so this entry reads standalone.

- `dotnet build` · `dotnet test` · `dotnet test tests/Apg.Api.Tests` ·
  `dotnet test --filter "FullyQualifiedName~At_least_one_space_is_over_filled"`
- `dotnet run --project src/Apg.Api --launch-profile http` → http://localhost:5286
- In `web/`: `npm start` → http://localhost:4200 · `npm run build` · `npm test` ·
  one spec with `npx ng test --watch=false --include=src/app/app.spec.ts`
- `.\dev.ps1` from the repo root runs both halves together
- SQLite at `src/Apg.Api/apg.db`, gitignored. Delete it and restart for a clean reseed, or
  `POST /api/dev/reset-database` (Phase 8 adds the button that calls it)
- `.gitignore` added: `bin/`, `obj/`, `*.db`, `node_modules/`, `web/dist/`, `web/.angular/`
- Every invented list lives in `src/Apg.Api/Seeding/SeedConfig.cs`, so APG's real processors, plants,
  carriers and stock classes are a one-file swap
