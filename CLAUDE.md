# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech stack (mandated)

**Angular** front end, **.NET Core** back end. This is fixed — do not substitute another framework, and do not reach for a lighter option (a static mock, a Node/Express stub, a client-only prototype) even where the prototype's throwaway back-end would otherwise justify it. "Smallest back-end necessary" below means a minimal ASP.NET Core Web API, not a different technology.

## Current state

Pass 1 is **complete**. Phases 0 to 8 are done: the solution, the Angular app, EF Core + SQLite and the deterministic seeder are in place, the LMS shell (top bar + sidebar) is built, every computed quantity, status and date rule lives in `Apg.Domain` and reaches the client on the DTO contract, Phase 2 settled the visual language in `Documents/design-system.md`, Phase 3 built the matching screen's two week-banded card lists with expand/collapse, Phase 3b removed the carry-over cards it had shipped and replaced them with the trimmed backlog (resolved question 17), Phase 4 added per-column filters, sorting within the bands, the column flip and reset-to-default, Phase 5 added drag-to-match (CDK across the two columns, quantity prompt, Drafted matches, undo), Phase 6 gave a match the rest of its life — open from either side, edit, delete a draft, cancel with a reason, confirm, and confirm a Processor Space, Phase 7 added the debug record forms: + Add on both columns, Edit and Cancel on every card, and the counterparty flag that shows a cancelled record has not taken its matches with it, and Phase 8 closed pass 1 — Reset demo data in the top bar, the empty/loading/error states, the quantity ramp made consistent everywhere, the grab glyph, and `Documents/DEMO.md`. See `Documents/BUILD-LOG.md` for what each phase actually did and `Documents/DEMO.md` for the walkthrough.

**What pass 1 deliberately does not do:** no record detail pages; no Match list view, so a cancelled match is visible nowhere; no farmer/agent submission flow (the `+ Add` buttons are demo scaffolding); no login and no roles, so no per-processor visibility gating; no notifications, so `Notified` has no UI transition; no default-pricing maintenance; no weekly roll-ups; no Finance Stock draw-down; and no keyboard drag path (resolved question 14). None of those is a defect — see the roadmap's "Deferred beyond pass 1".

**The matching screen now creates and manages both records and matches.** Dragging a card onto a card in the other column drafts a match; the match line on line 2 opens the card, and every row of the expanded match table opens that match's modal. Records are created, edited and cancelled from the debug controls (Phase 7), which are marked as demo scaffolding and are **not** the farmer/agent submission flow. There is no keyboard drag path (resolved question 14).

### Layout

```
ApgMatchingPrototype.sln
src/Apg.Domain/            pure C# — entities, enums, NzTime. NO EF Core, NO ASP.NET. Ever.
src/Apg.Api/               minimal API (.NET 9), EF Core + SQLite, the seeder
tests/Apg.Domain.Tests/    xUnit — domain purity, date handling
tests/Apg.Api.Tests/       xUnit — seed determinism and the demonstration cases
web/                       Angular 22 + Angular Material 22
Data/                      CSV exports from the existing forecasting system (unchanged)
Documents/                 roadmap, phase docs, build log, browser checklist, DEMO.md
```

### Versions

.NET 9 SDK (9.0.317) · EF Core 9 (Sqlite provider) · xUnit 2.9 · Node 24 LTS · Angular 22.1 · Angular Material 22.1 · TypeScript 6.0 · vitest 4 (Angular's current default runner).

### Commands

Run from the repo root unless stated.

| What | Command |
| --- | --- |
| Build everything | `dotnet build` |
| Run all .NET tests | `dotnet test` |
| One test project | `dotnet test tests/Apg.Api.Tests` |
| One test | `dotnet test --filter "FullyQualifiedName~At_least_one_space_is_over_filled"` |
| Run the API | `dotnet run --project src/Apg.Api --launch-profile http` → http://localhost:5286 |
| Angular dev server | `npm start` in `web/` → http://localhost:4200 |
| Angular build | `npm run build` in `web/` |
| Angular tests | `npm test` in `web/` |
| One Angular spec | `npx ng test --watch=false --include=src/app/app.spec.ts` in `web/` |
| **Both halves together** | `.\dev.ps1` from the repo root |

`dotnet` and `node` are installed at `C:\Program Files\dotnet` and `C:\Program Files\nodejs`; if a fresh shell cannot find them, the machine `PATH` has not been re-read yet.

**Stop any running `Apg.Api` before building.** It holds `Apg.Domain.dll` open and `dotnet build` fails with `MSB3027` / `MSB3021`. This has bitten every phase so far. `Get-CimInstance Win32_Process -Filter "Name='Apg.Api.exe'"` finds it; stopping the `Apg.Api.exe` child is enough, as its `dotnet run` host exits with it. Note the Angular dev server holds no lock and can stay up.

The shell adds one folder of its own: `web/src/app/shell/demo-reset/` — `demo-reset.ts` (the root
service: confirm, re-seed, clear preferences, reload) and `reset-demo-data.*` (the dialog, which
decides nothing and closes true or false, like every other dialog in the application). It reuses
`matching/record/debug-ribbon.ts` rather than growing a second debug treatment.

### Wiring

- The Angular dev server proxies `/api` to `http://localhost:5286` (`web/proxy.conf.json`, wired into `angular.json`'s `serve` options), so the client only ever calls same-origin paths. CORS for `http://localhost:4200` is configured in the API as a fallback for running without the proxy.
- SQLite lives at `src/Apg.Api/apg.db`, gitignored. The schema is created with `EnsureCreated` — there are no migrations, deliberately. Deleting the file and restarting reproduces identical seed data.
- `POST /api/dev/reset-database` drops, recreates and re-seeds. **Phase 8's `Reset demo data` control in the top bar calls it**, after a confirmation, then clears the stored preferences and reloads the page (`web/src/app/shell/demo-reset/`). The reload is deliberate: a refetch would leave expanded cards, a drag in flight and the in-memory preference store behind.
- The three read endpoints are `GET /api/processor-spaces`, `GET /api/livestock-availability` and `GET /api/week-bands`. Since Phase 1 they return the **DTO contract** — `src/Apg.Api/Contracts/Dtos.cs`, mirrored field for field in `web/src/app/api/models.ts` — carrying every computed field. The raw-record shapes Phase 0 returned are gone.
- **Write path (Phase 5):** `GET /api/match-proposal?processorSpaceId=&livestockAvailabilityId=` (default, ceiling, refusal, default price — asked at drop, before any dialog), `POST /api/matches` (always a new `Drafted` row; never merges), `DELETE /api/matches/{id}` (Drafted only — the undo, and Phase 6's delete-draft), `GET /api/transport-companies` (`SeedConfig.TransportCompanies`). Create and delete return both parents recomputed (`MatchWriteResultDto`); the client patches the two records by id.
- **Write path (Phase 7 — debug record creation):** `GET /api/reference-data` (processors, each with **its own** plants and stock classes, plus the single availability stock-class list and the transaction types — all from `SeedConfig`, never derived from the loaded records the way the filter row options are); `GET /api/locations` (~299, each with the one farmer it belongs to); `POST /api/processor-spaces`, `PUT /api/processor-spaces/{id}` (**quantity, plant, delivery date, delivery time, notes only** — processor and stock class are not editable), `POST /api/processor-spaces/{id}/cancel`, and the three availability equivalents (`PUT` there edits **every** attribute). All six return `RecordWriteResultDto` — **the one record they touched, plus the recomputed week calendar**: a record created for a week the columns were not drawn on places into no band at all, and the client may not name a new week itself. Validation lives in `src/Apg.Api/Contracts/RecordWriter.cs`, pure over a `WorkingSet` exactly as `MatchWriter` is. **Cancelling a record never touches its matches** — the endpoints never consult the match set, and the domain helpers take none.
- **Write path (Phase 6):** `GET /api/matches/{id}` → `MatchEditContextDto` (the match, **both** parents in full, and `maximumQuantity` — the edit ceiling); `PUT /api/matches/{id}` (edit the three fields); `POST /api/matches/{id}/confirm` (Drafted → Confirmed, and it **takes the edit body** so a dirty form saves and confirms in one write); `POST /api/matches/{id}/cancel` (past Drafted, reason required, returns `match: null`); `POST /api/processor-spaces/{id}/confirm` (returns a bare `ProcessorSpaceDto`, not the two-parent shape — confirming a space touches no availability record). Every one is addressed **by match id alone**, which is why the same match is openable from either card without two code paths.
- **`GET /api/week-bands`** (Phase 3) returns an ordered, gapless `WeekBandDto[]`: every Sunday from the earliest record's week to the latest, always including the current week, each with `weekCommencingLabel` (`23-08-26`), `weekOfLabel` (`23 Aug`), `isCurrentWeek` and `isPastWeek`. It exists because requirement 1.6 wants a header on a week **no record falls in**, and the client cannot name such a week without doing date arithmetic. It is a calendar, not a record set: it carries no record ids, deliberately. The server ships one full list and **the client trims it per column** (Phase 3b) — each column starts at the week of its own earliest record, so the endpoint must keep returning the whole run.

### Conventions

- The seeder is deterministic: an explicit mulberry32 PRNG (`src/Apg.Api/Seeding/Mulberry32.cs`), never `System.Random`. Every date is an offset from the Sunday of the current **New Zealand** week.
- **The seeded Processor Spaces are 70% ANZCO / 20% Alliance Group / 10% SFF** (`SeedConfig.ProcessorMix`), shuffled. Until after Phase 4 the seeder cycled `Processors[i % 3]` while the week came from `i % 6`; the two aliased, so every week held exactly one processor and always would. The shuffle removes that structural guarantee but does not promise a mixed week — at 70% ANZCO an all-ANZCO week is ordinary, and the current seed has one. Statuses are **34 Booked / 4 Confirmed / 2 Cancelled**, assigned *after* the matches exist so a Confirmed space is one `ProcessorSpaceRules.CanConfirm` agrees could be confirmed, and one Cancelled space keeps its live matches because cancelling never cascades. All of these are pinned by `SeedDeterminismTests`.
- Every invented list (processors, plants, carriers, stock classes, farmer names) lives in `src/Apg.Api/Seeding/SeedConfig.cs` so APG's real values are a one-file swap.
- LMS colours and metrics live in `web/src/styles/_lms-tokens.scss`, sampled from the screenshots, with Phase 2's matching-screen palette appended (surfaces, rules, the quantity ramp, semantics) as both SCSS variables and `:root` custom properties. The Material palettes in `web/src/styles/_theme-colors.scss` were generated from `#00567E`. Do not re-sample; the values are recorded in the build log.
- **The Angular initial-chunk budget is 1 MB warn / 1.5 MB error** (`web/angular.json`), raised from
500 kB / 1 MB in Phase 8 with Mark's agreement. The bundle has been over 500 kB since Phase 3 and was
within 41 kB of the old hard error after Phase 7's five dialogs; the remedy for a prototype whose whole
job is one screen is a bigger budget, not lazy-loading the forms. The `anyComponentStyle` warning went
4 kB → 6 kB for the same reason. **`npm run build` is now clean with no warnings** — if it starts
warning again, something has grown, and that is worth knowing rather than drowning in a standing one.

The Material theme runs at `density: -2` with dialogs overridden to a 4px radius (`web/src/styles.scss`), so Material's own controls land on LMS's proportions without a per-component override each.
- Every dimension on the matching screen lives in `web/src/app/matching/_card-geometry.scss`. Do not hard-code a width, height or padding in a card, band or column stylesheet.

Supporting choices are recorded in `Documents/ROADMAP.md`: EF Core + SQLite for persistence, xUnit for the domain tests, Angular CDK `DragDrop` for the matching interaction, SCSS for styling.

Domain rules live in C# in `Apg.Domain` (no EF, no ASP.NET) and reach the client on DTOs that already carry every computed field — both matched sums, unmatched, derived statuses, the confirm gates, and the week-commencing Sunday. **The Angular app never recomputes a domain value in TypeScript.** One rule, one implementation; the moment it exists in both languages the two drift and the numbers quietly disagree.


### Where the rules actually live (Phase 1)

- **`src/Apg.Domain/Matching/`** — `CancelledRecords` (which records are cancelled; **every quantity and status rule takes one**), `MatchQuantities` (both sums, `Tally`, `ForSpace`, `ForAvailability`, `ConsumingSpace`/`ConsumingAvailability`), `QuantityTally` (`Unmatched`, `State`), `QuantityState` / `MatchSide` / `QuantityStateLabels`, `AvailabilityStatus.Derive`, `ProcessorSpaceRules` (`CanConfirm` **and** `ConfirmBlockedReason`, expressed over the same clauses so the gate and its explanation cannot drift), `MatchCreation` (`Propose`, `DefaultMatchQuantity`, `MaxMatchQuantity`, `NoUnmatchedQuantity`), `MatchLifecycle` (`CanDelete` / `CanConfirm` / `CanCancel` / `Confirm`, plus their refusal strings), `RecordCancellation`.
- **`src/Apg.Domain/Pricing/PriceTable.cs`** — `DefaultPricePerKg`, keyed on the Processor Space stock class.
- **`src/Apg.Domain/Time/NzTime.cs`** — the *only* home for date rules: `WeekCommencing`, `ToNzDate`, `Today(TimeProvider)`, `CurrentWeekCommencing(TimeProvider)`, `DateLabel`, `WeekLabel`, `AtNzTime`, and from Phase 3 `ShortDateLabel` / `ShortDateLabelFormat` (`d MMM` → `16 Aug`, `1 Sep`) and `WeeksFrom(first, last)` (contiguous inclusive Sundays, both ends normalised — still the source of `/api/week-bands`). Extend this file; never start a second one.
- **`src/Apg.Api/Contracts/`** — `Dtos.cs`, `MatchingProjection` (computes nothing; calls the domain for every value), `WorkingSetLoader`, `PriceTableLoader`, `MatchWriter` (pure over a `WorkingSet` + `PriceTable` — Propose / Reject / Drafted / RejectDelete), `MatchResponses`, `ApiJson` (the wire format, shared with the tests).

**Dates on the wire:** every business date is a `DateOnly` serialising as `yyyy-MM-dd`, and **always ships alongside a preformatted label** in LMS's `dd-MM-yy` (`23-08-26`). Where a date appears in prose rather than in a column it also ships a short label in `d MMM` (`16 Aug`) — `WeekBandDto.WeekOfLabel` and `LivestockAvailabilityDto.AvailableFromShortLabel`; the client supplies only the surrounding word ("Week of", "since"), because the week rail stacks them on separate lines. The client renders the label and must never construct a JavaScript `Date` from the ISO value. Change the formats in `NzTime.DateLabelFormat` / `NzTime.ShortDateLabelFormat`, nowhere else.

### The matching screen (Phases 3, 3b, 4 and 5)

Under `web/src/app/matching/`. `matching-screen` loads three streams, filters and sorts them, and renders two `matching-column`s; everything below is presentation over already-computed values. A drop asks the server for a proposal, then either refuses or opens the quantity prompt; a create patches both records by id.

```
_card-geometry.scss   ALL dimensions + the card-shell/spines/line-1 mixins + drag target/placeholder.
                      Both columns @use it, so design-system.md 6.1's "identical on both sides" is enforced.
board/matching-board.ts   buildBoard(weeks, spaces, availability) → { demand, supply, unplaced }.
                          Pure. The two band runs are trimmed slices of one array.
board/card-state.ts       root CardStateStore — which cards are expanded (session only)
drag/drag-state.ts        root DragStore — the card in flight, Escape cancel, drop-state (valid/blocked/same)
drag/card-drag.ts         acceptsFrom (same-column silent reject) + pairFromDrop (both directions → one pair)
drag/column-auto-scroll.ts  [columnAutoScroll] on each .list; CDK's own auto-scroll is disabled
match/record-patches.ts   root RecordPatches — THE write stream. Every writer publishes; the screen
                          subscribes once. A patch may carry one record or both, and an absent half
                          means "the server did not say", not "unchanged by omission".
match/match-drop.ts       drop → proposal → snack or dialog → POST → patch ; undo is DELETE
match/quantity-prompt.ts  design-system.md 11.1; default/max/price all from the server
match/match-actions.ts    root — open(matchId) / confirmSpace(id) and the four match writes
match/match-modal.ts      design-system.md 11.4. Passed a MatchEditContextDto and nothing else;
                          closes with an intent, never writes
match/confirm-change.ts   11.5 — the prompt before changing a Confirmed match
match/cancel-match.ts     11.6 — three reasons, and the warning that it leaves the screen
match/cancellation-reasons.ts  the three §15 labels
filters/filter-defaults.ts    THE constants module: filter/sort types + every default, frozen
filters/filter-service.ts     pure filter + sort + away-from-default + the empty state's summary
filters/filter-options.ts     option lists derived from the working set, with processor narrowing
filters/matching-preferences.ts  root signal store + localStorage
filters/column-filters.ts     the 40px filter row: chips, menus, the location type-ahead, sort
filters/filtered-empty.ts     the no-results state, with Clear filters / Reset to default
column/matching-column.ts header (+ Filtered chip and Reset), filter row, sticky 28px strip, .list
band/week-band.ts         sticky rail, band header, the band's cards, empty-band row
card/space-card.ts, card/availability-card.ts     the 52px rows — each is a cdkDropList + cdkDrag
card/card-expansion.ts    fields + both sums + the match table (every row opens its match), and the
                          demand side's Confirm space action with its stated reason. Both cards.
card/fill-meter.ts, card/stock-class-tile.ts, card/stock-classes.ts, card/card-chrome.ts
                          matchSummaryLabel / matchBreakdown are the Phase 6 entry point. The tile is
                          NO LONGER on either card row or the header strip — line 1 spells the stock
                          class out in full two cells along. It survives on the quantity prompt, the
                          match modal and the drag preview, which have no such column.
legend/status-legend.ts   the key to the board — the four status spines, the four ramp colours (both
                          over states side by side), the red cancelled-partner badge. Opened from a
                          borderless ? in whichever column header is currently on the RIGHT
                          (`showsLegend`, passed from the screen's flip). Draws itself from the real
                          spines mixin and real app-fill-meter instances so it cannot drift.
record/record-actions.ts   root — add / edit / cancel for both record types. Opens the dialogs,
                          performs the write, publishes to RecordPatches. The dialogs decide nothing.
record/space-form.ts      add AND edit in one dialog. The plant and stock-class pickers hold the chosen
                          processor's own lists, and changing processor CLEARS a now-invalid selection.
                          On an edit, processor and stock class render read-only (requirement 4.2).
record/availability-form.ts  every attribute editable; the location picker types ahead over ~300 and
                          shows back the farmer it settled. Finance Stock opens no Purchase list.
record/cancel-record.ts   lists every match that will SURVIVE the cancellation, by name
record/confirm-over-commit.ts  the warning before an edit that leaves a record over-committed. It warns;
                          it does not block — that edit is the one route to the pink state
record/debug-ribbon.ts    the '# DEMO DATA TOOL #' strip both forms carry, in the shell's dev-flag colour
record/record-vocabularies.ts  reference data + locations, fetched once, lazily, per session
record/record-form.ts     the two validators both forms share (integer >= 1, blank-to-null)
column/empty-column.ts    Phase 8. A side with NOTHING loaded — the column's glyph, a sentence and
                          the + Add button. Checked before the filtered-empty case: only one of the
                          two has a filter to blame, and offering Clear filters here would send an
                          operator hunting for a cause that does not exist.
testing/dto-fixtures.ts   DTO builders for the specs only
```

**Drag (Phase 5).** Each card is its own `cdkDropList` (sorting disabled, CDK auto-scroll disabled) holding one `cdkDrag`, and both columns sit in one `cdkDropListGroup` on the screen. The drop never transfers arrays — it reads `item.data` and `container.data`, resolves them through `pairFromDrop` (requirement 1.2: one function, both directions), and asks `GET /api/match-proposal`. Same-column enter-predicate returns false (silent no-op). Escape sets a cancelled flag; CDK has no Escape handling of its own, and `cdkDragEnded` fires *before* `cdkDropListDropped`, so the flag must not be cleared on `ended`. CDK's auto-scroll would scroll the *source* column when the pointer is over a band header in the target, so it is replaced by `columnAutoScroll` (48px zone, `$auto-scroll-zone` / `AUTO_SCROLL_ZONE` — one number in two places). **No keyboard drag path.** The default, the ceiling and the refusal string all arrive from the server; `no-domain-arithmetic.spec.ts`'s allow-list is still exactly two files.

**Getting to a match (Phase 6).** Line 2 shows `matchSummaryLabel` — `2 matches · 1 draft` / `1 match · confirmed` / `no matches` — live matches only (cancelled ones never reach the client); the hover `title` is `matchBreakdown`. With matches it is a **button that toggles the card's expansion**, and every row of the expanded match table opens that match's modal. Two consequences worth knowing: the label sits inside the drag handle, so it stops `pointerdown` or a click that drifts a pixel would lift the card instead; and the row is clickable rather than growing an actions column, because the supply match table already fits seven columns in 508px and not eight. **A match is opened by id and nothing else** — `MatchActions.open(matchId)` — which is what makes the same match openable from its space and from its availability record without two code paths.

**Filtering and sorting attach to `buildBoard`'s inputs, never its output** — `matching-screen` filters and sorts the lists and calls it again, so the band meta totals *and the per-column trim* reshape for free. Sorting the flat list before banding is also what makes a sort reorder cards **within** each week rather than dissolving the bands; there is deliberately no "ungrouped" mode.

**Filter and sort state (Phase 4).** `MatchingPreferences` (root) holds both columns' filters and sorts plus the flip, persisted to `localStorage` under the single key **`apg.matching.preferences.v2`** (v1 was abandoned when the supply column's `unmatchedOnly` became `hasUnmatched`; bumping the version drops stale state visibly instead of silently re-enabling a filter), validated field by field on read so a stale or hand-edited value falls back to that field's default rather than emptying a column. Every default lives in `filters/filter-defaults.ts` and **both the opening state and `reset()` read the same constants**, which `filter-defaults.spec.ts` asserts so they cannot drift. Card expansion stays session-only in `CardStateStore`. The flip is CSS `order` on the two column hosts — the components are never destroyed, so nothing is lost across it, and Phase 7's `+ Add` buttons will follow the columns because they live in the column header.

**The availability column has no week filter and must never gain one** (resolved question 17): supply is a state, not an event, and filtering it to one week hides the older unmatched records the backlog exists to surface. A test fails if any key of `DEFAULT_SUPPLY_FILTERS` matches `/week|available.?by/i`. Processor Spaces keep `Delivery week`. **There is also no shared search strip** — design-system.md §12.1 specified one, Phase 4 decided against it and gave its 52px back to the list.

**The backlog, and the per-column trim (Phase 3b, extended in Phase 4).** Every record is drawn **exactly once**, in the band of its own date — nothing is reprinted into a later week. Supply still unmatched from an earlier week is found by scrolling up, which works because `buildBoard` cuts each column down to the weeks its own records occupy: `board.demand` runs from the week of its earliest space to the week of its latest, `board.supply` likewise, and the two often differ. **Both ends are trimmed** — Phase 4 added the trailing half, overturning Phase 3b's rule that a column always ran through to the current week, because filtering to one delivery week left a stack of empty headers below the only band with anything in it. An interior empty week still keeps its header, and a column with no records at all shows the current week alone. The trim is recomputed on every call, never cached. **Do not add scroll synchronisation** because the rails disagree; that is the design. Expansion is keyed `side:recordId`.

**Arithmetic in `web/` is limited to two files, both allow-listed by name in `matching/no-domain-arithmetic.spec.ts`:** `card/fill-meter.ts` (CSS segment widths, clamped — a bar width is not a displayed figure) and `board/matching-board.ts` (band header roll-ups, which must be client-side because Phase 4's filters change what is in the band). That spec is the client analogue of `DomainPurityTests`: it scans `matching/**/*.ts` and fails on `new Date`, `Date.parse`, `Date.now`, `toLocaleDate*`, `Intl.DateTimeFormat`, `getTime()`, or an arithmetic operator next to a quantity field. **If you need a third such site, you are probably missing a DTO field.**

**Debug record creation (Phase 7).** The `+ Add` control in each column header and the `Edit` / `Cancel` buttons in each expanded card are **demo scaffolding, not the farmer/agent submission flow**, which is deferred past pass 1. They are marked as such twice over: design-system.md §14's stroked 26px button with a tools glyph, and a `# DEMO DATA TOOL #` ribbon in the shell's dev-flag `#CCD457` at the top of every form dialog. Three rules matter more than the forms themselves:

- **Dates are a native `<input matInput type="date">`, never a Material datepicker.** The native input's value *is* the ISO `yyyy-MM-dd` string the API wants; a datepicker's control value is a JavaScript `Date`, which no file under `matching/` may construct. Registering `provideNativeDateAdapter` would put one in a form control and `no-domain-arithmetic.spec.ts` would fail, correctly.
- **Reducing a quantity below what is already matched is allowed**, warned about, and is the only route to the pink `Over-committed` state (design-system.md §4.3). Neither the form nor the server refuses it — `RecordWriter` has no clause about matches at all.
- **Cancelling a record never cancels its matches.** They stay live on their own cards. The dialog lists every survivor by name first; the snack says so afterwards and its `SHOW IT` action ticks `Cancelled` into that column's status filter so the card comes back; and the counterparty card flags it, on the collapsed row and in the match table, from `MatchDto.spaceStatus` / `MatchDto.availabilityStatus`.

**Polish and demo readiness (Phase 8).** Pass 1's closing phase added five things worth knowing:

- **`Reset demo data` lives in the top bar** (`web/src/app/shell/demo-reset/`), left of the dev flag,
  in design-system.md §14.1's white-on-petrol variant of the debug treatment. It confirms, re-seeds,
  clears `apg.matching.preferences.v2`, then reloads — in that order, so a failed reset does not take
  the operator's filters with it.
- **The four quantity-ramp ink colours have exactly one definition**, the `quantity-ink` mixin in
  `_card-geometry.scss`. They had lived inside the `card-shell` mixin, which `card-expansion.scss`
  does not include, so an over-committed record's `-24` rendered in plain body text on the one surface
  that spells the state out in words; two more copies sat in the two dialogs. Include the mixin; never
  redeclare `.q-over`.
- **Three screen-level states**: `empty-column.ts` for a side with nothing loaded (checked *before*
  the filtered-empty case, because only one of them has a filter to blame), plus loading and
  API-unreachable panels on `matching-screen`. Every one names what has happened and offers a way out.
- **The six-dot grab glyph is positioned, not laid out** — absolutely placed in the card body's 8px
  right gutter. A real cell would push the card's trailing edge from 32px to 42px and the Unmatched
  column would stop lining up with its header (design-system.md §16.10).
- **A wrapping `mat-hint` needs both halves of the fix** — `subscriptSizing="dynamic"` on the field
  *and* `height: auto` on the subscript wrapper. Phase 8 added the missing template half to the
  quantity prompt and both record forms; only the match modal had it.

Two tests are the phase's own guards: `card/stock-class-coverage.spec.ts` reads both vocabularies out
of `SeedConfig.cs` and fails naming any stock class without an explicit tile, and
`nothing-renders-raw.spec.ts` sweeps every card, expansion and the match modal with every optional
field null. **Angular renders `null` as an empty string, not as the word**, so that spec's second half
— asserting the `-` fallbacks themselves — is the half that can actually fail; verified by removing a
guard and watching the first half pass.

**Every record write returns the recomputed week calendar**, and `RecordPatch.weeks` carries it, because a record created or moved beyond the loaded run of weeks would otherwise place into no band and vanish off the screen. `matching-screen.applyPatch` therefore **upserts** by id rather than replacing: a newly created record is in neither list yet.

**Form fields inside dialogs relax the density.** Material's own density table turns `form-field-filled-label-display` to `none` from `-2` downwards, so at the theme's `-2` every `appearance="fill"` label was silently invisible — which is what Phase 6's browser pass saw and could not explain. `web/src/styles.scss` restores Material's `-1` row for `.mat-mdc-dialog-container .mat-mdc-form-field` only. The 40px filter row keeps `-2` and holds no form fields at all.

**A match stops consuming the *other* record's quantity once its own record is cancelled** (decided
2026-09-01, mid-Phase 7; the roadmap's "Domain rules" section carries the full statement). Cancelling a
record still does not cascade — the match keeps its status and must be cancelled by hand — but it stops
holding stock on the side that is still trading. **The rule is asymmetric**: it is always the
*counterparty's* status that decides, so a cancelled record's own figures are unchanged by its own
cancellation and its card stays readable. It lives in `MatchQuantities.ConsumingSpace` /
`ConsumingAvailability`, and `CancelledRecords` is a **required parameter** on both tallies,
`AvailabilityStatus.Derive`, `ProcessorSpaceRules.CanConfirm` / `ConfirmBlockedReason`,
`MatchCreation.Propose` and the three-argument `MaxMatchQuantity` — required rather than optional
because every one of them is wrong without it, and wrong in the direction that hides supply.
`CancelledRecords.None` is the honest answer for a unit test over hand-built matches and reproduces the
arithmetic exactly as it stood before the rule existed; `CancelledRecords.In(spaces, availabilities)` is
what production passes.

**The cancelled-partner badge is the one place hue says something other than fill.** A match whose
partner record has been cancelled paints a solid `$lms-error` box — behind the collapsed card's
expand chevron, and around the word in the expanded match table's counterparty cell. It is sanctioned
because it is not a status being reported (the card's own status is untouched) but work outstanding,
and `$lms-error` is a semantic token that is no part of the quantity ramp. `cancelledPartnerCount` in
`card/card-chrome.ts` counts them.

**Hue is committed to the quantity meter and nothing else.**
 Status is carried by spine weight, pattern, icon and word; stock class by a monogram tile whose *shape* is the species. `Data/stock-class-configs.csv`'s colour column is deliberately unused (resolved question 16 overrides Phase 8 §3.1).

**No domain code reads the real clock.** Take a `TimeProvider`. `DomainPurityTests.No_domain_source_file_reads_the_real_clock` scans `src/Apg.Domain/**/*.cs` and fails on `DateTime.Now`, `.Today`, `.UtcNow` or `TimeProvider.System`.

## Build plan

The build is nine phases plus one remediation pass (3b), one chat each, each starting in plan mode. Before working on any of it, read:

- `Documents/ROADMAP.md` — shared context for every phase: domain model, architecture, resolved spec questions, phase list.
- `Documents/BUILD-LOG.md` — what earlier phases actually did and decided. Every phase appends an entry before finishing.
- `Documents/Phases/PHASE-N-*.md` — detailed requirements for the phase at hand.
- `Documents/build-plan.html` — the visual plan, and where the per-phase prompts are copied from.
- `Documents/browser-checklist.md` — the one pass no test can do: every geometry claim and every
  pointer path, consolidated from Phases 3–6, with real record ids. **Still unrun.** Add to it if your
  phase makes a claim jsdom cannot check, and if you get a browser, run it and record the outcome.
- `ExistingAppScreenshots/*.png` — four screens from APG's live LMS v7. **The prototype must look like it belongs in that application.** It is built with themed Angular Material, and every prototype screen renders inside the real shell: petrol-blue top bar with the yellow dev flag, and the sidebar with its full nav list. Sample colours from the pixels, not from memory.

The roadmap's **"Resolved spec questions"** override the requirements `.docx` wherever they conflict. Do not reopen them. Each phase closes by spawning a sonnet subagent to review the work, then appending to the build log.

## What this prototype must prove

Alpine Pastures Group (APG) brokers between **Processor Spaces** (meatworks' demand for animals) and **Livestock Availability** (farmers' supply). The high-level goal is **an easy-to-use drag-and-drop matching interface for non-technical APG staff**. Everything else is supporting scaffolding.

Prototype scope (in priority order):

1. The **matching screen** — the primary deliverable.
2. The **farmer/agent flow** for submitting Livestock Availability records — secondary.

Deliberately out of scope: a robust back-end. Build the smallest ASP.NET Core Web API that delivers the above — in-memory or SQLite-backed persistence is fine, and auth can be a role switcher rather than real identity. Notifications (SMS/email), default-pricing maintenance, and the weekly roll-up views are specified in the requirements but are not prototype goals — don't build them unless asked.

Where the domain rules below say a value is derived (statuses, matched quantities, unmatched quantities), compute it **server-side in the .NET API** and let Angular render what it receives. The drag-and-drop interaction is the one place worth spending real effort in the client.

## Domain model

Three entities, and the shape of the relationship is the whole point:

- **Processor Space** — a meatworks' committed slot: stock class, quantity required, processor, plant, delivery date/time, notes.
- **Livestock Availability** — a farmer's stock on offer: stock class, quantity available, location, available-from date, availability details, transaction type, optional linked Purchases, notes.
- **Match** — the join. **Many-to-many**: one Processor Space is filled from several Availability records, and one Availability record is split across several Processor Spaces. A Match carries its own `quantityMatched`, `pricePerKg`, `transportCompany`, and status. Model it as a first-class entity, never as a foreign key on either side.

Cancelling a Processor Space or Availability record **does not cascade** to its matches, **and cancelling a match does not touch its parent records** — that is intentional in both directions, so APG can arrange alternatives before notifying anyone. Matches must be cancelled separately.

Note the trap when checking this: cancelling a match legitimately changes an availability record's **derived** status — a record left with no live matches derives back to `Booked` — and that is the derivation doing its job, not a cascade. The **stored** statuses are what must not move, and a Processor Space's status is stored in its entirety.

### Users

- **APG** — sees everything; the only role that creates, views, or edits Matches directly.
- **Processor** (per-company admin) — sees only its own Processor Space records.
- **Farmer** — sees only their own Availability records.
- **Agent** — acts on behalf of farmers, creating Availability records for them. An Availability record therefore has both an owning farmer and possibly a creating agent.

Processors and farmers/agents **never see the Match entity**. Match-derived information is surfaced on their own record's detail view instead. Visibility of that information is further gated per processor (ANZCO sees the most, SFF sees a restricted set only once the space is Confirmed, Alliance Group sees no matches at all).

### Stock class is not a shared vocabulary

The two sides use different, non-aligned stock-class lists. Processor Space stock classes are **processor-specific** (ANZCO, Alliance Group, and SFF each have their own list); Livestock Availability uses a single separate list (GFNB ultra/premium, Prime, Cow, Sire Bull, Bull, Mixed Cattle, Lamb, Mutton). There is no automatic mapping between them — the human operator judges compatibility during drag-and-drop. Don't build a join on stock class and don't assume a shared enum.

## Business rules that drive most of the UI

**Quantity aggregation.** Nearly every screen shows two different sums over a record's matches:

- `Quantity Matched incl Draft` = sum of matches **not** Cancelled. **APG-only.**
- `Quantity Matched excl Draft` = sum of matches not Cancelled **and** not Drafted. Visible to processors/farmers, who see it labelled simply "Quantity Matched".

Compute both from the match set; never store a denormalised total. Colour semantics differ by side: Processor Space uses orange/green/blue for under/exact/over; Livestock Availability uses orange/green/**pink**, because over-committing supply should be impossible and pink flags a bug.

`Quantity Unmatched` (used on the matching screen) = original quantity minus incl-Draft matched. Negative values are highlighted, labelled "Over-filled" on the Processor Space side and "Over-committed" on the Availability side.

**Statuses.** Match status is explicit and APG-driven: `Drafted → Notified → Confirmed`, plus `Cancelled` (requires a cancellation reason: change from agent/farmer, change from processor, or internal APG decision). In pass 1 the lifecycle is `Drafted → Confirmed` (resolved question 2), so `MatchLifecycle` gates confirm on `Drafted` only, delete on `Drafted` only, and cancel on anything past it — delete and cancel are never both offered. Processor Space and Livestock Availability statuses are largely **derived from their matches**, not set directly — e.g. an Availability record is `Booked` with no live matches, `Pending` while matching is in progress, and `Confirmed` only when unmatched quantity is zero and every match is Confirmed or Cancelled. Implement these as computed state so they can't drift.

**Match creation.** Dragging one record onto the other prompts for `quantityMatched`, defaulting to `min(unmatched on each side)`. If that default is < 1, refuse with "There is no unmatched quantity". The default price per Kg (by processor × stock class × week-commencing-Sunday) is shown at draft time and stays editable on the match.

**Match editing.** The ceiling on an existing match is the availability's unmatched quantity **plus that match's own current quantity** (resolved question 13) — `MatchCreation.MaxMatchQuantity(availability, matches, existingMatch)`, the **three**-argument overload. The one-argument overload is for a *new* match and adds nothing back; reaching for it on an edit refuses the quantity the match already holds. The `.docx`'s "originally available" goes the other way and would permit the over-commit the pink colour exists to flag. Both are wrong, in opposite directions. The ceiling ships on `MatchEditContextDto.maximumQuantity` because composing it client-side would be arithmetic on two DTO quantity fields.

**Matching screen layout.** Processor Spaces left and Livestock Availability right by default, swappable on the flip button. Both lists change no data, and each is filterable and sortable by every displayed field. Both sides show a "week commencing" (Sunday) value, but **only Processor Spaces can be filtered by it** — resolved question 17 removed the availability week filter, and the `.docx`'s p.21 request for one is overridden. Default filters: Processor Spaces `Status = Booked`; Availability `Status in (Booked, Pending)` and `Quantity Unmatched > 0`.

## Requirements document

`Documents/Requirements/APG Booking Module Requirements 2026-08-27.docx` is the authoritative spec (32 pages). Consult it before implementing any screen — this file is a summary, not a substitute.

It is **misnamed**: despite the `.docx` extension it is a legacy OLE compound `.doc`, so unzip-based extraction fails. Extract it via Word COM:

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible = $false
$d = $w.Documents.Open("<abs path to .docx>", $false, $true)
$d.SaveAs([ref]"<abs path to out.txt>", [ref]7)   # 7 = wdFormatEncodedText
$d.Close([ref]$false); $w.Quit()
```

The spec contains unresolved questions in angle brackets (`<validate>`, `<Devs>`). Treat those as open, not as requirements.

## Seed data

`Data/*.csv` is an export from APG's **existing livestock forecasting system**, not from this booking module. Its stock classes, statuses, and transaction types do **not** match the booking-module vocabularies above — don't wire it in as if they did.

Useful for realistic demo content:

- `locations.csv` (~300 farms) — plausible Location values for Availability records.
- `stock-class-configs.csv` — icons and hex colours per stock class, reusable for visual styling.
- `purchases.csv` (~3100 rows) — `quantity`, `date`, `transactionTypeName` (Finance Stock, Grazing Stock, ANZCO Grazing, Farm Owned, …), `locationId`, `stockClassId`. Relevant because Availability records with Transaction Type = Finance Stock must draw down against Purchases that have unused quantity and match on stock class, location, and transaction type.
- `groups.csv`, `forecast-updates.csv`, `group-membership-logs.csv` — forecasting-specific; largely irrelevant here.
