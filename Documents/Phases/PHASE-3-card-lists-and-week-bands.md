# Phase 3 — Card Lists & Week Bands

**Depends on:** Phase 1 (the DTO contract), Phase 2 (`design-system.md`).
**Delivers:** both columns rendering real data as cards, banded by week, with the backlog above the current week visible by scrolling.

## Objective

Turn the seed data into the screen. After this phase the matching screen looks finished but does
nothing — no filtering, no sorting, no dragging. That is deliberate: the layout problem here
(the trimmed, scroll-up backlog especially) is worth isolating from everything else.

## Out of scope

Filters, sorting, the flip button (Phase 4). Drag and drop (Phase 5). Opening or editing matches
(Phase 6). The "+ Add" buttons (Phase 7).

Cards are read-only in this phase. Expand/collapse is the only interaction.

## Requirements

### 1. Layout

1.1 Two columns inside the LMS shell's content area — Processor Spaces left, Livestock Availability
    right — each scrolling independently. The top bar and sidebar built in Phase 0 stay put; they do
    not scroll with the columns, and the columns must lay out correctly in the width the sidebar
    leaves behind.
1.2 Each column is divided into **week bands**, a band per week commencing Sunday.
1.3 A **sticky rail** down the left of each column labels the current band — "Week of 16 Aug".
    It must remain readable while scrolling through a long band.
1.4 Bands run in date order, soonest first, and the whole screen is sorted soonest-first throughout
    (per `Frontend ideas.md`).
1.5 The **current week is visually distinguished** from past and future weeks. Past weeks are
    de-emphasised but not hidden.
1.6 An empty week band still renders its header, so gaps in the calendar are visible rather than
    silently collapsed — except for the leading run of empty bands, which is trimmed (see §4.2).

### 2. Processor Space cards

2.1 Each space appears in **exactly one band** — the one containing its delivery date.
2.2 Within a band, ordered by delivery date then delivery time, soonest first.
2.3 Collapsed content, per `design-system.md`: processor and plant, stock class, delivery date and
    time, quantity required, **quantity unmatched**, status.
2.4 Expanded adds: notes, quantity matched incl. draft, quantity matched excl. draft, and the
    record's matches — each showing quantity, farmer and location, match status, price per kg,
    transport company.
2.5 Cancelled matches are **not** shown (resolved question 4).
2.6 Quantity is shown as the **fill meter** from `design-system.md`, coloured from the DTO's quantity
    state: orange under, green exact, blue over. Hue on a card belongs to the meter and nothing else.
2.7 A negative unmatched value is highlighted and labelled **"Over-filled"**.
2.8 Status is carried on the card's **left edge** — weight, pattern and icon per the roadmap's scheme —
    plus a text label. Status uses no hue.

### 3. Livestock Availability cards

3.1 Anchored in the band containing the available-from date.
3.2 Within a band, ordered by available-from date, soonest first.
3.3 Collapsed content: location and farmer, stock class, available-from date, quantity available,
    **quantity unmatched**, status.
3.4 Expanded adds: availability details, transaction type, notes, both matched sums, and its
    matches — each showing quantity, processor and plant, delivery date and time, match status,
    price per kg, transport company.
3.5 The same **fill meter**, coloured orange under, green exact, **pink** over. Pink should never
    appear; if it does, it is a bug, and that is the point of it.
3.6 A negative unmatched value is highlighted and labelled **"Over-committed"**.
3.7 Status on the left edge, as on the space cards, with no hue.

### 4. The backlog — how carried-over supply is found

A Processor Space belongs to one day. An Availability record becomes available on a date and stays
available until it is used up. So a record still unmatched three weeks after its available-from date
is matchable *this* week, and an operator must be able to find it.

**Every record appears exactly once**, in its own band. Nothing is reprinted, duplicated, or echoed
into later weeks. Carried-over supply is found by **scrolling up**, and three things make that work:

4.1 **Finished work is filtered out by default**, so what sits above the current week is a genuine
    backlog rather than a history. Phase 4 builds the filters; this phase applies the same defaults
    as its starting state — spaces `Status = Booked`; availability `Status ∈ {Booked, Pending}` with
    `unmatched > 0`.

4.2 **Leading empty bands are trimmed.** Each column begins at the week of its **own** earliest
    surviving record. There is no fixed historical start, and neither column's start is influenced
    by what the other contains — a space must never be hidden because of what the availability list
    holds, or the reverse.

4.3 **Each column opens scrolled to the top**, so the oldest outstanding record is the first thing an
    operator sees. The list reads as a priority order before it reads as a calendar.

4.4 Interior empty bands — a week with no records between two weeks that have some — still render
    their header. Only the *leading* run of empty bands is removed.

4.5 The two columns will often start at different weeks and their rails will show different weeks at
    the same vertical position. That is expected: they scroll independently and each trims to its own
    data.

> **Do not build carry-over cards.** An earlier draft of this document specified an availability
> record reprinted, muted, at the top of every later week. It was removed deliberately (resolved
> question 17) because it duplicated records on screen, risked double-counting, complicated dragging,
> and obscured the backlog this design makes visible. Do not reintroduce it, and do not treat its
> absence as an oversight.

### 5. Expand and collapse

5.1 Per-card, independent, and remembered while the session lasts.
5.2 Expanding must not shift the cards above it out from under the pointer.
5.3 Mouse-driven. A pointer is assumed available (resolved question 14), so there is no keyboard
    requirement here — use a Material control that happens to be keyboard-operable and leave it at
    that, rather than building a keyboard path of your own.

### 6. Performance

6.1 Roughly 50 spaces and 50 availability records must scroll smoothly. Every record renders once,
    so there is no multiplier here — do not add virtualisation speculatively.
6.2 Derived quantities arrive on the DTO already computed. Do not recompute or cache them in the
    client — bind to what the API returned.

## Acceptance criteria

- Both columns render every seeded record, banded correctly by week.
- The sticky rail tracks the visible band while scrolling.
- An availability record from an earlier week that still has unmatched quantity is visible by
  scrolling up, appears exactly once, and drops out of view entirely once fully matched.
- Every number on every card comes from the DTO. No domain arithmetic anywhere in `web/`.
- The over-filled space in the seed data displays blue with the "Over-filled" label.
- No card offers an action beyond expand/collapse.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** that every record renders exactly once and nothing is
duplicated across bands; that the leading-band trim is computed per column from that column's own
data and cannot hide a record; that interior empty bands survive while leading ones do not. Also
whether any domain arithmetic escaped into TypeScript instead of arriving on the DTO, and whether the
sticky rail survives long bands and fast scrolling.

**Record in `Documents/BUILD-LOG.md`:** which week each column trims to against the current seed and
how far back the backlog runs, how the initial scroll-to-top is implemented, the component names and
props Phases 4 to 7 will attach to, how expand/collapse state is held, and anything about the layout
that is more fragile than it looks.
