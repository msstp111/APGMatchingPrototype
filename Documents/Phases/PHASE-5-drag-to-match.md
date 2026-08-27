# Phase 5 — Drag to Match

**Depends on:** Phase 1 (match rules and pricing), Phase 3 (cards), Phase 4 (filters).
**Delivers:** the feature this entire prototype exists to prove.

## Objective

Dragging a card from one column onto a card in the other creates a match. This is the deliverable.
Everything built so far was to make this moment feel obvious to someone who has never used the app.

It is also the riskiest build in the project: dragging between two independently scrolling,
independently filtered, week-banded columns. **Spike the mechanics before building the polish.**

## Out of scope

Editing or cancelling an existing match, or changing its status (Phase 6). This phase only creates
matches, always at status `Drafted`.

## Requirements

### 1. Drag mechanics

1.1 Angular CDK `DragDrop`. Drag a card from either column and drop it onto a card in the **other** column.
1.2 **Both directions work identically.** Space-onto-availability and availability-onto-space produce
    the same result. The operator should never have to think about direction.
1.3 Dropping on the **same** column is invalid — no match, no error, just no effect.
1.4 Dropping on empty space or a band header is invalid and cancels cleanly.
1.5 **Carry-over cards are draggable** and act on the record they represent (Phase 3, 4.5).
1.6 Auto-scroll the target column when a drag approaches its edge — without this, matching across
    weeks means dropping the card, scrolling, and starting again.
1.7 The dragged card follows the pointer per the Phase 2 drag states. Valid targets highlight;
    invalid ones visibly do not.
1.8 Escape cancels an in-flight drag.

### 2. No keyboard path

2.1 A mouse is assumed available at all times (resolved question 14). **Do not build a keyboard drag
    path**, and do not spend effort on screen-reader announcements for the drag.

2.2 An earlier draft of this document required both. That requirement has been removed deliberately —
    do not reinstate it, and do not treat its absence as an oversight to be helpfully corrected.

2.3 The consequence is that pointer dragging is the *only* way to create a match, so it has to work.
    That raises the stakes on section 1 rather than lowering them: there is no fallback if auto-scroll
    or a drop target misbehaves during a demo. Test the mouse path hard.

### 3. On drop — the quantity prompt

3.1 Compute the default on the server via the Phase 1 rules: `min(unmatched_space, unmatched_availability)`.
3.2 **If that default is less than 1**, create nothing and show exactly:
    **"There is no unmatched quantity"**. Do not open the dialog first and disable its button — refuse
    at the point of the drop.
3.3 Otherwise open the quantity prompt showing:
- a summary of both records, so the operator can confirm they grabbed the right pair — including
  both stock classes, since the two vocabularies do not map and the human is making the judgement
- **quantity matched**, pre-filled with the default, editable
- **default price per kg** from the API's Phase 1 price lookup (processor × **Processor Space** stock
  class × week commencing), editable, and clearly marked when no default was found
- **transport company** — optional at draft, searchable picklist
- Create and Cancel

3.4 **Quantity validation** (resolved questions 1 and 13):
- minimum 1
- maximum = the **availability's** unmatched quantity. Over-committing supply is prevented here.
- there is **no maximum** on the space side. Over-filling demand is allowed and shows as blue
  "Over-filled".
- explain the cap inline when the operator hits it, rather than silently clamping

3.5 Cancelling the dialog creates nothing and leaves both records untouched.

### 4. Creating the match

4.1 New match: status `Drafted`, the entered quantity, price, optional transport company, timestamp.
4.2 **Every drag creates a new match** (resolved question 8). Dropping a pair that already matches
    produces a second, separate match. Never merge, top up, or dedupe.
4.3 On creation, everything derived updates immediately on **both** columns: unmatched, both matched
    sums, quantity colours, the availability record's derived status, and whether a carry-over card
    should still exist.
4.4 If the match consumes the last of an availability record's quantity, its carry-over cards vanish
    from later bands — a visible, satisfying confirmation that the drag worked.
4.5 Confirm the creation briefly and non-blockingly. Include undo if it is cheap; a mis-drag is the
    most common mistake this screen will produce, and Phase 6 adds a proper delete for drafts.

### 5. Seeing existing matches

5.1 The spec requires that APG "can see and open the existing matches between lists" (p.21). A card
    already carrying matches must show it — a count and a status summary at minimum.
5.2 Opening one is Phase 6. Here, only surface that they exist.
5.3 Cancelled matches are not shown or counted (resolved question 4).

## Acceptance criteria

- A match can be created by dragging in either direction with a mouse.
- Dropping within the same column does nothing and reports nothing.
- Attempting a match where either side has no unmatched quantity produces exactly the specified
  message and no match.
- The quantity prompt defaults to `min(unmatched, unmatched)` and caps at the availability's
  unmatched quantity while permitting the space to be over-filled.
- The default price is looked up on the **Processor Space** stock class. Verify with a seeded pair
  whose two stock classes differ — if the lookup is keyed on the wrong side this is where it shows.
- Dragging a carry-over card matches against the underlying record.
- Both columns' numbers, colours, and statuses update instantly after a match is created.
- Creating a second match between an already-matched pair yields two matches, not one merged one.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** the quantity rules at their boundaries — the exact refusal
condition, the supply cap, the deliberately absent demand cap — and whether the default price is
genuinely keyed on the Processor Space stock class. Also ask it to check that dragging a carry-over
card acts on the underlying record, and that nothing merges or dedupes a repeat pairing.

**Record in `Documents/BUILD-LOG.md`:** how the drag was wired, anything about auto-scroll or long
week bands that still feels wrong, and how a card advertises that it
already carries matches — Phase 6 hangs its entire entry point off that affordance.
