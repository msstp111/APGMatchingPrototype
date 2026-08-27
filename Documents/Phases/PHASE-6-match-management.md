# Phase 6 — Match Management

**Depends on:** Phase 5 (matches exist).
**Delivers:** the full life of a match after it is drafted — edit, delete, cancel, confirm.

## Objective

Phase 5 creates matches. This phase lets APG do everything else to them, and confirms a Processor
Space. Pass 1 has no record detail pages and no Match list view, so every one of these actions lives
on the matching screen.

## Out of scope

The standalone Match list view (deferred). Record detail pages (deferred). The `Notified` status
(resolved question 2 — it exists in the type but has no UI path). Creating or editing the underlying
records (Phase 7).

## Requirements

### 1. Getting to a match

1.1 From a card's match indicator (Phase 5, §5), the operator can see that card's matches and open
    one.
1.2 Reachable from **both** sides — the same match is openable from its space and from its
    availability record.
1.3 Opens in a modal, per Phase 2's artboard.
1.4 Dismissible with Escape — Material dialogs do this already; take it as it comes.

### 2. Match modal — read-only context

Per the spec (p.23), both parent records are shown read-only and are fixed at creation.

2.1 **Processor Space block:** status, processor, plant, delivery date, delivery time, stock class,
    quantity originally required, quantity unmatched. Negative unmatched is highlighted and labelled
    **"Over-filled"**.
2.2 **Livestock Availability block:** status, location (and farmer), stock class, available-from date,
    quantity originally available, quantity unmatched. Negative unmatched is highlighted and labelled
    **"Over-committed"**.
2.3 Both stock classes are shown plainly. They come from different vocabularies and will often look
    unrelated; that is expected and must not be presented as an error.

### 3. Match modal — editable fields

3.1 **Quantity matched** — editable at every status.
- Maximum = the availability's unmatched quantity **plus this match's own current quantity**
  (resolved question 13). The .doc says "originally available"; it is wrong, and following it
  would permit the over-commit that the pink colour exists to flag.
- No maximum on the space side — over-filling is allowed.
- Minimum 1. To reduce a match to nothing, cancel or delete it.
- **At `Confirmed` status, an edit prompts for confirmation** before applying.

3.2 **Price per kg** — editable at every status. Populated from the default at draft time and freely
    editable thereafter.

3.3 **Transport company** — editable at every status, searchable picklist, optional.
- **At `Confirmed` status, an edit prompts for confirmation.**

3.4 Every edit recomputes the derived numbers on both columns immediately.

### 4. Actions

4.1 **Delete** — available only at `Drafted` (resolved question 3). No reason required. This is the
    remedy for a mis-drag. The match is gone; it is not a cancellation.

4.2 **Cancel** — for matches past `Drafted`. Requires a **cancellation reason**, chosen from exactly:
- Change from Agent/Farmer
- Change from Processor
- Internal decision by APG

  A cancelled match keeps its record but **disappears from the matching screen** (resolved question 4:
  cancelled matches surface only in the Match list view, which pass 1 does not have). Warn the
  operator that it will no longer be visible, since in pass 1 that is effectively out of sight.

4.3 **Confirm** — moves `Drafted → Confirmed`. Because `Notified` is skipped in pass 1, this is a
    single step.

4.4 Every action recomputes the availability record's derived status. Confirming the last outstanding
    match on a fully matched record flips it to `Confirmed` — this should be visible on the card
    without a refresh.

### 5. Confirming a Processor Space

5.1 A **Confirm** action on the Processor Space card.
5.2 Enabled only when the DTO's `canConfirm` flag is true: at least one `Confirmed`
    match and no `Drafted` matches (resolved question 12).
5.3 When disabled, say why. "Confirm" greying out for unstated reasons is exactly the kind of thing
    that makes non-technical users think the app is broken.
5.4 Sets the space's status to `Confirmed`. Processor Space status is **stored, not derived** —
    do not compute it.
5.5 A `Confirmed` space still appears on the matching screen if the filters allow, but note that the
    default filter is `Status = Booked`, so it will normally drop out of view. That is correct
    behaviour, not a bug.

### 6. Rules that must not break

6.1 **Cancelling a match never touches its parent records**, and cancelling a parent record never
    touches its matches. The non-cascade is deliberate — it lets APG arrange alternatives before
    telling anyone. Test it.
6.2 No derived value is ever written into the store.
6.3 A cancelled match is excluded from **both** matched sums and from `unmatched`. Deleting a drafted
    match has the same numeric effect as cancelling one; the difference is only that the record is
    gone rather than retained.

## Acceptance criteria

- The same match can be opened from both its space and its availability record.
- Quantity edits cap at availability-unmatched-plus-own-quantity, verified by a test on a match that
  already consumes most of its record's supply.
- Editing quantity or transport on a `Confirmed` match prompts first; editing a `Drafted` one does not.
- Delete is offered only on `Drafted` matches; cancel-with-reason only past `Drafted`.
- Cancelling requires a reason and removes the match from the matching screen.
- Confirm on a Processor Space is enabled in exactly the specified circumstance and explains itself
  when it is not.
- Cancelling a record leaves its matches intact and vice versa — covered by a test.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** the non-cascade, from both directions — cancelling a match
must not touch its records, and cancelling a record must not touch its matches. Also the quantity cap
when editing an existing match, which the requirements document states incorrectly, and whether
Processor Space status is anywhere being derived rather than stored.

**Record in `Documents/BUILD-LOG.md`:** how a match is opened from each side, what the modal expects
to be passed, how the confirmation prompts on Confirmed matches are implemented, and where a cancelled
match goes now that pass 1 has nowhere to display it.
