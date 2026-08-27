# APG Booking Module — Prototype Roadmap

**Every build chat receives this document.** It is the shared, stable picture of what we are building
and why. It changes rarely. The per-phase requirements documents in `Documents/Phases/` change often
and carry the detail.

The authoritative spec is `Documents/Requirements/APG Booking Module Requirements 2026-08-27.docx`
(a legacy OLE `.doc` despite the extension — see CLAUDE.md for extraction).
Frontend direction comes from `Documents/Requirements/Frontend ideas.md`.

---

## How this build is run

Each phase is one fresh chat. Every chat starts by reading:

1. **This roadmap** — the shared context.
2. **`Documents/BUILD-LOG.md`** — what the phases before you actually did, and every decision they made
   along the way that you are bound by.
3. **Its phase document** — `Documents/Phases/PHASE-N-*.md`, the detailed requirements for that phase only.
4. **A prompt** — copied from `Documents/build-plan.html`.

Every phase chat **starts in plan mode**. Produce a plan, get it approved, then build.

Rules that hold across every phase:

- **Do not build beyond your phase.** If you spot work that belongs to a later phase, note it and stop.
- **Do not re-litigate resolved questions.** See "Resolved spec questions" below. If the .doc conflicts
  with that list, the list wins.
- **Update CLAUDE.md** when you add commands, dependencies, or conventions a future chat must know.
- **Leave the build green.** Typechecks, lints, and tests pass before the phase is done.

### Closing a phase

No phase is finished when the code works. It is finished when it has been reviewed and recorded.

**Step 1 — Review.** Once the build is green, spawn a **subagent on the `sonnet` model** to review the
phase's work for correctness bugs and code quality. Give it the phase document, this roadmap, and the
diff, and ask it to report findings rather than apply them. Then:

- Fix what is real.
- Where you disagree with a finding, say so explicitly and record why — a reviewer being wrong is
  useful information for the next phase.
- Do not let the reviewer expand scope. A finding that belongs to a later phase goes in the build log,
  not into this phase's code.

**Step 2 — Record.** Append an entry to `Documents/BUILD-LOG.md` using the template at the top of that
file. This is the only channel through which one phase's discoveries reach the next, so it carries
what the roadmap and the phase documents cannot know in advance: decisions taken mid-build, deviations
from the plan and their reasons, review findings and their disposition, and anything the next phase
will trip over.

Write it for someone with **no memory of this conversation**, because that is exactly who reads it.

---

## What this prototype must prove

An easy-to-use drag-and-drop matching interface for non-technical APG staff. Everything else is
scaffolding for that one screen.

APG brokers between **Processor Spaces** (meatworks' demand) and **Livestock Availability** (farmers'
supply). The join between them is the **Match**, and its shape is the whole point: **many-to-many**.
One space is filled from several availability records; one availability record splits across several
spaces. A match carries its own quantity, price, transport company, and status. It is a first-class
entity, never a foreign key on either side.

Stock classes are **two non-aligned vocabularies** — processor-specific lists on the demand side, one
separate list on the supply side. There is no automatic mapping, no join on stock class, no shared
enum. Compatibility is the operator's judgement during the drag. This is a feature, not a gap.

---

## Pass 1 scope

**The matching screen, for APG only.** Nothing else.

- No login, no role switching. Every screen is the APG view.
- No farmer/agent flow, no Purchase draw-down for Finance Stock.
- No notifications, no default-pricing maintenance screen, no weekly roll-up views.
- No record detail pages and no standalone Match list view.
- Records are created via **debug "+ Add" buttons** on each side of the matching screen. These are
  scaffolding for demoing, not the eventual create flows.

---

## Stack

| Concern | Choice |
| --- | --- |
| Front end | **Angular** — standalone components, signals |
| Component library | **Angular Material**, custom-themed to match the existing LMS app |
| Drag and drop | **Angular CDK** `DragDrop` |
| Styling | SCSS with a token layer from Phase 2 |
| Back end | **ASP.NET Core** minimal API (.NET 9) |
| Persistence | EF Core + SQLite, seeded from `Data/*.csv` |
| Domain tests | xUnit |
| Front-end tests | Angular's default runner |

### Repository layout

```
src/Apg.Domain/        pure C# domain rules — no EF, no ASP.NET
src/Apg.Api/           minimal API, EF Core, seeding
tests/Apg.Domain.Tests/ xUnit
web/                   Angular application
Data/                  existing CSV exports (unchanged)
Documents/             this roadmap, phase docs, build log
```

### Where the rules live — read this before planning any phase

**The domain rules are C#, on the server, and there is exactly one implementation of them.**

`Apg.Domain` owns every computed value: both matched sums, unmatched, the derived availability status,
the confirm gates, the match quantity default and cap, the price lookup, and the week-commencing
Sunday. It is a plain class library — no EF, no ASP.NET — so it can be tested directly.

**The API returns DTOs that already carry every computed field.** The Angular client renders what it
is given and **never recomputes a domain value in TypeScript**. If a card needs a number, the DTO
carries it. This is the single most important architectural rule in the build: the moment the same
rule exists in both C# and TypeScript, the two drift and the numbers quietly disagree.

The week-commencing Sunday is stamped on every DTO server-side for the same reason — it keeps week
banding out of the browser's timezone entirely.

**Filtering and sorting are client-side**, over the already-loaded set. The dataset is small enough to
hold in memory, and filtering has to feel instantaneous. Mutations go to the API and the affected
records come back recomputed.

The round-trip cost of a server-authoritative design is a few milliseconds on localhost. Duplicated
domain logic would cost correctness, which is the one thing this prototype cannot afford.

**The two lists are cards, not tables.** `Frontend ideas.md` calls for cards on a week-banded
timeline. Angular Material's table is available if a later phase genuinely needs one, but the matching
screen's two columns are not it.

---

## Visual language — match the existing app

`ExistingAppScreenshots/*.png` show APG's live system, **LMS v7**. This prototype must look like it
belongs in that application, not like a new product. It is built with Angular Material, and matching
it means theming Material rather than styling from scratch.

What the screenshots establish:

- **Top bar** — deep petrol blue, full width. Hamburger toggle and an `LMS` wordmark on the left; a
  bold yellow `# DEV ENVIRONMENT #` flag on the right.
- **Left sidebar** — fixed, roughly 200px, white body under a header block in the same petrol blue
  carrying the user's name and a close button. Nav items are an outline icon plus a label; the active
  item takes a light grey full-width fill. A small grey footer block carries the version string and
  `Alpine Pastures © 2022`.
- **Filter panel** — a full-width underline search input over a row of Material underline selects and
  date pickers with floating labels, and a stacked `× Clear` / `^ Hide` pair at the top right.
- **Content** — dense, zebra-striped rows; small uppercase grey column headers with a sort arrow on
  the active one; numerics right-aligned; a circular blue `+` FAB at the top right for create; a
  Material paginator at the foot. Empty values render as `-`.
- **Type** — Roboto. There is no serif anywhere in the existing app.
- **Status is plain, uncoloured text** in the existing app — "Pending", "Complete", "Awaiting
  Invoice". Worth knowing before adding colour to it here.

**Every screen this prototype builds sits inside that shell** — the top bar and the sidebar are
present, not stubbed out. Existing nav items (Killsheets, Purchases, Adjustments, Locations, Admin,
Logout) are rendered and inert; the booking module adds its own entries.

Phase 2 must **sample the exact hex values from the PNGs** rather than eyeballing approximations.

The one deliberate departure: our two lists are **cards, not tables**, per `Frontend ideas.md`. The
shell, filter panel, typography and controls match LMS; the matching screen's content area does not.

---

## Frontend direction

From `Frontend ideas.md`, binding on every UI phase:

- **Cards, not rows.** Both sides render as cards showing the most valuable summary information, with
  an expand affordance for the rest.
- **Status is visible on every card** — see "Two colour systems" below for how, since hue is spoken
  for by the quantity states.
- **Flip/swap button.** Some people picture animals left and processors right; others the reverse.
  Default is Processor Spaces left (per the spec), but the sides must swap on a button.
- **Robust filters** on stock class and status, both sides.
- **Sorted soonest-first**, always.
- **Week guide markers** with a "Week of…" key down the left.

### Spaces are fixed to a day; availability spans weeks

The one genuinely open display problem. Working answer, expected to iterate:

Both columns are banded by week (commencing Sunday), with a sticky left rail label. A **Processor
Space** sits in exactly one band — its delivery date. A **Livestock Availability** record is anchored
in the band containing its available-from date, and then **reappears at the top of every later band as
a muted, dashed "carry-over" card** labelled "available since 10 Aug", for as long as it retains
unmatched quantity. Scrolling to any week therefore shows everything genuinely matchable *that* week,
not merely what became available that week. Detailed in Phase 3.

### Two colour systems, resolved

Two independent meanings compete for the same card: **record status** (Booked / Pending / Confirmed /
Cancelled) and **quantity fill** (under / exact / over). If both use hue they become unreadable —
green means "exactly filled" in one system and reads as "confirmed" in the other.

The division is settled, and no phase may reopen it:

**Hue belongs exclusively to quantity fill.** The spec is prescriptive about it — orange under, green
exact, blue over-filled on spaces, pink over-committed on availability — and unmatched quantity is the
number an operator scans for. It is expressed as a **fill meter**: a bar showing matched against
original, in full saturation, with the numeral beside it. Colour, bar length and number are three
redundant channels carrying one meaning.

**Status uses everything except hue** — weight, pattern, icon and text, on the card's left edge:

| Status | Left edge | Icon | Card treatment |
| --- | --- | --- | --- |
| Booked | Hairline, light grey | Outline | Normal |
| Pending | Diagonal hatching | Clock | Normal |
| Confirmed | Solid, in the LMS petrol blue | Filled tick | Normal |
| Cancelled | Dashed | Slash | Whole card desaturated, title struck through |

Pattern reads as reliably as hue at a glance once learnt, and it leaves the saturated palette free for
the numbers. It also matches the existing app, where status is plain uncoloured text.

> This narrows `Frontend ideas.md`'s "cards should have colours based on their status": status is
> unmistakable on every card, but it is carried by weight and pattern rather than hue, because hue is
> already committed. The one hue status does use — petrol blue for Confirmed — is the brand colour
> from the shell, reading as "locked". Easy to revisit if Mark wants it the other way round; the
> constraint is only that the two systems must not both use hue.

---

## Domain rules the build must not get wrong

Everything below is **computed, never stored**:

- `matchedInclDraft` = sum of `quantityMatched` where status ≠ Cancelled.
- `matchedExclDraft` = sum where status not in (Cancelled, Drafted). Labelled "Quantity Matched".
- `unmatched` = original quantity − `matchedInclDraft`.
- Processor Space colours: orange < required, green = required, blue > required.
- Availability colours: orange < available, green = available, **pink** > available (a bug flag —
  it should be unreachable).
- Availability status: `Booked` (no live matches) / `Pending` (matching underway) /
  `Confirmed` (`unmatched == 0` **and** every match Confirmed-or-Cancelled) / `Cancelled` (explicit).
- Processor Space status: `Booked` on create, `Confirmed` by APG action, `Cancelled` explicit.
  **Not derived.**
- Cancelling either record **never** cascades to its matches. This is deliberate: it lets APG arrange
  alternatives before notifying anyone.
- Match creation default quantity = `min(unmatched_space, unmatched_availability)`; if that is < 1,
  refuse with "There is no unmatched quantity".

---

## Resolved spec questions

Decided 2026-08-27 and 2026-08-28. **These override the .doc where they conflict.** Do not reopen them.

1. **Over-filling is deliberately asymmetric.** The quantity prompt may exceed a Processor Space's
   remaining need (negative unmatched → blue, "Over-filled"). It is **hard-capped** at the Livestock
   Availability's remaining supply. The pink "Over-committed" state stays unreachable and exists only
   as a bug indicator.
2. **`Notified` is not used in pass 1.** Lifecycle is `Drafted → Confirmed`, plus `Cancelled`.
   `Notified` remains a member of the status type with no UI transition into it.
3. **Drafted matches can be plain-deleted.** Cancel-with-reason is for matches past Drafted; a mis-drag
   is simply removed.
4. **Cancelled matches are visible only from the Match list view.** Hidden on the matching screen and
   on record detail views. The Match list is not in pass 1, so in pass 1 a cancelled match is not
   visible anywhere.
5. **Availability `Confirmed` requires `unmatched == 0` exactly**, not `<= 0`. Safe because of (1).
6. **Processor Space has no `Pending` status — deliberate.** A space with only drafted matches stays
   `Booked` and remains inside the matching screen's default filter.
7. **Default price is keyed on the Processor Space stock class**, not the Availability stock class:
   processor × PS stock class × week-commencing-Sunday. Seeded as a price table; no maintenance UI.
8. **Every drag creates a new match.** Dropping a record onto a partner it already matches produces a
   second, separate match rather than topping up the existing one.
9. **Delivery time is one optional free-text field** in pass 1, not the per-processor variants.
10. **Farmer is derived from Location.** Each location belongs to exactly one farmer. Picking the
    location determines the farmer and their contact details.
11. **Plants and transport companies are invented** — plausible NZ ones, in a single config module so
    the real lists are a one-file swap.
12. **Processor Space "Confirm" gate**, given (2): enabled when there is at least one `Confirmed` match
    and no `Drafted` matches. (The .doc's "Booked or Pending" names statuses matches don't have.)
13. **Match quantity ceiling** is remaining supply plus the match's own current quantity — not the
    Availability record's *original* quantity as the .doc states, which would permit the over-commit
    that (1) forbids.
14. **A mouse is assumed to be available at all times.** There is **no keyboard-only requirement** in
    this prototype: no keyboard drag path, and no keyboard-only journey to satisfy. Material's own
    controls remain keyboard-operable because they arrive that way, and focus states should not be
    actively removed — but no phase spends effort on a pointer-free path, and no phase should
    reintroduce one. (Production would need to revisit this; the prototype does not.)
15. **The visual language extends the existing LMS app**, built with Angular Material themed against
    `ExistingAppScreenshots/*.png`. Every prototype screen renders inside the real shell — top bar and
    sidebar present, not stubbed. See "Visual language" above.
16. **Hue belongs to quantity fill; status is carried by weight, pattern, icon and text.** The two
    systems never both use colour. See "Two colour systems, resolved" above for the full scheme.

The .doc contains unresolved authoring notes in angle brackets (`<validate>`, `<Devs>`). Those are open
questions, not requirements. Ignore them.

---

## Phases

| # | Phase | Delivers |
| --- | --- | --- |
| 0 | Scaffold & seed | Solution, themed Material shell (top bar + sidebar), API, EF Core, deterministic seed |
| 1 | Domain core | `Apg.Domain` — every computed quantity, status and rule in C#, xUnit-tested |
| 2 | Design pass | Visual language and screen mockups via the `design` skill; `design-system.md` |
| 3 | Card lists & week bands | Both columns rendering, banded by week, carry-over cards, expand |
| 4 | Filter, sort, flip | Stock class and status filters, sorting, side-swap, reset-to-default |
| 5 | Drag to match | Angular CDK across columns, quantity prompt, default price, refusal cases |
| 6 | Match management | Open a match; edit, delete draft, cancel with reason, confirm; confirm a space |
| 7 | Debug record creation | "+ Add" both sides; edit and cancel records; prove non-cascading cancel |
| 8 | Polish & demo readiness | Over-fill states, stock-class iconography, reset demo data, empty states |

**Phase 2 is where the bulk of UI design happens** and is the one phase that must invoke the `design`
skill. Phases 3–8 implement against its output rather than inventing visuals of their own.

---

## Deferred beyond pass 1

Roughly in the order they would earn their place:

1. Record detail views for both entities, with their match tables and dual sums.
2. The standalone Match list view — and with it, visibility of cancelled matches.
3. The farmer/agent Availability flow, including Finance Stock draw-down against `purchases.csv`.
4. Roles and per-processor visibility gating (ANZCO / SFF-after-Confirmed / Alliance-never).
5. `Notified` status and the notification mediums (in-app, SMS, email).
6. Default pricing maintenance.
7. Weekly roll-up views on the two list screens.
