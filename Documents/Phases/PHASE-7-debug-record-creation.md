# Phase 7 — Debug Record Creation

**Depends on:** Phase 3 (cards), Phase 4 (filters), Phase 6 (so new records can be matched and managed).
**Delivers:** a way to add, edit, and cancel both record types from the matching screen.

## Objective

Demoing the matching screen requires putting new records into it live — "watch, I'll add the space
ANZCO just rang about". These forms are **debug scaffolding**, not the real create flows. The real
farmer/agent submission journey is deferred beyond pass 1, and this phase must not quietly become it.

## Out of scope

The farmer/agent flow. Finance Stock draw-down against `purchases.csv` — the Purchase linkage is
deferred, so Transaction Type is captured as a plain value with no purchase list behind it. Roles and
permissions. Validation beyond what is listed below.

## Requirements

### 1. Entry points

1.1 An "+ Add Processor Space" control at the top of the spaces column, and "+ Add Livestock
    Availability" at the top of the availability column.
1.2 They follow the columns when flipped (Phase 4).
1.3 **Mark them visibly as debug tooling** — a distinct treatment, or grouped under a "Demo tools"
    affordance. Nobody watching a demo should mistake these for the farmer's real submission form.

### 2. Add Processor Space

Fields, per the spec's create story:

2.1 **Processor** — required. Selecting it filters both the plant and stock class pickers, since both
    lists are processor-specific.
2.2 **Plant** — required, filtered by processor.
2.3 **Stock class** — required, from **that processor's own list**. ANZCO, Alliance Group, and SFF
    each have a different one.
2.4 **Quantity required** — required, integer ≥ 1.
2.5 **Delivery date** — required.
2.6 **Delivery time** — optional, single free-text field (resolved question 9). The per-processor
    variations — ANZCO a specific time, Alliance a range or a "before", SFF none — are deferred.
2.7 **Notes** — optional free text.
2.8 Status is `Booked` on creation. Not editable.

### 3. Add Livestock Availability

3.1 **Stock class** — required, from the single availability list. This list does **not** map onto any
    processor's list; do not cross-reference them.
3.2 **Quantity available** — required, integer ≥ 1.
3.3 **Location** — required, searchable across ~300. Selecting it determines the farmer
    (resolved question 10); show the farmer's name once chosen so the operator can confirm the pick.
3.4 **Available from date** — required.
3.5 **Availability details** — optional free text. The spec's examples: specific pickup date or time,
    days the farmer is away.
3.6 **Transaction type** — required: Finance Stock, Grazing Stock, or Other. Selecting Finance Stock
    does **not** open a Purchase list in pass 1.
3.7 **Notes** — optional free text.
3.8 Status is `Booked` on creation. Not editable.

### 4. Editing records

4.1 Both record types are editable from their card.
4.2 Processor Space: quantity required, plant, delivery date, delivery time, notes.
4.3 Livestock Availability: every attribute.
4.4 Editing a quantity **recomputes everything derived**, and can legitimately push a record into an
    over-filled or over-committed state — reducing quantity available below what is already matched
    is exactly how the pink "Over-committed" state becomes reachable. Do not block the edit; surface
    the consequence.
4.5 Warn before an edit that would leave a record over-committed, but let the operator proceed. The
    spec explicitly contemplates a farmer selling stock elsewhere and the quantity being reduced.

### 5. Cancelling records

5.1 Both record types can be cancelled from their card, with confirmation.
5.2 **Cancelling a record does not cascade to its matches** — they survive untouched and must be
    cancelled separately. This is the deliberate behaviour that lets APG arrange alternatives before
    notifying anyone, and it is one of the more surprising rules in the domain.
5.3 After cancelling a record with live matches, make the situation legible: the record is cancelled,
    its matches are not. Someone watching the demo should be able to see that the orphaned matches
    still exist rather than having to take it on trust.
5.4 A cancelled record leaves the default filters on both columns and so drops out of view. That is
    correct; make sure the operator can still find it by changing the status filter.

### 6. Validation

6.1 Required fields enforced, with clear inline messages.
6.2 Quantities are integers ≥ 1.
6.3 Dates are real dates. Past dates are allowed — APG will be entering records after the fact.
6.4 Forms behave as Material forms do, Escape included. No extra keyboard work beyond what the
    components give you (resolved question 14).

## Acceptance criteria

- A Processor Space can be added and immediately appears in the correct week band, matchable by drag.
- The stock class picker shows only the selected processor's classes, and changing processor resets a
  now-invalid stock class rather than leaving it stale.
- A Livestock Availability record can be added, its farmer resolving from its location.
- Reducing a record's quantity below its already-matched total produces the over-committed state and
  warns rather than blocking.
- Cancelling a record with live matches leaves every match intact — verified by a test.
- The add controls are visibly distinguishable from production UI.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** that cancelling a record leaves every match intact, that a
processor change cannot leave a stale invalid stock class behind, and that reducing a quantity below
what is already matched warns without blocking. Ask it to try to reach an inconsistent state through
the edit forms specifically — that is where one is most likely to be reachable.

**Record in `Documents/BUILD-LOG.md`:** the form component names, how the debug affordances are marked
so Phase 8 can style them consistently, any validation rule you added beyond the phase document, and
whether you found a route to the pink over-committed state other than the intended one.
