# Browser checklist

**The one pass nothing in this build can do for itself.**

jsdom has no layout engine and no pointer, so every geometry claim the design makes and every
mouse-driven interaction the screen has is unverified by the test suites — and has been since Phase 3.
Phases 3, 3b, 4, 5 and 6 each closed with their own checklist buried in their own `BUILD-LOG.md`
entry. This file is those five merged, so the pass is one page to work through rather than an
archaeology exercise.

**It is a checklist, not a spec.** Where it disagrees with `design-system.md`, that document wins.
Every item cites where its claim is actually written down, so a failure can be taken to the right
place.

## What this pass is for

Three kinds of thing, all invisible to `npm test`:

1. **Falsifiable geometry.** `design-system.md` §8.3 promises 9–11 cards per column at 1366×768 and
   says outright that *"if the screen ends up showing four cards per column the design has failed and
   the card must shrink, not the target."* Nobody has counted.
2. **The sticky rail**, which Phase 3's log calls the most fragile thing in the layout: three numbers
   have to agree or the week label parks underneath the header strip.
3. **Pointer paths.** CDK's own auto-scroll was replaced in Phase 5 because it scrolled the *source*
   column when the pointer sat over a band header in the target. The replacement is unit-tested
   through `scrollStep` only. The Phase 5 reviewer disagreed with me about whether CDK can still
   interfere; that disagreement is on the record and only a drag settles it.

## Setup

```
.\dev.ps1                                    # both halves, from the repo root
curl -X POST http://localhost:5286/api/dev/reset-database    # if the data has been played with
```

Then http://localhost:4200, **browser window sized so the viewport is 1366 × 768.** The numbers below
are for that viewport and no other. Use the device-toolbar's "Responsive" mode set to 1366×768 rather
than guessing at the window chrome.

**The record ids and quantities below are stable across reseeds** — the seed is deterministic. The
*dates* move, because every date is an offset from the Sunday of the current NZ week. At the time of
writing the current week is **w/c 30 Aug** and the bands run 23-08 (past) through 27-09.

---

## Results so far

**2026-09-01, partial pass.** Section A's first item — the one the whole density target rested on —
**passes: 9–11 cards per column, as §8.3 promises.** It had been unverified since Phase 3, through two
changes to the figure. The pass also found three rendering defects in the match modal, all since fixed
(see the Phase 6 entry in `BUILD-LOG.md`, "First browser pass"). Everything else below is still unrun.

---

## A. Density and geometry — the numbers the design stands or falls on

- [x] **Count the cards in each column** with nothing expanded and the default filters on.
      **Expect 9–11 per column, 18–22 across both.** (`design-system.md` §8.3.)
      **Verified 2026-09-01: 9–11. The target holds.**
- [ ] **A collapsed card is 52px tall and never grows a third line.** Inspect one and check the
      computed height. (§6.1 — the height is set explicitly for exactly this reason.)
- [ ] **Line 1 aligns to the header strip, cell for cell.** The stock-class tile, name, stock class,
      date, quantity and meter should each sit under their own micro-cap heading. This is the whole
      thesis of the design — a card is a table row — and §16.9 warns it is *"invisible in code review
      and glaring on screen"*. It was wrong in the first cut of the Phase 2 canvas.
- [ ] **The trailing edge lines up too**: the Unmatched column against its own header, 32px in from
      the right. (§16.10 — the card spends 8px padding + 24px chevron, the strip 24px spacer + 8px.)
- [ ] **Long values ellipse rather than wrapping.** Availability **#28, Granite Glen Agriculture**
      (the longest location name in the seed) and any `Nat Beef - Premium` space (the longest stock
      class, 96px column). Neither may push the card to a second line. (§6.1.)
- [ ] **The fill meter block is 112px** and matches the strip's Unmatched cell. One number in two
      places; §4 says if they drift the columns stop lining up.

## B. The sticky rail — the fragile one

- [ ] **Scroll a long band.** The `Week of …` rail label should stick **below** the 28px header strip,
      never under it. Three numbers must agree: the strip's 28px height, the rail label's `top: 28px`,
      and the z-order (strip 3, rail label 1, cards 0). (Phase 3's log, "Deviations".)
- [ ] **The header strip itself stays put** at the top of the `.list` scroll container — not the page.
      (§16.8.)
- [ ] **The dotted petrol leader line** runs down the rail from below the label to the band's end, on
      current and future weeks and **not** on past ones. (§8.5, §9.4.)

## C. Bands, the backlog and the per-column trim

- [ ] **Both columns open scrolled to the top**, showing the oldest outstanding business first — not
      scrolled to today. (§9.2.)
- [ ] **There is a backlog above the current week.** With the default filters, week 23-08 should hold
      **6 spaces (#37, #13, #1, #19, #25, #31)** and **8 availability records (#1, #7, #13, #19, #25,
      #31, #43, #49)**. Its rail carries a grey `Past` tag; the current week's carries `This week` in
      petrol and a 2px petrol top rule opens it. (§9.4.)
- [ ] **Past cards are not faded.** De-emphasis sits on the band chrome only — a past week's records
      are the most actionable things on the screen. (§8.6, §9.4.)
- [ ] **Every record is drawn exactly once.** Nothing is reprinted into a later week. (§9.2 — the
      carry-over design was removed in Phase 3b and must not reappear.)
- [ ] **An interior empty week still renders its header**; the runs at each end do not. (§9.3.)

## D. Filters, sort and flip

- [ ] **The default counts read `showing 34 of 40` (demand) and `showing 41 of 50` (supply)**, and the
      chip faces show `Status: Booked` and `Status: 2 selected` + `More (1)` so nothing looks like it
      has vanished. (§12.2, §12.3.)
- [ ] **Filter the demand column to one delivery week.** The column should trim to that week alone —
      no stack of empty headers below it. (Phase 4 addendum, overturning Phase 3b's 2.6.)
- [ ] **The supply column's `More` menu offers no week filter.** Resolved question 17; three tests
      guard it, but look anyway.
- [ ] **The location type-ahead** narrows ~300 options and says how many more match beyond the 60 it
      shows. (Phase 4 decision 3, `LOCATION_MENU_LIMIT`.)
- [ ] **Sorting reorders cards inside each band and never dissolves one.** (§8.4.)
- [ ] **Flip the columns.** Filters, sort, expanded cards and scroll position all survive — it is CSS
      `order`, so neither component is destroyed. (Phase 4 decision 11.)
- [ ] **Filter a column to nothing.** The no-results state names the filters doing the hiding and
      offers both `Clear filters` and `Reset to default`. (§13.)

## E. Drag to match

- [ ] **Drag a space onto an availability record, then the reverse.** Same pair, same prompt — one
      function resolves both directions. (Phase 5, requirement 1.2.)
- [ ] **Drag a past-week availability record onto a current-week space.** This is the backlog's whole
      purpose.
- [ ] **Auto-scroll at both column edges — and specifically with the pointer over a band header or an
      empty-band row in the _target_ column.** This is where CDK's own auto-scroll scrolled the wrong
      column, and where the Phase 5 reviewer and I disagreed. The column under the pointer must
      scroll, never the source. (Phase 5, "Auto-scroll and long week bands".)
- [ ] **Escape mid-drag**: highlights clear, the preview vanishes, and releasing the mouse creates
      nothing. (CDK fires `ended` before `dropped`, so the cancelled flag must survive `ended`.)
- [ ] **Drop on the same column, on a band header, on empty space**: nothing happens, and no message.
      A silent no-op is the specification. (§10, Phase 5 requirement 1.3.)
- [ ] **Drop onto something with nothing left** — space **#4** is already over-filled (`unmatched -66`)
      and is on screen by default. Expect the snack `There is no unmatched quantity` and **no dialog at
      all**. (§11.2.)
      *Every exhausted availability record is hidden by the supply column's `unmatched > 0` default, so
      to try it from that side you must first turn off `Has unmatched quantity` in the supply `More`
      menu — records #2, #3, #5, #10, #27, #35, #37, #41 and #50 then appear with a `0` numeral.*
- [ ] **Create a match**, and watch both meters, both sums and both match lines update. Then **UNDO**
      from the snack bar and watch them go back.
- [ ] **Consume the last of an availability record** and watch it leave the supply column, because the
      default filter is `unmatched > 0`. Correct, not a bug. (§9.2.)
- [ ] **The drag preview is 1:1** — no tilt, no shrink — and the placeholder left behind is the same
      52px, so the list does not reflow under the pointer. (§10.)

## F. Match management

- [ ] **Open the same match from both sides.** Match **#7** hangs off space **#27** and availability
      **#6**. Expand either card, click the row: the modal must show the same figures and the same
      ceiling either way. (Requirement 1.2.)
- [ ] **The match label on line 2 opens the card.** `2 matches · 1 draft` is a button; `no matches` is
      not. Clicking it must **not** start a drag — it sits inside the drag handle and stops
      `pointerdown`. Try clicking it with a slight wobble.
- [ ] **No text overlaps anything else.** The first pass found `mat-hint` text painting over the notes
      below it and over the footer, because Material's subscript wrapper is a fixed height and a hint
      that wraps overflows rather than pushing down. Hints in this modal are now capped at one line of
      the price hint wraps to four lines inside its own field and the actions sit below it, not on it.
      **The Phase 5 quantity prompt had the same bug and the same fix** — check both dialogs.
      *The standing rule: a hint may wrap and belongs in the field it describes; what must hold is that
      the subscript can grow (`height: auto`). A note below the row is only for something that is not
      about a single field, such as the match modal's ceiling.*
- [ ] **Every form field shows its label.** In the first pass none of the six across the two dialogs
      appeared to, though all six are `mat-label`s in the templates. If `density: -2` is clipping the
      floating label in `appearance="fill"` fields, every field in the app is affected and Phase 7's
      forms will hit it hardest. **Unconfirmed — this is the item to settle first.**
- [ ] **The ceiling note.** On match **#7** it must read
      **`Ceiling 58 = the availability's 22 unmatched, plus this match's own 36.`**
      Record 6 has 144 available. **If the modal says 144, the requirements document's wrong rule has
      been implemented** and the over-commit the pink state exists to flag is reachable. (Resolved
      question 13.)
- [ ] **Type 59 into the quantity field** — the hint turns into `Max is 58` and Save is refused.
      Type `0`, and it says to cancel or delete instead. Type `1.5`, and it asks for whole head.
- [ ] **The other half of the same rule**, and the one a wrong implementation fails outright: match
      **#2** on space **#1** has consumed its record entirely, so its note reads
      **`Ceiling 29 = the availability's 0 unmatched, plus this match's own 29.`** Without the add-back
      the ceiling would be **0** and the operator could not resubmit the form unchanged, let alone
      reduce the match. Check the field accepts 29.
- [ ] **Edit a `Drafted` match's quantity** (say #7): **no prompt**, the modal closes, both columns
      move behind it.
- [ ] **Edit a `Confirmed` match's quantity** — match **#2**, also on space **#1**: the prompt names
      the consequence in the processor's terms, *"will change what ANZCO Rangitikei expects on
      28-08-26"*, and the buttons carry the two values (`Keep 29` / `Change to …`), not Yes and No.
      Decline it and nothing is written. (§11.5.)
- [ ] **Change quantity and transport together on a Confirmed match**: **both** consequences are named
      in the one sentence. (Fixed in Phase 6's review; the write applies both fields.)
- [ ] **Change only the price on a Confirmed match**: **no prompt.**
- [ ] **`Delete draft` appears only on a draft; `Cancel match…` only past one. Never both.** Space
      **#1** shows all of it from one card: match **#3** and **#4** are drafts, match **#2** is
      confirmed. (Resolved question 3.)
- [ ] **Cancel a match.** The reason list offers exactly three, nothing is preselected, the action is
      disabled until one is chosen and says `Choose a reason to continue`, and the warning panel states
      both that it disappears from the screen and that neither record is touched. (§11.6.)
- [ ] **After cancelling**, the match is gone from both cards, both sums have moved, and the parent
      records' statuses have not changed.
- [ ] **`Confirm space` is enabled on #37, #26, #32, #38, #21, #22** and disabled everywhere else with
      its reason printed beside it. Requirement 5.3 — the one that most directly stops a non-technical
      user concluding the app is broken.
      - `Needs at least one confirmed match and no drafts` — space **#1**, on screen by default
        (it holds drafts #3 and #4).
      - `Already confirmed` — spaces **#2**, **#3**, **#6**, **#9**.
      - `This space is cancelled` — spaces **#7** and **#16**, and note #7 still holds two live
        matches, because cancelling a record never cascades.
      *The last two groups are hidden by the demand column's `Status = Booked` default. Tick
      `Confirmed` and `Cancelled` on the Status chip to see them — which is itself the check that a
      Confirmed space still appears when the filters allow (requirement 5.5).*
- [ ] **Confirm space #37** and watch it drop out of the default `Status = Booked` filter. Correct
      behaviour, not a bug. (Requirement 5.5.)
- [ ] **Escape closes the modal, the change prompt and the cancel dialog.** (Requirement 1.4 — taken as
      Material gives it.)
- [ ] **Recount the cards per column with a match expanded**, now that Phase 6 added the actions row
      under the match table. The expansion is taller than it was when §8.3's figure was set.

## G. Does it look like it belongs in LMS?

Phase 8 owns this judgement; the point of checking now is that the baseline exists. **§16a already
lists four deliberate divergences** — the status spine (no LMS precedent at all), filter chrome at a
fifth of LMS's footprint, chips as an idiom LMS never uses, and a header strip with a fill and sticky
behaviour. Those are decisions, not defects.

- [ ] Hold the screen next to `ExistingAppScreenshots/*.png`. Anything that differs and is **not** one
      of those four is worth writing down.
- [ ] **The four status spines** read apart at a glance: Booked 3px light grey, Pending 6px hatched,
      Confirmed 6px solid petrol, Cancelled 6px dashed with the whole card desaturated and its title
      struck through. Space **#7** or **#16** is cancelled; **#2**, **#3**, **#6**, **#9** confirmed.
      (§3.1.)
- [ ] **The over-run treatment** on space **#4** (Alliance Group, 726 matched against 660 required,
      `unmatched -66`): both segments at 100%, the track outlined, the 3×12px cap past its right end,
      a negative numeral, and the literal word `Over-filled`. (§4.2.)
- [ ] **Nothing is pink.** No availability record is over-committed, and pink is a bug flag. If you see
      it, stop and report it. (§4.3.)
- [ ] **Stock-class tiles carry shape, not colour**: circle sheep, square cattle, diamond deer, grey
      monogram. The CSV's hex colours are deliberately unused. (§7, resolved question 16.)
- [ ] **Type is Roboto throughout and there is no serif anywhere.** (§1.)

---

## Things that look wrong and are correct

Do not report these. Each is a decision with a reason recorded.

| What you'll see | Why |
| --- | --- |
| The two columns show **different weeks at the same height** | They trim to their own records and scroll independently. **Do not add scroll synchronisation** — it would make one of them lie about which week you are in. (§9.3.) |
| A column **ends before the current week** | Both ends are trimmed. The `Past` tag says which side of today you are on. (Phase 4 addendum.) |
| Confirmed and Cancelled records **missing from the columns** | The default filters hide finished work. The `Filtered` chip and `showing n of m` say so. (§12.2.) |
| A `Pending` record with everything allocated **drops out of supply** | The `unmatched > 0` clause. On a *matching* screen there is nothing left to match. (§9.2.) |
| The band header and the rail **both say `Week of 30 Aug`** | §8.4 and §8.5 each specify it. Only the rail sticks. |
| Dropping inside one column **does nothing at all** | By specification. An error for a gesture that does not apply teaches an operator to fear the screen. (§10.) |
| A card's DOM node **flashes** into the target list mid-drag | CDK moves the preview's sibling; change detection restores it. (Phase 5, "Deviations".) |
| **No six-dot grab glyph** on hover | Not built. `cursor: grab` is the only handle cue. Phase 8's, if wanted. (§10.) |
| **Nothing responds to the keyboard** for dragging | Resolved question 14: a mouse is assumed at all times. Its absence is a decision. |
| The first week is **all ANZCO** | Chance, not arithmetic — the mix is 70/20/10 shuffled. The aliasing bug that caused it was fixed after Phase 4. |

## Recording the result

For each failure, note **what you saw, which item it was, and the section it cites** — the citations
are there so a finding lands in the right document rather than being re-litigated. A density miss is a
finding against `design-system.md` §8.3 and the remedy it names is *shrink the card, not the target*.

**Take one screenshot at 1366×768 with nothing expanded.** That single artefact settles most of
section A, gives Phase 8 its "does it look at home" baseline, and is the first visual record this
build has produced outside the Phase 2 canvas.

Then append the outcome to `BUILD-LOG.md` — as its own short interstitial entry if anything failed, or
as a line in the next phase's entry if nothing did. Five phases have now deferred this; the one thing
worse than not doing it is doing it and not writing down that it was done.
