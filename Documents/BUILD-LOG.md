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

---

## Phase 2 — Design Pass

**Completed:** 2026-08-28
**Status:** Complete

### What shipped

A ten-artboard design canvas and `Documents/design-system.md`, which is the document Phases 3–8
implement from. **No application code was touched** — `git status` shows nothing under `src/`,
`tests/` or `web/`.

**Canvas Artifact URL:** https://claude.ai/code/artifact/1cc1dd73-911d-4f74-be93-c672d8606d33

Artboards: `Main` (the matching screen in the LMS shell at 1366×768), `SpaceCard`,
`AvailabilityCard`, `CarryOver`, `WeekBands`, `DragStates`, `QuantityPrompt`, `MatchModal`,
`FilterBar`, `EdgeStates`. Every artboard uses **real seeded records by id**, harvested from the two
read endpoints; nothing is placeholder text.

The canvas source lives in the session scratchpad, not the repo: `canvas/*.js` are the working
modules (`css.js`, `lib.js`, `exp.js`, `data.js`, `ab1..ab10.js`) and `build.mjs` emits the ten
`.dc.html` artboards plus `canvas.json`. **A later phase wanting to edit the canvas does not need
them** — the `design` skill can extract the artboards back out of the published artifact. If the
design needs re-cutting from scratch, it is faster to re-author than to hunt for the scratchpad.

### The design thesis, in one line

**A card is a table row that has grown a status spine, a fill meter and an expand chevron.** Each
column keeps LMS's sticky micro-cap header strip and every card's line 1 aligns to those columns;
cards are flat, square, zebra-striped and 52px; expanding one reveals an actual LMS table of its
matches. That is the answer to "make two columns of cards feel native to a table application", and it
is held to arithmetic rather than taste — see the density figures below.

### Sampled hex values and the Material theme

Phase 0's sampled values were **reused verbatim, not re-sampled** (petrol `#00567E`, dev flag
`#CCD457`, surface `#FAFAFA`, nav-active `#F6F6F6`, zebra `#EEEEEE`, sidebar footer `#EBEBEB`,
divider `#E0E0E0`, text `#212121`, muted `#757575`; sidebar 190, top bar 52, nav 48, row 44). The
standing split holds: **shell chrome paints with the sampled hex; only Material components take the
generated palette** (tone 40 is `#1D648D`, not `#00567E`).

**Two theme changes Phase 3 must make in `web/src/styles.scss`:**

1. `density: -2` (currently `0`) — at `0` a `mat-form-field` is 56px and a `mat-chip` 32px; this
   design's filter row is 40px and its chips 26px.
2. `.mat-mdc-dialog-surface { border-radius: 4px !important; }` — M3's default 28px dialog radius
   reads as a different product beside LMS's square tables.

**All form fields use `appearance="fill"`, never `"outline"`.** LMS is an
underline-with-floating-label app; outlined fields would be the most obvious tell that this is
something else.

### The status left-edge scheme, as shipped

| Status | Left edge | Icon | Card |
| --- | --- | --- | --- |
| Booked | **3px** solid `#E0E0E0` | `radio_button_unchecked` | normal |
| Pending | **6px** 45° hatch `#BDBDBD` on white, 4px period | `schedule` | normal |
| Confirmed | **6px** solid `#00567E` | `check_circle` (`FILL 1`) | normal |
| Cancelled | **6px** dashed `#9E9E9E`, 6/4 | `block` | `grayscale(1) opacity(.62)`, title struck |

Weight alone separates Booked (3px) from everything else (6px), so "nothing has happened yet" reads
before the pattern is resolved. Processor Space has no Pending (resolved question 6) — three statuses
is its complete set, not an omission.

### The fill meter, as shipped

66 × 8px track, `#E0E0E0`, 1px radius. **Two segments:** solid = `matchedExclDraft`, a 45%-alpha
extension runs on to `matchedInclDraft`. Alpha is a third channel belonging to neither colour system,
which is why the draft delta is not hatched. Numeral 40px right-aligned, 15px/600 tabular. **Block
total 112px (66 + 6 + 40), and the header strip's Unmatched cell is also 112 — they must not drift.**

Over 100%: both segments at 100%, the track outlined in the bar colour, a 3 × 12px over-run cap at
`top:-2px; right:-6px`, a negative numeral, and the literal `Over-filled` / `Over-committed` label.

Quantity ramp — literal tokens, **not** M3 palette entries:
`$q-under-bar #E8820C` / `$q-under-ink #A85B00`; `$q-exact-bar #2E7D32` / `$q-exact-ink #1B5E20`;
`$q-over-bar #1565C0` / `$q-over-ink #0D47A1` (**space only**); `$q-pink-bar #D81B60` /
`$q-pink-ink #AD1457` (**availability only**); `$q-track #E0E0E0`.

New non-quantity tokens: `$lms-card #FFFFFF`, `$lms-card-zebra #F5F5F5`, `$lms-band #F0F0F0`,
`$lms-petrol-tint #E8F1F6`, `$lms-hover #F5F9FB`, `$lms-column-wash #F6FAFC`,
`$lms-rule-strong #BDBDBD`, `$lms-rule-soft #EFEFEF`, `$lms-faint #9E9E9E`,
`$lms-tile-ink #5C5F62`, `$lms-supply-ink #37393C`, `$lms-error #BA1A1A`,
`$lms-attention-ink #5C5F62`, `$lms-attention-bg #F5F5F5`. All mirrored as `--` custom properties.

### The carry-over treatment settled on, and the alternative

**Proposal A** (as specced): repeat every carried-over record as a 40px one-line card at the top of
each later band. **Proposal B**: no repetition, one 32px summary strip per band.

**Shipped answer: they are the same component in two states** — B *is* A collapsed, same sub-header
and chevron. One component, a collapse toggle persisted per band and per column, and the **opening**
state chosen by count:

- `CARRY_OVER_EXPAND_LIMIT = 4` — expanded at or below four carried-over records, collapsed above.
- `CARRY_OVER_HORIZON_WEEKS = 4` forward of the current week, and **never in a band before the
  current week** — a record cannot be carried over into the past.

Both are named constants Phase 3 must export. The threshold is the one design change made *after* the
plan was approved, and the money shot is what forced it: **nine seeded records really do carry over
from week 16 Aug into week 23 Aug**, and expanded that is 360px of repeats pushing the week's own work
off a 544px list. It also lets Mark A/B the two proposals at runtime rather than in another design
pass, which is the point — this is the display he expects to iterate on.

**The carry-over card does NOT use a dashed left edge**, despite the roadmap's "muted, dashed"
wording. A dashed left edge is already the Cancelled spine, and a carry-over must keep showing its own
true status — seeded record #37 carries over while Pending. The dash moved to a real outer border on
three sides (top/right/bottom, `1px dashed #BDBDBD`), leaving the left edge to the status spine. This
is applying the roadmap's scheme faithfully, not departing from it.

### Decisions a later phase is bound by

1. **Stock class carries no hue.** `Data/stock-class-configs.csv`'s `icon` column informs species
   grouping; its **`color` column is not used on the matching screen**. This contradicts **Phase 8
   §3.1**, which asks for the hex colours — but resolved question 16 commits hue exclusively to the
   quantity meter and the roadmap's resolved questions outrank a phase document. Twenty-two saturated
   swatches would destroy the three-colour ramp the whole screen is scanned for. **Phase 8 inherits
   this decision rather than re-deciding it.** Instead: a 20px monogram tile, `#EEEEEE` fill,
   `#5C5F62` 11px/600 two-letter monogram, with **shape carrying species** — circle sheep, square
   cattle, diamond deer. Unmapped class → square tile, first two characters. Full 16-row table in
   `design-system.md` §7.
2. **Phase 3 must add a second `NzTime` date formatter** and ship it on the DTO. The band header wants
   `Week of 23 Aug` and the carry-over card wants `since 17 Aug`; the DTO's existing labels are
   `dd-MM-yy`. One formatter serves both. **Do not format a date in TypeScript and never construct a
   JavaScript `Date` from an ISO value.**
3. **Phase 3 must reserve the 40px filter row** even though Phase 4 fills it, so the density it
   measures is the density that ships.
4. **The header strip has two leading offsets.** Inside a week band a card's tile sits at 54px from the
   column edge (48 rail + 6 spine), so the strip's pad is 54px. Phase 3 only ever needs that form. The
   canvas also carries a 6px variant for the standalone card sheets, which have no rail.
5. **Warning affordances use no amber.** Every usable amber lands on `$q-under-ink` (`#A85B00`) and
   smuggles the quantity ramp's orange into meanings that are not quantities. Consequential warnings
   use `$lms-error`; "away from default" uses the hueless `$lms-attention-ink`.
6. **Both match tables carry a Transport column** and sit in an `overflow-x: auto` wrapper. On the
   supply side the delivery time rides inside the Delivery cell in muted text rather than taking a
   column — seven columns fit 508px, eight do not.
7. **Debug "+ Add" controls deliberately do not reuse LMS's create FAB.** They are 26px stroked
   buttons in the column header, so they read as tooling rather than as the product's create action.

### Density and width, the numbers Phase 3 is held to

Width at 1366: `1366 − 190 sidebar − 24 padding − 16 gutter = 1136`, ÷2 = 568 per column,
`− 2 border − 48 rail = 518px of card`. **The artboards are drawn at 508px, deliberately 10px
conservative** — the only column that changes is the flexing name column (114px real, 104px drawn).

Density at 768: `768 − 52 top bar − 52 search strip − 12 padding − 40 column header − 40 filter row
− 28 header strip = 544px of list`. Band chrome shares that, so the honest figure is **8–10 cards per
column, 16–20 across both**, against LMS's ~20 rows. If Phase 3 ends up at four cards per column the
design has failed and the card must shrink, not the target.

### Deviations from the phase document

- All ten required artboards exist and `design-system.md` covers every item the phase document's own
  list demands. Nothing was descoped.
- The stock-class colour decision (1 above) departs from Phase 8 §3.1, with the reason recorded.
- The carry-over dash placement departs from the roadmap's literal wording, with the reason recorded.
- The carry-over expand **threshold** is an addition beyond the approved plan's "expanded by default
  with a toggle". It is a refinement of the same component, not a new mechanism.

### Review findings

Two sonnet subagents ran: one over the canvas source modules for arithmetic, colour discipline,
pattern collision and dead code; one over `design-system.md` against the Phase 3 requirements and the
four screenshots. Both reported rather than applied. Disposition:

**Fixed — canvas:**

1. **Four band head-totals were wrong** (23 Aug demand 1,674→1,774; 23 Aug supply 2,539→2,519;
   30 Aug demand 4,153→3,533; 30 Aug supply "6 records · 2,135"→"5 records · 2,019"). Found by my own
   check before the reviewer's, and independently confirmed. The supply-side one mattered: the band
   meta must count what is **visible after the default filter**, and availability #3 is excluded by
   `Unmatched > 0`. That rule is now stated.
2. **Carry-over strips were quoting available head, not unmatched head** — corrected, and the label
   now reads "head unmatched".
3. **The header strip did not align with the card in the standalone card sheets** — a 48px error, in
   exactly the artboards meant to demonstrate that alignment. Fixed with the two-offset variant
   (decision 4). The most serious finding of either review, because it undercut the design's own
   thesis.
4. **`#A85B00` — literally `$q-under-ink` — was reused on three warning affordances.** Fixed
   (decision 5). Exactly the drift the colour rule exists to prevent, appearing inside the phase that
   wrote the rule.
5. **`ab4` rendered four cards under a "New this week (7)" header** — now renders all seven, so
   Proposals A and B compare honestly.
6. **The unmatched numeral column was 34px**, too narrow for the four-character over-run case
   (`-305`) — widened to 40px, meter narrowed to 66px, block total unchanged at 112px.
7. **The card height did not add up** — `7 + 17 + 3 + 14 + 7 = 48`, not 52. Now an explicit
   `height: 52px` with the lines vertically centred, so a 1px change cannot quietly move the density
   target.
8. **`.dt` lacked the truncation guards its siblings had**; the match table could widen the card with
   no scroll affordance. Both fixed.
9. Dead imports across seven modules, a no-op `box-shadow`, and an unused `let x` in `build.mjs` —
   removed. A comment claiming a price was "read off match 12" named a match that does not exist;
   corrected to Processor Space #8's own seeded match.

**Fixed — document:**

10. **The carry-over card's expanded state was unspecified**, blocking Phase 3 §4.5. Now stated: it is
    *identical* to a full card's expansion, because it is the same record. Its own line-1 column table
    was also missing and is now given.
11. **The supply-side match table was missing Transport**, which Phase 3 §3.4 requires.
12. **Two self-contradictions**: card radius (§0 "2px at most" vs §5.3 "0") and chip radius (2px vs
    13px). Resolved to 0 and 13px.
13. **The search-strip breakdown didn't sum** (8+36+6 = 50, not 52). Restated.
14. **The density claim ignored band chrome.** Now a table: 10 cards with no chrome visible, 8 with
    two band headers and both carry-over sub-headers. The honest range is 8–10.
15. **Whether Phase 3 reserves the Phase 4 filter row was unstated** — now decision 3.
16. **No CSS custom properties block**, which Phase 2's own requirements demand. Added.
17. **The carry-over date form was left open** between `since 17-08-26` and Phase 3 §4.3's own
    "available since 10 Aug" example. Decided: the friendlier form, via decision 2.
18. **The empty-band string existed only for the demand side**; line-2 overflow priority was
    unstated. Both added.
19. **Petrol `#00567E` is shared by the Confirmed spine and the demand column's identity rule**, which
    the colour section policed for the quantity ramp but never acknowledged for itself. Now stated
    explicitly, with the resolution if it ever confuses: move the *column rule* to a neutral, never
    the spine.

**Recorded, not fixed:**

20. The documentation reviewer's Question 2 identified four ways this design visibly differs from the
    screenshots: the status spine has no LMS precedent at all; the filter chrome is ~100px against
    LMS's ~190–200px; chips are an idiom LMS never uses; the column header strip has a fill, a rule
    and sticky behaviour where LMS's headers are plain text. **All four are deliberate and all four
    are now written into `design-system.md` §16a**, so Phase 8's "does it look at home" check has a
    baseline instead of rediscovering them as bugs. The spine is sanctioned by resolved question 16;
    the filter compression buys two cards per column.
21. The reviewer suggested the true density will run below the advertised figure. Correct, and now
    quantified as a range rather than softened.

### Watch out for

- **`design-system.md` §16 lists eleven things the canvas shows but does not explain.** Read it
  before building; it is where the sharp edges are.
- **The band meta counts what is visible after the default filter**, not every record in the week.
  Easy to get wrong, and it looks right either way.
- **`quantityState` is semantic, not a colour, and `Over` means opposite things by side** — permitted
  and expected on a space (blue), a bug indicator on an availability record (pink). The mapping is
  keyed on the state **and** the side.
- **The seed groups processors by week** (16-08 all ANZCO, 23-08 all Alliance, 30-08 all SFF). That is
  a seeder artefact, not a design intention. Do not build anything that assumes it.
- **The seed contains only `Booked` Processor Spaces** (all 40) and no cancelled availability records,
  so the Confirmed and Cancelled card variants on artboards 2 and 3 are constructed from real records
  and labelled as such. Phase 3 cannot verify those two states against seeded data.
- **The current week in every artboard is w/c Sunday 2026-08-23**, bands 16-08 through 20-09. A reseed
  moves the bands; the geometry does not move.
- **The 112px meter block and the header strip's 112px Unmatched cell are one number in two places.**
  Change one and the columns stop lining up.
- **The API locks `Apg.Domain.dll` while it runs** — unchanged from Phases 0 and 1, and it bit again
  here: an `Apg.Api` instance was **already running** on the machine when this phase started, so
  `dotnet run` failed with MSB3027 and the seed JSON came from that pre-existing instance rather than
  one this phase started. The data is deterministic and was cross-checked for self-consistency (all
  46 records used: `unmatched`, `quantityState` sign, `matchedExclDraft ≤ matchedInclDraft`, and every
  match bundle summing to its parent). That process was not started or stopped by this phase.
- **The machine now has the .NET 10 SDK** (`dotnet --version` → 10.0.400), not the 9.0.317 Phase 0
  recorded. The projects still target `net9.0` and built fine under it. Worth knowing before blaming
  a future build failure on something else.
- **`Documents/build-plan.html`'s pre-existing working-copy modification is gone.** Phases 0 and 1
  both flagged it; the working tree was clean at the start of this phase. Phase 2 did not touch it.
- **The repo still has no commits.** The working tree holds everything.

### New commands, dependencies, conventions

No new packages and no changes to CLAUDE.md's command table. Three things worth recording:

- **Harvesting real seed data for a design or a document:** start the API, then
  `curl -s http://localhost:5286/api/processor-spaces` and
  `curl -s http://localhost:5286/api/livestock-availability`. Stop the API before `dotnet build`.
- **`node` is not on the Bash tool's `PATH`** by default in this environment; prefix with
  `export PATH="/c/Program Files/nodejs:$PATH"`. Likewise `dotnet` at `/c/Program Files/dotnet`.
  There is **no `python`** on this machine — use `node` for scripted text edits.
- **Repo Markdown is CRLF.** A `node` string-replace script must normalise `\r\n` to `\n` on read or
  every multi-line anchor silently fails to match.

---

## Phase 3 — Card Lists & Week Bands

**Completed:** 2026-08-28
**Status:** Complete

### What shipped

The matching screen now renders both sides as week-banded card lists implementing `design-system.md`:
52px cards with status spines, fill meters and monogram tiles, grouped into week bands with a sticky
left rail, and carry-over cards repeating unmatched availability records into later weeks. Expand and
collapse is the only interaction; the filter row and search strip are reserved but empty.

A third endpoint, **`GET /api/week-bands`**, ships the calendar the bands are drawn on. Later phases
can rely on: `buildBoard` as the seam filtering attaches to, `CardStateStore` for per-card UI state,
`_card-geometry.scss` as the single home of every dimension, and `no-domain-arithmetic.spec.ts` as the
client-side guard that the DTO contract is not being worked around.

### Decisions made during the build

1. **The week calendar became a server-computed artefact — `GET /api/week-bands`.** Requirement 1.6
   says an empty week still renders its header, which means the client needs the *name of a week no
   record falls in*. There is no way to produce that from the records without adding seven days to an
   ISO string in TypeScript, which the roadmap forbids. So `MatchingProjection.WeekBands` returns an
   ordered, gapless `WeekBandDto[]` — `weekCommencing`, `weekCommencingLabel`, `weekOfLabel`,
   `isCurrentWeek`, `isPastWeek`.

   This is the decision the whole phase turned on. Once the ordered array exists, **banding is string
   equality on `weekCommencing` and carry-over placement is integer index comparison** — no `Date` is
   ever constructed, so "no domain arithmetic in `web/`" is achievable rather than aspirational.

   Two properties of it are deliberate and load-bearing:
   - **The range always includes the current week**, whether or not a record falls in it. The
     carry-over rule is expressed relative to the current band's index, so that index must always
     exist; otherwise every carry-over becomes a special case.
   - **It carries no record ids.** A record's week is already on the record. A second home for that
     membership is precisely what would let a carry-over drift into being a copy.

   **One band list serves both columns**, so a week that is empty on one side still renders there and
   the two sides stay vertically comparable.

2. **`NzTime.ShortDateLabel` (`d MMM`) and `NzTime.WeeksFrom`** — Phase 2's decision 2, discharged.
   One formatter serves both `Week of 16 Aug` and `since 17 Aug`. **The C# formats only the date; the
   words "Week of" and "since" are template text**, because the 48px rail stacks them on two lines and
   a single preformatted sentence could not be split. `LivestockAvailabilityDto` gained
   `availableFromShortLabel` alongside its existing `dd-MM-yy` label.

3. **Carry-over horizon: `CARRY_OVER_HORIZON_WEEKS = 4`**, in
   `web/src/app/matching/board/carry-over.ts`. Four weeks forward of the **current** week, not of the
   record's home week — a record from three months ago and one from last week are equally relevant
   *now*, and anchoring on the current week means a stale record cannot walk its own window forward
   indefinitely. Past four weeks, a record still holding unmatched stock is a data-quality problem
   rather than a matching opportunity, and repeating it further would bury the weeks that matter. Four
   covers the seeded span and APG's booking window.

   **`CARRY_OVER_EXPAND_LIMIT = 4`** in the same file: a band's carry-over group opens expanded at or
   below four repeats and collapsed above it. This is also what makes Phase 2's two proposals one
   component — Proposal B (a summary strip per band) is Proposal A (repeat every record) collapsed, so
   Mark can compare them at runtime rather than in another design pass.

4. **Three bounds on carry-over placement**, all in `addCarryOvers`: never in the record's own home
   band (which has the full card), never before the current week (a record cannot carry over into the
   past), never beyond the horizon. `record.unmatched > 0` is a *comparison* against a server-computed
   figure, not a computation — when Phase 5's drag takes it to zero the repeats stop being produced,
   which is the visible confirmation the drag worked.

5. **`carryOver` holds the same object references as the home band's `availability` array.** Identity
   by construction, not by convention — there is no clone, no id lookup and nothing to keep in sync, so
   §4.5's "expanding one shows the same matches" is true because there is only one object and one
   expansion component. `matching-board.spec.ts` asserts it with `Object.is`.

6. **Expansion state is keyed per card instance, not per record**: `side:recordId@bandWeek` in
   `CardStateStore` (root-provided, so it survives navigating away and back — "remembered while the
   session lasts", §5.1; nothing is persisted to `localStorage`). Keying by record alone would expand
   the home card too, and the home card growing would push everything below it — including the
   carry-over the pointer is over — down the page, breaking §5.2. The *content* is still identical
   because both cards read the same DTO object. The store also holds the carry-over group's collapse
   state, per band and per column.

7. **`buildBoard` returns `unplaced`, and a test asserts it is always empty.** The server derives the
   band range from the same working set, so a record can never fall outside it — but reporting rather
   than silently dropping means that if it ever does, a test says so instead of a record vanishing off
   a screen APG commits livestock on.

8. **Exactly two arithmetic sites exist in `web/`, both allow-listed by name in
   `matching/no-domain-arithmetic.spec.ts` with the reason recorded in the test itself:**
   - `card/fill-meter.ts` — segment widths as ratios, clamped to [0, 100]%. A CSS width is not a
     displayed figure and the clamp is a design rule, so neither belongs in the wire format. Every
     value the component actually *renders* — the numeral, the state, the label — arrives computed.
   - `board/matching-board.ts` — the band header roll-ups. A presentation aggregate over a list, not a
     domain rule, and it must be client-side because Phase 4's filters change which records are in the
     band. A per-band total on the DTO would be right today and wrong under a filter.

   **If a later phase needs a third such site, it is probably missing a DTO field.**

9. **The band meta counts native records only.** A carried-over record is already counted in its home
   band; counting it again in every later band would inflate every total on the screen. This is the one
   plausible double-count in this design and it has its own test. The carry-over strip's own total is
   **unmatched** head, not available head (Phase 2's correction) — what is left is the only figure that
   matters this week.

10. **`matching-screen` waits for the week bands before rendering the columns.** The three requests
    land in any order, and with no bands `buildBoard` would correctly report every record as unplaced
    and draw two empty columns for one round trip — which reads as an empty data set rather than a
    pending one. Zero bands is unambiguous because the endpoint always includes the current week.

11. **`density: -2` and a 4px dialog radius** in `web/src/styles.scss`, per `design-system.md` §1.1, so
    Material's own controls land on LMS's proportions without a per-component override each. §2's
    palette is appended to `_lms-tokens.scss` as SCSS variables **and** `:root` custom properties.
    One colour the design document uses but §2 never tabulated, `#4A4A4A` for a carry-over's name, is
    now the token `$lms-carry-name`.

### How many carry-over instances the seed actually produces

Measured against the running API with the seed anchored on Sunday 2026-08-23, which is the current week
(band index 1 of 6, the bands running 16-08 to 20-09):

| Band | Native records | Carry-over instances |
| --- | --- | --- |
| 2026-08-16 (past) | 9 | 0 |
| 2026-08-23 (**current**) | 9 | 9 |
| 2026-08-30 | 8 | 16 |
| 2026-09-06 | 8 | 23 |
| 2026-09-13 | 8 | 30 |
| 2026-09-20 | 8 | 36 |

**114 carry-over instances in total**, from 50 availability records of which 44 have unmatched stock
and 36 have a later band to appear in. The nine into the current week match `design-system.md` §9.1's
figure exactly, which is a useful cross-check that the placement rule matches the one Phase 2 designed
against.

**Consequence worth knowing: with the real seed, every carry-over group starts collapsed**, because the
smallest is 9 and `CARRY_OVER_EXPAND_LIMIT` is 4. The expanded-by-default path is real and reachable
(collapse a group and reopen it, or filter the list down in Phase 4) but the seeded screen does not
show it on load. If Mark wants to see Proposal A on first paint, raise the constant — that is exactly
what it is there for.

### What Phases 4 to 7 attach to

| Thing | Where | How a later phase uses it |
| --- | --- | --- |
| `buildBoard(weeks, spaces, availability)` | `board/matching-board.ts` | **Phase 4 filters the inputs and calls it again.** Do not filter inside it and do not reach into `BandView`; the band meta then reshapes for free. |
| `BandView` / `BandMeta` / `BoardView` | same | `{ week, spaces, availability, carryOver, meta }`. `carryOver` is same-reference. |
| `MatchSide = 'demand' \| 'supply'` | same | Not "left"/"right" — Phase 4 lets the columns swap position. |
| `CARRY_OVER_EXPAND_LIMIT`, `CARRY_OVER_HORIZON_WEEKS` | `board/carry-over.ts` | Tune here, nowhere else. |
| `CardStateStore` | `board/card-state.ts` | `isExpanded/toggleExpanded(side, recordId, bandWeek)` and `isCarryOverGroupOpen/toggleCarryOverGroup(side, bandWeek, count)`. Add Phase 4's flip state and Phase 5's drag state here rather than in a component. |
| `<app-matching-column side bands [total]>` | `column/matching-column.ts` | `total` is the pre-filter count for `showing n of n`; it defaults to the shown count, so Phase 4 passes the unfiltered total. The empty 40px `.filters` div is where the chips go. |
| `<app-week-band band side>` | `band/week-band.ts` | Rail, band header, carry-over group, "New this week", cards, empty row. |
| `<app-space-card space bandWeek zebra>` | `card/space-card.ts` | Phase 5 makes `.card` the drag source; `cursor: grab` is already on it. Phase 6's Confirm button goes on line 2 — `canConfirm` is already on the DTO and deliberately unused. |
| `<app-availability-card record bandWeek zebra>` | `card/availability-card.ts` | As above. |
| `<app-carry-over-card record bandWeek>` | `card/carry-over-card.ts` | Same record object as the home card, so a drag from here needs no special case. |
| `<app-card-expansion side [space] [availability]>` | `card/card-expansion.ts` | One component for all three cards. Phase 6's per-match actions go in the table's rows. |
| `<app-fill-meter …>` | `card/fill-meter.ts` | Phase 5's drop preview can reuse it. |
| `stockClassTile(stockClass)` | `card/stock-classes.ts` | The 16-row table plus fallback. Phase 7's form should read its class list from here. |
| `_card-geometry.scss` | `matching/` | **Every dimension.** Do not hard-code a width in a card, band or column stylesheet. |
| `testing/dto-fixtures.ts` | `matching/testing/` | `aSpace`/`anAvailability`/`aMatch`/`aWeek`/`weeks(currentIndex, count)` — defaults plus overrides. |

### Deviations from the phase document

- **Delivery-time ordering.** `design-system.md` §2.2 asks for delivery date *then delivery time*.
  `SeedConfig.DeliveryTimes` is free text (`AM kill`, `Yard by 6:30am`, `Before midday`) and
  alphabetical order is not chronological, so a secondary sort on it would be arbitrary rather than
  helpful. **Server order stays `date, id`** (Phase 1's default) and the client does not re-sort.
  Recorded rather than silently dropped; if Phase 4 wants true delivery-time ordering, the seed needs a
  sortable time field, which is a data change and not a sort change.
- **The `New this week` divider renders only when there are carry-overs *and* native cards.**
  §9.3 says "only when carry-overs are present". With carry-overs but no native records, the literal
  rule produces a `New this week (0)` heading over nothing. The stricter condition is a deliberate
  refinement in the same spirit.
- **The sticky rail label sits at `top: 28px`, not `top: 0`.** §8.5 says the rail label is
  `sticky; top: 0` inside the band; §16.8 puts the 28px column header strip inside the same scroll
  container at `sticky; top: 0`. Both cannot be right — `top: 0` parks the week label underneath the
  strip. Rail label at `top: 28px` / `z-index: 1`, strip at `z-index: 3`. **If Phase 4 changes the
  strip's height, this offset must change with it.**
- **The carry-over dash is an `outline` at `outline-offset: -3px`, not a `border`.** §9.2 specifies the
  outline; an outline takes no layout space, so the row stays exactly 40px and its cells stay level.
  (The *placement* on the outer edge rather than the left edge is Phase 2's decision, not a deviation.)
- **The band header label and the rail label both render** `Week of 16 Aug`, per §8.4 and §8.5
  respectively. That is mildly redundant on screen. Implemented as specified rather than reconciled,
  since only one of them sticks and Phase 4 may want the header one for its filtered counts.
- **`showing n of n` is currently tautological.** Honest for a screen with no filtering, and the
  `total` input is the seam.
- **Everything Phase 4 to 7 owns is absent**, as required: no filter chips, no sort, no flip button, no
  drag, no match dialogs, no add buttons, no Confirm-space button. The 40px filter row and 52px search
  strip are reserved-and-empty rather than filled with disabled controls, which would promise an
  interaction that does not exist.

### Review findings

One sonnet subagent reviewed the phase against the phase document, the roadmap and `design-system.md`.
It reported no bugs in the carry-over placement, band construction or expansion keying — the phase's
core risk — and confirmed the tests cover the edge cases. Disposition of what it did find:

**Fixed — the two that mattered:**

1. **`no-domain-arithmetic.spec.ts` never scanned the HTML templates.** It walked the tree collecting
   only `.ts` files, so `{{ s.quantityRequired - s.matchedInclDraft }}` written straight into
   `space-card.html` would have passed silently. Given this codebase's convention is that a card's
   cells are plain DTO bindings *in the template*, that was the most likely place for a breach and the
   one place the guard was blind. Templates are now scanned, HTML comments are stripped, and the file
   count is asserted per extension so the same gap cannot reopen unnoticed.
2. **The same spec excluded `+` entirely**, to avoid tripping over string concatenation — which meant
   `records.reduce((total, r) => total + r.unmatched, 0)`, the single most likely way a domain sum gets
   reimplemented, was invisible to it. `+` is now included; requiring the field name adjacent to the
   operator is what keeps ordinary concatenation from matching. **The spec now contains two tests of
   itself**: one asserting it catches four known breaches, one asserting it does not fire on the
   bindings these templates are full of. A purity test that passes everything is worse than none, and
   this one had two ways of doing that.

**Fixed — design-system fidelity.** All confirmed against the document, all mine:

3. Header strip was `#F0F0F0` on a `#BDBDBD` rule; §6.1 says `#FAFAFA` on `#E0E0E0`.
4. The week rail was `#F0F0F0` for every week; §8.5/§8.6 want `#FAFAFA` future, `#E8F1F6` current,
   `#F0F0F0` past. I had the future and past cases inverted.
5. The `Past` tag did not exist, and the current week's rail label was never petrol bold (§8.6).
6. The band's rule was on the bottom, so the current week's 2px petrol rule closed the previous band
   instead of opening its own (§8.4).
7. The rail's dotted petrol leader line (§8.5) was missing entirely.
8. The empty-band text read `No spaces this week`; §8.4 specifies `- no processor spaces this week` and
   `- no livestock availability this week`.
9. The carry-over row was missing its carry glyph in **both** places §9.2/§9.3 ask for it — the row and
   the group sub-header — and its name was weight 500 `#212121` rather than weight 400 `#4A4A4A`, so
   the repeat was not visually demoted at all. Its origin label was `#757575` and italic; §9.2 says
   `#9E9E9E` and says nothing about italics.
10. The carry-over row sat on card white; §9.2 says `#FAFAFA`.
11. The supply column's lead glyph was a paddock; §6.3 says a location pin.

**Fixed — code quality:**

12. **Each card component declared a `computed` with the same name as the helper it calls**
    (`readonly spineClass = computed(() => spineClass(...))`). Correct — a bare identifier in a class
    field initialiser resolves to the module import — but it reads as self-recursion, and a later
    "simplification" to `this.spineClass(...)` would break it silently. Renamed to `spine`,
    `statusGlyph`, `matchesLabel`, `transactionType`, `matchGlyph`, `transactionTypeText`.
13. **Two empty columns rendered for one round trip** when `/api/week-bands` resolved last — decision
    10 above.

**Recorded, not fixed:**

14. The reviewer questioned whether the band header label duplicating the rail label is intentional. It
    is what §8.4 and §8.5 each specify; noted under deviations rather than reconciled unilaterally.
15. The reviewer flagged `showsNewThisWeek`'s stricter condition as a literal deviation from §9.3 while
    agreeing it is the better outcome. Recorded under deviations so a future reader does not "fix" it
    back from the document text alone.

### Watch out for

- **The sticky rail is the most fragile thing in this layout.** Three numbers have to agree: the
  strip's 28px height, the rail label's `top: 28px`, and the `z-index` ordering (strip 3, rail label 1,
  cards 0). Change the strip's height in `_card-geometry.scss` and the rail label must follow. It is
  also unverified under real layout — see the next point.
- **On-screen card density and sticky behaviour are unverified.** jsdom has no layout engine, so no
  test in this phase can observe a sticky element, a real card height, or how many cards fit at 768px.
  The geometry is set explicitly and adds up arithmetically
  (`768 − 52 − 52 − 12 − 40 − 40 − 28 = 544`, ÷ 52 = 10.4 cards before band chrome), but **the 8–10
  card target and the rail's behaviour on a long band need eyeballing in a browser.** I have flagged
  this rather than claimed it.
- **A record can be drawn up to five times in one column** (once native, four times carried over), and
  every drawing is the same object. Anything that iterates cards to build a total, a count or a
  selection **must** decide whether it means records or cards. `buildBoard`'s band meta means records.
- **`@for` track expressions are per-block, not per-column.** The native cards and the carry-over cards
  are separate `@for` blocks in `week-band.html`, so both tracking `record.id` is safe today. Merging
  them into one list would collide immediately.
- **Seeded Processor Space #1 is over-filled 354 against 49 required** (`unmatched: -305`). The fill
  meter clamps to 100% and draws the over-run cap, so it renders sanely, and it is what makes the
  `-305` four-character numeral case real — Phase 2 widened the numeral column to 40px for exactly
  this. But a 7× over-fill looks like a seeder artefact rather than an intended demonstration. **Phase
  5 must cap the drag against unmatched quantity regardless**, and should not treat this record as
  evidence of what a realistic over-fill looks like.
- **Two spaces are over-filled, not one.** The acceptance criterion says "the over-filled space";
  #1 and #5 (Alliance Group, 209/190) both render blue with `Over-filled`. No availability record is
  over-committed, so **the pink `Over-committed` state is unreachable with the seed** and unverified
  against real data — which is correct, since pink is a bug flag.
- **`/api/week-bands` is derived from the same working set as the records**, so it moves when the seed
  moves. Nothing may assume six bands or that the current week is index 1.
- **`WeekBandDto` carries no record ids and must not gain any.** The moment band membership lives in
  two places, a carry-over can become a copy.
- **The API still locks `Apg.Domain.dll`.** It bit three times in this phase. `dotnet run` instances
  were running from *other tool sessions* on this machine, so killing one is not enough — check with
  `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`. Stopping the `Apg.Api.exe` child is
  sufficient; its `dotnet run` host exits with it. **The Angular dev server holds no lock and can stay
  up.** This is now in CLAUDE.md.
- **`$home` is a read-only variable in PowerShell.** A scratch script using it as a loop variable
  silently produces wrong numbers rather than failing, which cost real time here. Also
  `$x = @(Invoke-RestMethod …)` does not reliably flatten to an array — assign first, then wrap.
- **The repo now has commits** (`da173b8` Phase 0, `0474c2c` Phase 1, `e4de1b4` Phase 2), overturning
  Phase 2's closing note that it had none. Phase 3's work is uncommitted in the working tree.

### New commands, dependencies, conventions

- **New dependency: `@types/node`** (dev only), plus `"node"` added to `tsconfig.spec.json`'s `types`.
  `no-domain-arithmetic.spec.ts` reads source files off disk, the way `DomainPurityTests` scans
  `src/Apg.Domain`. The app's own tsconfig does not include it, so nothing in the bundle can reach
  Node APIs.
- **New endpoint: `GET /api/week-bands`.** Hand-check with
  `(Invoke-RestMethod http://localhost:5286/api/week-bands) | Format-Table -AutoSize`.
- **Run the Angular tests with `npm test` (`ng test`), never `npx vitest run`** — the latter bypasses
  Angular's harness and fails with `describe is not defined`.
- **Conventions now enforced by tests rather than by discipline:** no dates and no quantity arithmetic
  anywhere under `web/src/app/matching/` outside two named files
  (`matching/no-domain-arithmetic.spec.ts`); every dimension in `_card-geometry.scss`.

---

## Interstitial — Real plant names

**Completed:** 2026-08-28
**Status:** Complete
**Not a phase.** A small out-of-band change made between Phase 3 and Phase 3b, recorded here because
it altered seeded data and every later phase will see the difference.

### What changed

Mark added `Data/Plants.csv` with APG's real plant names. `SeedConfig.PlantsByProcessor` previously
held invented ones; it now holds the real list, transcribed:

| Processor | Plants | Count |
| --- | --- | --- |
| ANZCO | Canterbury, Eltham, Kokiri, Manawatu, Marlborough, Rakaia, Rangitikei | 7 |
| Alliance Group | Dannevirke, Levin, Lorneville, Mataura, Nelson, Pukeuri, Smithfield | 7 |
| SFF | Belfast, Finegand, Pacific, Pareora, Waitane | 5 |

### Three reconciliations between the CSV and the codebase

1. **`AGL` → `Alliance Group`.** The CSV uses the company's initials; the spec, the stock-class lists
   and every other part of the seeder use the full name.
2. **"Nelxon" → "Nelson".** A typo in the CSV. Alliance's plant is Nelson. Corrected in
   `SeedConfig.cs` and flagged to Mark, who can revert it in one word if the misspelling is wanted.
3. **The CSV is not read at runtime.** The list is transcribed into `SeedConfig.cs`, which the roadmap
   designates as the single home for these lists. Reading it would mean handling a UTF-8 BOM (the
   file starts `EF BB BF`, so the first record parses as `﻿AGL`), a missing header row, and a
   filename cased `Plants.csv` where `locations.csv` is lower — three failure modes for nineteen
   static rows. `Data/Plants.csv` remains the source of record; if APG revise it, edit there and
   re-transcribe. The doc comment on `PlantsByProcessor` says so.

### Why this did not go through a phase

It is the one-file swap `SeedConfig.cs` was built for. Folding it into Phase 4 would have mixed seed
data into a filter-logic diff and made that phase's review reason about both; putting it in Phase 3b
would have muddied a remediation phase. It is small, independent of both, and better done before
either — Phase 4 filters by plant, and 3b's screenshots are worth taking against real names.

### Effect on the seed

**The shape is unchanged.** Plant selection is a single PRNG draw indexed into the array, so a longer
array consumes the same number of draws and every downstream value stays aligned. Only the `Plant`
field on Processor Space records differs. Confirmed by the suite: the determinism test, the golden
mulberry32 values and `The_generated_counts_are_the_ones_the_build_log_records` all still pass, so
Phase 0's recorded counts remain true.

### Tests

- `Every_processor_has_three_to_five_plants_and_at_least_fifteen_carriers_exist` **failed** on the new
  data — the 3-to-5 bound described the invented list. Renamed to
  `Every_processor_has_plants_and_at_least_fifteen_carriers_exist` and the bound widened to 3–10, with
  a comment saying why.
- Added `The_plants_are_the_real_ones_from_the_data_folder`, asserting all three lists exactly. If
  APG revise `Plants.csv`, this test is what fails and points at the transcription.
- `dotnet test`: **198 passing** (122 domain, 76 API), none skipped.

### Watch out for

- **`src/Apg.Api/apg.db` was deleted** so the next API start reseeds with the real names. Anyone
  holding a database from before this change still has the invented plants; delete the file or
  `POST /api/dev/reset-database`.
- **`DtoProjectionTests` uses the literals `"Rangitikei"` and `"Finegand"`** in its fixtures. Both
  happen to be real plants, and both are hand-built fixture strings rather than reads from
  `SeedConfig`, so they were left alone — but they are not guaranteed to stay valid if APG revise the
  list.
- **The API locks `Apg.Domain.dll` while running**, so `dotnet test` fails with MSB3027 until it is
  stopped. It had to be stopped to verify this change; restart with `.\dev.ps1`.
- **`Documents/build-plan.html`'s domain diagram said "ANZCO · Pareora".** Pareora is an **SFF** plant,
  not ANZCO — the invented data had hidden the error. Corrected to ANZCO · Rangitikei. Worth a general
  caution: examples written against invented plants may be wrong now, and a wrong plant in front of
  APG is more noticeable than an invented one.

---

## Phase 3b — Remove Carry-Over, Build the Backlog

**Completed:** 2026-08-28
**Status:** Complete

### What this entry overturns

**This entry overturns Phase 3's decisions 1, 3, 4 and 5, and the `$lms-carry-name` token from its
decision 11.** Specifically:

- **Decision 1's last sentence** — "One band list serves both columns, so a week that is empty on one
  side still renders there and the two sides stay vertically comparable." Gone. The server still
  returns one ordered, gapless calendar, but **each column now trims its own leading empty bands** and
  the two columns therefore often start at different weeks. The rest of decision 1 — that
  `GET /api/week-bands` exists, is server-computed, is gapless, always includes the current week, and
  carries no record ids — stands unchanged.
- **Decision 3** (`CARRY_OVER_HORIZON_WEEKS = 4`, `CARRY_OVER_EXPAND_LIMIT = 4`) — both constants and
  the file holding them are deleted.
- **Decision 4** (the three bounds on carry-over placement) — the placement function is deleted.
- **Decision 5** (`carryOver` holds the same object references as the home band) — `BandView.carryOver`
  no longer exists, so there is nothing to hold references to.
- **Decision 11's `$lms-carry-name` (`#4A4A4A`)** — deleted from `_lms-tokens.scss`, SCSS variable and
  custom property both. The rest of decision 11 (`density: -2`, the 4px dialog radius, the §2 palette)
  stands.

Decisions 2, 6, 7, 8, 9 and 10 survive, two of them in altered form: **decision 6**'s expansion key
loses its band component (below), and **decision 9**'s "band meta counts native records only" is now
vacuous — every record is native, so there is nothing to exclude.

The cause is **resolved question 17** (2026-08-28), which replaced carry-over cards with a burn-down
backlog after Phase 3 had been built, reviewed and logged. Phase 3 was not wrong; the design it
implemented was superseded.

### What shipped

Carry-over is gone from the repository: `board/carry-over.ts`, `card/carry-over-card.*`,
`BandView.carryOver`, the band's carry-over group and its "New this week" divider, the group-collapse
state, the `$lms-carry-name` token, four geometry variables and every associated test. Every record is
now drawn **exactly once**, in the band of its own date.

In its place, `buildBoard` returns **two trimmed band runs instead of one shared list** —
`{ demand, supply, unplaced }` — each starting at the week of that column's own earliest record. What
sits above the current week is the backlog, found by scrolling up; both columns open at the top,
which needs no code because nothing ever scrolled them.

### How the per-column trim works, and where it lives

All of it is in `web/src/app/matching/board/matching-board.ts`, in one 20-line `trim()` function.
`buildBoard` still places records into a single array of `BandView`s, then returns two **slices of
that same array**:

```ts
return {
  demand: trim(view, weeks, (band) => band.spaces.length > 0),
  supply: trim(view, weeks, (band) => band.availability.length > 0),
  unplaced,
};
```

Consequences worth knowing:

- **Both columns hold the same `BandView` objects.** The trim is `Array.prototype.slice`, not a
  rebuild, so nothing can drift between the two columns and the cost is one index scan per side. A
  spec asserts `Object.is(board.demand[0], board.supply[0])` when both start at the same week.
- **`start` is `bands.findIndex(hasRecordsForThisSide)`.** Only the *leading* run goes. An interior
  empty week keeps its header, and trailing empty weeks are untouched — both have their own tests.
- **A column with no records at all starts at the current week.** This case is not in the phase
  document and is a decision made during the build (see below).
- **Nothing is cached.** `buildBoard` is called inside a `computed` on the screen; Phase 4 filters the
  input lists and calls it again, and the first band moves forward on its own.
- **No date arithmetic.** Trimming is an index into an array the server ordered. `no-domain-arithmetic.spec.ts`
  still passes unchanged, and its allow-list is still exactly two files.

`matching-screen.html` binds `[bands]="board().demand"` and `[bands]="board().supply"`.
`MatchingColumn` is unchanged: its `shown` count sums the bands it was handed, and a trimmed band held
none of that side's records by definition.

### Which week each column starts at, against the current seed

Measured against the running API on 2026-08-28 (current week Sunday **2026-08-23**, bands 16-08
through 20-09):

| | Records | Weeks they fall in | Column starts at |
| --- | --- | --- | --- |
| Processor Spaces | 40 | 16-08: 7 · 23-08: 7 · 30-08: 7 · 06-09: 7 · 13-09: 6 · 20-09: 6 | **2026-08-16** |
| Livestock Availability | 50 | 16-08: 9 · 23-08: 9 · 30-08: 8 · 06-09: 8 · 13-09: 8 · 20-09: 8 | **2026-08-16** |

**Say this plainly: against the current seed the trim removes nothing.** Both sides have records in
the earliest band, so both columns start there, and the screen looks the same as it would without the
trim. That stays true under Phase 4's default filters — all 40 spaces are `Booked`, and 44 of the 50
availability records are `Booked`/`Pending` with `unmatched > 0`, the earliest of them still in week
16-08. The trim earns its place the moment a filter, an edit or a reseed empties a leading week on one
side only, and its correctness is carried by the specs rather than by the seeded screen. **Do not
conclude from the demo that it does nothing.**

For scale: Phase 3 drew **114 carry-over instances** against this seed. It now draws none.

### Decisions made during the build

1. **No filtering in this phase, confirmed with Mark before building.** PHASE-3B's "Out of scope"
   says filters are Phase 4; the rewritten PHASE-3 §4.1 says this phase "applies the same defaults as
   its starting state". They conflict. 3b's own scope statement won. **Consequence: the region above
   the current week is not yet a true backlog** — it still shows Confirmed and fully-allocated
   records, because nothing is filtered out. Phase 4 completes the picture, and until it does, the
   backlog is structurally right and semantically incomplete.
2. **Expansion is keyed `side:recordId`, not `side:recordId@bandWeek`, and `bandWeek` is off both
   card components.** Also confirmed with Mark. Phase 3's decision 6 keyed the band in so a repeat
   could expand independently of its home card; with each record drawn once, the band component could
   never vary. **This changes two component signatures Phase 3's build log advertised** —
   `<app-space-card space zebra>` and `<app-availability-card record zebra>` — and
   `CardStateStore.isExpanded/toggleExpanded` now take two arguments.
3. **A column with no records at all starts at the current week**, rather than rendering no bands.
   The phase document does not cover the case. Rendering nothing would give a blank column, which
   `design-system.md` §13 forbids; starting at the current week shows where "now" is and the
   empty-band rows say each week is empty. The proper "Empty column" state (a glyph, a sentence, a
   way out) is §13's and belongs to Phase 4/8.
4. **`NzTime.WeeksFrom` stays.** Requirement 1.8 said to delete it *if genuinely nothing calls it* —
   `MatchingProjection.WeekBands` still does, and requirement 2.4 keeps the server as the source of
   the calendar. It is not dead. Its tests are untouched.
5. **`LivestockAvailabilityDto.AvailableFromShortLabel` stays on the contract and is now unused by the
   client** — requirement 1.8 said to keep it. It fed the removed row's "since 17 Aug". Both the C#
   and TypeScript declarations now say plainly that nothing renders it and why it is kept, so a later
   phase does not delete it as dead or assume something displays it. `NzTime.ShortDateLabel` is still
   used, for the band header's `Week of 16 Aug`.
6. **`SeedDataGenerator.CarryOverAvailabilityCount` → `BacklogAvailabilityCount`** (requirement 1.9).
   Value 5, behaviour identical: the five earliest availability records are still locked out of
   matching, and they are what puts unmatched supply above the current week. Two call sites updated.
   **The generated data is unchanged** — `SeedDeterminismTests`, the golden mulberry32 values and
   `The_generated_counts_are_the_ones_the_build_log_records` all pass, so Phase 0's recorded counts
   stay true.
7. **No file, symbol, token, style or test in the repository refers to carry-over any more**, and
   that was taken literally: even the explanatory comments that would naturally have said "this fed
   the carry-over row" are phrased without the term. The two deliberate exceptions are prose, not
   code — `design-system.md` §9's stale-canvas note and `CLAUDE.md`'s one-line statement of what 3b
   did — plus this log and the phase documents, which are history.

### Deviations from the phase document

- **Requirement 3 (open at the top) needed no code.** `.list` is the scroll container, content renders
  from the top, and nothing in `web/` calls `scrollIntoView`, assigns `scrollTop`, or jumps to the
  current week. With the leading trim there is no dead space above the first record. Verified by
  inspection rather than by a test: jsdom has no layout engine, so a `scrollTop === 0` assertion would
  prove nothing.
- **One thing was fixed beyond the letter of the phase document:** `design-system.md` §12.2 listed an
  `Available-from week (W.C.)` filter for the supply column, which resolved question 17 explicitly
  forbids. Left alone it would have been a trap for Phase 4. Removed, with the reason stated inline.
- Everything else in sections 1 to 4 was built as specified.

### Review findings

A sonnet subagent reviewed the phase against `PHASE-3B-remove-carry-over.md`, the roadmap and the
diff (with the concurrent plant-names change excluded, so it reviewed this phase only). It reported
rather than applied, and it ran the four commands itself rather than trusting my word for them.

**No confirmed bugs.** Its verdict on the two things the phase turned on:

- **The removal is complete.** It grepped the repository for `carry`, `Carry`, `CARRY_OVER`,
  `New this week`, `4A4A4A` and `bandWeek` and found no true hits — every surviving match of "carry"
  is ordinary prose ("carrying a date"). It confirmed the four files are deleted rather than emptied,
  that no `xit`, `xdescribe` or `.skip` exists anywhere under `web/src/app/matching`, and that the
  carry-over tests were deleted outright rather than disabled.
- **The trim is correct.** Per column, from that column's own records, via one shared helper taking a
  predicate rather than two copies. `findIndex` stops at the first populated band, so only the leading
  run goes and an interior gap survives; `slice` means both columns hold the same band objects; and it
  verified `board` is an Angular `computed()` rather than anything memoised, so Phase 4's
  filter-and-rebuild will re-trim.
- **Asked explicitly whether anything in `web/` now constructs or parses a `Date`: nothing does.** It
  checked that `no-domain-arithmetic.spec.ts` still genuinely walks both `.ts` and `.html`, that its
  two self-tests still fire, and that its allow-list is still exactly two files and honestly described.

Two items raised, both uncertain rather than defects, and their disposition:

1. **No test for both columns being empty at once** — **fixed.** A one-line case; the code path is the
   same as the single-empty-column case that was already covered, but it costs nothing to pin.
   `falls back to the current week for both columns when there is nothing at all`.
2. **No Phase 3b build-log entry yet** — sequencing, not a gap. The reviewer runs at step 1 of the
   roadmap's closing protocol and this entry is step 2. It is this.

The reviewer also listed four things it correctly identified as later phases' work — the `Filtered`
chip and `Reset`, the demand-only week filter, sort and flip (Phase 4); drag and drop, and watching a
record fall out of the backlog as it is matched (Phase 5); and `showing n of n` staying tautological
until Phase 4 supplies a real `total`. None of them were touched.

### Watch out for

- **The trim is invisible against the current seed** (see the table above). Do not read "nothing
  changed on screen" as "the trim does not work" — nine specs say otherwise, and Phase 4's filters are
  what will make it bite.
- **The backlog is structurally complete and semantically incomplete until Phase 4.** Everything above
  the current week is currently *every* record from those weeks, not just unfinished business,
  because nothing is filtered. The roadmap's claim that "what remains above the current week is
  therefore a backlog" becomes true when the default filters arrive, not before.
- **Two component signatures changed** from what Phase 3's build log advertises:
  `<app-space-card space zebra>` and `<app-availability-card record zebra>` — `bandWeek` is gone —
  and `CardStateStore.isExpanded/toggleExpanded(side, recordId)` now take two arguments.
- **`buildBoard` no longer returns `bands`.** It returns `{ demand, supply, unplaced }`. Phase 4 must
  filter the *inputs* and call it again, exactly as before; what it must not do is reach into one
  column's slice and expect the other's weeks to line up.
- **The two rails legitimately disagree.** At the same vertical position the demand column may show
  `Week of 16 Aug` and the supply column `Week of 30 Aug`. That is the design (requirement 2.3).
  **Do not add scroll synchronisation** to "fix" it: locking two lists of different lengths together
  makes one of them lie about which week the operator is in.
- **The empty-column fallback is not the empty-column *state*.** A column with no records renders
  bands from the current week with `- no processor spaces this week` in each. The proper empty state
  `design-system.md` §13 specifies — a glyph, a sentence, a way out — does not exist yet and belongs
  to Phase 4's filtered-empty case and Phase 8's polish.
- **`design-system.md` §9 is now a different section under the same number.** Anything citing "§9" from
  Phase 2 or Phase 3 means the carry-over section, which is gone; §9 is now the backlog, the trim and
  the past-band treatment. The Phase 2 canvas artifact was **not** regenerated and still shows
  carry-over rows on its `CarryOver`, `WeekBands` and `Main` artboards — the document says so at the
  top of §9, and the document wins.
- **On-screen verification was not done in this phase.** The Angular build and 42 specs pass, but no
  browser was driven: card density, the sticky rail and the trimmed columns side by side have still
  not been eyeballed at 1366 × 768. Phase 3's log flagged the same gap; it is still open, and it is
  worth ten minutes before Phase 4 builds on top of the layout.
- **An `Apg.Api` instance belonging to another session was running when this phase started.** It was
  stopped to build (it holds `Apg.Domain.dll` open) and restarted afterwards. Unchanged advice:
  `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`, stop the `Apg.Api.exe` child.
- **A concurrent, unrelated change was in the working tree throughout this phase** — the real plant
  names recorded in the Interstitial entry above, touching `SeedConfig.cs` and
  `SeedConfigurationTests.cs`. Phase 3b did not make, review or test those two files, and they were
  excluded from the diff the reviewer read. If the two changes need separating, that is the seam.

### New commands, dependencies, conventions

No new packages, no new commands, no change to CLAUDE.md's command table. Three conventions worth
carrying forward:

- **`buildBoard` is still the only seam.** Filter its inputs; never filter inside it, and never reach
  into a `BandView`. The band meta *and* the per-column trim both reshape for free.
- **Trimming is an index, never a date.** If a future phase needs a week the client cannot name, the
  answer is another field on `WeekBandDto`, not `new Date`.
- **The word "carry-over" is now absent from all code, styles, tests and `design-system.md`** (bar its
  one stale-canvas note). It survives in this log and in the phase documents, which are history. If it
  reappears in a component, something has gone backwards.

Test counts at close: `Apg.Domain.Tests` 122, `Apg.Api.Tests` 76, Angular 42 across 5 files.

---

## Phase 4 — Filter, Sort & Flip

**Completed:** 2026-08-31
**Status:** Complete

### What shipped

The matching screen filters and sorts. Each column has its own 40px filter row — Status and Stock
class as chips that show their current value, everything else behind a `More` chip — plus a
right-aligned sort control, a `Filtered` badge and `Reset` in its header when it is away from
default, and a no-results state that restates the filters hiding the records. The columns swap on a
flip button, and every choice persists to `localStorage`. Both columns open in the spec's default
filters, so what sits above the current week is now a genuine backlog rather than a history — the
thing Phase 3b built the structure for and could not complete.

Nothing changes data and no new endpoint exists: filtering and sorting run over the working set the
three read endpoints already returned.

Later phases can rely on: `filters/filter-defaults.ts` as the one home of every default,
`MatchingPreferences` as the root store for view preferences, and `filters/filter-service.ts` as
pure, testable filter and sort functions over DTO lists.

### Where the state lives, and what persists

| Thing | Where |
| --- | --- |
| Filter and sort types, and **every default** | `web/src/app/matching/filters/filter-defaults.ts` |
| Pure filtering, sorting, away-from-default, the empty state's summary | `filters/filter-service.ts` |
| Option lists, derived from the working set, with processor narrowing | `filters/filter-options.ts` |
| The signal store, and all persistence | `filters/matching-preferences.ts` (root-provided) |
| The 40px filter row | `filters/column-filters.ts` |
| The no-results state | `filters/filtered-empty.ts` |
| Which cards are expanded | still `board/card-state.ts`, still session-only |

**One `localStorage` key: `apg.matching.preferences.v1`.** It holds
`{ version: 1, flipped, demand: { filters, sort }, supply: { filters, sort } }` — one key so a
partial write cannot leave two halves disagreeing, and versioned so a shape change is a fallback
rather than a crash. Reading is defensive **field by field**: a value outside a known set (a status,
a transaction type, a sort field) is dropped and that field falls back to its default, while a
free-text selection with no known set (stock class, processor, plant) is *kept* even when the loaded
data no longer contains it — a stale value filters nothing in, the empty state names it, and
silently discarding a selection the operator made is the worse failure. Malformed JSON, an unknown
version, or storage being unavailable all fall back to the defaults without throwing.

Card expansion deliberately did **not** move into this store. A filter still applied tomorrow is a
convenience; a card still expanded tomorrow is a small mystery.

### Decisions made during the build

1. **The defaults and the reset are the same objects, not the same values.** `resetDemand()` and
   `resetSupply()` assign the exported constants themselves, and `filter-defaults.spec.ts` asserts
   the opening state with `toBe` (identity) rather than `toEqual`. A test that restated
   `['Booked']` would simply have been a second copy of the defaults, which is the thing the
   acceptance criterion is guarding against. There is also a key-enumeration test, so a filter field
   added without a default fails there rather than silently arriving as `undefined`.

2. **No shared search strip, and its 52px reclaimed** — decided with Mark mid-plan.
   `design-system.md` §12.1 specified a full-width LMS-style search field over both columns. It was
   not in PHASE-4's numbered requirements, the per-column filters cover everything it would have
   searched, and it would have been the one control filtering *both* columns at once — the ambiguity
   §12.2 avoids by giving each column its own controls — which would also have muddied per-column
   `Reset`, since a column cannot reset a field it does not own. Checked before deciding: **no later
   phase needs it.** Every other "search" in Phases 5–8 is a type-ahead picker inside a dialog or
   form (transport company in 5 and 6, location in 7), and Phase 8's "Reset demo data" button is the
   only unhoused screen-level control, needing ~28px rather than a 52px band.

   Rather than leave a permanently empty band with no owner, the strip was removed and **the list
   grew from 544px to 596px — 9 to 11 cards per column instead of 8 to 10**, which is the figure
   §8.3 exists to protect. Four sections of `design-system.md` were edited to match (below).

3. **Requirement 2.3's "searchable" location filter is a type-ahead inside the control**, not a
   search of the cards. Mark clarified this and had PHASE-4 §2.3 rewritten to say so while this
   phase was being planned. It narrows the ~300 location *options* so one can be picked; the cards
   are never searched by text anywhere on this screen. The menu shows the first 60 matches and says
   how many more there are, so a capped list never pretends to be the whole list.

4. **No "ungrouped" global sort mode.** Requirement 4.3 permits offering one; it was considered and
   declined. The chronological band order is the spine of the screen, and the backlog above the
   current week only means anything while the bands are intact. **Sorting is applied to the flat
   lists before `buildBoard` bands them**, and `buildBoard` preserves the order it is handed inside
   each band — so a sort reorders cards *within* each week by construction and cannot dissolve a
   band even by accident. No change to `matching-board.ts` was needed.

5. **The default demand sort is delivery date then id, not "then delivery time"** (requirement 4.2's
   literal wording). `deliveryTime` is free text — `AM kill`, `Yard by 6:30am`, `Before midday` — so
   an alphabetical secondary sort is not chronological: it would put the 6:30am delivery last and
   read as a bug. Phase 3's log already ruled this out and named the remedy (a sortable time field,
   which is a data change this phase may not make). Delivery time **is** offered as a sort field,
   because 4.1 asks for every displayed field; its ordering is alphabetical.

6. **Filter options are derived from the loaded working set, not from a vocabulary endpoint.**
   Requirements 1.2 and 1.4 want the demand stock classes and plants to narrow to the chosen
   processor, and that falls straight out of the records, which carry all three fields. It keeps
   this phase entirely client-side, and no option is ever offered that would match nothing. The one
   deliberate exception is status: `DEMAND_STATUSES` and `SUPPLY_STATUSES` are the type's members
   rather than the data's, because ticking `Cancelled` and seeing nothing teaches more than a menu
   that quietly omits it.

7. **Changing the processor selection prunes plants and stock classes it has just taken off the
   menu** (`narrowDemandFilters`). Choosing `ANZCO` while `Lorneville` is still selected would
   otherwise leave two filters that cannot both be satisfied, and the column would empty for a
   reason no visible control is showing. An empty column with a visible cause is fine; one whose
   cause has been hidden by another control is the misleading view this phase's review focus names.

8. **The `More` chip opens a menu with a submenu per field, not an inline second row.** §12.2
   describes "a second row of `appearance="fill"` selects"; a second row costs 40px of a 596px list —
   a card per column — and a `mat-select` opened inside a `mat-menu` is an overlay inside an
   overlay. So every control in the row is the same shape: a chip that shows its value with a menu
   behind it. `design-system.md` §12.2 now records this.

9. **The `More` count is "filters currently restricting the list", not "filters away from default".**
   The supply column therefore opens reading `More (1)`, because `Unmatched > 0` is on and genuinely
   hides records. §12.2 wants the defaults visible on the chip faces precisely so nobody concludes a
   record has vanished.

10. **`Clear filters` and `Reset to default` are different buttons doing different things**, both on
    the empty state as §13 asks. Clearing shows *everything* loaded, including the Confirmed and
    Cancelled records the default hides; resetting returns the column to how it opened. Someone who
    has filtered themselves into an empty column usually wants to see what is actually there.

11. **The flip is CSS `order` on the two column hosts**, not a template swap. Neither column
    component is ever destroyed, so filters, sort, expanded cards and scroll position cannot be lost
    across it — requirement 5.2 is satisfied by construction rather than by copying state around.
    **Phase 7's `+ Add` buttons will follow the columns for free**, because they belong in the column
    header (design-system.md §14) and the header moves with its column.

12. **Away-from-default compares selections as sets.** Ticking `Pending` then `Booked` leaves the
    supply default in a different order, and an operator who has arrived back at the defaults by hand
    is at the defaults — the `Filtered` chip must not claim otherwise.

13. **Comparators use `<` and `>`, never `a - b`.** Subtracting two quantity fields is arithmetic on
    a domain value and `no-domain-arithmetic.spec.ts` fails it, correctly. Date sorts compare the ISO
    `yyyy-MM-dd` strings, which sort chronologically as text. **The allow-list is still exactly two
    files** and no third arithmetic site was needed.

### How the leading-band trim recomputes (the phase document asks for this by name)

It is not recomputed by anything in this phase — and that is the point. `matching-screen.ts` filters
and sorts the two lists in `computed()`s and hands the results to `buildBoard`, which is where Phase
3b put the per-column trim:

```ts
readonly visibleSpaces = computed(() => sortSpaces(filterSpaces(this.spaces(), …), …));
readonly board = computed(() => buildBoard(this.weeks(), this.visibleSpaces(), …));
```

`buildBoard` starts each column at `findIndex` of the first band holding **that column's own**
surviving records, so filtering out the oldest space moves the demand column's first band forward
and leaves the supply column exactly where it was. Nothing is cached and nothing is memoised beyond
Angular's own `computed`. `matching-screen.spec.ts`'s
`re-trims a column leading bands when a filter removes its oldest record` asserts both halves of
that: the moved column and the unmoved one.

**Filter `buildBoard`'s inputs; never filter inside it, and never reach into a `BandView`.** The band
meta totals and the trim then both reshape for free.

### Deviations from the phase document

- **No shared search strip** (decision 2) — it was `design-system.md`'s, not the phase document's.
- **The default demand sort ignores delivery time** (decision 5), with the reason and the remedy.
- **No "ungrouped" sort mode** (decision 4), which 4.3 permits rather than requires.
- **`More` is a menu, not an inline second row** (decision 8).
- Everything in sections 1 to 7 was built. Section 3 (no supply week filter) is enforced three ways:
  the type has no such field, a test fails if any key of `DEFAULT_SUPPLY_FILTERS` matches
  `/week|available.?by/i`, and `column-filters.spec.ts` opens the supply column's `More` menu and
  asserts nothing in it mentions a week. The W.C. value still renders on both sides.

### `design-system.md` edits, and why a phase edited Phase 2's document

Phase 3b set the precedent: it deleted §12.2's supply week filter because "left alone it would have
been a trap for Phase 4". The same reasoning applies to a search strip that will now never be built.

- **§12.1** — rewritten as "not built, and not to be reinstated casually", with the three reasons and
  the note that requirement 2.3's type-ahead is a different thing entirely.
- **§8.1** — the 52px row struck from the content-area table.
- **§8.3** — the density arithmetic restated at **596px**, and the cards-per-column table moved to
  **9–11** (from 8–10).
- **§12.2** — `More` as built, and the `More (n)` count explained.
- **§16a.2** — the filter-chrome divergence from LMS restated: 40px per column and nothing else.
- Two stray "544px list" references elsewhere updated to 596px.

### Review findings

A sonnet subagent reviewed against the phase document, the roadmap, `design-system.md` and the diff,
and ran all four commands itself rather than trusting my word. **No confirmed correctness bugs.** It
verified independently that the reset assigns the constants themselves, that the trim is per column
and uncached, that resolved question 17 is enforced at three levels, that no third arithmetic site
was added, and that the flip cannot lose state. Three findings, all fixed:

1. **The "no week filter on supply" test did not test that** (the most valuable finding). It asserted
   only that both columns render a filter component and that the string `Week of` appears somewhere
   on the page — it never opened the supply column's `More` menu, so a week item added there later
   would have passed. **Fixed**, and properly: a new `filters/column-filters.spec.ts` mounts the row
   for each side, opens the real `mat-menu` overlay and reads it, asserting the demand side offers
   `Delivery week` and that nothing in the supply side's menu matches `/week/i` or `/available.?by/i`.
   The positive assertions in the same test are what stop the negative one passing vacuously on an
   empty panel. That file also covers the chip faces, the type-ahead and the processor narrowing
   through the control rather than the helper.
2. **The transaction-type list was hand-typed in `matching-preferences.ts`** for storage validation,
   unlike the statuses, which are exported constants. A member added to `TransactionType` later would
   have been silently rejected on read with no compiler complaint. **Fixed:** `TRANSACTION_TYPES` now
   lives in `filter-defaults.ts` with the other closed sets.
3. **`visibleLocations` and `hiddenLocationCount` each recomputed the same match** independently.
   **Fixed:** one private `matchingLocations` computed feeds both.

The reviewer also noted, correctly, that on-screen verification at 1366×768 still had not been done —
see below.

### Watch out for

- **On-screen density is still unverified, and this phase changed it.** Removing the search strip
  should give 9–11 cards per column instead of 8–10, but jsdom has no layout engine and no browser
  was driven from this session: there is no browser-automation tool available here. **The API (5286)
  and the Angular dev server (4200) were left running deliberately so this can be eyeballed.**
  Phases 3 and 3b left the same gap; it is now three phases old and worth ten minutes.
- **The two columns legitimately show different weeks at the same height**, and filtering makes it
  happen far more often than before, because each column re-trims to its own surviving records. That
  is the design (Phase 3b, requirement 2.3). **Do not add scroll synchronisation.**
- **`showing n of m` counts records, and `m` is the whole loaded set for that side**, not the number
  in view. Against the current seed the demand column opens `showing 40 of 40` (all 40 spaces are
  `Booked`) and supply opens `showing 44 of 50` — which is exactly design-system.md §12.3's own
  example, by coincidence rather than by design.
- **A column with nothing loaded at all still renders empty week bands**, not §13's "Empty column"
  state. Only the *filtered* empty case was built, because 7.3 asks for that one and §13 pairs the
  other with Phase 7's `+ Add a record` button. Phase 7 or 8 owns the rest.
- **Menus, not selects.** Every filter control is a chip plus a `mat-menu`, and multi-select items
  call `$event.stopPropagation()` so the menu survives a tick. If a later phase adds a `mat-select`
  inside one of these menus it will be an overlay inside an overlay; prefer another submenu.
- **The location menu is capped at 60 matches** (`LOCATION_MENU_LIMIT`) with a line saying how many
  more match. With ~300 locations in the seed, an unfiltered open shows 60 of them.
- **Prettier is not clean across the repo.** Running `npx prettier --write` over
  `src/app/matching/**` reformats several Phase 3 files this phase did not touch (and rewrites CRLF
  to LF); those were reverted so the diff stays honest. Format the files you actually change.
- **`@angular/animations` is not installed** — Angular 22 makes it optional. `provideNoopAnimations`
  fails at import in a spec; Material's menus open in jsdom without it.
- **The API still locks `Apg.Domain.dll` while it runs.** It bit again here. Unchanged advice:
  `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`, stop the `Apg.Api.exe` child.
- **`Documents/Phases/PHASE-4-filter-sort-flip.md` was modified in the working tree by another
  session while this phase ran** — the §2.3 rewrite recorded in decision 3. That change is not this
  phase's, but it is in the same uncommitted diff.
- **Phase 3b's work and this phase's are both uncommitted** at the time of writing; the last commit
  is `704876c Phase 3b`. (Phase 3b's own log says its work was uncommitted too, so that commit
  presumably arrived afterwards.)

### New commands, dependencies, conventions

No new packages and no changes to CLAUDE.md's command table.

- One spec: `npx ng test --watch=false --include=src/app/matching/filters/column-filters.spec.ts`
- **Conventions now enforced by tests rather than by discipline:** the defaults and the reset cannot
  drift (`filter-defaults.spec.ts`); the supply column can gain no week filter, in the model or in
  the rendered control (`filter-defaults.spec.ts`, `column-filters.spec.ts`); sorting cannot dissolve
  a band (`filter-service.spec.ts`); the trim moves with the filters, per column
  (`matching-screen.spec.ts`).
- **Filter `buildBoard`'s inputs. Never filter inside it, never reach into a `BandView`.**

Test counts at close: `Apg.Domain.Tests` 122, `Apg.Api.Tests` 76, Angular **104 across 9 files**
(42 across 5 at the end of Phase 3b).

---

## Phase 4 addendum — trailing trim, one phrase, one more chip

**Completed:** 2026-08-31
**Status:** Complete
**Not a new phase.** Three corrections to Phase 4, made after looking at the finished screen. The
Phase 4 entry above stands; these three points amend it.

### What changed, and what it overturns

**1. Both ends of each column are now trimmed, not just the leading run.**

A column spans exactly the weeks its own surviving records occupy: from the week of its earliest to
the week of its latest. `trim()` in `web/src/app/matching/board/matching-board.ts` already found the
first populated band and now finds the last as well. **Interior empty weeks still render** — a gap in
the calendar is information, and trimming both ends is not the same as dropping every empty band. A
column with no records at all shows the current week alone rather than the current week onward.

**This overturns Phase 3b's requirement 2.6**, which guaranteed the run always reached the current
week so a column whose records were all in the past still showed where "now" is. Filtering the demand
column to one delivery week made the cost obvious: a stack of empty headers below the only band
holding anything, which reads as missing data rather than as a calendar. What 2.6 was protecting is
still carried — every past band has a grey `Past` tag on its rail and no future band does, so "am I
looking at old stock" never depended on the current week being on screen. Decided with Mark, who was
shown the trade-off first. `design-system.md` §9.3's rule table now says so.

`Array.prototype.findLastIndex` is ES2023 and this tsconfig does not assume that lib, so the search
is a reverse loop.

**2. Both columns say `Has unmatched quantity`, and the field is `hasUnmatched` on both.**

They were `Has unmatched quantity` on demand and `Unmatched quantity more than zero` on supply, which
was nothing better than transcribing each requirement's own words (1.6 and 2.5). It is the same rule —
`unmatched > 0` — so it now has one wording, one field name and one handler; only the default differs,
off on demand and **on** on supply. `SupplyFilters.unmatchedOnly` is gone.

**The `localStorage` key is now `apg.matching.preferences.v2`.** The per-field fallback would have
silently turned a deliberately-disabled filter back on when the old field name stopped being read;
bumping the version drops the stale object once, visibly, instead. Anyone who had filters set will
find them back at the defaults after this change, once.

**3. A third chip per column: `Processor` on demand, `Location` on supply.**

The row was sized for the narrowest case and had room to spare. Measured against ~566px of column at
1366×768, three chips plus `More` plus the sort control lands near 546px; a fourth would start
ellipsing the values the chips exist to show.

**The promoted control leaves `More`**, so every filter has exactly one home and `More (n)` keeps
meaning "n filters active in here" — `demandMoreCount` no longer counts processors and
`supplyMoreCount` no longer counts locations. `More` now holds demand
`Plant · Delivery week (W.C.) · Has unmatched quantity` and supply
`Transaction type · Has unmatched quantity`.

### Tests

Six existing tests encoded the old behaviour and were changed rather than added to:
`leaves trailing empty weeks alone` became `drops trailing empty weeks`;
`runs through the current week when every record is in the past` became
`ends at the last populated week even when that is in the past`; the two empty-column cases now expect
one band; `trims the leading empty weeks and keeps the later ones` became
`shows only the weeks its own records occupy`; and two band-list expectations lost a trailing week.
Added: `trims each end of each column separately`, `puts the who filter on the row rather than inside
More`, and `words the unmatched filter identically on both sides`.

Angular is **107 tests across 9 files**, up from 104.

### Watch out for

- **A column can now end before the current week.** If every surviving record in a column is in the
  past, the `This week` band is not drawn at all. That is intended. The `Past` tag is what tells the
  operator which side of today they are on.
- **`More (n)` counts only what is inside `More`.** If a later phase promotes another filter to a
  chip, it has to come out of the count too, or the chip will claim a filter is hidden while it is in
  plain sight.
- **The supply row is the tighter of the two** — `Status: 2 selected` plus `Location: <a long farm
  name>` is the worst case. Chips are `flex: 0 1 auto` with ellipsis so they shrink rather than
  overflow, but if it reads badly the fix is shorter chip labels, not a second row.

---

## Interstitial — Seed variability: processor mix, space statuses, `Lamb`

**Completed:** 2026-08-31
**Status:** Complete
**Not a phase.** A data change made after Phase 4 closed, recorded separately for the same reason the
real-plant-names change was: Phase 4 was explicitly barred from changing data, and a seed change
mixed into a filter diff would make both harder to review.

### The bug this started from

**Every week in the seed held exactly one processor** — 16-08 all ANZCO, 23-08 all Alliance Group,
30-08 all SFF, then repeating. Mark spotted it on screen. The cause was arithmetic, not intent:
`GenerateProcessorSpaces` picked `SeedConfig.Processors[i % 3]` while the week a space lands in came
from `i % WeekCount` with `WeekCount == 6`. Three and six alias exactly, so the processor was a
function of the week and always would be. `design-system.md` §16.6 had noticed the symptom and
recorded it as "an artefact of the seeder"; it was a bug.

It matters beyond looking odd: on a screen where filtering by processor was indistinguishable from
filtering by week, neither filter could be trusted to demonstrate anything.

### What changed

| | Before | After |
| --- | --- | --- |
| Processor mix (40 spaces) | ANZCO 14 · Alliance 13 · SFF 13, one per week | **ANZCO 28 · Alliance 8 · SFF 4** (70/20/10), shuffled |
| Space statuses | 40 Booked | **34 Booked · 4 Confirmed · 2 Cancelled** |
| SFF stock classes | `Lambs`, `Prime`, `Cows` | **`Lamb`**, `Prime`, `Cows` |

- **The mix lives in `SeedConfig.ProcessorMix`** as weights, and `SeedDataGenerator.ProcessorAssignments`
  builds the exact counts from them and shuffles with the shared PRNG. Weights rather than counts so
  the record count can change without re-deriving them; integer division's remainder goes to the
  largest share, so the list is always exactly `ProcessorSpaceCount` long. 70/20/10 is the real-world
  mix APG sees.
- **Statuses are assigned after the matches exist** (`ApplySpaceStatuses`), never before, because both
  rules are the domain's:
  - a space is only made `Confirmed` where `ProcessorSpaceRules.CanConfirm` already says it could be —
    at least one live match, every live match Confirmed. Seeding a Confirmed space with a draft
    outstanding would put a record on screen that contradicts the rule the Confirm button enforces;
  - a `Cancelled` space **keeps its matches**, and the pass deliberately prefers spaces that hold
    **live** ones. Cancelling never cascades (that is the point — it lets APG arrange alternatives
    before notifying anyone), and the seed now shows it rather than leaving Phase 7 to demonstrate it
    from nothing. Both cancelled spaces hold live matches: 7 has two, 16 has one.
  - Spaces locked by the section 4.7 demonstration cases are skipped, so confirming or cancelling one
    cannot quietly retire the case it was built for. `GenerateMatches` now returns a `MatchSet`
    carrying the locked ids alongside the matches, which is the only reason its signature changed.
  - Counts are `ConfirmedSpaceCount = 4` and `CancelledSpaceCount = 2`, named constants beside the
    others. Small on purpose: the matching screen's default filter is `Status = Booked`, and these are
    the records it is meant to hide.
- **`Lambs` → `Lamb`** in SFF's list. `SeedConfig`'s `"Lamb" or "Lambs" => Species.Lamb` and the
  client's `stock-classes.ts` alias both stay, documented as aliases, so a revert is one word.

### What the seed looks like now

Measured against the running API on 2026-08-31 (current week Sunday **2026-08-30**, bands 23-08
through 27-09):

- Spaces per week: 23-08 `ANZCO 7` · 30-08 `ANZCO 6, Alliance 1` · 06-09 `Alliance 4, ANZCO 2, SFF 1` ·
  13-09 `ANZCO 5, Alliance 2` · 20-09 `ANZCO 4, Alliance 1, SFF 1` · 27-09 `ANZCO 4, SFF 2`.
  **The earliest week is still all ANZCO** — that is now chance rather than arithmetic, and with 70% of
  spaces being ANZCO a seven-record week of them is unremarkable.
- Under the default filters the demand column reads **`showing 34 of 40`** and supply
  **`showing 41 of 50`**. Both counts are finally non-tautological.
- Above the current week: 6 Booked spaces and 8 still-matchable availability records. That is the
  backlog, and it is now visibly a backlog rather than a history.
- **The match status split did not move** — still 8 Drafted, 15 Confirmed, 2 Cancelled. The
  demonstration spine is scripted, and the filler pass targets a fixed total, so the split survives a
  different random stream. Phase 0's and Phase 2's counts tables record the old *space* numbers and
  are left alone: they are history, and this entry supersedes them.

### Tests

- `Processor_space_stock_classes_are_exactly_the_specified_per_processor_lists` re-pinned to `Lamb`.
- **New** `The_processor_mix_is_seventy_twenty_ten`, so the mix is a stated intention rather than an
  emergent number.
- `The_generated_counts_are_the_ones_the_build_log_records` gained the **space** status split, derived
  from the constants rather than restated, so changing a constant without changing the log fails here.
- **New** `Every_confirmed_space_is_one_the_domain_agrees_could_be_confirmed` and
  `At_least_one_cancelled_space_still_holds_live_matches` — both asserted through `Apg.Domain` rather
  than through the seeder's own bookkeeping, so the seed and the rules cannot disagree unnoticed.
- `dotnet test`: **122 domain + 79 API**, none skipped. Every section 4.7 demonstration case still
  builds; the seeder throws by name if one cannot, and none did.

### Review findings

A sonnet subagent reviewed the seed diff only (the concurrent client-side change was excluded). It
ran the build and the tests itself, and went further than asked: it hit `POST /api/dev/reset-database`
and re-fetched, confirming **determinism empirically** rather than by reading the code. It walked the
proportion arithmetic by hand for a 41-space count and for weights that do not sum to 100, checked
that the one new dictionary is never iterated (so no ordering can leak into the output), and verified
against the live data that every Confirmed space satisfies `CanConfirm` and that SFF's four spaces
still cover all three of its classes.

**No determinism problems and no silently-dropped demonstration case.** Three findings, all fixed:

1. **The `ProcessorMix` doc comment claimed "no week is ever a single processor", which a shuffle
   cannot promise — and the seed's own earliest week is all ANZCO.** The most valuable finding,
   because it was my sentence and it was wrong in the same file that fixes the bug. What the shuffle
   removes is the *structural* guarantee; at 70% ANZCO a seven-space all-ANZCO week is ordinary. A
   real guarantee would need the assignment to know about the week, which is exactly the coupling
   that caused the original bug. Comment rewritten, and CLAUDE.md's line with it.
2. **The cancelled-space selection ordered on "has any match" rather than "has a **live** match".**
   It worked, but only because the filler pass happens never to produce Cancelled matches — a space
   whose only match was itself cancelled would have demonstrated nothing, and nothing in the code
   would have noticed. Now ordered on `MatchQuantities.IsLive`, with a `Required(...)` that throws if
   no cancelled space holds a live match. The fix changed the data: previously one of the two
   cancelled spaces had no matches at all, and now both carry live ones.
3. **The `Required(...)` checks ran after the mutations**, unlike the rest of the file's fail-before-
   use pattern, so a shortfall would have thrown with half the pass already applied. Both candidate
   lists are now built and checked before anything is written.

### Watch out for

- **The over-filled space is no longer `-305`.** It was Processor Space #1 at 354 matched against 49
  required, which Phase 3's log called out as looking like a seeder artefact. The new stream produces
  one over-filled space with a plausible over-run in the tens. That is better data and a small loss:
  **the seed no longer exercises the four-character numeral** (`-305`) the meter's 40px column was
  widened for. `design-system.md` §4.2 now says so; check that column against a four-character figure
  by hand if it is ever narrowed.
- **`src/Apg.Api/apg.db` was deleted** so the next start reseeds. Anyone holding a database from
  before this change still has the old data — delete the file or `POST /api/dev/reset-database`.
- **Confirmed and Cancelled spaces drop out of the default filter**, which is correct and will look
  like records going missing to anyone who has not read this. The `Filtered` chip and the count say
  so.
- **The seed's *availability* records changed too**, even though nothing about them was edited: the
  processor draw moved the shared PRNG stream, so every downstream value differs. Any note anywhere
  citing an availability record by id and quantity is now stale.
- **`ProcessorAssignments` assumes the weights are a share of `ProcessorSpaceCount`.** They need not
  sum to 100 — the code divides by their total — but a mix that leaves several processors with zero
  spaces would break the stock-class coverage guarantee, and SFF at 4 spaces for 3 classes is already
  the tightest case in the set.

---

## Phase 5 — Drag to Match

**Completed:** 2026-08-31
**Status:** Complete

### What shipped

The matching screen now writes. Dragging a card onto a card in the other column asks
`GET /api/match-proposal`, then either shows exactly `"There is no unmatched quantity"` or opens the
quantity prompt; Create posts a new `Drafted` match and patches both parents by id. Undo is
`DELETE /api/matches/{id}` for Drafted only. Both directions resolve through one function. Same-column
drops are a silent no-op. There is no keyboard drag path (resolved question 14).

Later phases can rely on: `MatchWriter` as the pure write path over a `WorkingSet` + `PriceTable`,
`MatchWriteResultDto` as the patch shape, `DELETE /api/matches/{id}` as the drafted-only delete Phase
6 will reuse, and `matchSummaryLabel` / `matchBreakdown` on the card as the Phase 6 entry point.

### How the drag was wired

This is the thing the phase document asked the log to record.

Each card host is its own `cdkDropList` (sorting disabled, CDK auto-scroll disabled) holding one
`cdkDrag`. The handle is `.cbody`, so the chevron still expands. Both columns sit in one
`cdkDropListGroup` on `matching-screen`. The drop **does not transfer arrays** — it reads `item.data`
and `container.data`, runs them through `pairFromDrop` in `drag/card-drag.ts` (requirement 1.2: one
function, both directions, each record placed by its own side), and hands the pair to `MatchDrop`.

`acceptsFrom(side)` is the enter-predicate: same column returns false, so CDK never marks the list as
receiving, no outline appears, no drop event fires. A target with no unmatched quantity still
accepts — the refusal is the server's, at drop, in the exact words of requirement 3.2. A silent
swallow there would leave the operator with no idea why nothing happened.

`DragStore` (`drag/drag-state.ts`) is the one place the screen agrees on the drag in flight: which
card, whether Escape cancelled it, and each target's `none` / `same` / `valid` / `blocked` look. The
pointer is **not a signal** — a write per frame would change-detect the whole tree for a value only
the auto-scroll loop reads. Escape is ours: CDK has no Escape handling, and `cdkDragEnded` fires
*before* `cdkDropListDropped`, so `end()` must not clear the cancelled flag. The preview lives on
`<body>`; cancelled and preview styles are in `web/src/styles.scss` because no component stylesheet
can reach them.

`MatchDrop` asks the proposal **before** opening anything. A refused pair is a snack and no dialog.
A create publishes `writes$`; `matching-screen.applyWrite` replaces both records by id so filters
re-run — that is what makes a fully consumed availability record leave the default supply view
(`hasUnmatched` / status Booked+Pending). Undo publishes the same shape with `match: null`.

Nothing in `web/` recomputes a default, a ceiling or a refusal. The hover blocked cue is a `< 1`
comparison against the DTO's unmatched figure, the same shape as the supply column's filter.
`no-domain-arithmetic.spec.ts`'s allow-list is still exactly two files.

### Auto-scroll and long week bands

CDK's own auto-scroll is off (`cdkDropListAutoScrollDisabled`). It scrolls the **source** column
when the pointer sits over a band header or an empty-band row in the target — those hosts are not
drop lists, so CDK treats the pointer as still over the list the card left. Across weeks that is the
common case, so it is replaced.

`[columnAutoScroll]` on each `.list` (`drag/column-auto-scroll.ts`) scrolls the column the pointer is
actually over. The zone is **48px**, one number in two places: `$auto-scroll-zone` in
`_card-geometry.scss` draws the veil, `AUTO_SCROLL_ZONE` drives the step. The pointer must be inside
the column horizontally (a drag over one edge never scrolls the other) and may overshoot the list
vertically by one zone (past the last card keeps scrolling) but not further (holding over the column
header does nothing). Step ramps from 2 at the inner boundary to 16 at the edge.

The two columns still scroll independently and their rails still disagree — that is Phase 3b's
design, and drag does not add scroll synchronisation. Auto-scroll is what makes a past-week
availability record reachable without dropping, scrolling, and starting again. It has been unit-
tested through `scrollStep` (jsdom has no layout); the mouse path over real band headers is on the
browser checklist below and was not exercised in this chat.

### How a card advertises that it already carries matches

Phase 6 hangs its entire entry point off this. Do not invent a second one.

Line 2 of both cards shows `matchSummaryLabel` from `card/card-chrome.ts`:

| Matches on the record | Label |
| --- | --- |
| none | `no matches` |
| mixed, including drafts | `2 matches · 1 draft` |
| all confirmed | `1 match · confirmed` |
| notified-only, or mixed without drafts | the count alone |

Drafts are called out because every match this phase creates is a draft, and a card that said only
"2 matches" would look identically settled whether nothing had been committed or everything had.
"confirmed" is stated only when it is true of all of them. The hover `title` is `matchBreakdown`
(`1 drafted · 1 confirmed`), every live status present, in Drafted / Notified / Confirmed order.

**Cancelled matches are neither shown nor counted** (resolved question 4) — they never arrive on the
DTO. The label is **not clickable**. Opening a match is Phase 6; do not add a click handler here
without reading that phase.

### Decisions made during the build

1. **Undo shipped in this phase**, not deferred. Requirement 4.5 said "include undo if it is cheap";
   a mis-drag is the most common mistake this screen will produce, and `DELETE /api/matches/{id}`
   for Drafted only is the same endpoint Phase 6 needs for delete-draft. The snack offers UNDO for
   8 seconds. The delete is 404 if missing, 409 if the match is past Drafted.

2. **No Playwright.** jsdom covers `pairFromDrop`, `scrollStep`, `DragStore`, `MatchDrop`, the
   prompt, and the screen's patch / leave-view / undo. The mouse path over real columns is a written
   checklist, not a browser suite. Adding Playwright would have been a new runner and a new
   convention in a phase that already had enough surface.

3. **Every drag is a new match** (resolved question 8). `MatchWriter.Drafted` never looks for an
   existing pairing. A repeat drop produces a second row; the incl-Draft sum is what updates.

4. **Quantity cap is availability-side only.** Over-filling a space is allowed and reads as blue
   "Over-filled". The dialog explains the supply cap inline rather than silently clamping.

5. **Price is keyed on the Processor Space stock class**, never the availability class. The two
   vocabularies do not map; a lookup on the wrong side returns a plausible number for the wrong
   animal. `MatchWriterTests.The_default_price_is_keyed_on_the_processor_space_stock_class` walks
   the seed for a pair whose two classes produce different lookups.

6. **Hover blocked is a comparison, not a second proposal.** `DragStore.dropState` compares each
   side's unmatched to 1. The authoritative refusal is still `GET /api/match-proposal` on drop.
   That is why an already-over-filled space highlights blocked even though a crafted POST used to
   be able to add head to it (fixed in review — see below).

7. **CreatedAt comes from `TimeProvider`**, not `DateTime.UtcNow`. Domain purity still holds; the
   API already had a clock registered.

### Deviations from the phase document

- **Undo was built**, not left for Phase 6. The phase said "if cheap"; it was.
- **No Playwright / no in-chat browser pass.** Acceptance asked for a mouse-path demo; the
  mechanics are covered in jsdom and the API was smoked with curl (space 37 × availability 1 →
  draft 39 @ $6, undo restored, exhausted pair returned the exact refusal). Density, sticky rail,
  auto-scroll over band headers, Escape in a real pointer sequence, and both-direction drops in the
  running app are still on the checklist.
- **No six-dot grab glyph** from design-system.md §10. The handle is the whole `.cbody`. Polish,
  not a requirement of PHASE-5. Recorded so Phase 8 does not rediscover it as a missing spec item.
- **CDK may briefly shuffle a card's DOM node into the target list** until change detection
  restores it. Sorting is disabled and we never splice arrays, but CDK still moves the preview's
  sibling. If a later phase sees a flash, this is why.

Nothing required by sections 1–5 was skipped except the in-browser mouse verification.

### Review findings

The closing protocol asks for a sonnet subagent. Sonnet was unavailable (usage limit). The review
ran on the inherit model against the phase document's review focus and the diff. That is a
deviation from the roadmap's "Closing a phase" step 1, recorded so the next phase does not assume
a sonnet pass happened.

**Review focus (from PHASE-5):** quantity rules at their boundaries — exact refusal, supply cap,
deliberately absent demand cap — whether the default price is genuinely keyed on the Processor Space
stock class; nothing merges or dedupes a repeat pairing; a fully consumed record leaves the
default-filtered view.

#### Fixed

1. **`MatchWriter.Reject` did not re-run `MatchCreation.Propose`.** The UI refuses when
   `min(unmatched, unmatched) < 1`, including an already-over-filled space (negative unmatched). A
   crafted `POST /api/matches` with quantity ≥ 1 could still add head if the availability record had
   stock, because Reject only checked "record exists, quantity ≥ 1, quantity ≤ availability
   unmatched". That is the demand-side cap the phase deliberately does not have *for a first fill*,
   leaking into a pair Propose has already refused. Reject now calls Propose first and returns
   `NoUnmatchedQuantity` when the pair is not allowed, then still enforces min 1 and the supply
   ceiling. Tests: `A_pair_with_nothing_left_is_refused_with_the_exact_domain_message` now also
   Rejects quantity 1; new
   `Validation_refuses_a_pair_whose_space_is_already_over_filled`.

2. **`quantity-prompt` treated a default price of `0` as missing.** `priceHint` used truthiness of
   `defaultPricePerKg`, so a real zero would have shown "No default price…". Hint now uses
   `!= null`. Spec added: `treats a zero default price as a real default, not as missing`.

3. **Duplicate Phase 5 DTOs in `models.ts`.** A second copy of `MatchProposalDto` /
   `CreateMatchRequest` / `MatchWriteResultDto` sat at EOF. Removed; the copies at the matching
   contract block stay.

4. **Vacuous repeat-pairing test.** The first version only counted existing live pairings. Rewritten
   as `A_repeat_pairing_is_still_allowed_and_a_second_draft_adds_to_the_incl_draft_sum`: Propose
   must be allowed, Reject of quantity 1 must be null, and appending a second `Drafted` must raise
   `MatchedInclDraft` by that quantity.

5. **Fractional quantity.** The prompt now rejects non-integers (`integerHeads`) with an inline
   error; `create()` posts `Number(this.quantity.value)`.

6. **Screen write spec read raw `textContent`.** After a patch it now asserts the fill-meter
   `title` (`N unmatched`) so a layout change cannot hide a stale unmatched figure.

#### Disagreed, not fixed

- **Reviewer said CDK can still scroll the source column over a band header.** Every card list
  sets `cdkDropListAutoScrollDisabled`, so CDK's `_startScrollingIfNecessary` returns even when it
  falls back to `_initialContainer`. `ColumnAutoScroll` is the only scroller. Still worth eyeballing
  on long bands — that is why the checklist names band headers explicitly.

#### Recorded, not defects

- **No keyboard path.** Requirement 2.1–2.2 removed it deliberately. Do not reinstate it.
- **Custom auto-scroll instead of CDK's.** Required by the week-banded layout; see above.
- **No demand-side quantity cap.** Requirement 3.4 / resolved question 1. Over-fill is blue
  "Over-filled".
- **Match count is not a Phase 6 open control.** Requirement 5.2: surface that they exist; opening
  is the next phase.
- **Missing six-dot grab glyph.** Fidelity / polish, not an acceptance miss. A glyph that appears
  only on hover would resize the 52px row unless reserved space is already there; `cursor: grab` is
  the only handle cue this phase shipped.
- **Pointer starts at 0,0 until the first `pointermove`.** Auto-scroll does nothing until the
  pointer actually moves, which is the first frame of any real drag.
- **No Playwright.** See deviations.
- **Same-column drop reports nothing.** Requirement 1.3.

#### Later phases, not this one

- Edit, cancel, confirm a match; cancel-with-reason; delete of anything past Drafted — Phase 6.
- Confirm-space button — Phase 6 / 7 as that phase specifies.
- Click-to-open the match affordance — Phase 6. The label and the breakdown are the hook.

### Watch out for

- **`end()` must not clear `cancelled`.** CDK's event order is ended-then-dropped. Clearing the flag
  on `ended` would make every Escape-cancelled drag fire as a real drop.
- **Do not turn CDK auto-scroll back on** to "simplify" the custom one. It will scroll the source
  column over every band header in the target.
- **Do not add a third file to `no-domain-arithmetic.spec.ts` for this screen.** If you need one,
  you are probably missing a DTO field. The proposal already carries default, max and refusal.
- **`applyWrite` replaces by id, it does not refetch.** Filters re-run over the patched lists. A
  later phase that adds a field the write result does not carry will show a stale card until reload.
- **Phase 6 should reuse `DELETE /api/matches/{id}`**, not invent a second drafted-delete. Anything
  past Drafted is 409 here on purpose.
- **The match affordance is the Phase 6 entry point.** `matchSummaryLabel` / `matchBreakdown` in
  `card-chrome.ts`, rendered on both cards. Add the click there, do not draw a second chip.
- **A POST that over-fills a space is allowed the first time** (unmatched still ≥ 1, quantity up to
  the availability leftover). A POST against a space whose unmatched is already `< 1` is refused.
  Those are different gates; do not collapse them.

### New commands, dependencies, conventions

No new packages. New endpoints and files:

| What | Where |
| --- | --- |
| Proposal / create / delete / transport companies | `GET /api/match-proposal`, `POST /api/matches`, `DELETE /api/matches/{id}`, `GET /api/transport-companies` |
| Pure write path | `src/Apg.Api/Contracts/MatchWriter.cs` |
| Wire messages | `MatchResponses.cs`, `MatchProposalDto` / `CreateMatchRequest` / `MatchWriteResultDto` in `Dtos.cs` |
| Price table load | `PriceTableLoader.cs` (registered in `Program.cs`) |
| Single-record projection | `MatchingProjection.SpaceById` / `AvailabilityById` |
| Drag store / pair / auto-scroll | `web/src/app/matching/drag/` |
| Drop → prompt → write | `web/src/app/matching/match/` |
| Match line on the card | `matchSummaryLabel` / `matchBreakdown` in `card/card-chrome.ts` |

`GET /api/transport-companies` returns `SeedConfig.TransportCompanies` sorted. The picklist is
optional at draft.

### Tests

- `tests/Apg.Api.Tests/MatchWriterTests.cs` — default and cap, exact refusal, price key on a
  differing-class pair, refuse 0 and above supply max, accept over-fill of space, refuse POST onto
  an already-over-filled space, no merge, delete only Drafted.
- Angular: `card-drag`, `column-auto-scroll`, `drag-state`, `card-chrome` (match labels),
  `match-drop`, `quantity-prompt` (including price `0` vs `null`), `matching-screen` write / undo /
  leave-view.

Close-out run: **122 domain + 88 API**, none skipped. Angular **135 tests across 15 files**.
`npm run build` succeeds (existing initial-chunk budget warning only — 826 kB vs 500 kB).

### Browser checklist (not verified in this chat)

No browser MCP was available. Before demoing:

- Drag space → availability and availability → space; same pair, same prompt.
- Drag a past-week availability onto a current-week space.
- Auto-scroll at both column edges, including while the pointer is over a band header or an empty
  band in the *target* column (CDK's own auto-scroll failed exactly there).
- Escape mid-drag: highlights go, preview vanishes, pointer-up creates nothing.
- Drop on the same column, on a band header, on empty space: nothing, no snack.
- Drop on a full record: snack `"There is no unmatched quantity"`, no dialog.
- Create, confirm both meters and the match line update; consume the last of an availability
  record and watch it leave the default supply view; UNDO puts it back.
- Density and sticky rail from Phases 3–4 still hold with a card in flight.

---

## Phase 6 — Match Management

**Completed:** 2026-08-31
**Status:** Complete

### What shipped

A match now has a life after the drag. Opening one from either card gives a modal (design-system.md
§11.4) that edits quantity, price and transport company; a `Drafted` match can be deleted or
confirmed, anything past `Drafted` can be cancelled with one of exactly three reasons, and a
Processor Space can be confirmed from its expanded card — with the reason printed beside the button
whenever it cannot be. Six new endpoints, all addressed by match id alone, and one new client-side
seam: `RecordPatches`, the single stream every write on this screen publishes to.

Later phases can rely on: `MatchLifecycle` as the domain's answer to what may be done to a match at
each status, `ProcessorSpaceRules.ConfirmBlockedReason` as the sentence beside a disabled Confirm,
`MatchEditContextDto` as everything a match modal needs, and `RecordPatches` as the place a Phase 7
record write publishes to.

### How a match is opened from each side — the phase document asks the log to record this

**Two clicks, and the same two on both cards.**

1. **Line 2's match label is now a button.** `2 matches · 1 draft` toggles the card's expansion. Phase
   5's log named this label the entry point and explicitly forbade drawing a second chip beside it, so
   the label itself became the control. With no matches it stays plain text: there is nothing to open.
2. **Every row of the expanded match table opens that match** — `(click)="openMatch(m.id)"` on the
   `<tr>`, from both `card-expansion.html` branches.

Two things about that are not obvious and are load-bearing:

- **The label sits inside the drag handle** (`.cbody` carries `cdkDragHandle`), unlike the chevron,
  which is outside it. It therefore stops `pointerdown`: without that, a click that drifts a pixel
  lifts the card instead of opening it.
- **The row is clickable rather than growing an actions column.** design-system.md §6.2 records that
  the supply match table fits seven columns in 508px and not eight, so there is no width for one; a
  clickable row costs nothing and keeps §16.10's trailing-edge alignment intact. It has a `title`
  and a hover fill and no ARIA role — resolved question 14 rules out spending effort on a pointer-free
  path, and a `role="button"` with no `tabindex` would be worse than nothing.

**Requirement 1.2 is satisfied by construction rather than by two code paths.** Both sides call
`MatchActions.open(matchId)` with a number, and neither knows which card it is on;
`GET /api/matches/{id}` answers the same context whichever card asked.
`MatchEditTests.The_same_id_gives_the_same_match_whichever_card_it_came_from` asserts the two
projections produce an equal `MatchDto`.

### What the modal expects to be passed — also asked for by name

**A `MatchEditContextDto` and nothing else**, fetched before the dialog opens. It carries:

| Field | Why it is on the wire |
| --- | --- |
| `match` | taken off the parent's own `Matches` array, never projected a second time, so the row in the card's table and the row in the modal cannot become two shapes |
| `space`, `availability` | **both parents in full.** §2.1/§2.2 want each parent's status, original quantity and unmatched figure, and `MatchDto` carries none of those — it has the denormalised *labels* of both sides but neither side's quantities |
| `maximumQuantity` | the edit ceiling, below |

`MatchModal` writes nothing and decides nothing. It closes with a `MatchModalResult` — a discriminated
union of `save` / `confirm` / `delete` / `cancel`, the first two carrying an `UpdateMatchRequest` —
and `MatchActions` performs the write. **Every footer action closes the modal**, which is why
requirement 3.4 ("every edit recomputes the derived numbers on both columns immediately") is visible
rather than merely true: the modal goes, and both columns move behind it.

`EditContext` returns null for a **cancelled** match as surely as for a missing one, so
`GET /api/matches/{id}` 404s on one. A cancelled match is on no card, and pass 1 has nowhere else to
open it from.

### How the Confirmed-edit prompts are implemented — also asked for by name

`MatchActions.prompted()` sits between the modal closing and the `PUT`. It calls `promptFor()`, which
returns a `ConfirmChangeData` or null:

- **null unless the match is `Confirmed`.** Nothing prompts at `Drafted` — the match has been
  communicated to nobody, which is what `Drafted` means.
- **null unless the quantity or the transport company changed.** A **price-only edit never prompts.**
  The rule is about who else is affected: a quantity is what the meatworks expects to receive and a
  carrier is who is turning up, both already agreed with somebody; a price is between APG and the
  farmer and changes nothing anyone is planning around.
- Otherwise a nested `ConfirmChange` dialog (440px, design-system.md §11.5) that **names the
  consequence in the processor's terms, not the field's** — *"Changing its quantity from 354 to 300
  head will change what Alliance Group Wallacetown expects on 28-08-26"* — with the two buttons
  carrying the two values (`Keep 354` / `Change to 300`) rather than Yes and No.

**The prompt is the client's, not the server's, and that is deliberate**: it is a question for a human
about a consequence, not a rule about validity. The server enforces the ceiling and the minimum
whatever the dialog allowed, and would accept the same `PUT` without one.

Declining is silent. Keeping the old value is a decision, not a failure, and it earns no snack bar.

### Where a cancelled match goes — also asked for by name

**Nowhere. That is the design, and the operator is told so before the fact.**

`RecordCancellation.CancelMatch` sets the status and the reason; the row stays in the database with
both. But a cancelled match is excluded from both parents' `matches` arrays (resolved question 4), so:

- it vanishes from both cards' match tables and stops counting in `matchSummaryLabel`;
- both matched sums drop by its quantity and both unmatched figures rise;
- `POST /api/matches/{id}/cancel` returns `MatchWriteResultDto` with **`match: null`** — the same
  shape a delete returns, because the visible consequence is the same;
- `GET /api/matches/{id}` then 404s, so it cannot be reopened.

Pass 1 has no Match list view, so that is the last anyone sees of it. `CancelMatch`'s warning panel
says exactly that — *"A cancelled match disappears from the matching screen. Pass 1 has no Match list
view, so it will not be visible anywhere afterwards"* — and, in the same breath, the thing that is
**not** about to happen: *"Both records keep their own status — cancelling a match never touches its
parents."*

Deleting a drafted match has the identical numeric effect; the only difference is that the row is
gone rather than retained with its reason (requirement 6.3, and
`Deleting_a_draft_and_cancelling_it_move_the_numbers_identically` asserts it).

### Decisions made during the build

1. **`RecordPatches` replaces `MatchDrop.writes`.** Phase 5 had one writer, so it owned a `Subject`.
   Phase 6 adds five more and one of them patches a single record. A root `RecordPatches` service now
   takes every write and `matching-screen` subscribes once. **A `RecordPatch` may carry one record or
   both, and an absent half means "the server did not say", not "unchanged by omission"** —
   `applyPatch` skips what it was not given. Phase 7's record writes should publish here.

2. **Confirming a space returns a bare `ProcessorSpaceDto`, not the two-parent shape.** Confirming a
   space touches no availability record; returning one would imply it had, on the one screen where
   what a write does and does not reach is the thing most easily misread.

3. **`POST /api/matches/{id}/confirm` takes the edit body.** Mark chose "save, then confirm" over
   disabling Confirm on a dirty form. Sending the fields with the confirm makes that a **single
   validated `SaveChanges`** rather than two chained calls with a half-applied state in between. A
   pristine form sends the values the match already holds, which is a no-op.

4. **`ProcessorSpaceRules.CanConfirm` is now defined as `ConfirmBlockedReason(...) is null`**, so the
   gate and its explanation are one piece of logic and cannot come to disagree — the button enabled
   while the reason still says why it cannot be. Three answers, because "Confirm is greyed out" needs
   three: `Already confirmed`, `This space is cancelled`, and design-system.md §15's verbatim
   `Needs at least one confirmed match and no drafts`. **`CanConfirm`'s behaviour is unchanged**; the
   Phase 1 tests that pin it all still pass untouched.

5. **`MatchLifecycle` is a new file rather than an extension of `RecordCancellation`.** It answers
   *whether* (`CanDelete` / `CanConfirm` / `CanCancel`) and does one thing (`Confirm`). Cancellation
   stays in `RecordCancellation`, which remains **the only path that sets `Cancelled`** — and whose
   signatures, taking no record collections at all, are half the non-cascade guarantee.
   `MatchLifecycleTests.Nothing_here_cancels_a_match` asserts `Confirm` is the file's only mutator, so
   a second way to cancel cannot appear here without a reason being optional on one of them.

6. **Confirming a match is `Drafted`-only, and `Notified` is deliberately not a second entry.**
   Resolved question 2 skips `Notified` in pass 1; were notifications to arrive, a Notified match
   should need its own explicit step rather than inheriting this one silently.

7. **`Save changes` is inert until something differs.** Nothing to save is not an error, so it is
   disabled without explanation — unlike Confirm-space and the cancel dialog's action, where the
   reason is stated because the cause is not self-evident.

### Deviations from the phase document

- **Nothing in sections 1 to 6 was descoped.** Every requirement was built.
- **The per-match affordance is a clickable table row, which design-system.md does not specify.** §6.2
  fixes the table's columns and §16.10 its trailing-edge alignment, and an actions column would break
  both — see "How a match is opened" above. Recorded rather than invented silently, per the document's
  own instruction at the top of design-system.md.
- **The `Confirm space` button is `mat-stroked-button`, not the `mat-flat-button` §1.2 lists for
  primary dialog actions.** It sits inside a card, not a dialog footer, and a filled petrol button
  inside a 52px-row list reads as the screen's primary action, which it is not.

### Review findings

A sonnet subagent reviewed against PHASE-6, the roadmap and the diff. It ran `dotnet build`,
`dotnet test`, `npm test` and `npm run build` itself rather than trusting my word, and read the new
files off disk where the diff did not carry them.

**Clean on all three of the phase document's review-focus items**, verified independently:

- **The non-cascade, both directions.** `RecordCancellation`'s signatures make a cascade structurally
  impossible in either direction, and the tests cover the trap case — a record's *derived* status
  legitimately changes when its last live match is cancelled, while its *stored* status never moves.
- **The edit ceiling** uses the three-argument `MaxMatchQuantity`, is enforced server-side in
  `RejectUpdate` (which both `PUT` and the confirm endpoint go through), and is never computed in the
  client.
- **Processor Space status is stored everywhere.** `ConfirmBlockedReason` only reads it; the only
  writes are the explicit confirm endpoint and `RecordCancellation.CancelProcessorSpace`.

It also confirmed the acceptance criteria are met, that `no-domain-arithmetic.spec.ts`'s allow-list is
still exactly two files, and that the new tests are substantive rather than vacuous.

Three findings, all low. Disposition:

1. **The confirm endpoint returned 409 for plain body-validation failures** that the plain `PUT`
   returns 400 for, with the identical message — **fixed.** The two gates are now separate: a status
   gate is a conflict (`Only a drafted match can be confirmed` → 409), a ceiling or a minimum is a bad
   request (→ 400), and it is the same rejection the plain edit returns. Verified against the running
   API.
2. **The Confirmed-edit prompt named only one field when quantity *and* transport changed in the same
   save** — **fixed**, and this was the finding worth having. The write applied both fields, so the
   operator would have agreed to one change and unknowingly applied two. Both consequences are now
   named in the one sentence; the buttons still carry the quantity when it moved, since that is the
   figure the whole screen is scanned for. New test:
   `names both consequences when quantity and transport changed together`.
3. **`MatchingProjection` computes `ConfirmBlockedReason` twice per space** (once directly, once
   inside `CanConfirm`) — **deliberately not fixed, and a comment added saying why.** Collapsing it
   would mean writing `CanConfirm = reason is null` in the projection, which puts the *definition* of
   the gate in the one class whose entire contract is that it computes nothing. A rule restated in the
   projection is the same drift as a rule restated in TypeScript, one layer closer in. The cost is a
   LINQ filter over one space's matches, forty times per request.

### Watch out for

- **The non-cascade has a trap that looks exactly like a violation.** Cancelling a match legitimately
  changes an availability record's **derived** status — a record left with no live matches derives
  back to `Booked` — and the smoke test shows precisely that (`Pending -> Booked`). That is the
  derivation doing its job. The **stored** statuses are what must not move, and a Processor Space's
  status is stored in its entirety.
- **`MaxMatchQuantity` has two overloads and both are wrong in the other's place.** The one-argument
  one is for a *new* match and adds nothing back — used on an edit it would refuse the quantity the
  match already holds. The `.docx`'s "originally available" goes the other way and would permit the
  over-commit. `MatchWriter.EditCeiling` is the only caller for edits; go through it.
- **The ceiling is on the wire for two reasons, not one.** The usual one, and because composing it
  client-side is `availability.unmatched + match.quantityMatched` — which
  `no-domain-arithmetic.spec.ts` fails, correctly. The allow-list is still exactly two files.
- **The match label stops `pointerdown`.** It is inside the drag handle. Remove that and a click that
  drifts a pixel lifts the card instead of opening it.
- **A confirmed space drops out of the default `Status = Booked` filter and appears to vanish**
  (requirement 5.5). Correct behaviour, and the `showing n of m` count says so. The same is true of
  the space the seeder confirms.
- **`MatchWriteResultDto.match` is null for a delete *and* for a cancel.** Two different acts, one
  visible consequence. Do not read null as "deleted".
- **`GET /api/matches/{id}` 404s on a cancelled match.** Intended — it is on no card, and pass 1 has
  no Match list view. If Phase 7 or a later pass needs to display one, that needs its own endpoint and
  its own shape, exactly as Phase 1's log said of `MatchDto.CancellationReason` (still always null on
  the two read endpoints).
- **On-screen verification was still not done**, and it is now five phases old. No browser automation
  tool is available in this session, as in Phases 3, 3b, 4 and 5. What changed is that the checklist
  is now one document — `Documents/browser-checklist.md` — instead of five buried sections. **A phase
  that makes a claim jsdom cannot check should add to it**, and any phase that gets a browser should
  run it and record the outcome, here, as its own short interstitial entry if anything fails.
- **An `Apg.Api.exe` belonging to another session was running when this phase started** and was
  stopped to build. The sonnet reviewer stopped it again mid-review and did not restart it; it has
  been restarted here, on a reset database. Unchanged advice:
  `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`.
- **A long `bash` heredoc silently fails in this environment** past roughly 150 lines, with
  `unexpected EOF while looking for matching '`. Large new files were written with the editor tool
  instead; a small `node` patch helper handled surgical edits and preserved each file's line endings
  (the repo is mixed — Phase 0/1 files are LF, Phase 5's CRLF, and `core.autocrlf` is `true`).

### Browser checklist — now one document, and still unrun

**`Documents/browser-checklist.md` is new in this phase.** Phases 3, 3b, 4, 5 and 6 each closed with
their own browser checklist buried in their own entry here, which meant "do the browser pass" had come
to mean reading five sections and merging them. They are now merged, into 52 items across seven
sections, **written against the live seed so they name real record ids and real expected figures**
rather than hypotheticals.

Two examples of what that buys, both of which took a query against the running API to get right:

- **Match #2 on space #1** has consumed its availability record entirely, so its ceiling note must
  read `Ceiling 29 = the availability's 0 unmatched, plus this match's own 29.` Without the add-back
  the ceiling would be **0** and the form could not be resubmitted unchanged. **Match #7** (space #27
  × availability #6) is the other half: ceiling **58** against a record holding **144**, so if the
  modal ever says 144, the requirements document's wrong rule has been implemented.
- Two of the examples I first wrote were **hidden by the default filters** — a Confirmed space and an
  exhausted availability record are both filtered out, so neither can be clicked. The checklist now
  uses cards that are actually on screen, and says which filter to lift where it cannot.

It also carries a **"things that look wrong and are correct"** table — the two rails disagreeing, a
column ending before the current week, a silent same-column drop, the CDK preview flash — so a first
run does not spend its findings on decisions that are already recorded.

The pass itself was **not run in this chat**: no browser automation tool is available here, as in
Phases 3, 3b, 4 and 5. The API (5286) and the Angular dev server (4200) were left running on a freshly
reset database so it can be worked through directly.

### First browser pass — what it found

**Mark ran part of the checklist against the running app on 2026-09-01.** Two results, and three fixes.

**The density target holds. `design-system.md` §8.3's 9–11 cards per column is met** — measured, not
inferred. That claim had been unverified since Phase 3, through two changes to the figure (Phase 4
removed the search strip and raised it from 8–10; Phase 6 added an actions row to the expansion). It
can stop being carried as a risk. Section A's first item is the one the whole target rested on.

**Three defects in the match modal, all rendering, none in the rules.** All fixed:

1. **Long `mat-hint` text painted over the notes below it, and over the dialog's own footer.**
   Material's subscript wrapper is a fixed height — more so at `density: -2` — so a hint that wraps
   overflows it instead of pushing what follows down. `Defaulted from ANZCO · Cows · w/c 23-08-26, and
   editable` in a 150px field wrapped to three lines and landed on top of the ceiling note, which in
   turn landed on `Close`. **The rule now is that a hint has to fit one line of a 150px field**; the
   two sentences that cannot — the ceiling and the price provenance — moved into a normal-flow
   `.notes` block below the row, where they wrap freely. `.fields` also gets an explicit subscript
   height as a backstop, so a longer string in some future edit pushes rather than overlaps.
2. **The supply block's record id was truncated away.** `LIVESTOCK AVAILABILITY #8` is a shade too
   long for half a 640px dialog, and the kicker truncated as one string — so the ellipsis landed on
   the number and the block named no record at all. The id is now its own unshrinkable span and only
   the words give way; the status was pinned too, and the `.rhead` gap trimmed to 6px.
3. **The cancel dialog's wording**, at Mark's direction: the title is now
   **"Select reason for cancellation"** and the `Choose a reason to continue` hint beside the disabled
   button is **gone**. The title is the
   instruction — with a reason required, nothing preselected and the action disabled until one is
   chosen, a separate prompt had nothing to add. This narrows Phase 6's own "disabled controls say
   why" rule to where the cause is *not* self-evident; `Confirm space` keeps its stated reason,
   because there the cause genuinely is not on screen.

Three tests were added for things jsdom cannot see but can still guard: every `mat-hint` in the modal
is at most 12 characters, the long sentences are in `.notes`, and each kicker's `.rid` renders its id
outside the truncating span.

**The Phase 5 quantity prompt had the same bug, and it is now fixed too.** I predicted it from the
shape of the string — `Default for {processor} · {stockClass} · w/c {label}` in a 148px field, 53
characters against the 52 that broke the modal — and named the drag that would show the worst case
(space **#14**, ANZCO Kokiri, onto availability **#12**). Mark ran it and it was worse than next door:
the price hint wrapped to **four** lines, the quantity hint to two, and the `Cancel` / `Create match`
row landed on top of both.

Fixed the same way, in `match/quantity-prompt.*`:

- `quantityHint` is now `max 1140` rather than `Default 60 · max 1140`. The field is prefilled with
  the default, so restating it was costing a line to say what the box already said.
- `priceHint` became `priceNote` and moved into a normal-flow `<p class="pnote">` under the row. Both
  its forms are unchanged, including `No default price for …`, so the Phase 5 test that distinguishes
  a **zero** default price from a **missing** one still asserts the same strings.
- The transport field gained a real `<mat-label>Transport company</mat-label>` and its hint shrank to
  `Can be added later`. It had been carrying the field's own name in the hint because it had no label
  — a Phase 5 oddity the match modal did not copy, and the reason that hint wrapped at all.
- The same subscript-height backstop as the modal.

Two tests added, one per dialog, asserting that **every `mat-hint` is short** (≤12 chars in the modal,
≤18 in the prompt) and that the long sentence is in the notes block. jsdom cannot see an overlap, but
it can see the string that causes one.

**Then two more passes, and the second reversed the first.** Recorded in full because the reasoning is
the useful part.

Moving the sentence out of the price field's subscript fixed the overlap but made a full-width note
under a row of *three* fields, left-aligned under the **quantity** box — so it read as describing the
quantity. Mark: *"it looks worse than before because it's confusing as to which field it pertains."*
I answered that by naming the subject in the wording (`Price defaulted from …`) and indenting the note
to start under the price field.

**Mark then called it the other way, and the call is right: put it back in the field and let it wrap
to four lines.** The field a hint sits in is what says which field it is about, and no amount of
wording or indentation buys that association back as cheaply as simply not giving it up. Both dialogs
now keep the price provenance in the price field's own `mat-hint`, in design-system.md 11.1's wording
(`Default for ANZCO · Nat Beef - Premium · w/c 30-08-26`), wrapping there.

**What made the revert safe is that the two changes were separable, and only one of them was the fix.**
The overlap was never caused by the text being in a hint; it was caused by Material's subscript
wrapper having a fixed height at `density: -2`, so a wrapped hint overflows it silently. The one-line
`height: auto` in each dialog's `.fields` is the whole fix. With it, four lines push the actions down;
without it, they land on top of them. Both stylesheets now say so in capitals above the rule, because
it looks like tidying and is load bearing.

**So the standing rule is narrower than the one I first wrote, and this supersedes it:** a hint may
wrap, and belongs in the field it describes. What must be true is that **the subscript can grow** —
`height: auto` on `.mat-mdc-form-field-subscript-wrapper`. A note below the row is for something that
is not about a single field: in the match modal the **ceiling** is still a note, because it explains a
rule spanning the whole match and design-system.md 11.4.4 asks for it "under the fields".

**The transport field keeps its name in its hint, not in a `mat-label`.** I had "fixed" that too, on
the grounds that a hint carrying the field's own name is odd and the match modal did not do it; Mark
put it back as `Transport company - can be added later`, lower-case c. It is therefore a decision, not
an oversight — **do not re-tidy it**, and note the two dialogs differ here on purpose: the match modal
uses a `mat-label` plus `Optional`.

One thing kept from the round trip: `quantityHint` stayed at `max 142` rather than 11.1's
`Default 132 · max 142`, because the field is prefilled with the default and restating it costs a line
to repeat what the box already says. Not asked for, and it can go back.

The tests that had pinned "every hint is short" were deleted rather than adjusted — they asserted the
opposite of the decision. In their place each dialog now pins the thing that actually matters and was
never at issue: **the price hint names the Processor Space's stock class and not the availability
record's** (resolved question 7), with a fixture whose two classes differ so the assertion cannot pass
by coincidence.

**Open, and not chased:** in both of Mark's screenshots **none of the three field labels is visible**
— `Quantity matched`, `Price per kg` and `Transport company` are all in the templates as `mat-label`,
but the filled fields render with the value alone. The suspicion is that `density: -2` leaves no room
for a floating label above the value in an `appearance="fill"` field, which would mean every form
field in both dialogs is effectively unlabelled. It has not been confirmed and nothing was changed.
**Phase 7 builds forms and will hit this immediately** — check it before designing around it.

### New commands, dependencies, conventions

No new packages. All recorded in CLAUDE.md as well.

| What | Where |
| --- | --- |
| Match modal's context, and the edit ceiling | `GET /api/matches/{id}` → `MatchEditContextDto` |
| Edit the three fields | `PUT /api/matches/{id}` |
| Drafted → Confirmed, carrying the edit body | `POST /api/matches/{id}/confirm` |
| Cancel past Drafted, reason required | `POST /api/matches/{id}/cancel` → `match: null` |
| Confirm a space | `POST /api/processor-spaces/{id}/confirm` → bare `ProcessorSpaceDto` |
| Match lifecycle gates | `src/Apg.Domain/Matching/MatchLifecycle.cs` |
| Why Confirm is unavailable | `ProcessorSpaceRules.ConfirmBlockedReason`, on the DTO as `confirmBlockedReason` |
| The one write stream | `web/src/app/matching/match/record-patches.ts` |
| Open / edit / confirm / delete / cancel | `web/src/app/matching/match/match-actions.ts` |
| The three dialogs | `match/match-modal.*`, `match/confirm-change.*`, `match/cancel-match.*` |
| The consolidated browser pass | `Documents/browser-checklist.md` |

- One spec: `npx ng test --watch=false --include=src/app/matching/match/match-actions.spec.ts`
- One rule's tests: `dotnet test --filter "FullyQualifiedName~MatchEditTests"`
- **Conventions now enforced by tests rather than by discipline:** the confirm gate and its stated
  reason cannot disagree (`ProcessorSpaceRuleTests`); delete and cancel are never both available
  (`MatchLifecycleTests`); cancelling a match cannot touch its parents, in the domain and through the
  projection (`CancellationTests`, `MatchEditTests`); the edit ceiling can never over-commit a record
  and can always keep what a match already holds (`MatchEditTests`).

Test counts at close: `Apg.Domain.Tests` **151** (122 at the end of Phase 5), `Apg.Api.Tests` **108**
(88), Angular **178 across 19 files** (135 across 15). `npm run build` succeeds with the existing
initial-chunk budget warning only — 881 kB against a 500 kB budget, up from 826 kB.

---

## Phase 7 — Debug Record Creation

**Completed:** 2026-09-01
**Status:** Complete

### What shipped

Records can now be put into the matching screen live. Each column header carries a debug `+ Add`
control, each expanded card carries `Edit` and `Cancel`, and both record types have a form behind
them — marked as demo scaffolding twice over, because the farmer/agent submission journey is deferred
past pass 1 and this must not be mistaken for it. Eight new endpoints, one new client folder
(`web/src/app/matching/record/`), and one new field pair on `MatchDto`.

Two behaviours are the phase, and both are visible rather than asserted: **reducing a record's
quantity below what is already matched reaches the pink `Over-committed` state**, warned about and not
blocked; and **cancelling a record leaves every one of its matches alive**, said in the dialog before
the fact, in the snack afterwards, and on the counterparty column's own cards.

Later phases can rely on: `RecordWriter` as the pure record-write path, `RecordWriteResultDto` as the
one-record-plus-calendar shape, `RecordActions` as the client seam every record write goes through,
and `record/_record-form.scss` plus `debug-ribbon` as the single home of the debug treatment.

### The component names Phase 8 will need

| File | What it is |
| --- | --- |
| `record/record-actions.ts` | Root service. Opens every dialog, performs every write, publishes to `RecordPatches`, owns both snack messages. The dialogs decide nothing and write nothing — the same division of labour as `MatchActions`. |
| `record/space-form.ts/.html` | Add **and** edit in one dialog, branching on whether it was given a record. |
| `record/availability-form.ts/.html` | As above, plus the ~300-location type-ahead. |
| `record/cancel-record.ts/.html` | The confirmation, listing every match that will survive. |
| `record/confirm-over-commit.ts/.html` | The prompt before an edit that leaves a record disagreeing with its own matches. |
| `record/debug-ribbon.ts` | The `# DEMO DATA TOOL #` strip. **One component, used by both forms**, so the marking cannot drift and Phase 8 has one place to restyle. |
| `record/record-vocabularies.ts` | Reference data and locations, fetched once and lazily per session. |
| `record/record-form.ts` | The two validators both forms share. |
| `record/_record-form.scss` | The shared form layout, `@use`d by both `space-form.scss` and `availability-form.scss`. |

### How the debug affordances are marked

Three ways, and they are meant to be redundant:

1. **The column-header button** is design-system.md §14's: 26px `mat-stroked`-style, 12px text, petrol
   on white with a `#BDBDBD` ring, plus a `construction` glyph, labelled `+ Add space` / `+ Add record`.
   Deliberately *not* LMS's circular petrol create FAB.
2. **A `# DEMO DATA TOOL #` ribbon** at the top of both form dialogs — the shell's dev-flag `#CCD457`
   on `#37393C` — with the line *"Debug scaffolding for demos — not the farmer or agent submission
   form."* That colour already means "this is not the real thing" in this application, and a ribbon is
   not a card, a status or a quantity, so it does not touch the hue rule.
3. **The `Edit` and `Cancel` buttons in a card's actions row are text buttons**, muted and
   `$lms-error`, deliberately quieter than the `Confirm space` beside them: the scaffolding must never
   outrank the real action on the card.

`design-system.md` §14 and §6.2 now record all three.

### Decisions made during the build

1. **Every record write returns the recomputed week calendar**, and `RecordPatch` gained a `weeks`
   field to carry it. This is the decision the phase turned on. The client places a record into a band
   by string equality on its week-commencing Sunday against the list from `GET /api/week-bands`; a
   record whose week is not in that list is `unplaced` and simply does not appear. Creating a space
   three months out does exactly that, and the client cannot name the missing week itself without
   advancing a date in TypeScript. So `RecordWriteResultDto` carries `{ space | availability, weeks }`
   and `matching-screen.applyPatch` adopts the calendar first. **A match write still carries no weeks
   — a match has no date of its own** — and an absent `weeks` still means "not affected", as an absent
   record does.

2. **`applyPatch` upserts by id instead of replacing by id.** A created record is in neither list yet,
   and replace-by-id would have dropped it silently: the one failure mode where nothing errors and
   nothing appears. Ordering does not matter because both lists are sorted before they are banded.

3. **Dates are a native `<input matInput type="date">`, never a Material datepicker.** A datepicker's
   control value is a JavaScript `Date`, which `no-domain-arithmetic.spec.ts` forbids anywhere under
   `matching/` — and rightly: it would hand the browser's timezone a decision the server settles. The
   native input's value *is* the ISO `yyyy-MM-dd` string the API wants and the browser renders it in
   the local format for free. **The allow-list is still exactly two files.**

4. **The forms' vocabularies come from `SeedConfig` over a new `GET /api/reference-data`, not from the
   loaded records.** `filters/filter-options.ts` derives its options from the working set, which is
   right for a filter — no option is offered that would match nothing — and wrong for a create form,
   which must be able to introduce a stock class or a plant that nothing uses yet. A hard-coded copy in
   TypeScript would also have been a second place APG's real lists need swapping.

5. **The over-commit prompt is the client's, not the server's**, exactly as Phase 6 decided of its
   Confirmed-match prompt and for the same reason: it is a question for a human about a consequence,
   not a rule about validity. `RecordWriter` has **no clause about matches at all**, which is what
   keeps requirement 4.4 true by construction. The form's live caption and the prompt both compare the
   typed quantity against the DTO's `matchedInclDraft` and name both figures; **neither composes the
   over-run**, which arrives computed on the card a moment later.

6. **The prompt fires on the demand side too**, where over-*filling* is normal and expected (resolved
   question 1). The operator is still about to make a record disagree with its own matches, so they are
   told once — but the wording says plainly that an over-filled space is a normal state, rather than
   dressing it as a fault.

7. **`Edit` and `Cancel` live in the expanded card's actions row**, beside `Confirm space`, and the
   supply card gained that row for them. Decided with Mark. The 52px collapsed row has no width to give
   and §16.10 pins its trailing edge at 32px; a kebab menu would also have been an idiom LMS does not
   use.

8. **The counterparty flag** (Mark's choice of the three offered). `MatchDto` gained `spaceStatus` and
   `availabilityStatus` — two fields rather than one "partner cancelled" flag, because the same
   `MatchDto` object hangs off both parents and a single-sided flag is ambiguous on one of them. The
   far side's card shows a `block` glyph beside its match count and names the row in the expanded match
   table. Icon and word, no hue: cancelling never cascades, so this is a normal state and not an error.
   Recorded in `design-system.md` §6.1 and §6.2 as an addition to those sections rather than something
   they specified.

9. **`SHOW IT` on the cancellation snack ticks `Cancelled` into that column's status filter.** It
   discharges requirement 5.4 by doing it rather than by saying it can be done, and it adds to the
   filter rather than resetting it, so nothing else the operator had set is lost.

10. **The snack says when a record it just wrote is hidden by the current filters.** Adding an ANZCO
    space while the column is filtered to SFF lands the record and filters it straight back out —
    the write worked and nothing appeared. `RecordActions` runs the *same* pure `filterSpaces` /
    `filterAvailability` the screen renders through, over the one record, so the message cannot
    disagree with what is on screen.

11. **`Cancel` is disabled on an already-cancelled record.** The server refuses a second cancellation
    with a message, and the card is already desaturated with its title struck through, so the cause is
    self-evident and needs no stated reason — which is where Phase 6's "disabled controls say why" rule
    ends (Phase 6 narrowed it the same way for its cancel dialog).

12. **A space edit may not change the processor or the stock class** (requirement 4.2 lists neither),
    and `UpdateProcessorSpaceRequest` does not carry them, so the rule is in the wire format rather
    than in a guard. A test asserts the type has no such property. An availability edit really does
    take every attribute (4.3).

13. **No `[disabled]` binding on any reactive control.** Angular warns about it, and would be warning
    about the right thing: the enabled state would live in the template rather than in the form. An
    empty menu plus its hint says "choose a processor first" just as well.

### The Phase 6 open question, closed — and what it changed

Phase 6's entry ended with an unchased finding: **no `mat-label` was visible in either dialog**, with
`density: -2` the suspicion and a note that "Phase 7 builds forms and will hit this immediately".

It is settled, and without a browser. Material's own density table
(`@angular/material/form-field/_m3-form-field.scss`, `get-density-tokens`) reads:

```scss
form-field-filled-label-display: list.nth((block, block, none, none, none, none), $index),
```

— `none` from density **-2** downwards. At the theme's `-2`, every `appearance="fill"` field in the
application was silently unlabelled, and every field Phase 7 adds would have been too.

`web/src/styles.scss` now restores Material's own **-1 row** — container height, label display and both
with-label paddings, taken together rather than hand-tuned — scoped to
`.mat-mdc-dialog-container .mat-mdc-form-field`. Only dialogs are relaxed: the 40px filter row is what
`-2` exists for, and it holds no form fields at all (every control on it is a chip and a menu).

**Two consequences a later phase should know.** The quantity prompt and the match modal now render
three labels each that they did not before, so both dialogs are ~4px taller per field and carry text
they were laid out without. And the quantity prompt's transport field still carries its name in its
**hint** rather than a `mat-label` — Mark's explicit decision, which the Phase 6 log says not to
re-tidy — but that decision was made while no label was rendering anywhere. It is left exactly as it
was; whether it still reads right beside two labelled fields is on the browser checklist as a judgement
call rather than a defect.

### Deviations from the phase document

- **Nothing in sections 1 to 6 was descoped.** Every requirement was built.
- **`design-system.md` §13's "Empty column" state was not built.** Phase 4's log parks it with "Phase 7
  or 8", and §13 pairs it with a `+ Add a record` button — but PHASE-7's own requirements do not ask
  for it, and the roadmap's rule is to build only what the phase specifies. A column with nothing
  loaded still renders empty week bands. **This is Phase 8's**, and the add button it wants now exists
  in the column header for it to reuse.
- **The over-commit prompt was added beyond the letter of 4.5**, which asks only that the edit warn.
  The form's live caption is the warning; the prompt is a second, deliberate step, because the caption
  is easy to type past. Both name the two figures and neither blocks.
- **Two things were added that the phase document does not ask for**, both small and both recorded
  above as decisions: the "hidden by this column's filters" qualifier on a write's snack (decision 10)
  and disabling `Cancel` on an already-cancelled record (decision 11).

### Validation rules added beyond the phase document

The document asks for required fields, integers ≥ 1, real dates and past dates allowed. `RecordWriter`
also enforces, server-side:

- the **processor must be one of the three**, and the **plant and stock class must belong to it** — the
  server-side half of requirement 2.1's picker rule, so a crafted request cannot do what the form
  prevents. The refusal names that processor's actual list;
- an availability record's stock class must be in the **single supply list**, and is checked against
  **no** processor's list — a test asserts both halves, since the two vocabularies not aligning is the
  point of the screen;
- the **location must exist** (a `locationId` of 0 is "choose a location"; an unknown one is "there is
  no such location");
- the **transaction type must be a defined member**;
- blank optional text is stored as **null, not `""`** — the same rule `MatchWriter` applies.

Cancelling is refused only when the record is **already cancelled**. Deliberately nothing else:
`RecordCancellation.CanCancelProcessorSpace` takes the record and no match collection, so a gate that
depended on the matches cannot be written there without changing its signature.

### Is there another route to the pink Over-committed state? — the phase document asks this by name

**No, and it was looked for rather than assumed.** Every path that changes either side of
`unmatched = quantityAvailable − matchedInclDraft` on a supply record:

| Path | Can it push unmatched below zero? |
| --- | --- |
| Creating a match by drag | **No.** `MatchCreation.Propose` caps at the record's remaining supply, and `MatchWriter.Reject` re-applies the same cap server-side. Phase 5's review closed the one hole here (a crafted POST onto an already-over-filled *space*). |
| Editing a match's quantity | **No.** The three-argument `MaxMatchQuantity` ceiling is remaining supply **plus that match's own current quantity**, enforced in `MatchWriter.RejectUpdate`, which both `PUT` and the confirm endpoint go through. |
| Confirming or cancelling a match | **No.** Confirming moves no quantity; cancelling only ever *raises* unmatched. |
| Deleting a draft | **No.** Raises unmatched. |
| **Editing the record's `quantityAvailable` downwards** | **Yes — and this is the intended one.** Warned about twice and refused by nothing. |
| Creating a record | **No.** A new record has no matches, so it starts fully unmatched. |
| Cancelling a record | **No.** It changes a status and nothing else. |

Verified against the running API as well as in tests: availability #6 (144 available, 124 matched
across three Confirmed matches) edited to 100 returns `unmatched: -24`, `quantityState: Over`,
`quantityStateLabel: "Over-committed"`, `status: Pending` — and all three matches unchanged, in id,
status and quantity. `Pending` rather than `Confirmed` is correct: resolved question 5 requires
`unmatched == 0` exactly.

### Verified end to end against the running API

Every one of these was run by hand against a freshly seeded database, and the database was reset
afterwards, so the demo data is clean:

- `GET /api/reference-data` returns the three processors with their own plants and classes, the nine
  supply classes and the three transaction types.
- `GET /api/locations` returns 299 rows, name-ordered, each with its farmer.
- **Refusals:** an Alliance plant on an ANZCO space, a supply class on a space, a demand class on a
  record, an unknown location, and a quantity of zero — each with the message naming what was wrong.
- **Create:** a space and an availability record, both `Booked`, blank optional fields stored as null,
  the farmer resolving from the location.
- **The calendar grows:** a space dated 2027-01-10 came back with a 21-week calendar reaching
  `10-01-27`, still gapless and still every Sunday.
- **Edit:** a space's plant, quantity, date, time and notes; the same edit refused when the plant
  belongs to another processor.
- **The pink state**, as above.
- **Cancel, both sides:** cancelling space #1 (two matches, one Confirmed and one Drafted) left both
  matches byte-identical and both counterparty records' stored statuses untouched; their match rows now
  report `spaceStatus: Cancelled`, which is what the far column flags. Cancelling availability #6 did
  the same in the other direction across three spaces. A second cancellation is refused with
  *"This processor space is already cancelled"*.

### Review findings

A sonnet subagent reviewed against PHASE-7, the roadmap and the diff, reading the new files off disk
where the diff did not carry them, and running all four commands itself rather than trusting my word.

**Clean on all three of the phase document's review-focus items**, each verified independently rather
than read back from the code's own comments:

- **The non-cascade.** It confirmed the domain helpers take no match collection, that
  `RecordWriter.RejectCancelSpace` / `RejectCancelAvailability` never consult the match set either,
  and that the test is real — snapshotting match tuples *and* stored counterparty statuses either side
  of the act, and checking the projected card still lists the survivors with the cancelled parent's
  status riding along.
- **The processor-change guard.** It looked for a bypass and found none: the edit form never renders
  the two selects at all, so the vulnerable path is unreachable there, and the server re-validates
  independently against `SeedConfig`.
- **Warn without blocking.** It confirmed neither reject function has any clause referencing a matched
  quantity, and that the client's prompt is a confirmation and never a gate.

It also checked, and found no issue with: the arithmetic allow-list still being exactly two files with
every new form passing the scan; `Apg.Domain`'s purity; `models.ts` mirroring `Dtos.cs` field for
field; `applyPatch`'s upsert and calendar adoption, with their tests; and — worth recording — that
`RecordWriterTests` shares `SeedFixture.Data.Matches` by reference but that **no test in the project
mutates a `Match` object's fields**, so nothing leaks across classes under xUnit's parallelism. If a
later suite ever needs to mutate a match, it must clone that list too.

Three findings. Disposition:

1. **`Cancel` is disabled on an already-cancelled record but `Edit` is not, and the form said nothing
   about it** (low/medium; the reviewer flagged it for a decision rather than as a bug, noting the
   phase document puts validation beyond its own list out of scope). **Half fixed, deliberately.** The
   *edit* stays permitted: the phase restricts editing by field and never by status, and refusing it
   here would sit oddly beside Phase 6, which lets a **Confirmed** match be edited behind a prompt.
   What was wrong is that nothing said so — and a cancelled record is off both columns' default
   filters, so whoever opened the form may not have registered that the card was struck through. Both
   forms now carry a line when the record is cancelled: *"Saving changes it; it does not reinstate it,
   and its matches are unaffected either way."* Three tests pin it, including that the save still goes
   through. There is no un-cancel in pass 1, which is what makes the sentence worth saying.
2. **The Angular initial bundle grew to ~959 kB against a 500 kB budget** (informational). Not fixed
   and not a Phase 7 defect: the budget has been exceeded since Phase 3, the build is green, and the
   1 MB error threshold in `angular.json` is still clear. Five new dialogs is the growth. **It is now
   within 41 kB of the error threshold** — the first thing Phase 8 should know if a build starts
   failing, and the remedy is lazy-loading the record forms or raising the budget, not deleting them.
3. **The dialog form-field density fix is well-scoped and intentional** (not a defect; the reviewer
   confirmed it rather than flagged it). Recorded above.

### Watch out for

- **`RecordWriter` must never grow a clause about matches.** Not on an edit, not on a cancel. Both
  omissions are requirements — 4.4/4.5 and 5.2 — and both look like missing validation to a reader who
  has not read them. The domain's `CanCancelProcessorSpace` / `CanCancelAvailability` take the record
  and nothing else for the same reason `CancelProcessorSpace` does: a gate that were handed the match
  set is a gate that can come to depend on it.
- **A record write's `weeks` is load-bearing, not bookkeeping.** Drop it and a record created beyond
  the loaded calendar places into no band and silently does not appear. If a later phase adds another
  record write, it must return `RecordWriteResultDto` too.
- **`applyPatch` upserts, so a patch with an unknown id now *adds* a record.** A future write that
  returns a record the screen should not show would add it rather than ignore it.
- **The two record-edit request types are the same fields by coincidence, not by rule.** The demand one
  is deliberately shorter (no processor, no stock class). Merging them would make requirement 4.2's
  restriction look like an oversight and would quietly permit re-pointing a booked slot.
- **An edit of any record at any status is permitted**, including a Confirmed or Cancelled one. The
  phase document restricts editing by field, never by status, and this is debug tooling. If that is
  wrong for a demo, it is a one-line gate in `RecordWriter` — but note Phase 6 decided the equivalent
  question for *matches* the other way (edit a Confirmed match, with a prompt), so refusing it here
  would be the inconsistent choice.
- **A record created months out extends the calendar and adds interior empty week bands.** Only the
  runs at each *end* are trimmed (§9.3), so a January delivery drawn from a September screen brings a
  run of empty headers with it. That is the calendar being honest, and it is on the browser checklist
  as a "looks wrong, is correct".
- **A newly created space outside the seeded price table's range (weeks −4 to +8) has no default
  price**, and the quantity prompt says so. Correct, and it will look like a bug in a demo if nobody
  has read this.
- **The dialog label fix is unverified on screen.** It is derived from Material's own source rather
  than guessed, and every dialog in the application depends on it. Section H of the browser checklist
  puts it first for that reason.
- **`RecordWriterTests` clones the shared `SeedFixture` data.** That fixture is one lazily-generated
  object graph shared across every test class in the project, and this is the first suite that mutates
  records. Anything that edits or cancels must clone; a test that forgets will corrupt whatever runs
  after it, in a way that looks like a bug somewhere else entirely.
- **`no-domain-arithmetic.spec.ts`'s allow-list is still exactly two files**, and the new forms are
  inside the directory it scans. If a later phase wants a Material datepicker here, it must first
  explain to that test why a `Date` is now acceptable.
- **The API still locks `Apg.Domain.dll` while it runs.** It bit again at the start of this phase — an
  instance from another session was running. `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`,
  stop the `Apg.Api.exe` child.
- **Long `bash` heredocs still fail past roughly 150 lines** in this environment, exactly as Phase 6
  recorded. Every new file here was written in chunks under ~120 lines.

### New commands, dependencies, conventions

No new packages. All recorded in CLAUDE.md as well.

| What | Where |
| --- | --- |
| The forms' vocabularies | `GET /api/reference-data` → `ReferenceDataDto` |
| Locations with their farmers | `GET /api/locations` → `LocationOptionDto[]` |
| Create / edit / cancel a space | `POST /api/processor-spaces`, `PUT /api/processor-spaces/{id}`, `POST /api/processor-spaces/{id}/cancel` |
| Create / edit / cancel a record | the same three under `/api/livestock-availability` |
| The record write shape | `RecordWriteResultDto` — one record, plus the recomputed `weeks` |
| Server-side record rules | `src/Apg.Api/Contracts/RecordWriter.cs` |
| Cancel gates | `RecordCancellation.CanCancelProcessorSpace` / `CanCancelAvailability` |
| The client seam | `web/src/app/matching/record/record-actions.ts` |
| The counterparty flag | `MatchDto.spaceStatus` / `.availabilityStatus`, `cancelledPartnerCount` in `card/card-chrome.ts` |

- One spec: `npx ng test --watch=false --include=src/app/matching/record/record-actions.spec.ts`
- One rule's tests: `dotnet test --filter "FullyQualifiedName~RecordWriterTests"`
- **Conventions now enforced by tests rather than by discipline:** cancelling a record cannot touch its
  matches, in the domain and through the projection (`RecordWriterTests`); a space edit cannot carry a
  processor or a stock class (asserted on the request type itself); reducing a quantity below what is
  matched is *permitted* and produces `Over-committed`; a created record is added to the screen rather
  than dropped, and a write's new calendar is adopted (`matching-screen.spec.ts`).

Test counts at close: `Apg.Domain.Tests` **153** (151 at the end of Phase 6), `Apg.Api.Tests` **122**
(108), Angular **221 across 22 files** (178 across 19). `npm run build` succeeds with the existing
initial-chunk budget warning only — **959 kB** against a 500 kB budget, up from 881 kB.

---

## Phase 7 addendum — the match window, the cancelled-partner badge, and one domain rule

**Completed:** 2026-09-01
**Status:** Complete
**Not a new phase.** Four changes Mark asked for after looking at the finished screen. The Phase 7
entry above stands; these amend it, and the fourth amends the roadmap.

### 1. The match modal's hints now wrap properly, and the ceiling moved into its field

**`subscriptSizing="dynamic"` on all three fields — and this was a real bug, not a preference.**
Material's hint and error wrappers are `position: absolute` inside a fixed-height subscript, so a hint
that wraps overflows it silently and paints over what follows. Phase 6's log claims the `height: auto`
in `.fields` fixed that; **it cannot have done**, because an absolutely positioned child contributes no
height for `auto` to size to. `dynamic` is Material's own switch to `position: static`, and it is the
half that was missing. Both halves are needed and the stylesheet now says so.

**The wrapping margins are 8px a side** (`.mat-mdc-form-field-hint-wrapper`,
`.mat-mdc-form-field-error-wrapper`), against Material's default of 16px. Worth recording precisely,
because the instruction was "widen the margins … each side half the current margin on the left" and the
measured default is symmetric at 16/16 — so 8px a side is the stated number and it *narrows* the
indent rather than widening it. If the intent was for the hint to wrap sooner, the figure to raise is
those two `padding` values, in one place, and nothing else moves.

**`Ceiling 472 = the availability's 177 unmatched, plus this match's own 295.` is now the quantity
field's own hint**, and its `mat-error` when the entry goes past the ceiling. The `<p class="ceiling">`
note under the row is gone — leaving both would have printed the same sentence twice, 10px apart.
This overturns design-system.md 11.4.4's "under the fields" and the Phase 6 decision that put it
there. `quantityHint` and `quantityCaption` are deleted.

### 2. The cancelled-partner flag is now loud

Mark asked for it "strongly shown as needing attention — e.g. a solid red box". So:

- in the expanded match table, the counterparty cell's `.orphan` is a **solid `$lms-error` box** with
  white text, not muted grey;
- on the **collapsed card**, a solid `$lms-error` square sits behind the **expand chevron** — the right
  control to mark, since it opens the very table that names the match. The chevron's `title` becomes
  the explanation.

**The quieter line-2 glyph the phase shipped is gone**, replaced by the chevron badge: two markers of
one fact on a 52px row is clutter, and only one of them can carry the sentence.

**This is a deliberate exception to "status carries no hue"**, and the reasoning is worth keeping: it
is not a status being reported — the card's own status, meter and counts are all untouched by what
happened on the other side — it is *work outstanding*, and `$lms-error` is the semantic token
design-system.md 2 already reserves for consequential things and is no part of the quantity ramp.

### 3. The domain rule: a match tied to a cancelled record consumes nothing

**This is the one to read.** Asked as "the quantity of a cancelled match should be ignored when
calculating unmatched", which is already true and has been since Phase 1 — verified live before
changing anything: cancelling match #20 (12 head) moved space #37 from 39 unmatched to 51 and
availability #35 from 0 to 12. What was *not* true is the case Mark was actually looking at, and
confirmed when asked: a match to a **cancelled record**. Those went on holding stock forever.

The seed showed the cost plainly: availability **#30** read 108 unmatched of 330 because 143 head were
matched to cancelled space #7, and availability **#10** read **0** unmatched — which put it below the
supply column's `unmatched > 0` default filter, so a record with 32 saleable head was **invisible**.

Now: **a match stops consuming the *other* record's quantity once its own record is cancelled.** After
the change #30 reads 251, #48 reads 220 and derives `Booked` again, and #10 reads 32 and is back on
screen. Cancelled spaces #7 and #16 keep their own figures unchanged.

**Three things about the shape of it:**

1. **It is asymmetric, and that is the half a future change will get backwards.** It is always the
   *counterparty's* status that decides. Tallying a space drops matches whose availability record is
   cancelled; tallying a record drops matches whose space is. A cancelled record's own figures are
   untouched by its own cancellation, which is what keeps its card readable while somebody deals with
   the matches it left behind.
2. **`CancelledRecords` is a required parameter, not an optional one.** It is on both tallies,
   `AvailabilityStatus.Derive`, `ProcessorSpaceRules.CanConfirm` / `ConfirmBlockedReason`,
   `MatchCreation.Propose` and the three-argument `MaxMatchQuantity`. Required because every one of
   them is wrong without it and wrong in the direction that hides supply — and making it required is
   what let the compiler find all sixty-odd call sites rather than leaving a silently stale one.
   `CancelledRecords.None` is honest in a unit test over hand-built matches and reproduces the old
   arithmetic exactly; `SeedFixture.Cancelled` is what the API tests pass, because the seed really does
   hold two cancelled spaces and a test passing `None` would assert arithmetic no endpoint performs.
3. **The ceiling add-back moved with it.** `MaxMatchQuantity` adds a match's own quantity back only if
   that match was subtracted in the first place — live *and* not tied to a cancelled record. Adding it
   back for an orphan would hand out supply it never took.

**It is still not a cascade**, and the distinction is now three-way: a cancelled record's matches keep
their status, their quantity and their place on both cards, and must still be cancelled by hand; what
changes is only what the record on the other end may say about its own stock.

`Documents/ROADMAP.md`'s "Domain rules the build must not get wrong" is amended — its
`matchedInclDraft` bullet was the old rule stated as fact and would have misled Phase 8.

### Tests

- **New `tests/Apg.Domain.Tests/CancelledRecordTests.cs`** — seven cases: the supply release, the
  asymmetry, a cancelled match *and* an orphan both ignored, the record deriving `Booked` again, a
  space that can no longer be confirmed on orphaned matches, the ceiling add-back, and the freed pair
  becoming matchable again. Each asserts against `CancelledRecords.None` as well, so the test says what
  changed rather than only what is now true.
- **`MatchEditTests.The_ceiling_never_permits_over_committing_a_record` was rewritten, not deleted.**
  It computed its expected ceiling by summing every *live* sibling; under the new rule it read 26 where
  the ceiling is legitimately 58. It now sums the *consuming* siblings, which keeps the invariant it
  exists for and would still catch the requirements document's "originally available".
- Two new match-modal specs: the ceiling sentence is in the field's own hint and in no note, and every
  field's subscript is dynamically sized (jsdom cannot see an overlap, but it can see the attribute
  whose absence causes one).
- Two new card specs: the chevron badge appears and clears with the data, and the badge is on the
  element the stylesheet paints.

Test counts at close: `Apg.Domain.Tests` **160** (153), `Apg.Api.Tests` **122** (unchanged), Angular
**224 across 22 files** (221).

### Watch out for

- **`MatchQuantities.Tally`, `MatchedInclDraft` and `MatchedExclDraft` still filter on `IsLive` alone.**
  They are the arithmetic, not the rule about which matches reach it — `ConsumingSpace` /
  `ConsumingAvailability` do that, and the two scoped tallies are the only public way in. Do not call
  `Tally` directly from new code.
- **`LiveMatchDtos` still uses `IsLive`, deliberately.** An orphaned match must keep appearing on both
  cards: it is still there, still needs cancelling, and the red badge is drawn from it. It consumes no
  quantity and is still listed — those are two different questions about the same match.
- **A record can now derive `Booked` while showing a red badge.** Nothing is holding its stock, and a
  match still needs dealing with. Both are true.
- **The seeder passes `CancelledRecords.None` in `ApplySpaceStatuses`, and that is correct** — nothing
  is cancelled until that pass's own last lines, and no availability record is ever cancelled by the
  seeder. The comment there says so; do not "fix" it to a real ledger without re-reading the ordering.
- **The match modal's two wrapping fixes are one fix in two files.** `subscriptSizing="dynamic"` in the
  template and `height: auto` in the stylesheet: either alone leaves the overlap. The quantity prompt
  and the Phase 7 record forms still carry only the stylesheet half — **they have the same latent bug**
  and it will show the moment one of their hints wraps. The prompt's price hint already does at
  narrow widths.
- **`dotnet build` failed with MSB3027 twice more during this work.** The API was running from this
  session both times.

---

## Phase 8 — Polish & Demo Readiness

**Completed:** 2026-09-01
**Status:** Complete
**This is the last entry in pass 1.** It doubles as the hand-off to whoever picks up pass 2, so it
carries more than a phase entry normally would: what pass 1 is, what it deliberately is not, what is
known to be rough, and where the seams are for the deferred work.

### What shipped

The prototype survives being handed to someone who has never seen it. `Reset demo data` sits in the
top bar and puts the whole demo back; the screen now has a loading state, an API-unreachable state
with a way out, and an empty-column state; the quantity ramp is consistent on every surface it appears
on, which it was not; the six-dot grab glyph design-system.md §10 asked for exists; and
`Documents/DEMO.md` is a walkthrough that names every record by id and figure, so nothing is hunted for
while people watch.

Nothing in `Apg.Domain` or `src/Apg.Api/Contracts/` was touched. This phase is entirely client, docs
and tests.

### The three decisions taken with Mark before building

1. **`Reset demo data` lives in the top bar**, immediately left of the `# DEV ENVIRONMENT #` flag,
   rather than on the matching screen or in the sidebar. Three reasons: the flag beside it already
   means "this is not the real thing" in this application, so the control inherits the reading rather
   than arguing for it; a shell control costs the 596px list nothing, where the matching-screen option
   cost about half a card per column; and a reset replaces the **whole database**, not one screen's
   data. design-system.md §14.1 records it, including the white-on-petrol variant of §14's stroked
   treatment — petrol-on-white cannot sit on a petrol bar.
2. **The phase closes on code-level verification**, with the browser pass handed to Mark. No browser
   automation exists in this session, as in Phases 3, 3b, 4, 5, 6 and 7.
3. **The Angular budget was raised rather than the dialogs lazy-loaded** — see "New commands" below.

### Decisions made during the build

1. **The reset order is re-seed → clear preferences → reload, and two of the three orderings are
   wrong in ways that fail silently.** Clearing the preferences before the POST takes the operator's
   filters with a reset that then fails; reloading before clearing them reloads into the old filters
   and leaves the clear to a page that no longer exists. `demo-reset.spec.ts` asserts the sequence,
   not just the occurrences.

2. **The reload is deliberate, not lazy.** A refetch would leave behind everything that is not
   fetched — expanded cards in `CardStateStore`, a drag in flight, an open dialog, the in-memory half
   of `MatchingPreferences`. A reset that leaves a card expanded on a match that no longer exists is
   worse than one that takes a second, and the one thing this control must be is trustworthy: it is
   what a demo falls back on when something has gone wrong. `DemoReset.reload()` is `protected` so a
   spec can override it without a real navigation.

3. **The quantity ramp's four ink colours now have exactly one definition** — the `quantity-ink`
   mixin in `_card-geometry.scss`. **This started as an audit and found a real defect.** The four
   rules had lived inside the `card-shell` mixin, which `card-expansion.scss` does not include, so the
   expanded card's `Quantity unmatched` value carried a ramp class **that nothing painted**: an
   over-committed record's `-24` rendered in ordinary black on the one surface that spells the state
   out in words. Two further copies sat in `match-modal.scss` and `quantity-prompt.scss`. A colour
   defined four times is a colour that comes to differ in three of them. Include the mixin; never
   redeclare `.q-over`.

4. **The six-dot grab glyph is positioned, not laid out.** design-system.md §10 puts it "left of the
   chevron", and a real cell there would push the card's trailing edge from 32px to 42px while the
   header strip stayed at 32px — the Unmatched column would stop lining up with its own heading, which
   §16.10 warns is "invisible in code review and glaring on screen". It is absolutely positioned in
   the card body's own 8px right gutter, 6 × 10px, and only its opacity changes. The name column keeps
   its 114px and §10's "nothing resizes" stays literally true. It is not on the stay-behind card: that
   is the shadow a lifted card leaves and nothing about it is grabbable.

5. **The empty-column state is checked *before* the filtered-empty state**, and its condition is
   "nothing loaded for this side" (`totalCount() === 0`), not "nothing shown". The two answer
   different questions and only one of them has a filter to blame: offering `Clear filters` on a
   column with no records at all sends an operator hunting for a cause that does not exist. Phase 4's
   log parked this state with "Phase 7 or 8" and Phase 7 declined it as outside its own requirements.

6. **Only the *opening* of a card expansion is animated.** 120ms, opacity and a 2px rise — not a
   height, because a match table of unknown length has no final height to animate to, and 120ms of a
   growing block is 120ms during which the card under the pointer is still moving. Collapse is
   instant: `@if` removes the element and `@angular/animations` is not installed (Angular 22 makes it
   optional; Phase 4 recorded the absence). A package for 120ms of closing motion is not worth it.

7. **The reset dialog carries no record counts.** It said "the same 40 processor spaces, 50 records
   and 25 matches"; the closing review pointed out that nothing guards a sentence in a dialog, and a
   count that is true today is silently wrong the day the seeder is tuned. The figures live in
   `Documents/DEMO.md` instead, where `ResetRestoresTheSeedTests` guards them.

8. **`Data/stock-class-configs.csv`'s hex colours stay unused, and this is Phase 8 declining its own
   requirement 3.1.** Resolved question 16 commits hue exclusively to the quantity meter and the
   roadmap's resolved questions outrank a phase document; Phase 2's decision 1 settled it and said
   "Phase 8 inherits this decision rather than re-deciding it". Twenty-odd saturated swatches would
   destroy the three-colour ramp the whole screen is scanned for. The CSV's `icon` column informs the
   species shapes, and it only partly overlaps our lists — it has **no row at all** for `Deer`,
   `Cattle`, `Sire Bull`, `Mixed Cattle`, either `GFNB` class or either `Nat Beef` class, which is why
   the shapes are a table in `stock-classes.ts` rather than a lookup into that file.

### The pink Over-committed state — forced, and then looked for (requirement 2.3)

**Forced live against the API.** `PUT /api/livestock-availability/6` with `quantityAvailable` 144 →
100 against 122 already matched returned `unmatched: -22`, `quantityState: "Over"`,
`quantityStateLabel: "Over-committed"`, `status: "Pending"` — and **all three matches unchanged in id,
quantity and status.** `Pending` rather than `Confirmed` is correct: resolved question 5 requires
`unmatched == 0` exactly. The database was reset afterwards.

Those exact figures are now the fixture in `card/quantity-states.spec.ts`, alongside seeded space
**#4** (Alliance Group Dannevirke, 726 against 660, `unmatched -66`) for the blue case, so the spec
breaks if either state stops being reachable rather than passing against numbers invented to suit it.

**Then no ordinary flow was looked for again**, rather than trusting Phase 7's table. Every path that
moves either side of `unmatched = quantityAvailable − matchedInclDraft` on a supply record was
re-walked against the current code, and Phase 7's answer stands unchanged: the drag caps at remaining
supply in `MatchCreation.Propose` and again in `MatchWriter.Reject`; the edit ceiling is the
three-argument `MaxMatchQuantity` enforced in `RejectUpdate`, which both `PUT` and the confirm
endpoint go through; confirming moves no quantity; cancelling and deleting only ever *raise*
unmatched; a new record has no matches. **Editing the record's quantity downwards is the only route,
and it is the intended one** — warned about twice and refused by nothing. `ResetRestoresTheSeedTests`
also asserts a reseed leaves no record over-committed, so pink cannot arrive in the demo data by
accident.

**What has still not been seen is how it renders.** Section I of the browser checklist puts it third.

### Stock-class coverage (requirement 3)

`card/stock-class-coverage.spec.ts` reads **both vocabularies out of `SeedConfig.cs`** — the same
read-a-source-file technique `no-domain-arithmetic.spec.ts` uses, and for the same reason: a copy of
the lists in TypeScript is the drift the architecture exists to prevent. It asserts every class is
**explicitly mapped** rather than merely handled, because the fallback is indistinguishable from a
mapping once `stockClassTile` has returned, and `GFNB premium` rendering as `GF` would be working and
wrong. All sixteen classes across the four lists are mapped. It carries an anti-vacuity test: a parser
that stopped matching would return an empty list, and "every class in an empty list is mapped" is true
and worthless.

`MAPPED_STOCK_CLASSES` is exported from `stock-classes.ts` for that spec alone. Application code
should call `stockClassTile` and never consult it.

### The `undefined` / `NaN` / `Invalid Date` sweep — and what it taught

`matching/nothing-renders-raw.spec.ts` renders both cards, both expansions and the match modal with
**every optional field null at once** and sweeps for the four forbidden strings.

**It found nothing, and the first version of it was nearly worthless.** Verified by removing the
`|| '-'` from the space card's delivery time and watching the sweep pass: **Angular interpolates
`null` as an empty string, not as the word**, so a template that drops a guard prints *nothing* — and
an empty string contains none of the four strings being looked for. The failure mode is a blank cell,
not a raw value.

So the spec has two halves that catch different things, and it says so:

- The **sweep** covers what it genuinely covers: strings assembled in TypeScript (the modal's
  sub-lines, `matchBreakdown`, `orphanedTitle`, `counterparty()`) and every `title` attribute, which
  is a hover string somebody really does read and where an unguarded field survives longest.
- The **fallback assertions** are the falsifiable half — that the space card's meta reads
  `Rangitikei · -`, that a match with no price says `no default price` and never `$0.00`, that the
  modal says `no time set` and `no farmer on file`. Removing a guard fails one of these by name.

The codebase turned out to be careful about this already; every optional field on every surface was
guarded before Phase 8 touched it. What was missing was the proof.

### Requirements not built, and why

- **§3.1's hex colours** — decision 8 above.
- **Nothing else.** Sections 1 to 9 were built.

### Held next to `ExistingAppScreenshots/*.png`

All four PNGs were read and compared against the finished markup and tokens. §16a's four sanctioned
divergences hold. **One more was found and recorded rather than fixed**, as design-system.md §16a.5:

> **Sorting is a control, not a column header.** LMS sorts by clicking a column header, which then
> carries the arrow (`DATE ↓` in Purchases and Killsheets). Ours is a right-aligned sort control on
> the filter row and the micro-cap strip is not clickable.

Not fixed, for three reasons: the strip's cells are 40–112px and several would not hold a label plus
an arrow; sorting here reorders cards **within** week bands rather than the whole list, so a header
arrow would overstate what it does; and the sort control is Phase 4's, not this phase's, so changing
it would be reopening a closed phase in a polish pass. It is the divergence a pixel-for-pixel
comparison notices next, which is exactly why it is written down beside the other four.

Nothing else was off-family. The shell is faithful down to the user's name in the sidebar header, the
version and copyright block, and the inert nav list in its original order with `Logout` last.

### Review findings

A sonnet subagent reviewed **the whole application**, as the phase document asks, not just this
phase's diff. It ran `dotnet build`, `dotnet test`, `npm test` and `npm run build` itself, and went
further than asked: it hit the running API against a freshly reset database and **checked every figure
in `Documents/DEMO.md`** — space #1's 59/77/29, space #4's 726/660/−66, space #5's exact fill, space
#37's 39 unmatched, availability #6's 144/122/22, #7's 25, the `34 of 40` and `42 of 50` counts, and
all three match breakdowns. All matched.

**On the question the phase document asks by name — has any domain rule drifted during the build?
No.** It re-derived `MatchQuantities`, `CancelledRecords`, `QuantityTally.Unmatched` (correctly off
the incl-draft sum), `MatchCreation`'s default and both ceilings, `AvailabilityStatus.Derive`,
`ProcessorSpaceRules`, `MatchLifecycle` and `RecordCancellation` from the roadmap rather than reading
the code back to itself, and confirmed the asymmetric cancelled-counterparty rule is applied the right
way round. It confirmed `no-domain-arithmetic.spec.ts`'s allow-list is still exactly two files and
that the spec is self-verifying rather than vacuous.

Four findings. Disposition:

1. **The error panel and the columns were independent conditionals** (correctness, and the one real
   bug). The three reads land independently, so a `week-bands` call that succeeded while
   `processor-spaces` failed would draw the "API unreachable" panel **above a column that looked
   populated** — worse than either state alone, because it invites the operator to trust what is on
   screen. **Fixed:** the four states are now one `@if / @else if` chain and an error outranks
   everything. Two tests added, and the first was verified to fail against the pre-fix template:
   `shows the error alone when one read fails and the others succeed`, and
   `re-issues all three reads when the error panel offers a way out`.
2. **No spec anywhere under `shell/demo-reset/`** for the reset's ordering or its error path
   (quality; fair, given it is the phase's headline destructive feature). **Fixed:**
   `demo-reset.spec.ts`, four cases — the order as a sequence, `Keep it` being inert, a dismissed
   dialog (Escape and a backdrop click both close with `undefined`, and neither is a yes), and a
   failed re-seed keeping the stored preferences and saying so.
3. **A tautologically-written assertion** in `quantity-states.spec.ts`
   (`expect(x).toBe(cond ? x : y)`). It was not actually vacuous, but it read as if it might be.
   **Fixed** to a plain `expect(...).not.toBeNull()` with a message.
4. **The reset dialog's hardcoded seed counts were unguarded.** **Fixed by removing the counts**
   rather than by adding a test — decision 7 above.

It found no domain-rule drift, nothing new for pass 2 beyond what the roadmap's deferred list already
names, and no other correctness bug in the application.

### What pass 1 is

**The matching screen, for APG, and nothing else.** One screen, inside the real LMS shell, that
creates and manages both records and matches:

- Two week-banded card columns, filterable and sortable per column, swappable on a flip button, with
  every preference persisted.
- Drag one card onto a card in the other column to draft a match; the quantity, the ceiling, the
  default price and the refusal all come from the server.
- A match's whole life: open from either side by id alone, edit, delete a draft, cancel with one of
  three reasons, confirm — and confirm a Processor Space.
- Records created, edited and cancelled from marked debug tooling.
- Every computed value — both sums, unmatched, the derived statuses, the confirm gates, the week
  commencing Sunday, the date labels — is C# in `Apg.Domain`, reaches the client on the DTO, and is
  never recomputed in TypeScript. Two arithmetic sites exist in `web/` and both are allow-listed by
  name.

### What pass 1 deliberately does not do

**None of the following is a defect.** They are in `Documents/DEMO.md` too, because the demo is where
someone will notice.

- **No record detail pages.** Everything about a record is on its card and its expansion.
- **No Match list view — so a cancelled match is visible nowhere.** It is retained in the database
  with its reason; `GET /api/matches/{id}` 404s on it and both parents' `matches` arrays exclude it
  (resolved question 4). This is the first thing to explain at a demo.
- **No farmer or agent submission flow.** The `+ Add` buttons and the `Edit` / `Cancel` controls are
  demo scaffolding, marked three ways over precisely so they are not mistaken for it.
- **No login and no roles**, so no per-processor visibility gating (ANZCO the most, SFF a restricted
  set once confirmed, Alliance Group none). Every screen is the APG view.
- **No notifications**, so `Notified` has no UI transition in. It is **not inert in the rules** — it
  counts in both matched sums and blocks confirmation on both sides.
- **No default-pricing maintenance**, **no weekly roll-ups**, **no Finance Stock draw-down** against
  `purchases.csv`.
- **No keyboard drag path** (resolved question 14). A mouse is assumed. Its absence is a decision and
  must not be helpfully corrected.
- **A deliberately small back end**: SQLite, `EnsureCreated`, no migrations, no auth.

### Known rough edges that survived pass 1

- **The browser pass has still never been run in full.** `Documents/browser-checklist.md` is nine
  sections; two items are ticked. Every geometric claim and every pointer path in this build is argued
  for rather than seen. This is the largest single piece of unfinished business in pass 1, and it is
  ten minutes of work.
- **The Angular initial bundle is ~960 kB.** Under the raised budget, well over any sensible one.
- **`showing n of m` counts records, not cards**, which is right, and reads oddly the first time.
- **Delivery time is free text and cannot be sorted chronologically.** Offered as a sort field because
  requirement 4.1 asks for every displayed field; alphabetical, which puts `Yard by 6:30am` last.
- **The seeded price table runs weeks −4 to +8.** A record created outside it has no default price.
  The prompt says so in words; it will still look like a bug to anyone who has not read this.
- **`Documents/design-system.md` §9 is a different section from the one Phase 2 and Phase 3 cite**,
  and the Phase 2 canvas artifact still shows the carry-over design resolved question 17 removed. The
  document says so at the top of §9 and the document wins.

### Where the seams are for pass 2

| Deferred work | Where it attaches |
| --- | --- |
| **Record detail views** | `MatchingProjection.SpaceById` / `AvailabilityById` already return one record's full DTO, and `card-expansion.ts` already renders every field and both sums. A detail page is a route around that component, not new projection work. |
| **The Match list view, and cancelled matches** | This one needs a **new endpoint and a new shape**. `MatchDto.CancellationReason` exists on the type and is always null on every current endpoint; both read endpoints exclude cancelled matches from `matches` entirely, and `GET /api/matches/{id}` 404s on one. Phase 1's log said this explicitly: do not "fix" the existing shapes to carry cancelled matches — give the list its own. |
| **The farmer/agent flow** | `RecordWriter` is already the pure, validated write path for both record types and `POST /api/livestock-availability` already exists. What is missing is the journey, the Purchase draw-down for Finance Stock, and an owning identity. The debug form is **not** a starting point — it is deliberately unlike the real thing. |
| **Roles and per-processor gating** | Nothing in the build assumes a viewer. The gate belongs in `MatchingProjection`, which is the one place that decides what reaches the wire, and `LiveMatchDtos` is the method that would need to know who is asking. Do not gate in the client. |
| **`Notified`** | Already a member of `MatchStatus`, already counted in both sums, already blocks both confirm gates. What it lacks is a transition and a visual treatment — design-system.md §3.1 says give it its own left-edge pattern rather than reusing Pending's. |
| **Default-pricing maintenance** | `PriceTable` is built from seeded `PriceTableEntry` rows and keyed on processor × PS stock class × week. A maintenance screen is CRUD over that table; the lookup does not change. |
| **Weekly roll-ups** | `buildBoard`'s `BandMeta` already rolls up per band, client-side, deliberately — because filters change what is in a band. A roll-up *view* is a different thing and would want its own endpoint. |

### Watch out for

- **`RecordWriter` must never grow a clause about matches**, and the domain's cancel gates must keep
  taking the record and nothing else. Both omissions are requirements and both look like missing
  validation to a reader who has not read them.
- **The cancelled-counterparty rule is asymmetric** and that is the half a future change will get
  backwards. It is always the *other* record's status that decides. `CancelledRecords` is a required
  parameter on every rule downstream of it, deliberately, so the compiler finds every call site.
- **`MaxMatchQuantity` has two overloads and each is wrong in the other's place.** Go through
  `MatchWriter.EditCeiling` for edits.
- **A wrapping `mat-hint` needs both halves** — `subscriptSizing="dynamic"` on the field *and*
  `height: auto` on the subscript wrapper. Phase 8 added the missing template half to the quantity
  prompt and both record forms; before that only the match modal had it, and Phase 7's addendum had
  flagged the other three as carrying the latent bug.
- **Never redeclare `.q-under` / `.q-exact` / `.q-over` / `.q-pink`.** `@include geo.quantity-ink;`.
- **`.over` is two different classes.** The fill meter's root takes `over` when the state is Over, and
  the card's line-2 label is also `.over`. Angular scopes their styles so nothing leaks, but a bare
  `querySelector('.over')` finds the meter and reads the numeral. Scope to `.l2 .over`.
- **`applyPatch` upserts**, so a patch with an unknown id *adds* a record.
- **The API still locks `Apg.Domain.dll` while it runs.** It bit twice in this phase, both times from
  this session. `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"`, stop the `Apg.Api.exe`
  child; its `dotnet run` host exits with it.
- **A node script editing repo files must normalise CRLF on read**, as Phase 2 recorded, and must not
  put a `$` followed by a single quote in a `String.replace` replacement — that is the "everything
  after the match" pattern and it silently truncated a line here.
- **Long `bash` heredocs still fail** past roughly 150 lines, exactly as Phases 6 and 7 recorded. This
  entry was written to a file and appended.

### New commands, dependencies, conventions

**No new packages.** All recorded in CLAUDE.md as well.

| What | Where |
| --- | --- |
| Reset demo data | `web/src/app/shell/demo-reset/` — `demo-reset.ts` (root service) and `reset-demo-data.*` (the dialog, which decides nothing) |
| The reset endpoint's client method | `ApiClient.resetDatabase()` |
| Forgetting the stored preferences | `clearStoredPreferences()` in `matching/filters/matching-preferences.ts` |
| A column with nothing loaded | `matching/column/empty-column.ts` |
| Loading and API-unreachable | `matching-screen.html` / `.scss`, the `.state` block |
| The one definition of the ramp's ink | `@mixin quantity-ink` in `matching/_card-geometry.scss` |
| The stock classes a tile is mapped for | `MAPPED_STOCK_CLASSES` in `card/stock-classes.ts` — for its spec only |
| The demo walkthrough | `Documents/DEMO.md` |

- One spec: `npx ng test --watch=false --include=src/app/shell/demo-reset/demo-reset.spec.ts`
- One rule's tests: `dotnet test --filter "FullyQualifiedName~ResetRestoresTheSeedTests"`
- **`web/angular.json`'s budgets were raised**: initial 500 kB/1 MB → **1 MB/1.5 MB**, and
  `anyComponentStyle` 4 kB → 6 kB warn. Decided with Mark. The bundle has been over 500 kB since Phase
  3 and was within 41 kB of the old hard error after Phase 7's five dialogs; for a prototype whose
  whole job is one screen the remedy is a bigger budget, not lazy-loading the forms. **`npm run build`
  is now clean with no warnings for the first time in the build** — if it starts warning again,
  something has grown, which is worth knowing rather than drowning in a standing warning.
- **Conventions now enforced by tests rather than by discipline:** every stock class in either
  vocabulary has an explicit tile (`stock-class-coverage.spec.ts`); no surface renders a raw
  `undefined`/`NaN`/`Invalid Date`, and absent values render `-` (`nothing-renders-raw.spec.ts`); the
  ramp is keyed on state **and** side, and the over states carry a word and a numeral as well as a
  colour (`quantity-states.spec.ts`); the reset's three steps happen in order and a failure keeps the
  preferences (`demo-reset.spec.ts`); one screen state at a time (`matching-screen.spec.ts`); a reseed
  restores every section 4.7 case (`ResetRestoresTheSeedTests`).

Test counts at close: `Apg.Domain.Tests` **160** (unchanged), `Apg.Api.Tests` **128** (122), Angular
**252 across 26 files** (224 across 22 at the end of Phase 7). `dotnet build` is clean with 0
warnings; `npm run build` is clean with none.

---

## Interstitial — the legend, and the tile off the cards

Two small changes with Mark, outside the phase plan.

### 1. A legend button, and the dialog behind it

**`matching/legend/status-legend.*`**, opened from a borderless 26px `help` button in the column
header, immediately right of `+ Add`.

design-system.md 3 commits **hue exclusively to quantity** and **pattern exclusively to status**. That
rule is what lets the board be scanned for a colour, and its cost is that status is said in a 6px
hatch — which is not self-explanatory. The first question anyone new to the screen asks is whether the
striped edge is a warning. It is not; on a working board it is the commonest edge in the supply column.
Nothing on the screen was answering that, so this does, in four sections: the four status spines, the
four ramp colours (both over states, side by side, because `Over` means opposite things on the two
sides), the red cancelled-partner badge with the non-cascade stated in words, and the two colour
systems' separation up top.

**The legend draws itself from the real components.** The spines are the `spines` mixin's own classes
and the meters are real `app-fill-meter` instances fed DTO-shaped figures. A legend redrawn by hand is
a legend that comes to disagree with the thing it explains — the same argument as `quantity-ink`'s, and
Phase 8 found what happens when a colour is defined in more than one place. `status-legend.spec.ts`
asserts coverage rather than markup, so a fifth status or a re-keyed ramp fails here.

**Placement is bound to the screen, not to a column.** `MatchingColumn` takes a `showsLegend` input and
`matching-screen.html` passes `flipped()` / `!flipped()`, so the button is always on whichever column
is currently on the right. A help control should stay in the corner it was last found in, unlike
`+ Add`, which belongs to its column and rides the flip with it. One button, not one per column: the
legend explains both sides equally.

Treatment is deliberately **not** section 14's stroked debug button beside it — borderless, muted grey
going petrol on hover, same 26px height so the header's controls keep one baseline. The ring is what
says "debug tool", and this is not one.

**This is a visual decision design-system.md does not cover**, which section 0 asks be recorded rather
than invented silently. It wants a section 14.2 if it is ever formalised.

#### Two layout faults, found by rendering it

Both were invisible to the suite and obvious on screen, which is the argument for the browser pass this
build keeps deferring. Verified by compiling the legend's SCSS standalone and screenshotting the markup
in headless Chrome — worth knowing that this is possible without the API running.

- **`display: contents` rows need `align-self: stretch`.** Each cell carries its own 1px bottom rule,
  because the dissolved row element cannot carry one. Top-aligned, the three cells ended at three
  different heights and the rule arrived as three stubs at three different y positions.
- **Booked's spine is `$lms-divider`, the same colour as every rule on the screen.** On a bordered white
  scrap its 3px sat flush against a 1px border of the identical colour and the two merged into a thick
  corner: the one row in the table that has to demonstrate a *thin* edge showed no edge at all. The
  scrap is now borderless on the zebra tone, where the spine is the only mark in the box.

### 2. The stock-class tile is off both cards

Removed from `space-card.html`, `availability-card.html` and the header strip's `.s-tile` spacer cell —
all three together, because line 1's cells are shared geometry and dropping one from the cards alone
would have unaligned the strip (design-system.md 16.10).

Mark's call, and it overrides design-system.md 7 for the card rows only: the monogram abbreviates a
stock class that line 1 already spells out **in full, two cells along**, so it was saying the same
thing twice in the row's tightest 20px, and the 28px it cost (tile plus gap) went to the name column,
which truncates. A side effect worth having: line 2's `.meta` now starts on the same vertical as line
1's name, which it never did before.

`$col-tile` and the `StockClassTile` component both stay. The tile still appears in the quantity
prompt, the match modal and the drag preview, where there is no adjacent stock-class column and the
tile is the only thing saying what is in play — which is also why `stock-class-coverage.spec.ts` still
guards the mapping.

### State at close

Angular **287 tests across 29 files** (288 briefly, before the legend's tile-shape test went with the
tile). `npm run build` clean, no warnings — initial total **991.11 kB** against the 1 MB warn budget,
which is 9 kB of headroom and worth watching.

**Not done, and left as a question for Mark:** the tile is still on the quantity prompt, the match
modal and the drag preview. If the intent was "no monograms anywhere", those three are the rest of it.

---

## Interstitial — the split date cell

**Why.** Mark, on a 1080p screen: the delivery column's heading read `DELIVE…` and its values read
`26-08-…`. Both clipped, and clipping is what made the board feel broken rather than dense.

The diagnosis matters more than the fix. `$col-date` is a hard 50px and **`.name` is the only column
that flexes**, so a wider screen gives the date nothing — it hands every spare pixel to the processor's
name. `dd-MM-yy` needs ~56px and `DELIVERY` in micro-caps needs ~62px. The column was never going to
fit either at any viewport.

Ten treatments were drawn on a scratch page against the real geometry and the real seed
(`Card Date Treatments`, published as an artifact). Mark picked the stacked one, then asked for it to
use **the card's two existing lines** rather than a two-line stack crammed into one 30px cell — which
was the right call, and is the whole shape of what got built.

### What changed

**The date is now the day on line 1 and its month directly beneath it on line 2.** `26` over `AUG`,
in the same column, aligned to the same heading.

- **`NzTime` gained `DayOfMonthLabel` and `MonthLabel`** plus their formats. Both halves ship
  preformatted on `ProcessorSpaceDto` (`deliveryDayLabel` / `deliveryMonthLabel`) and on
  `LivestockAvailabilityDto` (`availableFromDayLabel` / `availableFromMonthLabel`). The client does not
  slice `deliveryDateLabel` to get them: taking a substring of a date is date handling, and
  `no-domain-arithmetic.spec.ts` is right to forbid it. The full `dd-MM-yy` stays on both DTOs and is
  the hover text on both halves — **that is where the year went**.
- **`.cbody` is a two-row grid, and `.l1` / `.l2` are gone.** A cell cannot sit under line 1's date
  column while line 2 is a ragged flex flow, so line 2 adopted line 1's columns. Every cell is now a
  direct child of `.cbody`, placed by grid area. Row heights are still 17px and 14px with a 3px gutter,
  so the 52px card is unchanged to the pixel.
- **The demand heading is `Date`, not `Delivery`.** The fix for a clipped word is a shorter word, not a
  wider column: the 12px would have come straight off the processor's name, and nothing else in the
  strip is a date. `From` on the supply side is unchanged.
- **`$col-date` did not move.** It is still 50px — see below, because this is the part that is easy to
  get wrong twice.

### The 40px mistake, and what it taught

The obvious move was to narrow the column to fit its new content: a two-digit day over a three-letter
month needs ~26px, so 40px looked generous. It shipped, and two supply cards immediately truncated
their match counts to `2 matches · confir…`.

The reason is that **line 2's trailing run borrows the date column's slack.** `.trail` — over-state
label, match count, status — shares the date column's grid area with the month and is pushed to the
card's edge, so it reaches back across whatever the 26px month leaves. At `$col-date: 50px` that is
184px; at 40px it is 174px. `2 matches · confirmed` beside a `Pending` status needs ~182px, and Pending
is the wider status word, so exactly the Pending cards failed.

So the column's spare width is not waste — it is shared between the two rows, and narrowing it takes
the difference off line 2. Reverted to 50px, and `$col-month: 26px` was added so `.trail`'s max-width
has an exact landmark to stop against rather than a guess. Without that max-width the two would
*overlap* rather than truncate, which is a silent failure instead of a visible one.

### One .NET trap, caught by a test written for it

`date.ToString("d")` is **not** the day of the month. A one-character format string is read as a
*standard* format specifier, so `"d"` is the short-date pattern and yields `08/24/2026` under the
invariant culture. `"%d"` forces the custom specifier. Both compile. `A_single_digit_day_carries_no_
leading_zero` is the test that caught it, and the percent is now commented in `NzTime` as load-bearing.

### Also worth knowing

- **design-system.md 6.1's drop order had to be restated.** On a flex row it fell out of source order;
  inside `.trail` only `.mcount` may shrink, so the count still gives way first and the status icon and
  its word are still the last things standing.
- **The `line-1` mixin is gone.** The header strip is now the only flex row on the screen and declares
  its own; `col-name` and `col-fixed` stay, and are still what keeps the strip and the cards aligned.
- `quantity-states.spec.ts` moved from `.l2 .over` to `.trail .over` — same isolation from the fill
  meter's own `over` class, new home.

### State at close

.NET **291 tests** (160 domain, 131 API — three new). Angular **287 tests across 29 files**.
`npm run build` clean, no warnings; initial total **992.11 kB** against the 1 MB warn budget.

Verified in headless Chrome at 1366 and 1920: `DATE` and `FROM` both render in full, no card truncates
its match count at either width, and the day/month pair aligns to its heading on both columns.

---

## Post-pass-1 tweak — the two match dialogs, 2026-09-07

Mark, looking at the drop prompt and the match modal side by side: the prompt reads well — supply on
top, an arrow, demand beneath, so the block shows the animals travelling — and the modal, which is the
next thing the same operator opens, threw that away for a left/right pair. Three changes, all in
`web/src/app/matching/match/`.

**The modal now stacks its parents the way the prompt does.** `.pair`'s `display: flex` and the `.rec`
`flex: 1 1 0` are gone; the availability block, the `.flow` arrow and the space block are siblings in
that order, full width, the arrow's 4px margins holding them apart. The arrow markup and its rule are
the prompt's, copied verbatim rather than shared — two dialogs, twenty lines, and factoring them into a
component would put a layout decision behind an indirection for no gain. `.fields` went `margin-top:
4px` → `12px`, which is the prompt's figure: the 4px was sized against the side-by-side pair.

Worth recording *why* it was side by side in the first place: design-system.md 11.4.1 argued neither
parent is the subject of the dialog, the match between them is, so neither should sit above the other.
The argument is sound and the layout still lost — 300px a side could not hold a record's identity, its
sub-line and two fact pairs, and in the screenshots most of them truncated. The arrow is what makes the
stack more than a narrower layout: it states a direction the left/right pair only implied.

**The stock-class commentary is gone.** `stockClassesDiffer`, `stockClassNote`, the `@if` block and
`.note`'s rule all deleted. It was §11.4.2, and its case was real — the two vocabularies genuinely do
not map, and `Cows` against `Cow` reads as a typo. But it fires on almost every match (the classes
agree only by coincidence), it says the same thing every time, and the operator made exactly that
judgement seconds earlier at the prompt, which no longer carries the note either. Both classes are
still on screen in each block's tile and sub-line. The spec's two tests for it were replaced by one
asserting the classes are shown *and* the paragraph is not.

**Both dialogs now name the act, not just the record.** `Match 132 head` → **`Draft match: 132 head`**
on the prompt, since `Create match` produces a `Drafted` match rather than a commitment; `Match #26` →
**`Confirm match #26`** on the modal while the match is `Drafted`, and **`Edit match #26`** past it,
where there is nothing left to confirm and the dialog is an editor. The modal's title is therefore a
field (`MatchModal.title`) rather than an interpolation in the template. A static `Confirm match` would
have been a lie on a Confirmed match, whose footer offers `Save changes` and `Cancel match…`.

**State at close.** Angular **288 tests across 29 files** (net +1: two note tests out, three in — the
stacking order, the classes-without-commentary check, and the two titles). `npm run build` clean, no
warnings. Two spec expectations moved with the layout rather than against it: the modal's kicker and
record-id order is now supply-then-demand.

`Documents/design-system.md` §11.1 and §11.4 are updated, both with the superseded wording kept beside
the change. **§11.1 was also stale in a way this uncovered** — it still specified the space above the
availability record and still specified the stock-class note, neither of which the prompt has done for
some time.

### Same day, second pass: the badges and the titles

Mark, from the screenshots: the monogram badge is still beside each name in both dialogs, and the
titles' numbers are not worth the space.

**The tile is out of both dialogs.** §16.10 took it off the card rows and the header strip as match
noise; the two dialogs and the drag chip were the only survivors, and a badge beside a name in a
dialog that also spells the class out in words was the last place it read as meaningful. Both blocks
still name their class — the prompt in the `.cls` cell beside the name, the modal in its sub-line.
`StockClassTile` is no longer imported by either component.

**The drag chip keeps its tile, deliberately.** It has three fields in 200px — species, whose, how
many — and no room to spell a stock class out, so the monogram is the only thing in it that says what
is in hand. That asymmetry is now written down in §11.1 and in the checklist, because it is exactly
the kind of thing a later tidy-up would "fix".

**Both titles now name the processor and plant instead of a number.**

| Was | Is |
| --- | --- |
| `Draft match: 132 head` | `Draft match: ANZCO Kokiri` |
| `Confirm match #3` | `Confirm match: ANZCO Rangitikei` |
| `Edit match #2` | `Edit match: ANZCO Rangitikei` |

The head count followed the quantity field as it was edited — a figure restated 200px above the field
it came from. The match id named a row in the `Matches` table, which no operator sees and no other
screen shows. What an operator cannot recover once the dialog covers the board is *which* of a dozen
near-identical ANZCO slots this is, and that is what the title now says. Both parent blocks still carry
their own record ids, so the modal has not lost an identifier.

`spaceName()` lives in `card/card-chrome.ts` beside the other presentation mappings, not interpolated
in two templates: `plant` is a non-nullable string on the DTO but can be blank on a hand-built record,
and `ANZCO ` with a trailing space in a dialog title is the kind of thing nobody notices until a demo.
Each dialog holds it in one field that the title *and* the space block's name line both read, so the
two cannot disagree.

**State at close.** Angular **291 tests across 29 files** (+3: the prompt's title and badge, the
modal's badge; the modal's title test absorbed the id assertion as a negative). `npm run build` clean,
991.57 kB. Re-verified in headless Chrome by the same three paths — a real drag for the prompt, a
match-table row click for each modal state — and the checklist table above records the second run.

### And a third, one word long: `Delete draft` → `Undo match`

Mark's call, same day. What the operator is taking back is the drag they made a moment ago, and a
draft has been communicated to nobody — so `Undo` names the act as they experience it where `Delete`
named the mechanism. **The `#BA1A1A` destructive treatment stays**: the row is gone for good, and
there is no undoing the undo. That the two now pull slightly against each other is the honest
reading of an act that feels reversible and is not.

The snack moved with it, `Draft deleted` → **`Match undone`**. A confirmation that reports a
different verb from the one just pressed makes an operator wonder whether something else happened,
and `MatchActions.deleteDraft` is the only place that string exists. The method keeps its name — it
still calls `DELETE /api/matches/{id}`, and resolved question 3 still governs *when* it is offered
(`Drafted` only, never beside `Cancel match…`). Nothing about the write changed.

---

## Post-pass-1 tweak — the expanded card as an inset sheet, 2026-09-07

**The complaint.** An expanded card did not read as one object. The column is a run of white /
`#F5F5F5` striped 52px rows; the drawer opened below one of them as four more bands of white /
`#FAFAFA` / white + `#F5F5F5`, at a 30px row rhythm, with no boundary of its own — and its match table
striped with `$lms-card-zebra`, **the same `#F5F5F5` the card list stripes with**. The drawer was built
out of the list's own vocabulary, so it dissolved into it. That last fact is the diagnosis: this was
never a matter of the treatment being too weak, it was the treatment being made of the wrong material.

**The lab.** `Documents/expansion-lab.html`, the same throwaway single-file pattern as
`drag-lab.html`: the real column reproduced from `_lms-tokens.scss` and `_card-geometry.scss`, two
cards open (one on a white row, one on a zebra row) with striped cards above, between and below, and
twelve alternatives each expressed as **one class on the board** so they compose. Presets across the
top, a side-by-side against the unmodified column, and the selection in the URL hash
(`expansion-lab.html#1,2,3`) so a particular combination can be sent to someone as a link. Each idea
carries what it would cost in the real files and what its risk is; the file stays as the record of the
nine that were not taken.

Mark chose **1 + 2 + 3 + 5 + 8 + 9**.

**What shipped.** Four devices, and **not one of them is a hue** — see design-system.md §6.2, which was
rewritten around them:

| | Device | Where |
| --- | --- | --- |
| 2 | a 10px gutter, the host on `$lms-surface` | `:host { padding: $expansion-inset }` |
| 1 | a ground darker than anything in the list, `#E8EAED`, and **the table's zebra deleted** | `.expansion`, `.matches` |
| 5 | a 1px `$lms-rule-strong` frame closing on a 2px bottom edge | `.expansion` |
| 3 | an inset shadow — the one recess on the screen | `.expansion` |
| 9 | the two sums promoted to a caption bar at the **top** | the template, not CSS |
| 8 | vertical column rules and a lifted `th` ground in the match table | `.matches` |

Three things are worth knowing beyond the list:

- **The host and the `.expansion` div now do different jobs** — gutter and sheet. Both elements
  already existed in `card-expansion.html`; nothing was added to the DOM. It is also what lets the
  ground and the gutter be two different colours without one silently winning on specificity, which
  is the bug the lab surfaced when the two were one element.
- **The sums moved in the template, not with `order`.** Reading order and paint order agree, and the
  block that gives the drawer its top edge is the block a screen reader reaches first.
- **Row hover is `rgba(255,255,255,.45)`, not `$lms-hover`.** `$lms-hover` is *lighter* than the
  drawer's new ground, so the old fill would have lit a row brighter than the sheet holding it. The
  gesture is unchanged — the row lifts towards the surface above it — on the surface this block
  actually has.

`$leading-offset`'s 6px indent on the drawer went with the gutter: content inside a framed sheet does
not want to line up with content outside one. `$expansion-actions-padding` went `10px 10px 0` →
`10px 10px 8px`, because 0 put the buttons on the frame.

**Six new tokens**, one ladder, in `_lms-tokens.scss` and mirrored in `:root`: `$lms-expansion`
`#E8EAED`, `$lms-expansion-head` `#DFE4E8`, `$lms-expansion-th` `#ECEFF1`, `$lms-expansion-rule`
`#D5D9DD`, `$lms-expansion-rule-soft` `#DFE2E5`, `$lms-expansion-head-rule` `#CCD2D7`. They are cool
greys rather than a petrol tint on purpose: `$lms-petrol-tint` is the current-week band's and
`$lms-drop-target` sits just below it, and a third petrol value in the same column would have said
"this week" or "droppable" before it said "open". White is already the top of the range, so the only
free direction was down.

**State at close.** Angular **291 tests across 29 files**, unchanged — no spec asserted on the
drawer's surfaces or on the order of its blocks, which is worth noting as a gap rather than a
comfort. `npm run build` clean, 985.29 kB. Verified in headless Chrome against the running app
(`/matching`, two spaces expanded via CDP), not only in the lab.

### Same day — idea 1 pulled, and the gutter reopened

**Idea 1 lasted a day.** Mark's colleague looked at the grey-grounded drawer and said the whole thing
looked **read only**, which is the one reading nobody in the lab had tested for and is obviously right
once said: on this screen everything disabled recedes exactly that way — a greyed `Confirm space`, a
past week's label, a cancelled card's desaturation. The drawer is the most interactive region on the
card. It holds the only route to a match and the record's own Edit and Cancel, and it had been painted
the colour of things you cannot touch.

So `$lms-expansion` `#E8EAED` is gone and the sheet is `$lms-card` white again. What came back with it:
`.fields` and `td` bottom rules to `$lms-rule-soft`, `th` to `$lms-divider`, and the match table's row
hover to `$lms-hover` from the `rgba(255,255,255,.45)` that only made sense over a grey ground. What
did **not** come back is the **zebra** — that deletion belonged to idea 8, not idea 1, and the vertical
column rules do the separating now (design-system.md §3.2). Two tokens went with the ground:
`$lms-expansion` and `$lms-expansion-rule-soft`. The other four are the caption bar and the table
header, and they stay.

The general lesson is worth keeping: **the separation problem and the value problem are different
problems.** Every option in the lab that solved it with a ground was solving the first by breaking the
second, and nothing in the twelve descriptions said so, because "does this look editable" was not one
of the questions being asked. It is now.

**What shipped is 2 + 3 + 5 + 8 + 9** — gutter, recess, frame, table treatment, caption bar. 291 tests
unchanged, `npm run build` clean, verified against the running app.

**The gutter is now the open question.** With the sheet white, idea 2's 10px of `$lms-surface`
`#FAFAFA` sits between a white card above and a white or `#F5F5F5` card below, and at that value it is
very nearly invisible: it does not read as a ground the sheet sits on, it reads as a gap where
something is missing. A gutter only contains something if it is visibly not that thing.
`expansion-lab.html` gained a **second control row and a radio group** — seven readings of idea 2,
`#...,gA` through `gG` in the hash:

| | Option | What it is |
| --- | --- | --- |
| A | As shipped | 8/10/10 of `#FAFAFA` — the one being complained about |
| B | Tray | the same metrics filled with `$lms-expansion-head` `#DFE4E8`, the caption bar's own grey |
| C | None | idea 2 deleted; the frame and the recess carry it alone |
| D | Hung from its card | no top gap at all, grey at the sides and below |
| E | Sides only | flush top and bottom, inset 10px left and right |
| F | Hanging indent | 28px on the left only, transparent |
| G | The card's own ground | the gutter takes the colour of the row it hangs off |

The page now opens on the shipped set rather than on the original, and the compare board is relabelled
`Before` — a version has shipped, so "Today" was about to start meaning the wrong thing.

### Gutter settled — option C, none at all

Mark took **C** from the seven. The 10px gutter is gone: `.expansion` is full-bleed and the component
host is a bare wrapper carrying the open animation and the 1px `$lms-divider` rule that closes the
block. `$expansion-inset` went with it, and so did the last trace of the 6px `$leading-offset` indent.

The predicted risk — the frame landing 1px from the rule under the card above and the card below,
three horizontal lines inside 2px — **did not materialise**, and it is worth recording why: the sums
caption bar gives the drawer a top edge of its own, so the frame was never the only thing separating
it from the row above. Drawing the six alternatives is what made that visible. The real finding is
that **the gutter was the only device paying no rent**: the frame, the recess and the caption bar were
already doing the whole job between them, and the gutter was spending 20px of width and 18px of height
to repeat what they said.

Two of the six shipped devices are therefore gone within two days of the original change — the grey
ground and the gutter — and design-system.md §6.2 now carries both post-mortems above the spec, with
the constraint any future attempt has to meet: **the drawer must stay on a live-content surface, and
must not spend width or height saying it is separate.**

One thing left deliberately alone: the drawer's bottom edge is now the sheet's 2px `$lms-rule-strong`
border *plus* the host's 1px `$lms-divider`, a 3px stack. It reads as a closing edge and it is what
was approved on screen, so it stands — but it is redundant, and if anyone tightens it, the host's rule
is the one to drop.

**State at close.** Angular **291 tests across 29 files**, unchanged throughout. `npm run build`
clean. Verified against the running app, two spaces expanded via CDP; `expansion-lab.html` opens on
what ships (`#2,3,5,8,9,gC`) and keeps all six rejected gutters and all six rejected ideas as the
record.

---

## Post-pass-1 tweak — the grip, and the body that expands, 2026-09-07

**The complaint, in Mark's words.** *"If you hover over any card, your hand changes to a little hand
[grab cursor]. And if you want to expand the card, you have to click the arrow in the right hand
corner of it. I believe that this is probably not the right configuration."* The ask: a large,
grid-like touch target on the **left** of every card for the drag, and the rest of the card simply
clickable to expand.

**Why the old arrangement was backwards.** Phase 5 made the whole `.cbody` the `cdkDragHandle` and
Phase 8 gave it design-system.md §10's six-dot glyph, positioned in the body's 8px right gutter and
revealed on hover. So the card advertised *one* gesture across all 508px of its width — the rarer of
the two — while the commoner one, expanding, was a 24px chevron at the far end of the row. The glyph
was in the right gutter for a good reason (§16.10: a real cell there would push the trailing edge
from 32px to 42px and unpick the Unmatched column's alignment), but "don't grow the trailing edge"
was never an argument for the *leading* edge, which is where the eye starts and where nothing was.

**What shipped.**

- **A grip cell**, 30 × 51px, first in the row, Material's `drag_indicator`, `cursor: grab`, a 1px
  `$lms-divider` rule on its trailing edge so 30px of space reads as a rail rather than as padding.
  Always visible, not summoned by hover: a handle you have to hover to find is a handle an operator
  does not know is there, and it is now the only route to a match.
- **It is the only `cdkDragHandle` on the card.** `.cbody` lost the attribute and gained
  `(click)="toggle()"` and `cursor: pointer`.
- **The six-dot `.grab` glyph is gone**, and `cursor: grab` off the card as a whole.
- **The chevron stays**, unchanged, because it is the focusable control carrying `aria-expanded`. The
  body gets no `role` and no `tabindex` — a second tab stop on the same 52px row saying the same
  thing is one more thing to tab past — and the grip is `aria-hidden`, there being no keyboard drag
  path (resolved question 14).

**The 3px zig-zag, which is the part worth remembering.** The grip's first cut sat *after* the spine
in flow, and Mark caught it on screen within the minute: *"cards that have a status line on the left
are causing the grab target to bump to the right."* Booked's spine is 3px and every other status's is
6px (§3.1), so the run of glyphs stepped in and out by 3px down the list — the exact class of
misalignment `_card-geometry.scss` exists to prevent, arrived at by putting a fixed cell behind a
variable one. His own diagnosis was the fix: make the grip wider and let the status run over the top
of it.

So **`.card > .spine` is now `position: absolute; left: 0; top: 0; bottom: 0`** and the grip reserves
`$spine-width` of left padding for it. The spine costs the row no width at all, the grip's box no
longer depends on the card's status, and the glyph sits at one x on every row. Two details:

- `bottom: 0` resolves against the padding box, so the spine is still 51px tall inside the 52px
  border-box card — the same height `align-self: stretch` gave it, still above the bottom rule.
- The override is **scoped to `.card >` deliberately.** `legend/status-legend.scss` includes the bare
  `spines` mixin to draw its four sample spines in a 92px scrap that is not a positioned ancestor;
  absolute positioning in the mixin itself would have flung them into the dialog's corner. The legend
  drawing itself from the real mixin is what made that a trap worth stating rather than a bug.

**One number moved and one retired.** The strip's leading pad is `$col-grip + 8px`, and it happens to
be **the same 38px** it was as `$leading-offset + 6px + …`: the grip's 30px absorbs the spine's 6px
plus a 24px glyph area, which is why the columns did not have to be re-measured. `$leading-offset` is
gone — the strip was its only reader and re-adding it would double-count the spine. The trailing edge
is untouched at 32px.

**One regression the change invites, and its guard.** The match-count button on line 2 sits *inside*
the body, and the body now toggles: without a `stopPropagation` the button's toggle and the body's
toggle cancel out and the card looks like it ignored the click. It used to stop `pointerdown`
instead, for the opposite reason — the body was the drag handle and a click that drifted a pixel
lifted the card. Both hazards are one line, in the same place, for opposite reasons.

`card/card-grip.spec.ts` (8 tests, both cards in one loop) holds all of it: the grip is the *only*
`.cdk-drag-handle` on the row, the body expands and collapses, the chevron still works, and the match
count opens the card **once**. That last one was verified the way Phase 8 verified its `-` fallbacks —
by removing the `stopPropagation` and watching it fail.

**State at close.** Angular **299 tests across 30 files** (291 + the new spec's 8), `npm run build`
clean with no warnings. Verified in headless Chrome at 1600×1100 against the running app: the grips
are one straight column across Booked and Pending rows in both columns, the hatch runs over the
grip's leading edge, and every line-1 heading still sits over its own values.

---

## Post-pass-1 tweak — the expanded card, round two, 2026-09-07

**The complaint.** The inset-sheet change earlier the same day fixed the drawer *dissolving* into the
list, and left a different problem behind: *"when you've got multiple open at the same time, it's
still visually to my eye all blurs together in terms of greys, mild blues and whites."* Mark asked
for ten ways to make the expanded card read better, and for a lab to judge them in.

**The diagnosis, which is the part that decided everything after it.** Three separate faults, and
only the first is about colour:

1. **The value range was exhausted, not misused.** Eight named greys lived inside about ten L\* points
   — `#FFF` card, `#F5F5F5` zebra, `#FAFAFA` surface, `#F0F0F0` band, `#EFEFEF` rule-soft, `#ECEFF1`
   table head, `#E0E0E0` divider, `#DFE4E8` caption bar. **A ninth step could not separate anything.**
   Every remaining fix was either the *removal* of a grey or a device that is not a value at all.
   This is why the first lab's answer — add a ground, add a frame, add a recess — could not be
   extended a second time.
2. **Band count, not band colour.** One open card printed five horizontal grounds: sums, fields,
   table head, table body, actions. Three open cards printed fifteen.
3. **Nothing said which card owned which drawer.** Only adjacency did, which is exactly the signal
   that fails when adjacency repeats. And nothing inside the drawer lined up with the row above it:
   the card's text began at x=38 (30px grip + 8px padding), the drawer's at x=10.

**`Documents/expansion-lab-2.html`** — a second lab, because the first one's baseline no longer
existed and it could therefore no longer be used to judge anything. Ten new ideas (none a repeat of
the earlier twelve), each one class on a `.board`, so they compose; the left board is what shipped and
never changes; presets across the top; **a `cards open: 1 / 2 / 3` control**, the count being the
variable the complaint is actually a function of; and the URL hash carries the set, so a combination
worth keeping can be pasted back into a chat.

**Chosen: 3, 5, 6, 8 and 0.** What shipped:

- **3 · The sums anchor the drawer by size.** The `#DFE4E8` caption bar is gone and the two figures
  sit on white at **20px/600**, label beneath. The type scale was the one axis never spent — nothing
  in the drawer was outside 10.5–13px, so the block had no focal point and the eye drifted across
  grounds looking for one. `$lms-expansion-head` and `$lms-expansion-head-rule` are **deleted**: two
  of the eight greys, gone.
- **5 · A rail, aligned to the card body.** The grip's own hairline continues down the sheet's leading
  edge and the content indents past it, so the drawer's first label, the sums and the table's `Qty`
  column all start at x=38 — under the card's own name.
- **6 · A notch under the chevron.** An 11px square rotated 45° on the top edge, centred on the
  control that opened the drawer. Ownership stated instead of inferred.
- **8 · One shadow direction.** The recess is gone and the sheet **rises** — `0 3px 8px -3px
  rgba(0,0,0,.30)`, the only shadow left on the screen. Hover is colour only, and the host's closing
  rule went with it. Three shadow directions inside 200px, all in the same soft grey, had cancelled.
- **0 · One drawer per column.** `board/card-state.ts`. The one part of this work that treats the
  problem as arithmetic rather than as styling, and by far the cheapest. **Per column, not per
  screen** — comparing a space against an availability record is the screen's central task, so a
  supply drawer must never close a demand one. `board/card-state.spec.ts` (6 tests) guards the
  per-column half specifically, because clearing the whole set on open is *shorter* code and would
  pass any test that only ever opens one column.

**Two pixel arguments, and both were settled by measuring rather than by reasoning.**

- **The rail is 29px, not `$col-grip`'s 30.** The card is edge-to-edge, so its grip paints a
  `border-right` *inside* its own 30px box — the rule is the pixel at x=29 — while the sheet's rail is
  positioned inside the sheet's 1px frame. At 30 the rail landed on x=31: two pixels right of the line
  it was meant to continue, which is exactly what Mark saw and sent back. The lab's own arithmetic
  said it should have been fine, so the number was found by scanning pixels and the comment in
  `_card-geometry.scss` says so. **Do not adjust it by eye.**
- **The notch is `calc($card-edge + $col-chevron / 2 - 1px)` from the sheet's right edge**, the -1px
  being the frame, because the notch is placed from the sheet's padding box and the chevron from the
  card's outer edge. One expression, so it cannot drift off the control it points at.

**And the bug the second of those turned up, which outlives everything else in this entry.** Mark
asked for the chevron to move left so the notch could sit under it, and gave the card a trailing
gutter to do it — `padding-right: $card-edge`. That fixed a misalignment that had been on screen since
**Phase 3**: §16.10 item 10 asserted that the card and the header strip both spend 32px at their
trailing edge, and forgot that `.strip` is a flex row with `gap: $col-gap`. The strip has always spent
**40** — 8px padding + 8px gap + 24px cell — against the card's 32, so **`Unmatched` sat 8px left of
the numerals beneath it**, in both columns, for five phases. With the gutter both ends are 40.
Measured in the running app after the fix: the card's `app-fill-meter` and the strip's `.s-meter` both
end on x=781.

It is worth being blunt about why it survived. §16.10 item 9 warns that this class of error is
*"invisible in code review and glaring on screen"*, and item 10 is the one that was wrong — so every
review that checked the code against the document found agreement, because the document was carrying
the same missing term. Only a browser could break the tie, and `browser-checklist.md`'s trailing-edge
item had never been run.

**State at close.** Angular **305 tests across 31 files** (299 + the new spec's 6), `npm run build`
clean with no warnings, bundle 982.95 kB against the 1 MB warn budget.

**Verified against the running app** (`dotnet run` + `npm start`, headless Chromium over CDP, element
rects and pixel scans — recorded as section M of `browser-checklist.md`): the drawer's content and the
card's name both on x=241; the rail and the grip's rule both on x=232; the notch's centre and the
chevron's both on x=801; the meter block and its heading both ending on x=781; one drawer per column
with two cards clicked in turn, and a demand and a supply drawer open together without either closing
the other.

**One thing left on the record, found in that pass and deliberately not fixed.** On a record with no
matches the two sums are `0` and `0`, and at 20px they are now the loudest thing in the drawer —
idea 3's anchor, anchoring nothing, above a sentence explaining there is nothing to total. It is
honest rather than wrong. `browser-checklist.md` section M carries the two cheapest remedies if it
grates in the demo.

---

## Post-pass-1 tweak — the middle of the row drags again, behind a toggle, 2026-09-09

**Why this reopens a decision this log records.** The 2026-09-07 entry above took whole-body dragging
off the card and was right to: the card advertised the rarer of its two gestures across all 508px of
its width, and the commoner one was a 24px chevron at the far end. Mark's ask this time is narrower
and does not contradict that. The screen is run by two or three power users who will learn its
interactions once, and for them a drag reachable from only 30px of a 540px row is a tax. So the
**middle** region gets its drag back — and the two ends stay unambiguous on purpose.

**Three regions, and which of them is negotiable.**

| Region | Width | Drag | Click |
| --- | --- | --- | --- |
| Grip | 30px | **always** | — |
| Middle (`.cbody`) | ~478px | only with `Drag anywhere` on | **always** |
| Chevron | 24px | never | **always** |

The grip never switches off, and that is the point of keeping it: whatever the preference says, one
place on every row is guaranteed to drag and says so with its own glyph and its own `grab` cursor.
The chevron needed no work at all — it is a *sibling* of `.cbody`, not a descendant, and CDK arms a
drag only from a handle that `contains` the event's target.

**The hazard, and why a number answers it.** The concrete bug the old arrangement had was a click
that drifted a pixel lifting the card instead of opening it — this log records the `stopPropagation`
that worked around it twice. The fix is not cleverness but slop: `dragStartThreshold` goes from CDK's
default 5 to **8** (`DRAG_SLOP`, `drag/card-press.ts`), and the rule has **no dead zone and no
timer** — a press that never crosses 8px is a click *however long it is held*, one that crosses it is
a drag and never also a click. Both are decided by the same event, so a gesture that does neither, or
both, is unreachable.

**What the client deliberately does not do is re-derive that.** `CardPress` reports the pointer
sequence; the card asks CDK whether a drag began, through the `(cdkDragStarted)` binding it already
had. Reimplementing CDK's threshold in TypeScript would be a second implementation of one rule, and
the two would part company the first time page and client coordinates did — a wheel-scroll mid-press
does exactly that. Same argument as the domain values on the DTOs, applied to a library instead of a
language.

**Four things that would break quietly, and where they are pinned.**

- **`.cbody` lost its `(click)` binding entirely.** A drag released back over its own card fires an
  ordinary `click` on the way out, so a click event cannot tell the two gestures apart.
- **`button.mcount` swapped its guard, and the event matters.** It stopped `click` to avoid a double
  toggle; it now stops **`mousedown`**, because that is what CDK binds on the drag root and therefore
  what keeps a wobble on the label from lifting the card. The pre-2026-09-07 code stopped
  `pointerdown` for this same purpose and would not have worked against current CDK.
- **`CARD_DRAG_CONFIG` is provided at the application root**, not on the two card components.
  `DragNarrowing` is root-provided and reads `dragStartThreshold` off the same token to decide when a
  press has become a drag; provided lower down, CDK would have seen 8 while the narrowing saw its
  fallback of 5. That service had been reworked the same day to narrow on the move that *starts* the
  drag rather than on the press, which is what let the body reuse the grip's `grabbed()` unchanged —
  one narrowing path, whichever region the drag begins in, and no second timing rule to keep in step.
- **`card-grip.spec.ts` had to stop counting the `cdk-drag-handle` class.** CDK stamps it on a
  *disabled* handle too, so counting could not tell the toggle's two states apart and would have
  passed unchanged if the toggle did nothing at all. It asks the `CdkDragHandle` instances whether
  they are disabled instead.

**The cursor stays `pointer` over the middle**, which is the one place this could have quietly undone
2026-09-07. The click is still the commoner of that region's two gestures, and a grab cursor across
508px of a row whose usual action is expanding it was Mark's original complaint verbatim. Instead the
whole screen turns `grabbing` once a drag actually starts (`apg-dragging` on `document.body`), with
the rule weak enough in the cascade that `no-drop` over the source column and `not-allowed` over a
blocked target both still win.

**Off by default**, switched from the top bar beside `Filter on drag` and independent of it. Two costs
are accepted while it is on, both because CDK stamps `touch-action: none` and `user-select: none` on
every handle: touch and pen cannot scroll a column by dragging a card body, and the card's text is not
selectable. A mouse is assumed available at all times (resolved question 14), the wheel and the
scrollbar are unaffected, and the toggle is the way back.

**State at close.** Angular **368 tests across 33 files** (up 28: 12 in the new `card-press.spec.ts`,
6 more in `card-grip.spec.ts`, 4 in `top-bar.spec.ts`, 2 in `matching-preferences.spec.ts`, and the
rest arriving with the same day's `Filter on drag` work), `npm run build` clean with no warnings,
bundle 994.83 kB against the 1 MB warn budget — **5 kB of headroom, and worth watching.**

**Unrun, and it is the half that matters.** `browser-checklist.md` gains a `Drag anywhere` section.
jsdom cannot say whether eight pixels is actually generous enough for a real trackpad click, nor
whether a drag started mid-row still lands where it is aimed. Those are the two questions the feature
turns on and only a pointer can answer them.

---

## Post-pass-1 change — Notify processor, 2026-09-11

**This overturns a resolved question, which is why it is here.** Resolved question 2 said `Notified`
was not used in pass 1 and had no UI transition into it. Mark asked for the button: *"add that button
in without any actual communication going out, but it pushes the status to 'notify'."* The roadmap's
question 2 is amended in place with its old text kept, and deferred item 5 is narrowed to the
mediums.

**Why the original decision was right, and why it stopped being.** Pass 1 skipped the status because
the notification mediums — in-app, SMS, email, their per-event configuration, the history view — are
out of scope, and a status called Notified with nothing behind it is worse than no status at all. The
thing that argument missed is that the status carries information independently of how the message
travels: *this match has been put to the processor and we are waiting on their word*. The board could
not draw that distinction while every unconfirmed match was a draft, and drafts are the column APG
scans for work still entirely in its own hands. So the status shipped; the mediums did not.

**What was built.** Six files of production code and no new abstraction:

- `MatchLifecycle.CanNotify` (Drafted only) and `Notify(match)`, which sets the status and does
  nothing else. It is one line and has a test of its own precisely because of that: the temptation
  with a status called Notified is to have it also stamp a sent-at, queue a message or touch the
  parents, and every one of those would be a claim this prototype cannot back.
- **`CanConfirm` now names both live statuses** rather than testing "not Confirmed". The pass-1
  comment here warned against Notified inheriting Drafted's transition silently; it is named instead,
  because notifying is optional and a match that skipped it must still confirm in one move. A
  Notified match that could only be cancelled would be a dead end on the board.
- `MatchWriter.RejectNotify` and `POST /api/matches/{id}/notify`, taking the edit body exactly as
  confirm does, so a dirty form saves and notifies in one validated write.
- The modal's footer, its title verb, and `MatchActions.notifyMatch`.
- `matchStatusIcon` gained `send` for Notified. Sharing Drafted's clock would leave the one row that
  has moved looking identical to the rows that have not, which is the whole of what the status is
  for. `matchSummaryLabel` gained `· 1 notified`, after drafts and never alongside them — the phrase
  is the first thing to drop from line 2 when the card runs out of room.

**Three sentences say nothing is sent, and each is load-bearing on its own.** The `.dispatch` caption
under the modal's fields is what the operator reads; the snack (`Match notified to ANZCO — no message
sent`) is what they see when they press it again without reading; the comment above the endpoint is
what the next developer sees before adding a send. `Notify` on a button is a promise, and a demo room
that includes processor staff will take it at face value unless told otherwise. The caption is muted
prose rather than a warning colour because it states scope, not risk.

**One string had to change and it was not obvious.** `ProcessorSpaceRules.NeedsConfirmedMatches` read
`Needs at least one confirmed match and no drafts`, which was true only while Notified was
unreachable — a space whose every match is Notified has no drafts at all and still cannot be
confirmed, so the sentence beside the disabled button would have denied exactly what the gate was
doing. **The gate itself is untouched**: it has always read "every live match is Confirmed", written
that way in Phase 6 against the possibility of this day. It is now
`Needs every match confirmed, and at least one`, updated in DEMO.md, the browser checklist,
design-system.md §16 and two web fixtures. The labs under `Documents/*.html` keep the old wording and
are historical.

**The seeder was deliberately not touched.** It creates no Notified match and
`SeedDemonstrationCaseTests` still pins that at zero, so the demo's opening state is exactly what it
was and the only way into the status is an operator pressing the button.

**State at close.** .NET **353 tests** (218 domain, 135 API — up 5), Angular **399 tests across 33
files** (up 8), `dotnet build` and `npm run build` both clean with no warnings, bundle 1.01 MB against
the 1.2 MB warn budget. The endpoint was exercised against the running API: a draft notified (200,
status `Notified`), the same match notified again refused (409, `Only a drafted match can be
notified`).

**Unrun.** `browser-checklist.md` gains a five-item `Notify processor` section. What jsdom cannot say
is whether exactly one of the two right-hand buttons reads as filled, whether the new caption
collides with the wrapping hints above it, and whether `send` renders as a glyph rather than as the
word.

---

## Post-pass-1 change — notification is ANZCO's step alone, 2026-09-11

Same day as the entry above, and a correction to it: *"Notify Processor should only show for ANZCO.
It's not part of the lifecycle of a match for SFF or Alliance Group."* The button shipped gated on
status alone, which was wrong in a way no test would have caught, because status was the only clause
the requirements document spells out.

**It is not a carve-out, and that matters for where the code went.** The requirements already
describe per-processor visibility — ANZCO sees the most, SFF a restricted set only once the space is
Confirmed, Alliance Group no matches at all. Read against that, notification could never have been
universal: a notification to Alliance Group points at something they can never open, and one to SFF
at `Drafted` — the only status it can be sent from — arrives before there is anything for them to
look at. So this is the first visible piece of a model that was already written down, not a new rule
on top of it. Roles and the rest of the gating stay deferred (roadmap item 4).

**`ProcessorNotifications` is a new file in `Apg.Domain`**, name-keyed and case-insensitive, holding
one name. Three decisions inside it:

- **The domain, not `SeedConfig`.** It is a rule about processors, not a list of them — the same
  argument that put `StockClassCompatibility`'s table in the domain. The cost is that a rename in
  `SeedConfig.Processors` would leave the rule matching nobody and every card silently losing its
  button, so `ProcessorNotificationTests` in the API project asserts the two agree. That test exists
  because the failure is invisible, not because the coupling is complicated.
- **It fails closed**, where `StockClassCompatibility` fails open, and the asymmetry is deliberate:
  an unrecognised stock class hidden from a drag is supply an operator cannot see, whereas an
  unrecognised processor offered a Notify button is APG telling a room that a meatworks gets
  notified when nobody has agreed that it does.
- **The processor clause is reported before the status clause** in `NotifyBlockedReason`. For a
  confirmed SFF match both are true, and "only a drafted match can be notified" would send the
  operator looking for a draft — when no SFF match at any status is ever notifiable.

**`MatchLifecycle.CanNotify` now takes the space**, so it is `CanNotify(match, space)` expressed over
`NotifyBlockedReason`, the shape `ProcessorSpaceRules.CanConfirm` has had since Phase 6. The client
learns the answer from **`MatchEditContextDto.canNotify`**, set from `RejectNotify` so the footer's
gate and the endpoint's are one answer asked once — `MatchEditTests` asserts that over every live
seeded match. There is no processor name in `web/` and there must not be one.

**Two smaller consequences.** The title verb reads `canNotify` rather than testing for `Drafted`, or
an SFF draft would be titled `Notify match:` above a footer offering no such thing; and `Confirm
match` is filled on those drafts, which the existing `canNotify ? 'text' : 'filled'` binding already
did for free.

**State at close.** .NET **375 tests** (223 domain, 152 API — up 22), Angular **405 across 33 files**
(up 6), both builds clean, bundle unchanged at 1.01 MB. Verified against the running API over all
three processors: ANZCO `canNotify: true` and `POST /notify` → 200; Alliance Group and SFF
`canNotify: false` and 409 naming the processor.
