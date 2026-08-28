# Phase 3b — Remove Carry-Over, Build the Backlog

**Depends on:** Phase 3 (which built the thing this phase removes).
**Delivers:** the availability column as a burn-down backlog — every record once, leading empty bands
trimmed per column, both columns opening at the top.

## Why this phase exists

Phase 3 was built, reviewed and logged against a design that has since been **rejected**. It shipped
**carry-over cards**: an availability record with unmatched stock repeated, visually demoted, into
every later week band inside a four-week horizon. 114 such instances against the current seed.

That design was replaced on 2026-08-28 by resolved question 17. The roadmap's "Spaces are fixed to a
day; availability spans weeks" section now describes the replacement, and the Phase 3 requirements
document has already been rewritten. **This phase reconciles the code to it.**

Read Phase 3's build-log entry before planning. It is the accurate record of what exists; the Phase 3
requirements document now describes the intended end state instead, and the two disagree on purpose.

## Why carry-over was rejected

Not because it was badly built — it wasn't. Because the design was wrong:

- It **duplicated records on screen**, so every total, count and badge needed a double-counting guard.
- It made **dragging ambiguous** — which instance was picked up.
- It **hid the backlog it was meant to surface**. Scattering one record across five weeks makes the
  amount of outstanding supply impossible to read at a glance.

The replacement uses the default filters instead. Because finished work is filtered out, whatever sits
above the current week *is* the backlog, and the height of that region is the signal. Records burn
down out of it as they are matched and confirmed.

## Out of scope

Filters, sorting and the flip control (Phase 4) — even though this phase touches the same seam. Drag
and drop (Phase 5). Do not start Phase 4's work because you are already in `matching-board.ts`.

Regenerating the Phase 2 design canvas. Update `design-system.md`; note the canvas as stale on its
carry-over sections and leave it.

## Requirements

### 1. Remove the carry-over machinery

All of the following exist today and must go:

1.1 `web/src/app/matching/board/carry-over.ts` — `addCarryOvers`, `CARRY_OVER_HORIZON_WEEKS`,
    `CARRY_OVER_EXPAND_LIMIT`. Delete the file.
1.2 `web/src/app/matching/card/carry-over-card.ts` — the component. Delete it.
1.3 `BandView.carryOver` — remove from the shape returned by `buildBoard`.
1.4 `CardStateStore.isCarryOverGroupOpen` / `toggleCarryOverGroup` in `board/card-state.ts`.
1.5 In `band/week-band.ts`: the carry-over group and the **"New this week"** divider. With nothing to
    distinguish native cards from, the divider has no meaning.
1.6 The `$lms-carry-name` token (`#4A4A4A`) in `_lms-tokens.scss`, and any carry-over-only geometry in
    `_card-geometry.scss`.
1.7 Every carry-over test — placement bounds, the `Object.is` identity assertion in
    `matching-board.spec.ts`, expansion keying by band, the group-collapse tests.

1.8 Two things become possibly-unused rather than obviously-dead: `NzTime.WeeksFrom` and
    `LivestockAvailabilityDto.availableFromShortLabel` (which fed "since 17 Aug"). Delete `WeeksFrom`
    if genuinely nothing calls it. **Keep the DTO field** — removing it is a contract change for no
    gain, and Phase 4's filter chips may well want a compact date. Say in the build log which of them
    ended up unused.

1.9 In the seeder, `SeedDataGenerator.CarryOverAvailabilityCount` holds five week−1 records out of
    matching. **Keep the behaviour, rename the constant** — those records are exactly what populates
    the backlog. `BacklogAvailabilityCount` or similar. The seeded data must not change; the
    determinism test still has to pass and the counts in Phase 0's build-log entry must stay true.

### 2. Trim the leading empty bands — per column

This is the substantive new behaviour, and it **overturns a decision Phase 3 made deliberately.**

Phase 3's decision 1 built `GET /api/week-bands` returning one ordered, gapless band list, and had
**one list serve both columns** so that a week empty on one side still rendered on the other and the
two columns stayed vertically comparable. That is incompatible with what is now required.

2.1 **Each column begins at the week of its own earliest surviving record.** The leading run of bands
    with no records *in that column* is not rendered.

2.2 **Each column trims independently.** A Processor Space must never be hidden because of what the
    availability column contains, or the reverse. This is the reason the shared list has to go: with
    a common start week, a past-dated Booked space older than the earliest availability record
    disappears with nothing on screen to say so.

2.3 The two columns will therefore often start at different weeks, and their rails will show different
    weeks at the same vertical position. **That is expected and correct.** They scroll independently
    already. Do not add scroll synchronisation to compensate.

2.4 **Keep the server as the source of the calendar.** `GET /api/week-bands` still returns the ordered,
    gapless, labelled list — that is what makes empty-week headers possible without constructing a
    `Date` in TypeScript. Trimming is choosing where to start reading an ordered array, not date
    arithmetic, so it belongs in `buildBoard`. Do not move week generation into the client.

2.5 **Only the leading run is trimmed.** An empty week *between* two populated weeks still renders its
    header — a gap in the calendar is information.

2.6 Keep the band range's guarantee that it **includes the current week**, so `isCurrentWeek` always
    has somewhere to land and a column whose records are all in the past still shows where "now" is.
    Phase 3 introduced that property to serve the carry-over rule; it earns its place independently.

2.7 The trim is computed from **currently visible records**. Phase 4 will filter the inputs and call
    `buildBoard` again, so the first band must move forward when a filter removes the oldest record.
    Do not cache the trim point.

### 3. Open at the top

3.1 Both columns are scrolled to the top on load, so the oldest outstanding record is the first thing
    an operator sees.
3.2 With the leading trim in place there is no dead space above it — the top of the column is
    immediately meaningful.
3.3 The list reads as a priority order before it reads as a calendar. Nothing needs to jump to "today".

### 4. Design system

4.1 Update `Documents/design-system.md`: remove §9's carry-over card, group and "New this week"
    divider, and the `#4A4A4A` name colour.
4.2 Replace them with the treatment of a **past week band** relative to the current one, and where the
    trimmed list begins. Past bands are de-emphasised but fully usable — they hold live, draggable
    records, and must not read as disabled.
4.3 Note at the top of that section that the Phase 2 canvas is stale on carry-over and was not
    regenerated.

## Acceptance criteria

- No file, symbol, token, style or test in the repository refers to carry-over.
- Every availability record appears exactly **once** on screen, in the band of its available-from date.
- An availability record from an earlier week with unmatched quantity is reachable by scrolling up, and
  appears nowhere else.
- Each column starts at the week of its own earliest surviving record; the two often differ.
- A past-dated Booked processor space older than every surviving availability record is still visible.
- An empty week between two populated weeks still renders its header.
- Both columns are scrolled to the top on load.
- The seeded data is unchanged — the determinism test and Phase 0's recorded counts both still pass.
- `dotnet build`, `dotnet test` and the Angular build all pass, and the Angular test suite has no
  skipped or commented-out carry-over specs left behind.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** completeness of the removal — dead constants, orphaned
styles, tests deleted rather than skipped, stale comments referring to a concept that no longer
exists. Then the trim: that it is computed per column from that column's own visible records, that it
cannot hide a record, that interior empty bands survive while leading ones do not, and that it
recomputes rather than caching. Ask it explicitly whether anything in `web/` now constructs a `Date`
or does date arithmetic that the deleted code used to avoid.

**Record in `Documents/BUILD-LOG.md`:** state plainly at the top that this entry **overturns Phase 3's
decisions 1, 3, 4 and 5, and the `$lms-carry-name` token from its decision 11** — the log's own rule is
that a later entry says which earlier one it replaces. Then: how the per-column trim is implemented and
where it lives, which week each column now starts at against the current seed, what happened to
`NzTime.WeeksFrom` and `availableFromShortLabel`, the renamed seed constant, and anything Phase 4 now
attaches to differently — its filter pass has to re-trim, so the seam matters.
