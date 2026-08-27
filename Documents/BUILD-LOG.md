# Build Log

**Every phase chat reads this file before planning, and appends to it before finishing.**

The roadmap says what we intended. The phase documents say what each phase should do. This file is the
only record of what actually happened — the decisions taken mid-build that no document could have
anticipated, and that every later phase is bound by.

Write entries for someone with **no memory of the conversation that produced them**. That is exactly
who reads them.

Newest entries at the bottom. Do not edit earlier entries; if a later phase overturns an earlier
decision, say so in the later entry and note which one it replaces.

---

## Entry template

```markdown
## Phase N — <name>
**Completed:** <date>
**Status:** Complete | Complete with caveats | Partially complete

### What shipped
Two or three sentences. What a later phase can now rely on existing.

### Decisions made during the build
Anything decided here that a later phase is bound by and could not have read in the roadmap or the
phase document. Name the thing, the choice, and the reason. This is the most valuable section —
if it is empty, check again, because it rarely is.

### Deviations from the phase document
What was specified but not built, or built differently, and why. If nothing deviated, say so.

### Review findings
The sonnet review's findings, and what happened to each: fixed, deliberately not fixed (with reason),
or deferred to a later phase (say which).

### Watch out for
What the next phase will trip over. Sharp edges, half-truths in the docs, things that look wrong but
are correct, things that look right but are fragile.

### New commands, dependencies, conventions
Anything added that a future chat needs. These also belong in CLAUDE.md; repeat them here so the log
reads standalone.
```

---

<!-- Phase entries begin below this line. -->
