# Phase 8 — Polish & Demo Readiness

**Depends on:** every prior phase.
**Delivers:** a prototype that survives being shown to APG.

## Objective

Pass 1 ends here. The measure of this phase is not a feature list — it is whether someone can hand
the laptop to an APG staff member who has never seen the app, and watch them match livestock without
being talked through it.

## Out of scope

Anything on the deferred list in the roadmap. If you find yourself wanting record detail pages or the
Match list view, note it and stop — they are pass 2.

## Requirements

### 1. Reset demo data

1.1 A visible "Reset demo data" control that calls the API's reset endpoint to re-seed the database,
    and clears the client's stored UI preferences.
1.2 Confirm before wiping, since a demo's worth of drag-and-drop can be lost to a stray click.
1.3 Must genuinely restore the seed — including the carefully constructed cases from Phase 0 §4.7,
    which are what make the screen worth looking at.

### 2. Quantity states, finished

2.1 Over-filled spaces and over-committed availability records are unmistakable — highlight plus the
    literal labels **"Over-filled"** and **"Over-committed"**.
2.2 The three-colour ramps are correct and consistent everywhere they appear: cards, expanded match
    lists, dialogs, modals.
2.3 Confirm the pink over-committed state renders correctly by forcing it (Phase 7 §4.4 makes it
    reachable), then confirm no ordinary flow produces it.
2.4 Colour is never the only signal. Every state carries a label or icon.

### 3. Stock-class iconography

3.1 Use the icons and hex colours in `Data/stock-class-configs.csv` where names align.
3.2 That file comes from APG's **forecasting** system — its names only partly overlap our two
    booking-module lists, and the processor-specific lists especially will not all match. Implement
    the fallback designed in Phase 2 and make sure no stock class renders bare.
3.3 The mapping belongs in the Phase 0 config module, not scattered through components.

### 4. Empty, loading, and error states

4.1 Empty columns, empty week bands, no-results-after-filtering — each with a way out.
4.2 A record with no matches reads as deliberately empty, not broken.
4.3 If a default price is missing for a match, say so plainly rather than showing a blank or a zero.
4.4 Nothing in the UI ever shows a raw `undefined`, `NaN`, or `Invalid Date`.

### 5. Interaction polish

5.1 Card expand/collapse, drag pickup and drop, and modal open/close feel considered. Motion should
    be quick and never block the next action.
5.2 Drag auto-scroll is smooth at the top and bottom of a column, including across week bands.
5.3 Anything Phase 5 flagged as feeling wrong gets revisited here.

### 6. Legibility and shell consistency

6.1 Contrast is comfortable against the Phase 2 palette in both columns, on a mediocre monitor.
6.2 Every state carries a label or icon, never colour alone — the status left-edge scheme and the fill
    meter both already do this, so confirm nothing has regressed to colour-only.
6.3 Material dialogs behave as Material dialogs do: focus goes into them, Escape closes them. That
    comes with the component; do not remove it, and do not build beyond it.
6.4 The prototype's screens still sit correctly in the shell — sidebar collapse, top bar, and the
    content area at every width in scope.

> There is **no keyboard-only requirement** (resolved question 14). A mouse is assumed. Do not add a
> keyboard journey, and do not treat its absence as a gap.

### 7. Layout resilience

7.1 Both columns intact and usable at 1366×768.
7.2 The sticky week rail behaves at every viewport width in scope.
7.3 Long values — a 30-character location, a big quantity, a wordy note — do not break card layout.

### 8. Demo script

8.1 Add `Documents/DEMO.md`: a short walkthrough hitting the many-to-many shape (one space filled
    from three records; one record split across three spaces), an over-filled space, a match
    confirmation, and a record cancelled without cascading to its matches.
8.2 Name the specific seeded records to use, so the demo does not depend on hunting for a good example
    while people watch.

### 9. Final housekeeping

9.1 CLAUDE.md reflects the finished app: commands, structure, conventions, gotchas.
9.2 Remove dead code, unused dependencies, and stray console output.
9.3 The roadmap's deferred list is updated with anything discovered during the build that pass 2
    should pick up.

## Acceptance criteria

- Reset demo data fully restores the seeded state, Phase 0 §4.7 cases included.
- Held next to `ExistingAppScreenshots/*.png`, the finished screen reads as part of LMS.
- No raw `undefined`, `NaN`, or `Invalid Date` anywhere, under any filter combination.
- Every stock class on both sides renders with an icon or a deliberate fallback.
- The app is usable at 1366×768 with both columns visible.
- `Documents/DEMO.md` exists and its walkthrough works against freshly reset data.
- `dotnet build`, `dotnet test` and the Angular production build all pass.

## Hand-off notes

Close by stating plainly what pass 1 does **not** do — cancelled matches are invisible without the
Match list view, there are no record detail pages, no roles, no notifications — so that nobody
watching the demo mistakes a deliberate omission for a defect.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section. This is the last entry in the
build log for pass 1, so it doubles as the hand-off to whoever picks up pass 2.

**Review focus for the sonnet subagent:** run it across the whole application rather than just this
phase's diff — this is the only review that sees the finished thing. Ask for correctness bugs first
and quality second, and ask specifically whether any of the roadmap's domain rules have drifted during
the build.

**Record in `Documents/BUILD-LOG.md`:** a summary of pass 1 as built, everything deliberately left
undone, every known bug or rough edge that survived, anything discovered during the build that pass 2
should pick up, and where the seams are for the deferred work — roles, detail views, the match list,
and the farmer flow.
