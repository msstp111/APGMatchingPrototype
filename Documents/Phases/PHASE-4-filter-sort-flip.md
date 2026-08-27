# Phase 4 — Filter, Sort & Flip

**Depends on:** Phase 1 (the DTO contract), Phase 3 (the card lists).
**Delivers:** the controls that make the matching screen usable at APG's real data volume.

## Objective

Fifty records per side is already more than fits on a screen; the real system will hold hundreds.
Filtering is how an operator gets from "everything" to "the twelve records I could plausibly match
this morning". This phase is what turns a nice-looking screen into a working tool.

## Out of scope

Drag and drop (Phase 5). Anything that changes data — this phase only changes what is *shown*.

## Requirements

### 1. Filters — Processor Spaces

Filterable by every displayed field:

1.1 **Status** — multi-select. Default `Booked` (per the spec).
1.2 **Stock class** — multi-select, and prominent. `Frontend ideas.md` calls for robust stock-class
    filtering specifically. Remember these are the **processor-specific** lists: when a processor is
    filtered, the available stock classes narrow to that processor's own list.
1.3 **Processor** — multi-select.
1.4 **Plant** — multi-select, narrowed by the processor filter.
1.5 **Delivery week (W.C.)** — jump or filter to a given week commencing Sunday.
1.6 **Quantity unmatched** — at minimum a "has unmatched quantity" toggle.

### 2. Filters — Livestock Availability

2.1 **Status** — multi-select. Default `Booked` **and** `Pending`.
2.2 **Stock class** — multi-select, prominent. The single availability list, which does **not** map
    onto the processor lists. Do not attempt to filter one side by the other's stock class.
2.3 **Location** — searchable, since there are ~300.
2.4 **Transaction type** — multi-select.
2.5 **Available-from week (W.C.)**.
2.6 **Quantity unmatched > 0** — on by default (per the spec).

### 3. Filters and carry-over cards

The interaction between filtering and Phase 3's carry-over cards needs deciding explicitly:

3.1 A record excluded by a filter must not appear as a carry-over card either.
3.2 When filtering to a **specific week**, carry-over cards are exactly what makes that view correct —
    they are the records still matchable that week. They must survive a week filter.
3.3 Say in the code and the hand-off which rule you applied, because it is easy to get subtly wrong
    and hard to notice.

### 4. Sorting

4.1 Sortable by every displayed field on both columns, ascending or descending.
4.2 Defaults, from a single exported constants module in `web/`: spaces by delivery date then delivery time;
    availability by available-from date. Both soonest-first.
4.3 **Sorting operates within week bands**, not across them. The band order is always chronological —
    that is the spine of the screen. Sorting by, say, quantity reorders cards inside each week.
    If you believe a global sort that dissolves the bands is genuinely wanted, offer it as an explicit
    "ungrouped" mode rather than silently breaking the bands.

### 5. Flip / swap

5.1 A control that **swaps the two columns**, so availability can sit on the left. Requested directly
    in `Frontend ideas.md`: some people picture animals left, processors right.
5.2 The swap is purely presentational. No filter, sort, or selection state may be lost across it.
5.3 The preference persists in `localStorage`.
5.4 Because position can no longer identify a column, each column's identity must be unmistakable
    from its own styling and heading — this is why Phase 2 required the columns to be
    distinguishable rather than merely symmetrical.

### 6. Reset to default

6.1 A visible "reset" per column returning filters and sort to the Phase 1 defaults. The spec flags
    this as an open question (`<define how/when to return to this default>`); an explicit button is
    the answer — no hidden or timed resets.
6.2 Show clearly when a column is **not** in its default filter state, so nobody concludes a record
    has vanished when it is merely filtered out.

### 7. State and feedback

7.1 Filter and sort state lives in an Angular signal-based store service, with the user's choices
    persisted to `localStorage`. These are UI preferences, not domain data — that distinction is
    why they may live in the browser at all.
7.2 Each column shows a count: "showing 12 of 47".
7.3 When filters exclude everything, show an empty state with a one-click "clear filters" — never a
    blank column.
7.4 Filtering must not mutate records or matches in any way, and must not call the API. The working
    set is already loaded; filtering is a local operation over it.

## Acceptance criteria

- Every field listed in sections 1 and 2 filters correctly, verified by tests over
  the client-side filter service.
- Both columns open in their spec-mandated default filter state on first load.
- Flipping the columns preserves all filter and sort state and survives a page reload.
- Reset returns a column to exactly the Phase 1 default constants — assert this in a test rather
  than by hand, so the defaults and the reset cannot drift apart.
- Filtering to a single week shows that week's native cards plus the carry-over cards still
  matchable in it.
- Counts are correct and carry-over cards do not inflate them.
- `dotnet build`, `dotnet test` and the Angular build all pass.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** the filter-versus-carry-over interaction, whether the reset
control and the initial state can drift apart, and whether the displayed counts stay correct when
carry-over cards are on screen. Ask it to hunt specifically for filter combinations that produce a
misleading view rather than an empty one.

**Record in `Documents/BUILD-LOG.md`:** the rule you applied for carry-over cards under filters and
why, where filter and sort state lives, what persists to `localStorage` under which keys, and how the
flip is represented — Phase 7's add buttons must follow the columns when they swap.
