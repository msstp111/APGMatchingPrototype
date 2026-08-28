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
