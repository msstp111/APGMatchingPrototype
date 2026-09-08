# Demo script

**A fifteen-minute walkthrough of the APG matching screen, against freshly reset data.**

Every record below is named by **id and quantity**, because those are stable across a reseed and
hunting for a good example while people watch is how a demo loses a room. What is *not* stable is the
**dates**: every seeded date is an offset from the Sunday of the current New Zealand week, so the week
bands move. Where a step needs a week, it says "the top band" or "the current week" rather than a date.

If a figure below disagrees with the screen, the database has been played with. Reset it (step 0) and
the figures come back — they are pinned by `ResetRestoresTheSeedTests`.

---

## 0. Before anyone is watching

```
.\dev.ps1                     # both halves, from the repo root
```

Then http://localhost:4200, **window sized so the viewport is 1366 × 768**.

Click **`Reset demo data`** in the top bar, next to the `# DEV ENVIRONMENT #` flag, and confirm. The
page reloads with the seeded set and both columns at their default filters.

Do this once before the demo even if nothing has been touched. It costs two seconds and it is the
difference between the numbers below being right and being nearly right.

> **The reset is a demo tool, not a product feature.** It drops the database and re-seeds it. Say so
> if anyone asks — everything marked in the dev-flag yellow-green is scaffolding.

---

## 1. The screen cold — 60 seconds, and say nothing clever

Let them look at it first.

- **Two columns.** Processor Spaces on the left — what the meatworks have committed to killing.
  Livestock Availability on the right — what farmers have to sell. The **⇄** button between them swaps
  the sides, because some people picture animals on the left.
- **Both are banded by week**, oldest at the top, with the week down the left-hand rail.
- **The demand column reads `showing 34 of 40`, the supply column `showing 42 of 50`.** Nothing is
  broken: the defaults hide finished work — spaces that are `Confirmed` or `Cancelled`, and records
  with nothing left to allocate. The `Filtered` chip and the count say so.
- **Everything above the current week is the backlog.** Those rails carry a grey `Past` tag. It is
  business still outstanding, and its height is the signal: as records are matched and confirmed they
  drop out of the default filter and the backlog burns down.

**The one number to point at:** the coloured bar and figure at the right of every card. That is
**unmatched** — what is left to fill on a space, what is left to sell on a record. Orange is short,
green is exact, blue is over-filled. It is the only place colour means anything on this screen.

---

## 2. The shape of the thing — many-to-many

This is the point of the whole prototype, and it is two cards.

### 2a. One space filled from three farms

**Processor Space #1 — ANZCO Rangitikei, Cows, 77 required.** Top band, third card down.

Click the **`3 matches · 2 drafts`** line on the card. It expands.

| | |
| --- | --- |
| Star Worth Holdings | **29** head, Confirmed |
| Tui Bay Flats | **27** head, Drafted |
| Star Burn Crossing | **3** head, Drafted |

Three different farms filling one meatworks slot — **59 of 77 head, 18 still to find.** Point at the
two sums under the fields: `Quantity Matched incl. Draft 59` and `Quantity Matched 29`. APG sees both;
the processor would see only the second, because a draft is not a commitment to anybody yet.

### 2b. One farm's stock split across three works

Now the other direction. In the supply column, scroll to the bottom band and open
**Livestock Availability #6 — Lower Mount Pastures, Tania Kingi, Bull, 144 available.**

| | |
| --- | --- |
| ANZCO Rangitikei | **43** head, Confirmed |
| Alliance Group Mataura | **43** head, Confirmed |
| SFF Belfast | **36** head, Drafted |

**One line of bulls, three different processors, 22 head still unsold.** Two of those three spaces are
`Confirmed`, so they are not in the left-hand column at all — which is worth saying out loud, because
somebody will look for them.

> **Note the stock classes as you go.** The space says `Cows`, the record says `Mixed Cattle`. The two
> sides use different, non-aligned vocabularies and there is deliberately **no mapping** between them.
> A person decides what fits. That is a feature of the design, not a gap in it.

---

## 3. Make a match — the thing they are actually here to see

Both cards are in the **top band**, a few rows apart.

**Drag Livestock Availability #7 — Nikau Moon Farming, Mixed Cattle, 25 available — onto Processor
Space #1** (the ANZCO Rangitikei Cows space from step 2a).

Watch for, in this order:

1. The **other column washes pale blue** the moment the drag starts, and valid targets outline in
   petrol with a `+`. Cards in the *same* column do nothing at all — dropping supply on supply is not a
   gesture, so it is silently ignored rather than shouted about.
2. The prompt opens at **18 head** — `min(18 unmatched on the space, 25 on the record)`.
3. **Price `$6.09/kg`**, defaulted from ANZCO × Cows × that week. Editable.
4. A note saying `Cows` and `Mixed Cattle` come from different lists and the judgement is yours.
5. The ceiling: **max 25**, the record's remaining supply. Over-filling a *space* is allowed;
   over-committing a *farmer* is not.

Click **Create match**. Both cards move at once — the space's meter fills and its unmatched drops to
**0**, the record's to **7** — and a snack offers **UNDO** for eight seconds.

**Press UNDO.** Everything goes back. Do this: it is the single most reassuring thing in the demo,
because the first question a non-technical operator has is "what happens if I drop the wrong one".

### The refusal, if there is time

Drag anything onto **Processor Space #5 — ANZCO Rangitikei, Nat Beef - Ultra, 98 required**, in the
last band. It is exactly full. No dialog opens; a snack says **"There is no unmatched quantity"**. The
screen refuses at the point of the drop rather than opening a form to disable its own button.

---

## 4. An over-filled space — colour doing its job

Scroll the demand column to the **`13 Sep`** band.

**Processor Space #4 — Alliance Group Dannevirke, Mutton, 660 required, 726 matched.**

The meter is **blue**, its track outlined, with a small cap ticking past the right-hand end; the figure
reads **−66**; and the card says the word **`Over-filled`**.

**That is allowed and it is normal.** A meatworks will take the extra. What matters is that it is
visible from across the room. Three channels say it at once — colour, the drawn over-run, and the
literal word — so nobody has to know the colour code to read the card.

> The pink `Over-committed` state is the same treatment on the supply side, and it means the opposite:
> a farmer's stock has been promised twice. It **should never appear**. If it does, something is
> wrong — and Phase 8 forced it once deliberately to be sure it renders (see below).

---

## 5. Finish a match, then finish a space

**Processor Space #37 — ANZCO Rangitikei, Nat Beef - Ultra, 51 required.** First card in the top band.

Open its match line, then click the row — **Cedar Spruce Crossing, 12 head, Confirmed.** The modal
shows **both** parent records in full, the three editable fields, and, in the quantity field's own
hint, the ceiling spelled out and where it comes from. Close it.

Now click **`Confirm space`** in the expanded card. It is enabled here, and that is the interesting
part: the space has **39 head still unmatched** and APG can confirm it anyway. The gate is *"at least
one confirmed match and no drafts"* — not *"full"*.

**Then look at Processor Space #1** from step 2a. Its `Confirm space` is greyed out, and beside it, in
words: *"Needs at least one confirmed match and no drafts."* It has two drafts outstanding. **A
control that greys out for unstated reasons is what makes people think an app is broken**; every
disabled control on this screen says why, or its cause is already on the card.

---

## 6. Cancel a record — the rule that surprises everyone

Save this for last. It is the rule APG asked for and the one nobody expects.

**Expand Processor Space #1 and click `Cancel`.**

The dialog names all three matches that will **survive**, by farm, quantity and status, and says
plainly: *its matches will **not** be cancelled.* Confirm it.

Now watch the supply column:

- **Star Worth Holdings (#2)** and **Star Burn Crossing (#5)** were not on screen a moment ago — they
  were fully committed, so the default filter hid them. **Both appear**, with 29 and 3 head back to
  sell.
- **Tui Bay Flats (#4)** goes from **58** unmatched to **85**.
- All three carry a **solid red square behind the expand chevron**. Hover it: the match is still live
  and still has to be cancelled by hand.

Two things happened, and they are different:

1. **Cancelling never cascades.** All three matches are untouched — same id, same quantity, same
   status. That is deliberate: it lets APG arrange an alternative with the farmer *before* anyone is
   told their booking has gone.
2. **But the stock is released.** A farmer whose animals were matched to a cancelled space has those
   animals to sell again, and the screen says so immediately. The red badge is the outstanding work.

The cancelled space itself keeps its own figures unchanged and stays readable. Its card is desaturated
with its title struck through, and it drops out of the default `Status = Booked` filter — the snack's
**`SHOW IT`** brings it back by ticking `Cancelled` into that column's status filter.

**Reset the demo data afterwards.**

---

## 6a. Filter on drag — narrowing the far side to what fits (2026-09-09)

The two stock-class lists do not map onto one another, which by now they have heard twice. This is the
answer to the question that follows it: *so how do I find the right slot?*

**Click `Filter on drag` in the top bar**, left of `Reset demo data`. It fills white when it is on.

Now **start dragging Livestock Availability #43 — Moss Gate Lodge, Lamb, 626 available** — and look at
the demand column before you get there. The moment the card leaves its row, that column has gone from
33 booked spaces to the 8 that take lamb: ANZCO's, Alliance Group's and SFF's. The header says
`Lamb only` where the `Filtered` chip usually sits, and `showing 8 of 40` keeps the loaded total
honest. Drop as normal.

**Then click a grip instead of dragging it, two or three times.** Nothing happens: the aid waits for a
real drag, so a click that was aiming at the expand target does not flash half the screen.

**Let go over nothing.** The whole column comes back. Nothing was filtered, nothing was saved, and the
column refills on release without being asked.

Three things to say while it is on:

- **It hides; it never refuses.** Turn it off and lamb will go into a mutton space with no warning at
  all. The screen is not overruling the operator, it is putting the likely slots in front of them.
- **Both directions.** Grab a `Bulls` space and the supply column drops from 42 records to 15 — the
  bulls, the sire bulls and the mixed cattle.
- **It is off until asked for.** The first drag anyone does on a fresh demo behaves exactly as it did
  before this existed.

If they ask what happens when nothing fits: **filter the demand column to `Stock class: Deer`**. There
is exactly one — **#17, Alliance Group Dannevirke, 76 required** — and grabbing it empties the supply
column. The supply column says `No livestock availability for
Deer`, with no filter to clear, because there are no deer in the supply list at all. That is the state
a future pass would fix by unifying the two vocabularies, not by loosening this table.

---

## 7. If there is time — the filters and the flip

- **Status and Stock class** are chips on each column's filter row and show their current value
  without being opened. Everything else is behind **`More`**.
- The **demand** column can be filtered to a delivery week. The **supply** column deliberately cannot:
  filtering supply to one week would hide exactly the older unmatched records the backlog exists to
  surface.
- **`Reset`** in a column header appears the moment that column is away from its defaults.
- The **⇄** button swaps the columns and loses nothing — filters, sort, expanded cards, scroll
  position all survive it.

---

## Things that look wrong and are correct

Have these ready. Each one has been asked before.

| What they see | Why it is right |
| --- | --- |
| `showing 34 of 40` — records "missing" | The defaults hide Confirmed and Cancelled work. The chip and the count say so. |
| The two columns show **different weeks** at the same height | Each trims to its own records and they scroll independently. Locking them together would make one of them lie about which week you are in. |
| A column **ends before this week** | It ran out of records. The `Past` tag on every earlier band says which side of today you are on. |
| A space says `Cows`, a record says `Mixed Cattle` | Two vocabularies, no mapping, a person decides. The point of the screen. |
| **Cards vanish** from the other column when a grip is pressed | `Filter on drag` is on (§6a). They are hidden for the length of the gesture, not filtered, and they come back on release. The header chip names what it narrowed to. |
| `Filter on drag` hides a space the operator **wanted** | It is an aid over a table of plausible pairings, not a rule. Switch it off — the match it was hiding is allowed and always was. |
| Dropping a card in **its own column** does nothing at all | Not a gesture. An error message for something that simply does not apply teaches people to fear the screen. |
| `Confirm space` enabled on a space that is **not full** | The gate is one confirmed match and no drafts, not "full". |
| A cancelled match **disappears completely** | Pass 1 has no Match list view. Deleting a draft and cancelling a match move the numbers identically. |
| A newly added record dated months out brings **empty week headers** with it | The calendar is being honest. Only the runs at each end are trimmed. |
| A newly added space **has no default price** | The seeded price table covers a few weeks either side of now. The prompt says so in words rather than showing `$0.00`. |

---

## What pass 1 deliberately does not do

Say this before anyone finds it. None of the following is a defect:

- **No record detail pages.** Everything about a record is on its card and its expansion.
- **No Match list view — so a cancelled match is not visible anywhere.** It is retained in the
  database with its reason; there is simply no screen that shows it yet.
- **No farmer or agent submission flow.** Records are created here with the **demo tools** — the
  `+ Add` buttons and the `Edit` / `Cancel` controls, all marked with the dev-flag ribbon. That
  journey is the second priority in the brief and is deferred.
- **No login and no roles.** Every screen is the APG view. Per-processor visibility gating — ANZCO
  sees the most, SFF a restricted set once confirmed, Alliance Group no matches at all — is designed
  but not built.
- **No notifications**, so the `Notified` match status has no way in. The lifecycle here is
  `Drafted → Confirmed`, plus `Cancelled` with a reason.
- **No default-pricing maintenance screen** and **no weekly roll-up views.**
- **No Finance Stock draw-down** against the Purchases data.
- **No keyboard-only path for the drag.** A mouse is assumed throughout. This is a decision for the
  prototype, not an oversight, and production would revisit it.
- **The back end is deliberately small.** SQLite, no migrations, no auth. Reset drops and re-seeds it.

---

## The five-minute version

If the room is short of time, do **2a**, **3**, **4** and **6**. Those four beats carry the
many-to-many shape, the gesture, the quantity states and the non-cascade — which is the entire brief.
