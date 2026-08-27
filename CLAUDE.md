# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech stack (mandated)

**Angular** front end, **.NET Core** back end. This is fixed — do not substitute another framework, and do not reach for a lighter option (a static mock, a Node/Express stub, a client-only prototype) even where the prototype's throwaway back-end would otherwise justify it. "Smallest back-end necessary" below means a minimal ASP.NET Core Web API, not a different technology.

## Current state

Phase 0 is complete: the solution, the Angular app, EF Core + SQLite and the deterministic seeder are in place, and the LMS shell (top bar + sidebar) is built. Phases 1–8 are still to come — see `Documents/BUILD-LOG.md` for what each finished phase actually did.

### Layout

```
ApgMatchingPrototype.sln
src/Apg.Domain/            pure C# — entities, enums, NzTime. NO EF Core, NO ASP.NET. Ever.
src/Apg.Api/               minimal API (.NET 9), EF Core + SQLite, the seeder
tests/Apg.Domain.Tests/    xUnit — domain purity, date handling
tests/Apg.Api.Tests/       xUnit — seed determinism and the demonstration cases
web/                       Angular 22 + Angular Material 22
Data/                      CSV exports from the existing forecasting system (unchanged)
Documents/                 roadmap, phase docs, build log
```

### Versions

.NET 9 SDK (9.0.317) · EF Core 9 (Sqlite provider) · xUnit 2.9 · Node 24 LTS · Angular 22.1 · Angular Material 22.1 · TypeScript 6.0 · vitest 4 (Angular's current default runner).

### Commands

Run from the repo root unless stated.

| What | Command |
| --- | --- |
| Build everything | `dotnet build` |
| Run all .NET tests | `dotnet test` |
| One test project | `dotnet test tests/Apg.Api.Tests` |
| One test | `dotnet test --filter "FullyQualifiedName~At_least_one_space_is_over_filled"` |
| Run the API | `dotnet run --project src/Apg.Api --launch-profile http` → http://localhost:5286 |
| Angular dev server | `npm start` in `web/` → http://localhost:4200 |
| Angular build | `npm run build` in `web/` |
| Angular tests | `npm test` in `web/` |
| One Angular spec | `npx ng test --watch=false --include=src/app/app.spec.ts` in `web/` |
| **Both halves together** | `.\dev.ps1` from the repo root |

`dotnet` and `node` are installed at `C:\Program Files\dotnet` and `C:\Program Files\nodejs`; if a fresh shell cannot find them, the machine `PATH` has not been re-read yet.

### Wiring

- The Angular dev server proxies `/api` to `http://localhost:5286` (`web/proxy.conf.json`, wired into `angular.json`'s `serve` options), so the client only ever calls same-origin paths. CORS for `http://localhost:4200` is configured in the API as a fallback for running without the proxy.
- SQLite lives at `src/Apg.Api/apg.db`, gitignored. The schema is created with `EnsureCreated` — there are no migrations, deliberately. Deleting the file and restarting reproduces identical seed data.
- `POST /api/dev/reset-database` drops, recreates and re-seeds. Phase 8 adds the button that calls it.
- Read endpoints in Phase 0 are `GET /api/processor-spaces` and `GET /api/livestock-availability`, returning **raw stored records**. These are not the DTO contract — Phase 1 designs that, and it carries every computed field.

### Conventions

- The seeder is deterministic: an explicit mulberry32 PRNG (`src/Apg.Api/Seeding/Mulberry32.cs`), never `System.Random`. Every date is an offset from the Sunday of the current **New Zealand** week.
- Every invented list (processors, plants, carriers, stock classes, farmer names) lives in `src/Apg.Api/Seeding/SeedConfig.cs` so APG's real values are a one-file swap.
- LMS colours and metrics live in `web/src/styles/_lms-tokens.scss`, sampled from the screenshots. The Material palettes in `web/src/styles/_theme-colors.scss` were generated from `#00567E`. Do not re-sample; the values are recorded in the build log.

Supporting choices are recorded in `Documents/ROADMAP.md`: EF Core + SQLite for persistence, xUnit for the domain tests, Angular CDK `DragDrop` for the matching interaction, SCSS for styling.

Domain rules live in C# in `Apg.Domain` (no EF, no ASP.NET) and reach the client on DTOs that already carry every computed field — both matched sums, unmatched, derived statuses, the confirm gates, and the week-commencing Sunday. **The Angular app never recomputes a domain value in TypeScript.** One rule, one implementation; the moment it exists in both languages the two drift and the numbers quietly disagree.

## Build plan

The build is nine phases, one chat each, each starting in plan mode. Before working on any of it, read:

- `Documents/ROADMAP.md` — shared context for every phase: domain model, architecture, resolved spec questions, phase list.
- `Documents/BUILD-LOG.md` — what earlier phases actually did and decided. Every phase appends an entry before finishing.
- `Documents/Phases/PHASE-N-*.md` — detailed requirements for the phase at hand.
- `Documents/build-plan.html` — the visual plan, and where the per-phase prompts are copied from.
- `ExistingAppScreenshots/*.png` — four screens from APG's live LMS v7. **The prototype must look like it belongs in that application.** It is built with themed Angular Material, and every prototype screen renders inside the real shell: petrol-blue top bar with the yellow dev flag, and the sidebar with its full nav list. Sample colours from the pixels, not from memory.

The roadmap's **"Resolved spec questions"** override the requirements `.docx` wherever they conflict. Do not reopen them. Each phase closes by spawning a sonnet subagent to review the work, then appending to the build log.

## What this prototype must prove

Alpine Pastures Group (APG) brokers between **Processor Spaces** (meatworks' demand for animals) and **Livestock Availability** (farmers' supply). The high-level goal is **an easy-to-use drag-and-drop matching interface for non-technical APG staff**. Everything else is supporting scaffolding.

Prototype scope (in priority order):

1. The **matching screen** — the primary deliverable.
2. The **farmer/agent flow** for submitting Livestock Availability records — secondary.

Deliberately out of scope: a robust back-end. Build the smallest ASP.NET Core Web API that delivers the above — in-memory or SQLite-backed persistence is fine, and auth can be a role switcher rather than real identity. Notifications (SMS/email), default-pricing maintenance, and the weekly roll-up views are specified in the requirements but are not prototype goals — don't build them unless asked.

Where the domain rules below say a value is derived (statuses, matched quantities, unmatched quantities), compute it **server-side in the .NET API** and let Angular render what it receives. The drag-and-drop interaction is the one place worth spending real effort in the client.

## Domain model

Three entities, and the shape of the relationship is the whole point:

- **Processor Space** — a meatworks' committed slot: stock class, quantity required, processor, plant, delivery date/time, notes.
- **Livestock Availability** — a farmer's stock on offer: stock class, quantity available, location, available-from date, availability details, transaction type, optional linked Purchases, notes.
- **Match** — the join. **Many-to-many**: one Processor Space is filled from several Availability records, and one Availability record is split across several Processor Spaces. A Match carries its own `quantityMatched`, `pricePerKg`, `transportCompany`, and status. Model it as a first-class entity, never as a foreign key on either side.

Cancelling a Processor Space or Availability record **does not cascade** to its matches — that is intentional, so APG can arrange alternatives before notifying anyone. Matches must be cancelled separately.

### Users

- **APG** — sees everything; the only role that creates, views, or edits Matches directly.
- **Processor** (per-company admin) — sees only its own Processor Space records.
- **Farmer** — sees only their own Availability records.
- **Agent** — acts on behalf of farmers, creating Availability records for them. An Availability record therefore has both an owning farmer and possibly a creating agent.

Processors and farmers/agents **never see the Match entity**. Match-derived information is surfaced on their own record's detail view instead. Visibility of that information is further gated per processor (ANZCO sees the most, SFF sees a restricted set only once the space is Confirmed, Alliance Group sees no matches at all).

### Stock class is not a shared vocabulary

The two sides use different, non-aligned stock-class lists. Processor Space stock classes are **processor-specific** (ANZCO, Alliance Group, and SFF each have their own list); Livestock Availability uses a single separate list (GFNB ultra/premium, Prime, Cow, Sire Bull, Bull, Mixed Cattle, Lamb, Mutton). There is no automatic mapping between them — the human operator judges compatibility during drag-and-drop. Don't build a join on stock class and don't assume a shared enum.

## Business rules that drive most of the UI

**Quantity aggregation.** Nearly every screen shows two different sums over a record's matches:

- `Quantity Matched incl Draft` = sum of matches **not** Cancelled. **APG-only.**
- `Quantity Matched excl Draft` = sum of matches not Cancelled **and** not Drafted. Visible to processors/farmers, who see it labelled simply "Quantity Matched".

Compute both from the match set; never store a denormalised total. Colour semantics differ by side: Processor Space uses orange/green/blue for under/exact/over; Livestock Availability uses orange/green/**pink**, because over-committing supply should be impossible and pink flags a bug.

`Quantity Unmatched` (used on the matching screen) = original quantity minus incl-Draft matched. Negative values are highlighted, labelled "Over-filled" on the Processor Space side and "Over-committed" on the Availability side.

**Statuses.** Match status is explicit and APG-driven: `Drafted → Notified → Confirmed`, plus `Cancelled` (requires a cancellation reason: change from agent/farmer, change from processor, or internal APG decision). Processor Space and Livestock Availability statuses are largely **derived from their matches**, not set directly — e.g. an Availability record is `Booked` with no live matches, `Pending` while matching is in progress, and `Confirmed` only when unmatched quantity is zero and every match is Confirmed or Cancelled. Implement these as computed state so they can't drift.

**Match creation.** Dragging one record onto the other prompts for `quantityMatched`, defaulting to `min(unmatched on each side)`. If that default is < 1, refuse with "There is no unmatched quantity". The default price per Kg (by processor × stock class × week-commencing-Sunday) is shown at draft time and stays editable on the match.

**Matching screen layout.** Processor Spaces left, Livestock Availability right. Both lists read-only, each filterable and sortable by every displayed field, each with a "week commencing" (Sunday) column for week-at-a-glance filtering. Default filters: Processor Spaces `Status = Booked`; Availability `Status in (Booked, Pending)` and `Quantity Unmatched > 0`.

## Requirements document

`Documents/Requirements/APG Booking Module Requirements 2026-08-27.docx` is the authoritative spec (32 pages). Consult it before implementing any screen — this file is a summary, not a substitute.

It is **misnamed**: despite the `.docx` extension it is a legacy OLE compound `.doc`, so unzip-based extraction fails. Extract it via Word COM:

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible = $false
$d = $w.Documents.Open("<abs path to .docx>", $false, $true)
$d.SaveAs([ref]"<abs path to out.txt>", [ref]7)   # 7 = wdFormatEncodedText
$d.Close([ref]$false); $w.Quit()
```

The spec contains unresolved questions in angle brackets (`<validate>`, `<Devs>`). Treat those as open, not as requirements.

## Seed data

`Data/*.csv` is an export from APG's **existing livestock forecasting system**, not from this booking module. Its stock classes, statuses, and transaction types do **not** match the booking-module vocabularies above — don't wire it in as if they did.

Useful for realistic demo content:

- `locations.csv` (~300 farms) — plausible Location values for Availability records.
- `stock-class-configs.csv` — icons and hex colours per stock class, reusable for visual styling.
- `purchases.csv` (~3100 rows) — `quantity`, `date`, `transactionTypeName` (Finance Stock, Grazing Stock, ANZCO Grazing, Farm Owned, …), `locationId`, `stockClassId`. Relevant because Availability records with Transaction Type = Finance Stock must draw down against Purchases that have unused quantity and match on stock class, location, and transaction type.
- `groups.csv`, `forecast-updates.csv`, `group-membership-logs.csv` — forecasting-specific; largely irrelevant here.
