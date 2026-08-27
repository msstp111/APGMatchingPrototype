# Phase 3 — Card Lists & Week Bands

**Depends on:** Phase 1 (the DTO contract), Phase 2 (`design-system.md`).
**Delivers:** both columns rendering real data as cards, banded by week, with carry-over cards.

## Objective

Turn the seed data into the screen. After this phase the matching screen looks finished but does
nothing — no filtering, no sorting, no dragging. That is deliberate: the layout problem here
(especially carry-over cards) is hard enough to deserve its own phase.

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
    silently collapsed.

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

### 4. Carry-over cards — the core of this phase

A Processor Space belongs to one day. An Availability record becomes available on a date and stays
available until it is used up. So an availability record that is unmatched three weeks after its
available-from date is still matchable *this* week, and an operator working this week's bands must be
able to see and use it.

4.1 An availability record renders as a **full card in its home band** (the band of its
    available-from date).
4.2 It **also renders as a carry-over card at the top of every subsequent band**, for as long as its
    `unmatched > 0`.
4.3 Carry-over cards are visually secondary per `design-system.md` — muted, dashed — and labelled
    with their origin, e.g. "available since 10 Aug".
4.4 Carry-over cards stop appearing in bands after the record's unmatched quantity reaches zero.
4.5 A carry-over card is **the same record**, not a copy. Expanding one shows the same matches, and
    from Phase 5 onward dragging one creates a match against the same record.
4.6 Carry-over cards must **never double-count** in any total, badge, or count-of-records display.
4.7 Group carry-over cards distinctly from the band's native cards so the operator can tell "new this
    week" from "still hanging around" at a glance.
4.8 Cap the carry-over horizon at a sensible number of weeks past the current week so a stale record
    from months ago does not repeat forever. Make the cap a named constant and say what you chose.

> If, while building this, you find a display that works better than carry-over cards, build the
> specced behaviour first and then show the alternative. Mark expects to iterate here.

### 5. Expand and collapse

5.1 Per-card, independent, and remembered while the session lasts.
5.2 Expanding must not shift the cards above it out from under the pointer.
5.3 Mouse-driven. A pointer is assumed available (resolved question 14), so there is no keyboard
    requirement here — use a Material control that happens to be keyboard-operable and leave it at
    that, rather than building a keyboard path of your own.

### 6. Performance

6.1 Roughly 50 spaces, 50 availability records, and their carry-over instances must scroll smoothly.
6.2 Derived quantities arrive on the DTO already computed. Do not recompute or cache them in the
    client — bind to what the API returned.
6.3 If you reach for virtualisation, check first that it does not fight the sticky rail. Plain
    rendering is likely fine at this scale; do not add the complexity speculatively.

## Acceptance criteria

- Both columns render every seeded record, banded correctly by week.
- The sticky rail tracks the visible band while scrolling.
- An availability record with an early available-from date and remaining unmatched quantity appears
  as a carry-over card in each later band, and disappears from later bands once fully matched.
- Every number on every card comes from the DTO. No domain arithmetic anywhere in `web/`.
- The over-filled space in the seed data displays blue with the "Over-filled" label.
- No card offers an action beyond expand/collapse.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** carry-over card identity — that a carry-over is the same
record rather than a copy, and that it cannot double-count in any total or count. Also whether any
domain arithmetic escaped into TypeScript instead of arriving on the DTO, and whether the sticky
rail survives long bands and fast scrolling.

**Record in `Documents/BUILD-LOG.md`:** the carry-over horizon you chose and why, roughly how many
carry-over instances the seed produces, the component names and props Phases 4 to 7 will attach to,
how expand/collapse state is held, and anything about the layout that is more fragile than it looks.
