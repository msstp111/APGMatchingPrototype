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

---

## Phase 1 — Domain Core

**Completed:** 2026-08-28
**Status:** Complete

### What shipped

`Apg.Domain` now holds every computed quantity, status and matching rule as pure C# in
`src/Apg.Domain/Matching/` and `src/Apg.Domain/Pricing/PriceTable.cs`, with 113 xUnit tests
(`tests/Apg.Domain.Tests/`) covering the arithmetic and, separately and heavily, NZ date/DST
handling. `src/Apg.Api/Contracts/` (`Dtos.cs`, `MatchingProjection`, `WorkingSetLoader`, `ApiJson`)
projects the two read endpoints — `GET /api/processor-spaces` and `GET /api/livestock-availability`
(`src/Apg.Api/Program.cs`) — onto DTOs that carry every field a later phase needs; a later phase can
now build card lists, filters and the drag-to-match UI purely by rendering DTO fields, with zero
domain arithmetic in TypeScript. 65 API tests (`tests/Apg.Api.Tests/`) cover the projection and
serialisation. `web/src/app/matching/matching-screen.ts/.html` was updated to consume the new DTO
shape (still no domain logic in it, and now backed by `matching-screen.spec.ts`, a purity test that
feeds self-contradictory DTO fixtures and asserts the screen reproduces them unquestioned).

### Domain classes and methods, as shipped

- **`Apg.Domain.Matching.MatchQuantities`** — `MatchedInclDraft(matches)`, `MatchedExclDraft(matches)`,
  `IsLive(match)` (not Cancelled), `Tally(original, matchesForThisRecord)` →
  `QuantityTally(Original, MatchedInclDraft, MatchedExclDraft)`, plus the two scoped overloads
  `ForSpace(space, matches)` / `ForAvailability(availability, matches)` that filter the whole match
  set down to one record's own matches (safe to hand the whole set — a caller does not need to
  pre-filter).
- **`QuantityTally`** (readonly record struct) — `Unmatched => Original - MatchedInclDraft`
  (unclamped, can go negative both ways), `State` (`QuantityState.Under/Exact/Over`, off the sign of
  `Unmatched`).
- **`QuantityStateLabels.For(state, side)`** — `MatchSide.ProcessorSpace` → "Under-filled" /
  "Filled" / "Over-filled"; `MatchSide.LivestockAvailability` → "Under-committed" / "Fully
  committed" / "Over-committed".
- **`AvailabilityStatus.Derive(availability, matches)`** — stored `Cancelled` wins outright; no live
  matches → `Booked`; `Unmatched == 0` (exact) and every live match Confirmed → `Confirmed`;
  otherwise `Pending`.
- **`ProcessorSpaceRules.CanConfirm(space, matches)`** — `space.Status == Booked` AND at least one
  live match AND every live match Confirmed. (See "Decisions" below — the `Booked` gate is an
  addition beyond the roadmap's literal wording.) There is deliberately no `Derive`-style status
  function for Processor Space: its status is stored, set by explicit APG action, never computed.
- **`MatchCreation`** — `NoUnmatchedQuantity` = `"There is no unmatched quantity"` (exact string, a
  constant). `DefaultMatchQuantity(spaceUnmatched, availabilityUnmatched)` = `Math.Min` of the two.
  `MaxMatchQuantity(availabilityUnmatched)` for a **new** match (no space-side cap, ever).
  `MaxMatchQuantity(availability, availabilityMatches, existingMatch)` for **editing** one — adds the
  existing match's own quantity back onto its unmatched figure, but only when that match `IsLive`
  (a Cancelled match adds back nothing). `Propose(space, spaceMatches, availability,
  availabilityMatches)` is the one entry point a drag should call — returns
  `MatchQuantityProposal(IsAllowed, Quantity, Maximum, RefusalMessage)`.
- **`RecordCancellation`** — `CancelProcessorSpace(space)` / `CancelAvailability(availability)` take
  **no match collection at all** (the signature itself makes cascading impossible, not just the
  logic), and `CancelMatch(match, reason)` is the only path that sets `MatchStatus.Cancelled`. A
  Drafted match is deleted outright rather than cancelled (resolved question 3) — that's Phase 6's
  concern, not a status transition here.
- **`Pricing.PriceTable`** — built from seeded `PriceTableEntry` rows, keyed on
  `(Processor, ProcessorSpaceStockClass, WeekCommencing)`. `DefaultPricePerKg(processor, stockClass,
  weekCommencing)` normalises any date in the week to its Sunday before lookup; the
  `DefaultPricePerKg(space)` overload is the real call site. Returns `null` on a miss — no invented
  fallback price.
- **`Time/NzTime.cs`** was extended, not replaced (Phase 0 asked for exactly that). It gained
  `DateLabel(date)` and `WeekLabel(date)` plus the `DateLabelFormat` constant, and its existing
  `AtNzTime` was **hardened**: it previously called `GetUtcOffset` on a local time, which is
  undefined in the 02:00–03:00 that never happens (September Sunday) and ambiguous in the one that
  happens twice (April Sunday). It now advances past an invalid time, and documents that .NET
  resolves an ambiguous one to the standard offset. **This changed no seeded data** — seeded
  `CreatedAt` values are 08:00–17:00 and never landed in either window. Phase 0's build log flagged
  this helper as needing revisiting; that debt is now closed. No second date-handling file exists.

### The DTO shape, as shipped (`src/Apg.Api/Contracts/Dtos.cs`)

- **`ProcessorSpaceDto`** — stored: `Id, Processor, Plant, StockClass, QuantityRequired, DeliveryDate,
  DeliveryDateLabel, DeliveryTime, Notes, Status`. Computed: `MatchedInclDraft, MatchedExclDraft,
  Unmatched, QuantityState, QuantityStateLabel, WeekCommencing, WeekCommencingLabel, CanConfirm,
  Matches` (live only).
- **`LivestockAvailabilityDto`** — stored: `Id, StockClass, QuantityAvailable, LocationId,
  LocationName, FarmerId, FarmerName, FarmerMobile, AvailableFrom, AvailableFromLabel,
  AvailabilityDetails, TransactionType, Notes`. Computed: `Status` (derived, not the stored column),
  `MatchedInclDraft, MatchedExclDraft, Unmatched, QuantityState, QuantityStateLabel, WeekCommencing,
  WeekCommencingLabel, Matches` (live only).
- **`MatchDto`** — one shape for both parents: `Id, QuantityMatched, PricePerKg, TransportCompany,
  Status, CancellationReason` (always null on these two read endpoints — cancelled matches are
  excluded from the arrays entirely — kept on the type only so Phase 6's cancel response doesn't
  need a second shape), `CreatedAt` (the one genuine `DateTimeOffset` in the contract). Demand side:
  `ProcessorSpaceId, Processor, Plant, SpaceStockClass, DeliveryDate, DeliveryDateLabel,
  DeliveryTime`. Supply side: `LivestockAvailabilityId, FarmerName, LocationName,
  AvailabilityStockClass, AvailabilityDetails, AvailableFrom, AvailableFromLabel`. Both stock
  classes are carried deliberately — the two vocabularies not aligning is the point of the screen.
- Every `DateOnly` field ships with a sibling `*Label` in `dd-MM-yy`; enums serialise as strings
  (`ApiJson` registers `JsonStringEnumConverter`).

### Decisions made during the build

- **`ProcessorSpaceRules.CanConfirm` adds a `space.Status == Booked` gate** beyond resolved question
  12's literal wording ("at least one Confirmed match and no Drafted matches"). Reason: without it,
  a Cancelled space or one already Confirmed would still report `CanConfirm == true`, pushing the
  suppression logic onto the Angular client. Also restated the match-side condition as "every live
  match is Confirmed" rather than "no Drafted matches", so it correctly blocks confirmation on a
  Notified match too once notifications exist in a later phase — Notified was out of scope when
  question 12 was written. The sonnet reviewer confirmed this is a deliberate, sound extension, not
  scope creep, but flagged it as worth recording explicitly so a later reviewer doesn't mistake it
  for one. **A later phase must not "simplify" this back to the literal roadmap wording.**
- **`MatchCreation.MaxMatchQuantity` for an edit adds back the existing match's own quantity**, which
  is a deliberate reading of resolved question 13 over the phase doc's literal wording ("the
  availability record's original quantity") — the literal wording would permit exactly the over-commit
  that resolved question 1 forbids. Add-back is skipped for a Cancelled match (it consumed no supply).
- **A Drafted match is deleted, not cancelled**, per resolved question 3 — `RecordCancellation` has no
  "cancel a draft" path; that's plain deletion and belongs to Phase 6, not a `MatchStatus` transition.

### Deviations from the phase document

Every rule in sections 2–8 and every case in both the "Testing" and "Date handling" lists was
implemented and tested. Nothing was descoped. Two shape decisions departed from the document's
literal wording:

- **Requirement 7.3 reads as two counterparty-specific match shapes; one combined `MatchDto` shipped
  instead.** Confirmed with Mark before building. The same object hangs off both parents, so Phase
  5's drag creates one shape both cards can render and Phase 6's dialog has everything on one
  object. It costs a few redundant bytes per match.
- **Requirement 7.5's endpoints have no in-process HTTP test.** That would have meant a new package
  (`Microsoft.AspNetCore.Mvc.Testing`) and a `Program` partial-class marker for no coverage the
  projection and serialisation tests do not already give — those assert against `ApiJson.Options`,
  which is *the same options object the host serialises with*, so a drift between test and wire
  format is not possible. Both endpoints were instead verified by hand against a running API (see
  "Verified end to end" below).

### Review findings

A sonnet subagent independently re-derived every rule from the phase document and roadmap (not from
reading the code back to itself) and did a separate explicit pass over date handling. **No confirmed
correctness bugs.** One item worth recording rather than fixing: `ProcessorSpaceRules.CanConfirm`'s
`Booked`-gate addition (see "Decisions" above) — reviewed and endorsed, not a defect. The reviewer
also confirmed `DomainPurityTests.No_domain_source_file_reads_the_real_clock` genuinely scans every
`.cs` file under `src/Apg.Domain` and would catch a real violation, rather than merely passing by
coincidence, and confirmed the full DST/property test list in the phase doc is covered with no gaps.

### Watch out for

- **`ProcessorSpaceRules.CanConfirm`'s `Booked` gate** (above) — don't "fix" it to match the roadmap's
  literal words.
- **Cancelled-matches exclusion is two different things that must not blend**: excluded from the
  `Matches` array on both DTOs, but still correctly excluded from (not silently included in) both
  `MatchedInclDraft`/`MatchedExclDraft` sums. `DtoProjectionTests` guards this distinction explicitly
  — if a later phase needs a cancelled match's own data (e.g. a cancellation-reason display), it is
  not on these two DTOs by design and needs its own endpoint/shape, not a change to these ones.
  `MatchDto.CancellationReason` exists on the type today only so that future shape doesn't need
  inventing from scratch; it is always null coming off these endpoints.
- **`MatchCreation.MaxMatchQuantity` has two overloads** — a single-arg one (new match, no add-back)
  and a three-arg one (editing, with add-back). Reaching for the wrong one silently permits an
  over-commit on an edit.
- **Pricing is keyed on the Processor Space stock class, never the Availability side's.** The two
  vocabularies don't align; if Phase 5's drag-to-price wiring ever reads the wrong side's stock class
  it will look plausible and be wrong.
- **`ProcessorSpaceRules` has no status-derivation function on purpose.** A Processor Space's status
  is stored and set by explicit APG action; don't add a `Derive` for it by analogy with the
  availability side.

### New commands, dependencies, conventions

None beyond what CLAUDE.md already records — no new packages, no new commands. `src/Apg.Domain` still
has zero `PackageReference`/`ProjectReference` entries (confirmed by reading the `.csproj` directly),
so the "no EF Core, no ASP.NET, ever" rule holds through this phase.

### Further decisions made during the build

- **Date labels use LMS's `dd-MM-yy`.** Sampled from `ExistingAppScreenshots/LMS Purchases.png`, where
  23 August 2026 renders as `23-08-26`. Confirmed with Mark. Formatted under
  `CultureInfo.InvariantCulture` so a machine locale cannot change the wire format, and pinned by a
  test that runs it under `en-US` and `de-DE`. **The format lives in `NzTime.DateLabelFormat` and
  nowhere else** — Phase 2 may change it there. If a phase wants a friendlier form (the roadmap's
  carry-over cards describe "available since 10 Aug"), **add a second formatter to `NzTime`**; do not
  format a date in TypeScript.
- **`quantityStateLabel` is computed in C#, not chosen in the client.** The roadmap pins the wording of
  two of the six states ("Over-filled" on demand, "Over-committed" on supply); leaving the other four
  to the client would have put a `state === 'Over' ? … : …` expression in TypeScript, which is exactly
  the drift this phase exists to prevent. All six live in `QuantityStateLabels`. Phase 2 may reword
  them **in that one file**.
- **DTOs live in `Apg.Api`, not `Apg.Domain`.** A DTO is a transport concern and the wire format is an
  API decision. `MatchingProjection` computes nothing — every derived value on the way out is a call
  into `Apg.Domain`, which the reviewer verified independently.
- **`ApiJson` holds the wire format**, shared between `Program.cs` and the tests, so the serialisation
  tests assert against the same options object the host uses. A second copy in the test project would
  have been the very drift being tested for.
- **The seeder's `MatchContext` bookkeeping was deliberately left alone.** Its remaining-demand and
  remaining-supply counters are incremental *generation state*, not a displayed value, and rewriting
  them to call `MatchQuantities` risked changing the byte-identical seed the golden tests pin. The
  loop is closed by assertion instead: `SeedDemonstrationCaseTests` now proves the seed's section-4.7
  cases through the real domain functions, so seed and rules cannot disagree unnoticed.
- **Orphaned matches are skipped in the DTO collections rather than throwing.** A match whose parent is
  missing cannot render on either card. It still counts in the sums, which are taken over the raw match
  set, so skipping it changes no number. The seed guarantees integrity; this is defensive only.
- **One rule the roadmap does not cover:** whether an existing match's quantity is added back to the
  edit ceiling when that match is **Cancelled**. It must not be — a cancelled match consumed no supply,
  so adding it back would hand out the same animals twice. Resolved that way, and tested.

### Phase 0 debt closed

- **`SeedFixture.MatchedInclDraft` is gone.** Phase 0's log flagged it as the one copy of a domain rule
  living outside `Apg.Domain`, put there only because the real rule did not exist yet. It has been
  deleted and `SeedDemonstrationCaseTests` repointed at `MatchQuantities` and `AvailabilityStatus`.
  **There is now no copy of a domain rule anywhere outside `Apg.Domain`. Keep it that way** — including
  in test projects, where a "convenient" local helper is how the last one got in.
- **`AtNzTime`'s daylight-saving assumption** — closed, see the `NzTime` entry above.

### Further review findings

Beyond the endorsed `Booked` gate already recorded, the sonnet reviewer raised two items:

1. **Server-side default ordering** (low, informational) — **not changed, recorded here instead.** Both
   endpoints return records sorted soonest-first (delivery date, then available-from, each tie-broken
   by id). That is the roadmap's stated default ("Sorted soonest-first, always"), and ordering is not
   one of the computed values `Apg.Domain` owns. **Phase 4 should build its sort controls on top of
   this default rather than assume the API returns insertion order.**
2. **`DomainFixtures.cs` contained a type named `Given`** (cosmetic) — **fixed.** The file is now
   `tests/Apg.Domain.Tests/Given.cs`.

The reviewer independently recomputed the calendar facts rather than trusting the tests' own
assertions: it confirmed 27 September 2026 and 5 April 2026 are genuinely Sundays, that 22 August 2026
is a Saturday whose 13:00 UTC is already Sunday in New Zealand, and that the NZDT +13 / NZST +12
pairing is applied the right way round in both directions. Its verdict: the arithmetic is trustworthy,
date handling is the best-covered part of the phase, and no computed value is missing from the DTOs.

### Verified end to end

The API was run against a freshly deleted database and both endpoints inspected by hand:

- 40 spaces, 50 availability records.
- Availability statuses spread across the derivation's branches — 33 `Booked`, 12 `Pending`,
  5 `Confirmed`.
- **No cancelled match appears in any `matches` array** on either endpoint.
- **Every `weekCommencing` is a Sunday.**
- **No availability record is in the `Over` state**, so the pink bug-flag state is unreachable as
  intended.
- Arithmetic cross-checked by hand on space 13: two matches of 67 (Confirmed) and 2 (Drafted) →
  `matchedInclDraft` 69, `matchedExclDraft` 67, `unmatched` 1 against a requirement of 70, state
  `Under`, `canConfirm: false` because a draft is outstanding.

Test counts at close: `Apg.Domain.Tests` 113, `Apg.Api.Tests` 65, Angular 7.

### Further things to watch out for

- **`Unmatched` comes from the incl-Draft sum, not the excl-Draft one.** Both sums are on the DTO and
  it is easy to reach for the wrong one. A draft has already spoken for the stock as far as the
  operator is concerned; taking unmatched off the excl-Draft sum would offer the same animals to a
  second space. Tested by name.
- **`quantityState` is semantic, not a colour.** `Over` means opposite things by side: permitted and
  expected on a space (blue, "Over-filled"), a bug indicator on an availability record (pink,
  "Over-committed"). Phase 2 owns the mapping and must key it on the side as well as the state.
- **Never construct a JavaScript `Date` from a DTO's ISO date.** Render the `*Label` that ships beside
  it. This is stated at the top of `web/src/app/api/models.ts` and pinned by `matching-screen.spec.ts`,
  which feeds the screen deliberately self-contradictory figures and asserts they render unquestioned.
- **`Notified` is unreachable in pass 1 but is not inert in the rules.** It counts towards *both*
  matched sums, and it blocks confirmation on both sides. Do not treat it as equivalent to `Drafted`
  in the sums, or to `Confirmed` in the gates.
- **The API still locks `Apg.Domain.dll` while it runs** — `dotnet build` fails with MSB3027 if you
  forget to stop it. Unchanged from Phase 0, and it bit again during this phase.
- **`Documents/build-plan.html` still carries the unrelated pre-existing working-copy modification**
  Phase 0 noted. Phase 1 did not touch it either.
- **The repo still has no commits.** The working tree holds everything.

### Useful commands added

- One rule's tests: `dotnet test --filter "FullyQualifiedName~AvailabilityStatusTests"`
- The whole date matrix: `dotnet test --filter "FullyQualifiedName~NzTimeTests"`
- One Angular spec:
  `npx ng test --watch=false --include=src/app/matching/matching-screen.spec.ts` in `web/`
