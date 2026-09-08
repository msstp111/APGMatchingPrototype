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

**Phase 8 added section I and verified what it could without a browser.** The pink Over-committed
state was forced live against the API (availability #6, 144 → 100, `unmatched -22`,
`quantityStateLabel: "Over-committed"`, all three matches untouched) and the reset was run and
confirmed to restore the seed. What none of that shows is how any of it *renders*. Section I is the
remainder, and its last item — running `Documents/DEMO.md` end to end — is the one that decides
whether the demo is safe to give.

**Phase 7 closed one open question without a browser.** Phase 6's pass reported that no `mat-label`
was visible in either dialog and left the cause open. It is Material's own density table: from density
`-2` down, `form-field-filled-label-display` is `none`, and the theme runs at `-2`. `web/src/styles.scss`
now restores Material's `-1` row for dialog form fields only. **That fix is itself unverified on
screen** — section H's first item is the check, and it is the highest-value item in this file, because
it is a claim about every dialog rather than one screen.

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
- [x] **The trailing edge lines up too**: the Unmatched column against its own header, **40px** in
      from the right. **RUN 2026-09-07 — it FAILED, and is now fixed.** §16.10 item 10 asserted 32px
      on both sides and had forgotten that `.strip` is a flex row with `gap: $col-gap`: the strip
      spent 8px padding + 8px gap + 24px cell = 40, the card 24px chevron + 8px body padding = 32, so
      `Unmatched` sat 8px left of the numerals underneath it — from Phase 3 until now. The card was
      given `padding-right: $card-edge` (which §6.2's notch wanted anyway) and both ends are 40.
      Measured in the running app: the card's `app-fill-meter` and the strip's `.s-meter` both end on
      x=781. Re-check this if either end is ever touched again, and measure rather than adding up.
- [ ] **The leading edge lines up too, past the new grip.** Since 2026-09-07 the row starts with a
      full-height 30px drag grip — the spine painted over its leading 6px — then the body's 8px
      padding, so the strip's leading pad is 38px. `Processor` / `Location` must sit exactly over the
      name in the cards below it — get this wrong and every heading on line 1 sits 30px off. (§16.12.)
- [ ] **The grips are one straight column, whatever the status.** Scroll the supply side to
      **Terrace Rimu Crossing** and **Elm Ford Acres** (both Pending, both hatched) sitting among
      Booked cards: the six dots must be at the same x on every row, with the hatch running *over* the
      grip's left edge. In the first cut the grip followed the spine, and Booked's 3px against every
      other status's 6px stepped the whole column in and out. (§16.12.)
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
      not. Since 2026-09-07 the body around it opens the card too, so what to watch for here is the
      *opposite* failure: the label must open the card and leave it open, not toggle twice and look
      like it did nothing. Try clicking it with a slight wobble as well. With `Drag anywhere` **off**
      a wobble cannot lift the card at all; with it **on**, a wobble under 8px must still open the
      card, and the label's own `mousedown` guard must keep a wobble *on the label* from lifting it.
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
- [ ] **`Cancel match` appears only on a draft; `Cancel match…` only past one. Never both, and the ellipsis is the only difference in the label.** Space
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
- [ ] **No stock class is abbreviated anywhere** — the monogram tile is out of the application
      (2026-09-08, §7). Every class reads in words: card line 1, both dialogs' sub-lines, the filter
      menus, both forms. The drag chip is down to two fields, the name and the head count. Hue is
      still nowhere near stock class — the CSV's hex colours are deliberately unused (resolved
      question 16).
- [ ] **Type is Roboto throughout and there is no serif anywhere.** (§1.)

---

## H. Debug record creation (Phase 7)

**Everything in this section is demo scaffolding, not the farmer/agent submission flow.** The first
item is the one to run first: it is a claim about every dialog in the app, not just these two.

- [ ] **Field labels are visible in every dialog.** Open the match modal (a card's match line →
      a table row) and check that `Quantity matched`, `Price per kg` and `Transport company` are
      *legible above their values*. Phase 6's browser pass found all three missing and could not
      explain it; the cause was Material's density table, which hides a filled field's label from
      density `-2` down, and `web/src/styles.scss` now restores the `-1` row for dialog form fields
      only. **If they are still invisible, that fix is wrong and every form in the app is unlabelled.**
      Check the quantity prompt (any drag) and both record forms in the same pass.
- [ ] The quantity prompt's transport field still carries its name in the **hint** rather than a
      `mat-label`, which is Mark's own decision (Phase 6, "do not re-tidy it") — but it was made while
      no label was rendering anywhere. Now that labels show, decide whether it still reads right beside
      two labelled fields. **A judgement call, not a defect.**
- [ ] **`+ Add space` and `+ Add record` sit at the right of each column header**, are 26px stroked
      with a tools glyph, and are visibly lighter than anything else on the screen (§14).
- [ ] **They follow the columns across the flip.** Press the flip button; each stays with its own
      column.
- [ ] **Both forms open with a `# DEMO DATA TOOL #` ribbon** in the dev-flag yellow-green, and a line
      saying it is not the farmer's real submission form. Nobody watching should mistake it.
- [ ] **The date fields are native date inputs** and render in the local `dd/mm/yyyy` form. Type a date
      and check the record lands in the right week band.
- [ ] **Add a Processor Space** for next week: choose ANZCO and confirm the stock class menu holds only
      ANZCO's seven classes and the plant menu only ANZCO's seven plants. Then **switch the processor to
      SFF** and confirm the plant and stock class **clear** rather than keeping an ANZCO value.
- [ ] The new space **appears immediately, in the correct week band**, and can be dragged onto.
      A space created for a week **beyond the loaded calendar** (try three months out) must still
      appear — the columns re-band on the write. Note it will add interior empty weeks between "now"
      and it; that is the calendar being honest, not a bug (§9.3).
- [ ] A space dated **outside the seeded price table** (weeks −4 to +8) reports `No default price for …`
      at the drag. Correct, and worth knowing before it looks like a bug in a demo.
- [ ] **Add a Livestock Availability record**: type three letters into Location, pick one, and confirm
      the **farmer's name and mobile appear under the field**. Choose **Finance Stock** and confirm
      **nothing opens** — no Purchase list. That absence is a requirement, not an omission.
- [ ] **Edit a space** (expand a card → `Edit`): processor and stock class are **read-only**; plant,
      quantity, delivery date, time and notes are editable.
- [ ] **The pink state, the intended way.** Expand availability **#6** (144 available, 124 matched
      across 3 matches — re-check the ids against the live data if the seed has moved), `Edit`, and set
      the quantity to **100**. The field grows a warning naming 124 head; saving asks once more, naming
      the consequence; agreeing writes it. **The meter goes pink, the numeral reads `-24`, and the card
      says `Over-committed`.** The three matches are unchanged. This is the only route to that state.
- [ ] Declining that prompt writes **nothing** and says nothing.
- [ ] **Cancel a record holding live matches.** Expand a space with two or more matches → `Cancel`.
      The dialog **lists every match by quantity, status and counterparty** and says they will not be
      cancelled. Confirm, and then check all four places the survivors show up:
      1. the snack says *"its N matches are untouched"*;
      2. its `SHOW IT` action ticks `Cancelled` into that column's Status filter and **the card comes
         back**, still listing every match;
      3. the **other column's** cards carry a `block` glyph on line 2 beside the match count;
      4. expanding one of those shows `space cancelled` in the counterparty cell of the match row.
- [ ] The cancelled record's own matches still appear in **its** expanded table too.
- [ ] **The red badge, both places.** The counterparty card's chevron sits on a solid red square, and
      expanding it shows `space cancelled` / `record cancelled` in a red box in the match row. Hover
      the chevron: the title says the matches themselves are not cancelled.
- [ ] **The freed quantity.** Against the seeded data, availability **#30** reads **251** unmatched of
      330 (143 head are matched to cancelled space #7 and no longer count), **#48** reads 220 and
      derives `Booked`, and **#10** reads 32 and is *in* the supply column — it read 0 and was filtered
      out before this rule. Cancelled spaces #7 and #16 keep their own figures: 63 and 143 matched.
- [ ] **The match modal's hints.** Open any match: the quantity field's hint reads
      `Ceiling N = the availability's M unmatched, plus this match's own K.`, wraps inside its own
      150px field, and **pushes the fields below it down rather than painting over them**. There is no
      separate ceiling note under the row. Type a quantity above the ceiling: the same sentence appears
      as a red error. Then check the price hint wraps the same way.
- [ ] Cancelling the same record twice is refused with a message rather than silently repeated.

## I. Phase 8 — polish, and the claims it could not check

**Everything in this section is new in Phase 8 and none of it has been on a screen.** The first three
items are the ones worth doing first: each is a claim about a control that did not exist before.

- [ ] **Reset demo data.** The control is in the top bar, left of the `# DEV ENVIRONMENT #` flag, in
      white on petrol — check it reads as *quieter* than the flag rather than competing with it
      (§14.1). Click it: the dialog opens with the `# DEMO DATA TOOL #` ribbon and lists what is lost.
      **Press `Keep it` first** and confirm nothing happened. Then filter a column, expand a card,
      drag a match, and reset for real: the page reloads, the match is gone, and **both columns are
      back at their default filters** with no `Filtered` chip. (Requirement 1.)
- [ ] **The reset when the API is down.** Stop the API, click through the dialog: a snack says it could
      not reset and names the port. Nothing should silently appear to have worked.
- [ ] **The pink Over-committed state.** Expand availability **#6 — Lower Mount Pastures, Bull, 144
      available** (bottom band), click `Edit`, and change the quantity to **100**. The form's live
      caption warns, then a prompt names both figures, and neither blocks. The card then shows a
      **pink** meter, the numeral **−22**, the over-run cap, and the literal word **`Over-committed`**.
      **Compare it against the blue over-fill on space #4** and check the two are not confusable. This
      is the state that should never occur in ordinary use; Phase 8 forced it live against the API and
      confirmed the DTO, but nobody has seen it rendered. Reset afterwards. (Requirement 2.3, §4.3.)
- [ ] **The loading state.** Hard-refresh with the network throttled: a spinning glyph and *"Loading
      processor spaces and livestock availability…"*, not a blank content area.
- [ ] **The error state.** Stop the API and reload: a `cloud_off` panel naming the port, with a
      **Try again** button. Start the API, press it, and the screen fills without another reload.
- [ ] **The empty-column state.** Not reachable with the seed — 40 spaces and 50 records always load.
      Reach it by cancelling every space, or by stubbing an endpoint to return `[]`. Expect the
      column's own glyph, *"No processor spaces yet"* and a `+ Add` button; expect **no**
      `Clear filters`, because no filter is hiding anything. (§13.)
- [ ] **The wrapping hints in the quantity prompt and both record forms.** Phase 7's addendum found
      that only the match modal had both halves of the fix; Phase 8 added `subscriptSizing="dynamic"`
      to the other three. **Drag space #14 onto availability #12** — the worst case, a 53-character
      price hint in a 148px field — and check the hint wraps and **pushes the actions down rather than
      painting over them**. Then open the space form and type a quantity below what is matched: the
      over-commit caption is a whole sentence and wraps the same way.
- [ ] **The expansion's 120ms open.** Expand a card: the block below fades and rises 2px over 120ms
      while the card itself does not move at all. It should feel immediate, not animated. Collapse is
      instant by design.
- [ ] **The expanded card's unmatched figure is coloured.** Expand space **#4**: `Quantity unmatched`
      reads **−66** in blue with `Over-filled` beside it. Before Phase 8 it rendered in plain black —
      the ramp's four rules lived in a mixin the expansion did not include. (§4, §6.2.)
- [ ] **Documents/DEMO.md, start to finish, against freshly reset data.** Every id and figure in it was
      taken from the live API, but the *walkthrough* — the drags, the modal, the cancellation — has
      only been run as HTTP calls. This is the item that decides whether the demo is safe to give.

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
| The card shows a **hand cursor, not a grab cursor**, and there is no six-dot glyph in the right gutter | Both went on 2026-09-07. The two gestures are separated: the always-visible 24px `drag_indicator` grip at the *left* of the row drags, the rest of the row expands, and each carries its own cursor. The grip is a real cell, so the strip's leading pad is 38px rather than 14px. (§10, §16.12.) The trailing edge went from 32px to 40px on the same date, for an unrelated reason: it was misaligned with its own header and had been since Phase 3 — see section A. |
| The card shows a **hand cursor even with `Drag anywhere` on**, over a region that does drag | Deliberate (§16.13). The click is the commoner of that region's two gestures, and a grab cursor across 508px of a row whose usual action is expanding it is the exact complaint that separated the two in the first place. The grip advertises the drag; the cursor turns `grabbing` the moment one actually starts. |
| With `Drag anywhere` on, **a card's text cannot be selected and touch cannot scroll the list** by dragging a row | Accepted, not a bug. CDK stamps `touch-action: none` and `user-select: none` on every drag handle, and the middle of the row becomes one. A mouse is assumed available at all times (resolved question 14); the wheel, the trackpad and the scrollbar are unaffected, and the toggle is the way back. |
| **Nothing responds to the keyboard** for dragging | Resolved question 14: a mouse is assumed at all times. Its absence is a decision. |
| The first week is **all ANZCO** | Chance, not arithmetic — the mix is 70/20/10 shuffled. The aliasing bug that caused it was fixed after Phase 4. |
| A cancelled record's **matches are still there**, on both cards | The rule this whole phase exists to show. Cancelling a record never cascades — it lets APG arrange alternatives before anyone is notified. Cancel them separately. (Phase 7, 5.2.) |
| …but the counterparty's **unmatched went up** when the record was cancelled | Not a cascade: the match is untouched, it just stops holding stock that has nowhere to go. Always the *other* record's figures — a cancelled record's own are unchanged. (Phase 7 addendum, 3.) |
| A record reads **`Booked`** while wearing the red badge | Nothing is holding its stock (so: Booked) and a match still needs cancelling by hand (so: the badge). Both are true. |
| A cancelled record **vanishes from the column** | It has left both default filters. `SHOW IT` on the snack, or ticking `Cancelled` in the Status filter, brings it back. (Phase 7, 5.4.) |
| A record created **months out** adds a run of empty week bands | Interior empty weeks keep their headers: a gap in the calendar is information. Only the runs at each *end* are trimmed. (§9.3.) |
| A brand-new space says **`no default price`** when dragged | The seeded price table runs weeks −4 to +8. Beyond it there is honestly no price, and the prompt says so rather than inventing one. (§11.1.) |

## L. The legend, and the tile's removal (interstitial)

Both changes are geometry and colour, which is exactly what jsdom cannot check.

| Check | What it should be |
| --- | --- |
| The `?` button sits in the **right-hand** column's header, right of `+ Add` | It is bound to screen position, not to a column: hit the flip and it moves to the other header so it stays in the same corner. `+ Add` goes the other way. |
| It does **not** read as a second debug tool | Borderless and muted; the `+ Add` beside it keeps its `#BDBDBD` ring, which is what marks scaffolding. Same 26px height, one baseline. |
| In the legend, the **3px Booked edge reads as thinner** than the other three | Weight alone is what separates "nothing has happened yet" from everything else (§3.1). Each spine is drawn on a borderless zebra scrap: Booked's spine IS `$lms-divider`, so a bordered white scrap merged the two into one thick corner and the row that has to show a thin edge showed none. |
| The legend's four meters look **exactly like the ones on the cards** | They are real `app-fill-meter` instances at the same 112px. If they differ, the legend has drifted and the test suite cannot see it. |
| Both over states are visible together — **blue and pink** | The one place the two `Over` meanings can be compared side by side. Blue is permitted; pink is a flag. (§4.1.) |
| The legend fits at **1366×768** without the dialog scrolling awkwardly | 720px wide, four sections. If it needs a scroll it should be a clean one, not a clipped last row. |
| Line 1's **name column is wider** than before, and line 2's meta starts on the same vertical | The tile's 20px plus its 8px gap went to the name, which truncates. The alignment of the two lines is a side effect, not a goal. |
| The header strip's cells still sit **exactly over** the card's | The `.s-tile` spacer came out with the tile. If the strip is 28px out of step, only one of the three was changed. (§16.10.) |
| The chip names the **slot**, not the processor: `ANZCO Kokiri` | Pick up any ANZCO space — most of the column is ANZCO's, which is the whole reason. A space with no plant reads `ANZCO` with no trailing space. (§10.1.) |
| The chip is **232px** and the longest name does not clip | Worst cases: `Alliance Group Dannevirke` against `1180 head` on demand, `Spring Creek Agriculture` on supply. **Verified 2026-09-08 in headless Chrome against a CSS replica of `.chip`** — 150.2px of name cell against 142.8px of text, ~7px of slack in the worst case — but *not* yet in the running app, where the real font stack and the CDK transform are in play. Re-check with `.cname`'s `getBoundingClientRect()` against a detached probe span; **`scrollWidth` cannot see this clip**, because on a flexed cell it reports `max(clientWidth, content)`. |
| The tile is **gone from the drag chip too**, which was its last surface | Off the card rows and header strip in §16.10, off both match dialogs on 2026-09-07, off the chip on 2026-09-08. The argument for keeping it — 200px with no room for a class name — lost to the plainer fact that a two-letter code over twenty-two classes is a puzzle mid-drag. The chip is the name and the head count, and `app-stock-class-tile` no longer exists. (§7.) |

## The two match dialogs — RUN 2026-09-07, all passed (re-run after the title and badge change)

Driven in headless Chrome 152 at 1600×1100 (deviceScaleFactor 2) over the DevTools Protocol: the drag
was real pointer events, the modal was opened by clicking a row of an expanded card's match table.
Kept here because the claims are geometric and jsdom cannot see any of them.

| Check | What it should be | Seen |
| --- | --- | --- |
| The drop prompt's title names the act and the slot | `Draft match: ANZCO Rangitikei`, and no head count | ✔ |
| The modal's title names the act and the slot | `Confirm match: ANZCO Rangitikei` on a Drafted match; `Edit match: ANZCO Rangitikei` on a Confirmed one, whose footer offers `Cancel match…` and no `Confirm match` | ✔ both |
| Neither dialog carries a monogram tile | `app-stock-class-tile` absent from both; each name line starts at the block's own padding | ✔ — and vacuous since 2026-09-08: the component is deleted, so check the name lines' padding and nothing else |
| The modal stacks its parents | Livestock Availability, arrow, Processor Space — the drop prompt's order, `.rec + .flow + .rec` | ✔ |
| Each block spans the dialog | 512px inside the 640px dialog, both equal | ✔ |
| Nothing in either block truncates | `scrollWidth <= clientWidth` on all four names and sub-lines — the thing the 300px side-by-side halves could not manage | ✔ |
| No stock-class commentary | `.note` absent, and both classes still legible in the sub-lines — which are now the only place either one is stated | ✔ |
| The wrapping hints still push the footer down | The ceiling sentence runs to four lines and the price hint to three; the footer sits below both, not under them | ✔ |

## M. The expanded card, round two — RUN 2026-09-07, all passed

`design-system.md` §6.2's four devices and the exclusivity rule, added the same day from
`Documents/expansion-lab-2.html` (ideas 3, 5, 6, 8 and 0 of ten). Every row below was measured in the
**running app** — `dotnet run` plus `npm start`, headless Chromium over CDP, element rects and pixel
scans rather than a judgement by eye — because each one is a claim about a single pixel and every one
of them had already been got wrong once in the lab.

| Claim | What was measured | |
| --- | --- | --- |
| The drawer's content begins where the card's name begins | `.name` and the sheet's first `.label` both at **x=241**; the match table's first cell at 233 with 8px of padding, so its text lands on 241 too | ✔ |
| The rail's hairline continues the grip's rule | grip's `right - 1` and the `::before` rail both at **x=232** (independent pixel scan: both at x=883 in a 1500px window) | ✔ |
| $expansion-rail is 29px, not 30 | computed `padding-left: 29px`; at 30 the rule lands a pixel right of the grip's — the lab's first cut did exactly that | ✔ |
| The notch is centred on its chevron | chevron centre and notch centre both at **x=801**; pixel scan of the gap in the sheet's top border gives 1444–1459, centre 1451.5, against the chevron apex at 1451.5 | ✔ |
| The card's trailing run is 40px, matching the strip | meter block and `.s-meter` both end on **x=781** — see section A, this one was a failure before today | ✔ |
| The drawer rises; nothing else on the screen has a shadow | `.expansion` box-shadow `0 3px 8px -3px rgba(0,0,0,.3)`; the host's border-bottom is `0px`; `.card:hover` declares colour only | ✔ |

**2026-09-09 — the open row.** Four more, on the two ideas that shipped out of `open-row-lab.html`:
the grip column filled through, and the status spine continued.

| Claim | What was measured | |
| --- | --- | --- |
| The grip column runs unbroken from row to sheet | open `.grip` background and the sheet's `::before` both `rgb(221, 234, 241)`; the glyph `rgb(0, 86, 126)`. Fill is `28px` wide with a `1px` border-right — 29 in content-box, which is the point | ✔ |
| The filled rail did **not** move the grip's rule | `gripRuleX` and `railRuleX` both **1133**; `nameX` and the sheet's first label both **1142**. Written as a 29px box with a border it lands a pixel left — the lab does exactly that and is wrong | ✔ |
| Nothing about the open state changes a dimension | every card's `.card` height is **52px** with a drawer open and 52px without, measured across the whole column before and after the click, identical | ✔ |
| The status spine runs the whole open object | `app-card-expansion > .spine` height equals the host's height less the row's 52px, exactly; open `.card` `border-bottom-color: rgba(0,0,0,0)`. Checked on Pending, whose 45° hatch is the one that would show a phase break at the seam: none | ✔ |
| A cancelled record's stroke recedes with its row | Ticked `Cancelled` into the demand status filter and opened one: rail `filter: grayscale(1)`, `opacity: 0.62`, matching the row's grip; the sums, the match table and the actions stay at full strength. Before the fix the grip was grey and the rail three pixels below it was full-strength blue | ✔ |
| The grip still answers the pointer when the card is open | ground `rgb(245,249,251)` = `$lms-hover`, glyph stays `rgb(0,86,126)`. Both rules it has to out-weigh were checked by removing this one: the tint swallows `.grip:hover`, and `.card:hover .grip` drops the glyph to muted grey | ✔ |
| The sums are type on white, at 20px | no ground on `.sums`; `$lms-expansion-head` and `$lms-expansion-head-rule` no longer exist in the stylesheet | ✔ |
| One drawer per column | two demand cards clicked in turn → `app-space-card app-card-expansion` count stays **1** | ✔ |
| ...but the two columns are independent | a demand card and a supply card open together → 1 and 1, neither closing the other. This is the half of the rule that a shorter implementation would silently break | ✔ |

Two more, checked in the same pass:

| Claim | What was seen | |
| --- | --- | --- |
| The **last** card in a band opens correctly | Opened the last space in `WEEK OF 30 AUG`: notch under its chevron, rail unbroken, and the drawer's 1px foot meets the next band's 2px petrol rule directly. The frame's bottom edge is quiet against that rule, which is right — the band rule is what closes a band | ✔ |
| The **no-matches** drawer still reads | The table placeholder and the actions row are unchanged | ✔ |

**One thing to watch, found in that same shot and not a defect — and since answered.** On a record
with no matches the two sums were `0` and `0`, and at 20px they were the loudest thing in the drawer:
a large, emphatic pair of zeros above the sentence explaining there is nothing to total yet. The
2026-09-08 change makes them `0 of 77` and `0 of 77`, which says something — none of this space is
spoken for — where a bare `0` said nothing twice. **Look at this case again anyway**: whether a
denominator is enough, or whether the pair should still step down to the card-figure size when
`matchedInclDraft` is 0, is a judgement a person has to make in front of it.

## The sums strip (2026-09-08) — unrun

The two sums became fractions, the drafted figure joined the incl-Draft one, `Quantity unmatched`
moved up out of the field row, and the field row lost every quantity it had. jsdom holds the content
and the structure (`card-expansion.spec.ts`); none of the following.

| Claim | Where it comes from | How to check |
| --- | --- | --- |
| `Quantity unmatched` ends on the same x as the meter numeral above it | design-system.md §6.2 item 1 — the one reason that cell is right-aligned when the other two are not | Expand a demand card. Its value's right edge should be **40px in from the card's outer edge** (`.sums` spends `8 + 8 + 24 - 1` = 39 inside the sheet's 1px frame). This is the same class of claim that was **wrong for five phases** in §16.10, so measure it rather than eyeballing it |
| The strip is ~48px, down from the 105px the strip and its field row spent between them | removing the duplicated pair was the whole of the win available; two attempts at spending width instead are recorded in §6.2 | Measure `.sums` and `.fields` on a demand card with one line of notes |
| Three cells fit the strip with the unmatched one clear of them | two labels at ~120px over two lines, plus 26px gaps, plus the unmatched cell pushed right | Expand a demand card at 1920, 1366 and 1280 and watch for the unmatched cell colliding with `incl. Draft` |
| `59 of 77 · 30 drafted` reads as one figure with two annotations, not as three things | the middot is `.sum .sep::before`; the drafted count is the only figure on the strip with no label of its own | Look at it. If the drafted count reads as a separate statistic it wants a label, and a label means a fourth cell |
| `-24 Over-filled` fits the unmatched cell without wrapping | `.sum` is `white-space: nowrap`, so it will push instead of wrapping | Find the over-filled space and expand it |
| A long note does not disturb the strip | the strip and the field row are separate flex rows now, so it should not — worth confirming | Edit a record's notes to ~200 characters and expand it |

**The API must be restarted** before any of this: `draftedQuantity` is a new DTO field and a server
started before 2026-09-08 will not send it, which renders `· drafted` with no number in front of it.

**Still open:** whether the 20px sums outweigh the collapsed row's own 15px meter numeral when the eye
sweeps a column (§5.1 has no step above 15px anywhere else on this screen, and this is the first).
That one needs a person looking at it, not a measurement.

## The record forms' grid (2026-09-08) — unrun

Both debug dialogs (`+ Add` and `Edit`, either column) were relaid out as a two-column grid.
design-system.md §14.2 has the reasoning; jsdom holds the fields and the validation
(`space-form.spec.ts`, `availability-form.spec.ts`) and none of the following.

| Claim | Where it comes from | How to check |
| --- | --- | --- |
| **Two columns at the full 640px dialog, not three** | §14.2 item 1 — the fault that made every earlier screenshot of these forms misleading, since a clipped 80vw dialog showed two either way | Open `+ Add record` in a window **wider than 800px** so the dialog gets its full 640. `Availability details` and `Notes` must each run the whole width; `Stock class`/`Quantity available`, `Location`/`Available from` must pair; `Transaction type` sits alone in the left column with the right column empty, and that hole is intended |
| **No field's ground is taller than its own control** | §14.2 item 2 | `+ Add processor space`, touch nothing. `Processor` and `Stock class` grounds must end on the same y — `Stock class` carries `Choose a processor first` below its border and `Processor` must **not** grow to meet it. Same for `Plant`/`Quantity required` and `Delivery date`/`Delivery time`. On the supply form, `Transaction type` must not stretch to the height of the textarea opposite |
| The gap between rows is 14px everywhere, hint or no hint | §14.2 item 3 | Measure ground-bottom to ground-top on the supply form between `Stock class`→`Location` (no hint) and `Availability details`→`Notes` (a hint that wraps to two lines). Both should be 14 |
| A hint reads as belonging to the field above it | the whole point of dropping the 18px reserve | Look at `Optional, free text` under `Delivery time`. If it reads as floating between two rows, the row gap is too small relative to the hint's own offset |
| `.fixed` is exactly a field's height and its value sits on a field's x | §14.2, and it now reads `--mat-form-field-container-height` | `Edit processor space` on any record: `Processor`'s ground and `Plant`'s must be the same height (52 at the dialogs' relaxed density -1), and `ANZCO` must start on the same x as `Rangitikei` below it. The label/value pair is **centred** in the cell rather than reproducing Material's 22px/6px padding — measured as landing within ~2px, which is the claim to falsify here |
| The ribbon's 16px clears the first row of fields | `debug-ribbon.scss`, `margin: -4px 0 16px` | It was 12 and read as tight against the grid |
| Nothing wraps or clips at the narrow end | §14.2 item 1's 560px stack | Open either form at ~700px viewport (the dialog clips to 80vw = 560) and again at ~520px. At the second the grid must be **one column**, not two 230px ones |
| The over-fill / over-commit caption still clears the field above it | the original subscript fix, half of which (`min-height`) is gone | Edit a matched record and drop its quantity below `matchedInclDraft`. The red sentence must sit clear of `Notes`, wrapping included — this is the exact overlap the `min-height` was added for, so it is the one item here with a known way to fail |

## Filter on drag (2026-09-09) — unrun, and one item here is the whole feature

The top-bar toggle that narrows the far column to compatible stock classes while a card is held.
design-system.md §10.2 has the reasoning; `matching-screen.spec.ts`'s `filter on drag` block proves
the narrowing lands synchronously on the move that starts the drag — and that a click on a grip does
nothing — and `drag-narrowing.spec.ts` proves the state machine. **What no test can prove is that CDK still hits the right row afterwards** — jsdom has no
layout, so a drop that lands on the wrong card, or on nothing, would pass every test in the suite.
That is item 1 and it is the reason this section exists.

**The API must be restarted** before any of this: `stockClassGroups` is a new DTO field, and a server
started before 2026-09-09 does not send it. Every record would then arrive with the field absent, the
narrowing would treat that as no opinion and nothing would ever be hidden — which looks exactly like
the toggle not working.

| Claim | Where it comes from | How to check |
| --- | --- | --- |
| **A drop after narrowing lands on the card under the pointer** | §10.2's timing rule. Each card is its own `cdkDropList` and CDK measures every one of them inside the handler that crosses the drag threshold; the narrowing runs in that same handler, one listener earlier, and anything later would leave every surviving card somewhere CDK does not believe it is | Toggle on. Grab a **Lamb** availability record — the demand column should drop to 8 booked spaces — and drop it on the **last** lamb space in the list, i.e. the one that moved furthest up when the column shrank. The quantity prompt must name **that** space. Repeat dropping on the first: both ends of the list matter, and the far end is where a stale rect shows |
| Every lit-row treatment still works in the narrowed column | §10.3's hot/blocked states are keyed off CDK's own `entered` / `exited` | With the same drag, sweep down the narrowed column. Exactly one row lights at a time; **the rest stay at full strength** (the target-side scrim went on 2026-09-09), and a full space still shows the `block` glyph |
| **The far column is as readable in flight as it is at rest** | §10.3 — the target-side scrim is deleted (drag-lab-2 idea 1); only the source column recedes | Grab a record and hold it over the far column. Read three rows the pointer is **not** on: their meters, unmatched figures and status words must be exactly as legible as before the pickup. Sweep up and down the column — nothing but the row under the pointer may change. The **source** column must still be at 55% with its dotted origin ring |
| A **click** on a grip narrows nothing at all | the fault the 2026-09-09 rework fixed: it used to narrow on `pointerdown` | Click a grip sharply, ten times, at both ends of a column. The far column must not so much as flicker. Then press, hold **still**, and confirm it is still full |
| The column narrows on the move that **starts** the drag, and nothing changes after | `DragNarrowing.onMove` at CDK's own threshold — **8px since 2026-09-09**, read off `CDK_DRAG_CONFIG` so the two cannot disagree — ticking synchronously | Press a Lamb record's grip and edge the pointer away slowly. The demand column must shorten within the first few pixels — as the card leaves the row, not before it and not on entering the far column — and which cards are present must not change again for the rest of the drag |
| A drag abandoned outside either column restores it | the release is on `pointerup`, not `cdkDragEnded` | Drag a card into the gutter, the top bar, the sidebar, then off the window entirely and release. The far column must come back every time, with no stale `Lamb only` chip |
| Escape restores it while the button is still down | `DragNarrowing` listens for Escape as `DragStore` does | Grab a card, move into the far column, press Escape **without releasing**. Preview, highlights *and* the full column all return together; then release over a card — nothing is created |
| The header chip replaces `Filtered`, and the header does not reflow | §10.2, and the 596px header already carries title, count, chip, `+ Add` and `?` | Filter the demand column first (so `Filtered` + `Reset` are showing), then grab a supply record. `Lamb only` must appear **in their place**, and `+ Add` must not move by a pixel |
| `showing N of M` keeps the loaded total | the aid narrows `buildBoard`'s input, inside the operator's own filters | Grab a Lamb record: the demand header should read `showing 8 of 40`-ish — the second number unchanged from before the grab |
| Bands re-trim, and the operator can still tell which week they are in | §9.3's per-column trim runs on the narrowed list | Grab a record whose compatible spaces are all in one week. The demand column should show that week's band alone, not a run of empty headers |
| **Narrowed to nothing** draws §13's third state | Alliance Group books `Deer`; the supply vocabulary has none | Filter the demand column to `Stock class: Deer` to find one, then grab it. The supply column must read `No livestock availability for Deer` with **no** `Clear filters` button, and refill on release |
| Auto-scroll still works in a short column | `columnAutoScroll` measures live, unlike CDK's cache | Grab a card whose narrowed target column is shorter than the viewport. The 48px veils must not appear at all, and the pointer must not scroll a list with nothing to scroll |
| The toggle reads as on from across the room | §10.2 — a toggle whose only ON cue is its wording is a state nobody notices | Look at the top bar from 2m in both states. Also confirm the ON state does not collide with the yellow dev flag beside it |
| Nothing is blocked | the aid hides and never refuses | With the aid **on**, turn it off mid-session and match a Lamb record into a **Mutton** space. It must go through with no warning of any kind |

## Drag anywhere (2026-09-09) — unrun, and the whole point is the boundary

The top-bar toggle that gives a card's middle region a drag without taking away its click
(design-system.md §16.13). `card-press.spec.ts` pins the recogniser and `card-grip.spec.ts` pins what
each region does, but **jsdom cannot say how a real hand behaves**: whether eight pixels is actually
generous enough for a trackpad click, and whether a drag started mid-row still lands where it is
aimed, are both questions only a pointer can answer.

Turn the toggle **on** for all of this unless a row says otherwise. It is off by default.

| Claim | Where it comes from | How to check |
| --- | --- | --- |
| **A click in the middle of a row expands it, every time** | `DRAG_SLOP` is 8px, up from CDK's 5, and the release is judged on whether CDK started a drag | Expand and collapse twenty rows in a row, fast, clicking wherever the pointer happens to land. Not one may lift instead. Then do ten more *deliberately sloppily* — click while the hand is still moving. This is the item the whole feature turns on |
| A drag started mid-row lands on the card under the pointer | the drag is CDK's whichever handle began it; the 232px chip is pinned to the pointer either way | Drag from the middle of a demand card onto a supply card near the **bottom** of a long column. The quantity prompt must name that record. Repeat from the grip and confirm the chip looks identical — same size, same position under the pointer |
| A drag released back over its **own** card does nothing at all | the card asks CDK whether a drag began; a `click` still fires on the way out | Press the middle of a row, drag 100px, come back, release over the same row. Nothing must expand and nothing must be created |
| Escape mid-drag does not expand the card either | the same flag; an Escape-cancelled drag is still a drag | Press the middle, drag into the far column, press Escape, then release. The card must stay closed |
| The chevron never drags | it is a sibling of the body, not a descendant | Press the chevron and drag 200px. Nothing may lift; on release the card expands or collapses as usual |
| The grip drags with the toggle **off** | it is the unconditional handle, and it is the fallback the toggle exists to leave in place | Turn the toggle off. The grip must still drag, the middle must still expand, and a 200px drag from the middle must expand the card on release rather than lifting it |
| The match count opens the card and never lifts it | its guard is on `mousedown`, because that is what CDK binds | Press `2 matches · 1 draft` and wobble hard before releasing. The card must open, once, and never lift |
| The cursor turns `grabbing` while a card is in flight | `apg-dragging` on `document.body` | Drag from the middle and watch the cursor cross the gutter: `pointer` at rest, `grabbing` once moving, `no-drop` over the source column, `not-allowed` over a full target. The last two must still win |
| Both toggles are independent | separate fields on one stored object | Turn on `Filter on drag` only, then `Drag anywhere` only, then both. Reload between each: each state must come back as it was left |
| An older browser profile is not disturbed | `dragAnywhere` was added to `apg.matching.preferences.v2` without a version bump, because the reader falls back field by field | With filters already set from before today, reload. The filters must survive and the new toggle must read **off** |

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
