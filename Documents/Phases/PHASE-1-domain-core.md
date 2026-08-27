# Phase 1 — Domain Core

**Depends on:** Phase 0 (entities and seed data exist).
**Delivers:** `Apg.Domain` — every computed quantity, status and rule in the prototype, as pure C#
with xUnit tests — plus the DTO contract the Angular client will consume for the rest of the build.

## Objective

This is the highest-risk phase in the build and it has no UI. The same handful of rules — two
different matched-quantity sums, an unmatched figure, a derived status — appear on every card, every
dialog and every colour decision. If they drift, nothing crashes; the numbers are just quietly wrong,
which is the worst possible failure for a tool APG will use to commit real livestock.

So: pure functions in one place, exhaustively tested, and a DTO contract that carries the results to
the client so nothing is ever recomputed in TypeScript.

## Out of scope

Any UI. Any EF Core or ASP.NET dependency inside `Apg.Domain`. The endpoints themselves beyond what
section 7 requires — full CRUD arrives with Phases 6 and 7.

## Requirements

### 1. Types

1.1 `ProcessorSpace`: id, processor, plant, stock class, quantity required, delivery date, delivery
    time (optional free text), notes, status.
1.2 `LivestockAvailability`: id, stock class, quantity available, location, available-from date,
    availability details, transaction type, notes, status.
1.3 `Match`: id, processor space id, availability id, quantity matched, price per kg, transport
    company, status, cancellation reason, created at.
1.4 `MatchStatus`: `Drafted`, `Notified`, `Confirmed`, `Cancelled`.
    `Notified` is in the enum but unreachable in pass 1 (resolved question 2). Do not delete it —
    keeping it means the status logic never needs reshaping when notifications arrive.
1.5 `ProcessorSpaceStatus`: `Booked`, `Confirmed`, `Cancelled` — note the deliberate absence of
    `Pending` (resolved question 6).
1.6 `LivestockAvailabilityStatus`: `Booked`, `Pending`, `Confirmed`, `Cancelled`.

Use enums rather than strings, and make illegal states hard to represent.

### 2. Quantity rules

Each takes the record and its matches and returns a number.

2.1 `MatchedInclDraft` = sum of quantity matched where status ≠ `Cancelled`.
2.2 `MatchedExclDraft` = sum where status is neither `Cancelled` nor `Drafted`.
2.3 `Unmatched` = original quantity − `MatchedInclDraft`. May be negative on the Processor Space side
    ("Over-filled"). Should never be negative on the Availability side ("Over-committed") — but
    compute it honestly rather than clamping, because the pink colour exists precisely to surface the
    bug if it ever happens.
2.4 A quantity state per side, returned as a semantic value — `Under`, `Exact`, `Over` — not a colour.
    Phase 2 owns which colour each maps to on each side.

### 3. Status derivation

3.1 Availability status:
- explicitly `Cancelled` → `Cancelled` (stored, not derived)
- no matches with status ≠ `Cancelled` → `Booked`
- `Unmatched == 0` **and** every match `Confirmed` or `Cancelled` → `Confirmed`
- otherwise → `Pending`

  Note `== 0` exactly, not `<= 0` (resolved question 5).

3.2 Processor Space status is **not derived**. It is `Booked` on creation, `Confirmed` only by an
    explicit APG action, `Cancelled` explicitly. Provide no function that computes it.

3.3 `CanConfirmProcessorSpace(space, matches)` → true when there is at least one `Confirmed` match
    **and** no `Drafted` matches (resolved question 12).

3.4 Cancelling a record must not touch its matches. Whatever cancel helpers exist, assert this in a
    test — it is the single most likely rule for a future chat to "helpfully" break.

### 4. Match creation rules

4.1 `DefaultMatchQuantity` = `min(unmatched space, unmatched availability)`.
4.2 `MaxMatchQuantity` = the availability's unmatched quantity, **plus the existing match's own
    current quantity when editing** (resolved question 13). The Processor Space side has **no** cap —
    over-filling demand is permitted (resolved question 1).
4.3 A single entry point returning either a permitted default quantity or a refusal. When the default
    would be less than 1, the refusal message is exactly `There is no unmatched quantity`.
4.4 A match may be created between a pair that already has one; it becomes a second, separate match
    (resolved question 8). Nothing here dedupes or merges.

### 5. Pricing

5.1 `DefaultPricePerKg(processor, processorSpaceStockClass, weekCommencing)` against the seeded price
    table. Keyed on the **Processor Space** stock class (resolved question 7). Return null when no
    entry exists and let callers decide — do not invent a fallback price.

### 6. Date handling — treat this as a first-class risk

Week banding is the spine of the matching screen. A date that lands in the wrong week puts a record
in the wrong band, and nothing about that failure looks like a bug: the record is simply somewhere
else, and the operator concludes it doesn't exist. Every rule below exists because of a specific way
that happens.

6.1 **`DateOnly` for every business date** — delivery date, available-from date, week commencing.
    Never `DateTime`, never `DateTimeOffset`, for these. A business date has no time and no zone, and
    giving it one is how it starts drifting.

6.2 **`WeekCommencing(date)`** → the Sunday at or before the date. In .NET `DayOfWeek.Sunday` is 0,
    so this is `date.AddDays(-(int)date.DayOfWeek)`. It must be **idempotent**: a Sunday returns
    itself.

6.3 **One timezone helper, one timezone id.** New Zealand is `Pacific/Auckland`. .NET 6+ accepts IANA
    ids on Windows as well as Linux, but confirm the lookup resolves on both — the dev machine is
    Windows and CI may not be. Resolve the zone in exactly one place.

6.4 **Converting CSV timestamps.** `Data/*.csv` carries UTC ISO strings such as
    `2026-04-08T21:19:23.875Z`. That instant is **09:19 on 9 April** in New Zealand. Taking
    `.Date` off the UTC value yields 8 April — a full day early, and one week early whenever the true
    date is a Sunday. Always convert the instant to New Zealand local time *first*, then take the
    `DateOnly`.

6.5 **New Zealand has two offsets:** NZST is UTC+12, NZDT is UTC+13. The same UTC time-of-day
    therefore resolves to different local dates depending on the season, which is exactly the sort of
    thing that passes in July and fails in January.

6.6 **Daylight saving transitions fall on Sundays** — forward on the last Sunday in September, back
    on the first Sunday in April. Our week boundary is also Sunday. That coincidence is the single
    most likely source of an off-by-one-week error in this codebase, and it is why section "Testing"
    names those specific dates.

6.7 **Inject a clock.** No domain code calls `DateTime.Now`, `DateTime.UtcNow` or `DateTime.Today`
    directly. Take an abstraction — `TimeProvider` or a small `IClock` — so tests can pin "today" and
    assert against the current week without being flaky one day a week.

6.8 **"Today" and "the current week" are New Zealand concepts.** Saturday 13:00 UTC is already Sunday
    in New Zealand. Anything deriving the current week from a UTC clock is wrong for twelve hours of
    every Saturday — a window that includes Friday evening in New Zealand, when APG are most likely
    to be working.

6.9 **On the wire, business dates are strings and never become `Date` objects.** `DateOnly`
    serialises as `yyyy-MM-dd`, which is what the client should receive — but the client must not
    construct a JavaScript `Date` from it, because that reintroduces exactly the timezone question
    this design removes. **Every DTO therefore carries both the ISO date and a preformatted display
    label**, so the client renders a string it was given. The same goes for `weekCommencing` and the
    week band's own label.

### 7. The DTO contract — the deliverable Phases 3 to 8 depend on

This is as important as the rules themselves. **The Angular client never recomputes a domain value**,
so every number a card displays must arrive on the DTO.

7.1 `ProcessorSpaceDto` carries the stored fields plus: `matchedInclDraft`, `matchedExclDraft`,
    `unmatched`, the quantity state, `weekCommencing` for the delivery date, `canConfirm`, and its
    matches.
7.2 `LivestockAvailabilityDto` carries the stored fields plus: `matchedInclDraft`,
    `matchedExclDraft`, `unmatched`, the quantity state, `weekCommencing` for the available-from
    date, the **derived** status, the farmer resolved from the location, and its matches.
7.3 `MatchDto` carries quantity, price per kg, transport company, status, and enough of each parent
    record to render it inside the other's expanded card — for a space's matches, the farmer,
    location and availability details; for an availability's matches, the processor, plant, delivery
    date and delivery time.
7.4 **Cancelled matches are excluded** from the match collections on both DTOs (resolved question 4).
    They still count as excluded from both sums, which is a different thing — do not confuse the two.
7.5 Two read endpoints returning these DTOs for the whole working set. The client loads them once and
    filters locally.
7.6 Serialise enums as strings, so the client's own types stay readable.

### 8. Where things live

8.1 All of sections 2 to 6 live in `Apg.Domain` with no EF Core or ASP.NET reference.
8.2 Projection to DTOs may live in `Apg.Api`, but it must call `Apg.Domain` for every computed value
    rather than reimplementing any of them.

## Testing

This phase is judged on its tests. Cover at minimum:

- A record with no matches; with only cancelled matches; with a mix.
- The `Drafted` boundary — one drafted and one confirmed match must give two different sums.
- Exact fill (`Unmatched == 0`) on both sides.
- An over-filled space, asserting unmatched goes negative and the state is `Over`.
- Every branch of the availability status derivation, including the near-miss where `Unmatched == 0`
  but one match is still `Drafted` (→ `Pending`, not `Confirmed`).
- `CanConfirmProcessorSpace` with: no matches, only drafted, one confirmed plus one drafted, one
  confirmed alone.
- The refusal returning the exact message when the default is 0 or negative.
- `MaxMatchQuantity` when editing an existing match, proving the match's own quantity is added back.
- Cancelling a record leaves its matches untouched.

### Date handling — the part to over-test

Do not settle for one happy-path week test. Every case below has a specific way of going wrong, and
all of them fail silently.

**`WeekCommencing` basics**
- All seven days of one known week return the same Sunday.
- A Sunday returns itself, and the function is idempotent under repeated application.
- Crossing a **month** boundary: Tuesday 1 September 2026 → Sunday 30 August 2026.
- Crossing a **year** boundary: Thursday 1 January 2026 → Sunday 28 December 2025.
- A **leap day**: 29 February 2028.

**Daylight saving — the highest-risk cases, because NZ transitions on Sundays**
- **Forward, last Sunday in September:** 27 September 2026. Assert `WeekCommencing` of that date is
  that date, and that the 02:00→03:00 skip does not shift it.
- **Back, first Sunday in April:** 5 April 2026. Same assertions across the 03:00→02:00 repeat.
- The Saturday before and the Monday after each transition, asserting they band to the expected weeks.

**UTC → New Zealand conversion**
- `2026-04-08T21:19:23.875Z` (a real shape from `locations.csv`) resolves to **9 April**, not 8 April.
- `2026-01-15T11:30:00Z` during **NZDT** (UTC+13) → 16 January.
- `2026-07-15T11:30:00Z` during **NZST** (UTC+12) → 15 July.
  The last two matter most: identical UTC time-of-day, different local dates. A naive `+12` constant
  passes the July case and fails the January one.
- A timestamp shortly after UTC midnight resolves to the same NZ day, confirming the conversion is not
  simply shifting everything forward.

**Clock and current week**
- With the clock pinned to **Saturday 13:00 UTC**, "the current week" is the New Zealand Sunday's
  week, not the UTC Saturday's. This is the twelve-hour window in which a UTC-derived anchor is wrong.
- With the clock pinned to a Sunday, "the current week" starts that day.
- No test needs the real system clock. If one does, the clock abstraction is not injected properly.

**Serialisation**
- A `DateOnly` round-trips through JSON as `yyyy-MM-dd` with no zone and no drift.
- Every DTO carrying a date also carries its display label and its `weekCommencing`, so the client
  never needs to parse one.

**Property test**
- Over several hundred consecutive dates spanning at least two DST transitions and a year boundary,
  `WeekCommencing` always returns a Sunday, never later than the input, and never more than six days
  earlier. This catches whole classes of arithmetic error that hand-picked cases miss.

**Cross-platform**
- The `Pacific/Auckland` lookup resolves on Windows and on Linux. If CI runs on Linux and the dev
  machine is Windows, a passing local suite proves nothing about the build.

## Acceptance criteria

- `Apg.Domain` compiles with no EF Core or ASP.NET reference.
- `dotnet test` passes with meaningful coverage of the domain project.
- No derived value is persisted anywhere.
- Both read endpoints return DTOs carrying every computed field listed in section 7.
- No domain rule is implemented anywhere in `web/`.
- Every date case in the "Date handling" test list above has a test, including both DST Sundays, the
  NZDT/NZST pair, the Saturday-13:00-UTC clock case, and the property test.
- No test depends on the real system clock, and no domain code calls `DateTime.Now` or `.Today`.

## Closing this phase

Follow the shared protocol in the roadmap's "Closing a phase" section.

**Review focus for the sonnet subagent:** the arithmetic itself. Ask it to re-derive each rule from
the roadmap and the spec independently and check the implementation against its own reading, rather
than confirming the code does what the code says. Point it at the boundary cases especially — the
`Drafted` split between the two sums, `== 0` versus `<= 0`, and the confirm gates. Also ask whether
any computed value is missing from the DTOs, since that is what would force a later phase to
recompute in TypeScript.

Give it **date handling as a separate, explicit pass**: every `DateTime`/`DateTimeOffset` used where a
`DateOnly` belongs, every place a UTC instant becomes a date without converting to New Zealand time
first, every direct call to `DateTime.Now` or `.Today`, and whether the two DST-Sunday cases are
genuinely covered rather than assumed.

**Record in `Documents/BUILD-LOG.md`:** the full DTO shape as shipped, field by field, because every
later phase codes against it. Also the domain class and method names, any rule you found genuinely
ambiguous and how you resolved it, and any place the spec or roadmap turned out to be wrong.
