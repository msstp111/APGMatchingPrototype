# Phase 2 — Design Pass

**Depends on:** Phase 0 (the themed shell and real seed data to design against), Phase 1 (the exact
computed fields a card must show).
**Delivers:** a design canvas of the whole matching screen, plus `Documents/design-system.md`.

## Objective

This is the phase where the bulk of the UI is designed. Phases 3–8 implement against what you produce
here rather than inventing visuals of their own, so an ambiguity left open in this phase becomes five
inconsistent decisions later.

**You must invoke the `design` skill for this phase.** It produces a multi-artboard canvas published
as an Artifact that Mark can then edit visually. Do not hand-roll mockups instead.

## Out of scope

Writing application code. This phase produces a canvas and a written design system; it does not
touch application code.

## Read the screenshots first

`ExistingAppScreenshots/*.png` are the four reference images: APG's live LMS v7. **You are extending
that application's visual language, not designing a new one.** Read the roadmap's "Visual language"
section, then study the PNGs directly for the things a written summary loses — the exact blues, the
row density, how much air the filter panel takes, the weight of the column headers.

Sample hex values from the pixels. Phase 0 recorded the ones it sampled in the build log; reuse those
rather than arriving at slightly different numbers.

Two things this constrains:

- **It is an Angular Material app.** Design with themed Material components — its buttons, selects,
  chips, dialogs, FAB, and its type scale. A design that needs bespoke controls is the wrong design
  here, however nice it looks.
- **The shell is fixed.** The petrol-blue top bar with its yellow dev flag, and the sidebar with its
  blue header and grey footer, are settled by the existing app. Design *inside* the content area.

## The hard problem

It is **not** the colour collision — that is now settled in the roadmap under "Two colour systems,
resolved", and your job is to apply and document it, not to reopen it. In short: hue belongs
exclusively to quantity fill, expressed as a fill meter; status is carried by the card's left edge
through weight, pattern and icon, plus a text label.

The genuine problem is **making cards feel native to a table-based application.** Every other screen
in LMS is a dense zebra-striped table. Two columns of cards is a real departure, justified by the
matching interaction, and it has to look like a deliberate part of the same product rather than a
different app bolted on. Density is most of the answer: LMS shows twenty-odd rows at a glance, and a
card list that shows four has broken the family resemblance.

**Colour is never the sole carrier of meaning.** Every state needs a label or an icon as well. APG
staff will use this all day, some of them on poor monitors in farm offices.

## Artboards required

1. **The matching screen in the LMS shell, default state.** Full window: petrol-blue top bar with the
   yellow dev flag, the sidebar with its nav list and the booking module's entry active, and inside
   the content area both columns populated with real seeded data, week bands, sticky "Week of…" rail,
   filter panel, flip control. This is the money shot — the one artboard that has to be right, and it
   must be drawn at full width so the shell's proportions are honest.
2. **Processor Space card** — collapsed and expanded, in every status, plus the under / exact /
   over-filled quantity states.
3. **Livestock Availability card** — collapsed and expanded, every status, under / exact states, and
   the pink over-committed bug state.
4. **The backlog above the current week** — the top of the availability column, showing older weeks
   whose surviving records are the unfinished ones, running down into the current week. The question
   this artboard answers: does an operator scrolling up understand they are looking at outstanding
   supply rather than history? Consider whether past bands need any marking beyond being
   de-emphasised. There are **no carry-over cards** (resolved question 17) — every record appears
   once, in its own week.
5. **Week band and rail** — how a band header reads, how the sticky rail behaves, what an empty week
   looks like, how "this week" is distinguished from past and future weeks.
6. **Drag states** — a card mid-drag under the cursor, a valid drop target on the opposite column, an
   invalid target (same column), and what a card with no unmatched quantity left looks like as a
   target. Mouse only; there is no keyboard drag path (resolved question 14).
7. **Quantity prompt dialog** — both records summarised, quantity input with its default, the default
   price per kg, optional transport company. Plus the refusal state: "There is no unmatched quantity".
8. **Match management modal** — read-only blocks for both records, editable quantity / price /
   transport, and the actions: delete draft, cancel with reason, confirm.
9. **Filter and sort bar** — stock class and status filters on both sides, sort control, flip button,
   reset-to-default.
10. **Empty and edge states** — no results after filtering, a week with nothing in it, an over-filled
    space, a fully confirmed record.

## Card content

Take the exact fields from the Phase 1 DTOs. Collapsed cards carry only the most valuable summary
information; everything else lives behind expand.

**Processor Space, collapsed:** processor + plant, stock class, delivery date and time, quantity
required, **quantity unmatched** (the number APG scans for), status.
**Expanded, additionally:** notes, both matched sums (incl and excl draft), and its matches — each
showing quantity, farmer and location, status, price per kg, transport company.

**Livestock Availability, collapsed:** location and farmer, stock class, available-from date,
quantity available, **quantity unmatched**, status.
**Expanded, additionally:** availability details, transaction type, notes, both matched sums, and its
matches — each showing quantity, processor and plant, delivery date and time, status, price per kg,
transport company.

## Design constraints

- **Density beats beauty.** APG are matching dozens of records across weeks. A card that looks
  elegant at four-per-screen and forces scrolling for the fifth has failed. Aim to show a useful
  number of cards per column without shrinking text below readable.
- **Scannability.** Unmatched quantity is the number the operator hunts for on both sides. It should
  be findable without reading the card.
- **The two columns are symmetrical but not identical.** They must read as siblings while remaining
  instantly distinguishable when flipped, since the flip button means the operator cannot rely on
  position alone to know which side is which.
- **Non-technical users.** No jargon that isn't APG's own. "Quantity Matched" not "matchedExclDraft".
- **Desktop first**, must survive a 1366px laptop with both columns intact — remembering the sidebar
  takes ~200px of it.
- **Mouse only.** A pointer is assumed available at all times (resolved question 14). Do not design
  keyboard drag affordances or a pointer-free path. Material's own focus styling stays as it comes;
  don't remove it, and don't build on it either.
- **Empty values render as `-`**, matching the existing app.
- Stock-class iconography and colours can draw on `Data/stock-class-configs.csv`, but note that file
  comes from APG's forecasting system and its names only partly overlap either of our two stock-class
  lists. Design a fallback.

## `Documents/design-system.md`

Later phases must be implementable from this document alone, without opening the canvas. Record:

- **The hex values sampled from the screenshots** — the petrol blue, the dev-flag yellow, the zebra
  grey, the column-header grey, the FAB blue — and the Material theme configuration built on them.
- The colour tokens, as SCSS custom properties: surface, text, borders, and the quantity ramps for
  both sides.
- **The status scheme in full:** the left-edge treatment for each of the four statuses, its icon, and
  its text label. State plainly that status carries no hue and quantity carries no pattern, so a later
  phase cannot blur the two back together.
- **The fill meter's** dimensions, colours, and how it behaves when a value goes negative
  (over-filled) — a meter past 100% needs a defined look.
- Type scale, spacing scale, border radii, elevation.
- Card dimensions, collapsed and expanded, and internal padding.
- Week band and rail metrics, and how the content area sits inside the shell.
- How a **past** week band is de-emphasised relative to the current one, and where the trimmed list
  begins.
- Interaction states: hover, active, dragging, drop target, disabled.
- Anything you decided that the canvas shows but does not explain.

## Acceptance criteria

- The `design` skill was used and a canvas Artifact URL is reported back.
- All ten artboards exist and use real seeded data, not lorem placeholders.
- **Held next to the screenshots, the design reads as part of LMS** — same shell, same blues, same
  type, comparable density.
- Every control in the design is a themed Material component, not a bespoke one.
- `Documents/design-system.md` is complete enough that Phase 3 needs no further design decisions.
- The roadmap's status/quantity colour scheme is applied as written and documented in full.
- No keyboard-drag or pointer-free affordances were designed.
- No carry-over cards appear anywhere in the canvas.
- No application code was modified — nothing under `src/`, `tests/` or `web/`.

## Hand-off notes

The availability-spans-weeks problem is **settled** — see resolved question 17 and the roadmap's
"Spaces are fixed to a day" section. Every record appears once in its own week; carried-over supply is
found by scrolling up through a backlog that the default filters and the leading-band trim keep
meaningful. An earlier draft of this plan used carry-over cards and that design was rejected. Your job
is to make the backlog legible, not to solve the problem again.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section, with one adjustment: there is
no code to review, so the sonnet subagent reviews the **documentation** instead.

**Review focus for the sonnet subagent:** hand it `design-system.md`, the four screenshots and the
Phase 3 requirements, and ask two things. First, whether Phase 3 could be built from that document
alone without making a single visual decision — every gap is a decision left for someone else to
invent inconsistently. Second, whether the design would look at home in the screenshots, or whether it
has drifted into being its own product.

**Record in `Documents/BUILD-LOG.md`:** the canvas Artifact URL, the sampled hex values and the
Material theme configuration, the status left-edge scheme and the fill meter as shipped, how a past
week band reads against the current one, the type and colour tokens
by name, and anything the canvas shows that the document does not explain.
