# APG Booking Module — Design System

**Phase 2 output. Phases 3–8 implement from this document and make no visual decisions of their own.**
If something you need to build is not specified here, that is a bug in this document — say so in your
build log rather than inventing an answer, because an invented answer is how five phases end up with
five different card paddings.

**Canvas:** https://claude.ai/code/artifact/1cc1dd73-911d-4f74-be93-c672d8606d33
Ten artboards, every one drawn with real seeded records. The canvas shows; this document specifies.
Where they disagree, this document wins.

---

## 0. The one idea

Every other screen in LMS v7 is a dense, zebra-striped table showing about twenty rows at a glance.
Our two lists are cards, because dragging a table row onto another table row is not a gesture anyone
recognises. The risk is that cards read as a different application bolted onto LMS.

The answer:

> **A card is a table row that has grown a status spine, a fill meter and an expand chevron.**

Which means, concretely:

- Each column keeps a **sticky micro-cap header strip** in LMS's exact column-header treatment, and
  **every card's first line aligns to those columns**. The list reads as a table.
- Cards are **flat and square**: no shadow, no gap between them, **radius 0**, separated by 1px
  `#E0E0E0` rules. Elevation is reserved for drag previews and dialogs.
- **Zebra striping is kept** (§3.2).
- Expanding a card reveals **an actual LMS table** of its matches — 30px rows, zebra stripe, micro-cap
  headers, right-aligned numerics, `-` for empty.
- Density is held to arithmetic, not taste (§8.3).

---

## 1. Sampled LMS values

Every colour below was sampled from the pixels of `ExistingAppScreenshots/*.png` in Phase 0 with
`System.Drawing`. **Do not re-sample.** They already live in `web/src/styles/_lms-tokens.scss`.

| Token | Hex | Where in LMS |
| --- | --- | --- |
| Petrol blue (primary) | `#00567E` | top bar, sidebar header block, create FAB |
| Dev-environment flag | `#CCD457` | `# DEV ENVIRONMENT #` — a yellow-**green**, not a pure yellow |
| Content background | `#FAFAFA` | page body behind the content area |
| Active nav fill | `#F6F6F6` | selected sidebar item, full width |
| Zebra stripe | `#EEEEEE` | alternate table rows |
| Sidebar footer | `#EBEBEB` | version / copyright block |
| Divider | `#E0E0E0` | sidebar edge, row rules |
| Text primary | `#212121` | body |
| Text muted | `#757575` | small uppercase column headers, footer |

Shell metrics — the screenshots are at a device pixel ratio of ~1.75, so these are measured pixels
divided by that:

| Metric | Value |
| --- | --- |
| Sidebar width | 190px |
| Top bar height | 52px |
| Sidebar header block | 52px (flush with the top bar) |
| Nav item height | 48px |
| Dense table row | 44px |

Type is **Roboto** throughout, weights 300/400/500/700. There is no serif anywhere in LMS and there
must be none here. Icons are outline-style; Phase 0 loads Material Symbols Outlined at
`FILL 0, wght 300`.

### 1.1 Material theme configuration

`web/src/styles/_theme-colors.scss` was generated with
`ng generate @angular/material:theme-color --primary-color="#00567E"`. **Material 3 tonal palettes do
not reproduce a source colour exactly** — tone 40 of the generated primary is `#1D648D`, not
`#00567E`. Therefore, and this rule is permanent:

> **Shell and app chrome paint with the sampled hex directly. Only Material *components* take the
> generated palette.** Never "fix" the top bar or a status spine to use `--mat-sys-primary`.

`web/src/styles.scss` currently reads:

```scss
@include mat.theme((
  color: (primary: lms-palettes.$primary-palette, tertiary: lms-palettes.$tertiary-palette),
  typography: Roboto,
  density: 0,
));
```

**Phase 3 changes exactly two things in it:**

1. **`density: -2`.** At `density: 0` a `mat-form-field` is 56px tall and a `mat-chip` 32px. This
   design's filter row is 40px and its chips 26px. `-2` gets Material's own controls to LMS's
   density without per-component overrides.
2. **Dialog radius → 4px.** M3's default `mat-dialog` radius is 28px, which reads as a different
   product sitting next to LMS's square-cornered tables. Add to `styles.scss`:

```scss
.mat-mdc-dialog-surface { border-radius: 4px !important; }
```

Everything else about the theme stays as Phase 0 left it.

### 1.2 Material components — the complete list this design uses

There are **no bespoke controls** in this design. Anything that looks like one is a `<div>` with
inline styles carrying no interaction (the fill meter, the status spine, the week rail) — those are ornament, not controls.

| Need | Component |
| --- | --- |
| Filter search, all dialog inputs | `mat-form-field appearance="fill"` + `matInput` |
| Multi-select filters | `mat-select multiple` inside a `fill` form field |
| Status / stock-class filter pills | `mat-chip-listbox` / `mat-chip-option` |
| Transport company, location pickers | `mat-autocomplete` |
| Cancellation reason | `mat-radio-group` |
| Expand / collapse a card | `mat-icon-button` (the chevron) |
| Flip columns | `mat-icon-button` |
| Dialogs and modals | `MatDialog` |
| Refusal and confirmation messages | `MatSnackBar` |
| Add-record (debug) buttons | `mat-stroked-button` |
| Primary dialog actions | `mat-flat-button` (`color="primary"`) |
| Secondary / destructive actions | `mat-button` |
| Tooltips on blocked drop targets | `matTooltip` |
| Drag and drop | Angular CDK `DragDrop` |

**Form fields use `appearance="fill"`, never `"outline"`.** LMS's filter panel is
underline-with-floating-label; outlined fields would be the single most obvious tell that this is a
different app.

---

## 2. Colour tokens

Add to `web/src/styles/_lms-tokens.scss` (or a Phase 3 sibling that `@use`s it). SCSS variables plus
CSS custom properties, matching the existing file's pattern.

```scss
// --- surfaces -------------------------------------------------------------
$lms-card:            #FFFFFF;  // a card's own background
$lms-card-zebra:      #F5F5F5;  // alternate card (see 3.2 — softer than LMS's #EEEEEE)
$lms-band:            #F0F0F0;  // week band header, past-week rail
$lms-petrol-tint:     #E8F1F6;  // current-week band, valid drop target, info panels
$lms-hover:           #F5F9FB;  // card hover
$lms-column-wash:    #F6FAFC;  // the opposite column during a drag

// --- the expanded card's drawer (§6.2) — ONE strip of chrome inside a WHITE sheet ---
// A grey ground (#E8EAED) was shipped and pulled the same day: on this screen a greyed-out block
// reads as READ ONLY, and the drawer is the most interactive region on the card. See §6.2.
// $lms-expansion-head #DFE4E8 and $lms-expansion-head-rule #CCD2D7 grounded the sums caption bar
// and are DELETED (2026-09-07): the sums are type on white now. Eight named greys lived inside ten
// L* points on this screen, so the fix could only be a removal, never a ninth step.
$lms-expansion-th:        #ECEFF1;  // the match table's header row
$lms-expansion-rule:      #D5D9DD;  // the vertical rules between that header's cells

// --- lines and text -------------------------------------------------------
$lms-rule-strong:     #BDBDBD;  // form-field underline, Pending hatch stroke
$lms-rule-soft:       #EFEFEF;  // rules inside an expanded card
$lms-faint:           #9E9E9E;  // tertiary text, empty-state text, cancelled spine
$lms-supply-ink:      #37393C;  // the supply column's identity tone

// --- quantity ramp: HUE LIVES HERE AND NOWHERE ELSE -----------------------
$q-under-bar:  #E8820C;  $q-under-ink:  #A85B00;   // both sides
$q-exact-bar:  #2E7D32;  $q-exact-ink:  #1B5E20;   // both sides
$q-over-bar:   #1565C0;  $q-over-ink:   #0D47A1;   // PROCESSOR SPACE only
$q-pink-bar:   #D81B60;  $q-pink-ink:   #AD1457;   // AVAILABILITY only
$q-track:      #E0E0E0;  // the meter's unfilled track

// --- semantic ------------------------------------------------------------------
// From Material's generated error palette (tone 40). Deliberately NOT an amber: every usable
// amber lands on top of $q-under-ink (#A85B00) and smuggles the quantity ramp's orange into
// meanings that are not quantities. Phase 2's own review caught exactly that — see §16.
$lms-error:          #BA1A1A;  // destructive actions, validation, consequential warnings
$lms-attention-ink:  #5C5F62;  // "away from default" — informational, and hueless
$lms-attention-bg:   #F5F5F5;  // the panel behind a consequential warning
```

Mirror every one of them as a custom property in the same `:root` block `_lms-tokens.scss` already
has, so a component can reach them without importing the partial:

```scss
:root {
  --lms-card: #{$lms-card};                --lms-card-zebra: #{$lms-card-zebra};
  --lms-band: #{$lms-band};                --lms-petrol-tint: #{$lms-petrol-tint};
  --lms-hover: #{$lms-hover};              --lms-column-wash: #{$lms-column-wash};
  --lms-expansion-head: #{$lms-expansion-head};
  --lms-expansion-th: #{$lms-expansion-th};
  --lms-expansion-rule: #{$lms-expansion-rule};
  --lms-expansion-head-rule: #{$lms-expansion-head-rule};
  --lms-rule-strong: #{$lms-rule-strong};  --lms-rule-soft: #{$lms-rule-soft};
  --lms-faint: #{$lms-faint};
  --lms-supply-ink: #{$lms-supply-ink};
  --q-under-bar: #{$q-under-bar};          --q-under-ink: #{$q-under-ink};
  --q-exact-bar: #{$q-exact-bar};          --q-exact-ink: #{$q-exact-ink};
  --q-over-bar:  #{$q-over-bar};           --q-over-ink:  #{$q-over-ink};
  --q-pink-bar:  #{$q-pink-bar};           --q-pink-ink:  #{$q-pink-ink};
  --q-track:     #{$q-track};
  --lms-error: #{$lms-error};              --lms-attention-ink: #{$lms-attention-ink};
  --lms-attention-bg: #{$lms-attention-bg};
}
```

**The quantity ramp is not from the M3 palette and must not be replaced with palette tokens.** These
four hues are prescribed by the requirements. `-bar` is the meter fill; `-ink` is the numeral and any
text form of the same state, darkened so it passes contrast on white and on the zebra stripe.

`$q-over-bar` (`#1565C0`) is a vivid azure, deliberately far from the petrol `#00567E` used for the
Confirmed spine. They are never adjacent — one is a 66px meter fill, the other a 6px vertical edge —
and the over state always carries the literal word "Over-filled" as well. If a later phase finds them
confusable in practice, change `$q-over-bar`, not the petrol.

---

## 3. The two colour systems — the rule no phase may blur

Two independent meanings compete for the same card: **record status** and **quantity fill**. The
division is settled in the roadmap and restated here in full, because this is the single easiest thing
in the build to get wrong by accident.

> **Hue belongs exclusively to quantity fill. Status carries no hue.**
> **Pattern belongs exclusively to status. Quantity carries no pattern.**

Neither system may borrow the other's channel, in any phase, on any surface — card, expanded match
table, dialog, modal, filter chip or snack bar.

**One acknowledged overlap.** Petrol `#00567E` appears in three unrelated roles: the shell's own
chrome, the demand column's 3px identity rule and title, and the Confirmed status spine. So on a
Confirmed Processor Space the column header and the card's left edge are the same blue for unrelated
reasons. This is accepted rather than overlooked — petrol is the *brand* colour, it is not a member of
the quantity ramp, and status is never carried by colour alone (the pattern weight, the icon and the
word are always there too). If it proves confusing in use, move the demand column's identity rule to a
neutral and leave the spine alone; never the other way round.

Corollaries a later phase will be tempted to violate:

- Do not colour a status chip, a status filter chip, a status column, or a match-status cell.
- Do not hatch, dash or stripe a fill meter, however tempting for the draft segment (§4 uses **alpha**
  for that, which is a third channel belonging to neither system).
- Do not tint a whole card by status. The one card-level treatment status owns is Cancelled's
  desaturation (§3.1), which removes colour rather than adding it.
- **Stock class gets no hue either** (§7).

### 3.1 Status — the full scheme

Status is carried on the card's **left edge** plus an **icon** and a **text label**. Three redundant
channels, none of them hue.

| Status | Left edge | Icon (Material Symbols Outlined) | Label | Card treatment |
| --- | --- | --- | --- | --- |
| **Booked** | **3px** solid `#E0E0E0` | `radio_button_unchecked` | `Booked` | normal |
| **Pending** | **6px** 45° hatch, `#BDBDBD` on `#FFFFFF`, 4px period | `schedule` | `Pending` | normal |
| **Confirmed** | **6px** solid `#00567E` | `check_circle` (`FILL 1`) | `Confirmed` | normal |
| **Cancelled** | **6px** dashed `#9E9E9E`, 6px dash / 4px gap, vertical | `block` | `Cancelled` | `filter: grayscale(1); opacity: .62`; title struck through |

CSS for the two patterned edges — use exactly these so the two columns match:

```scss
.spine        { flex: 0 0 auto; align-self: stretch; }
.sp-booked    { width: 3px; background: #E0E0E0; }
.sp-pending   { width: 6px;
                background: repeating-linear-gradient(45deg, #BDBDBD 0 2px, #FFFFFF 2px 4px); }
.sp-confirmed { width: 6px; background: #00567E; }
.sp-cancelled { width: 6px;
                background: repeating-linear-gradient(180deg, #9E9E9E 0 6px, transparent 6px 10px); }
```

Note that **weight alone separates Booked from everything else**: 3px versus 6px. That is deliberate —
"nothing has happened yet" is legible before the pattern is even resolved, which matters on the poor
monitors this will run on.

**Statuses that do not occur:**

- **Processor Space has no `Pending`** (resolved question 6). A space with only drafted matches stays
  `Booked` and stays inside the default filter. Three statuses is its complete set.
- **`Notified` has no UI transition in pass 1** (resolved question 2) and therefore no visual
  treatment here. It is not inert in the rules — it counts in both matched sums and blocks
  confirmation — so if a later pass introduces it, give it its own left-edge pattern rather than
  reusing Pending's.

### 3.2 The zebra stripe

Alternate cards take `$lms-card-zebra` (`#F5F5F5`) on white. LMS's own stripe is `#EEEEEE`; ours is
one step lighter, because a card carries two things a table row does not — a patterned spine and a
desaturated Cancelled state — and `#EEEEEE` under both muddies them. `#F5F5F5` keeps the family
resemblance and stays clear of the `#EEEEEE` used for blocked drop targets and drag placeholders.

Striping is by **position in the rendered list within a band**, not by record id — every card in a
band takes part, because every card in a band is one of that band's own records.

**The stripe belongs to the list and to nothing else.** The expanded card's match table used to take
`$lms-card-zebra` for its own even rows, which meant the drawer printed the list's stripe inside
itself and dissolved into the run of cards around it. It does not any more (§6.2): rows there are
separated by rules and by vertical column rules, and `$lms-card-zebra` appears on 52px card rows
alone.

---

## 4. The fill meter

The one place hue lives. It is the answer to "what is the operator scanning for", and it carries its
meaning in three redundant channels: colour, bar length, and the numeral beside it.

```
┌──────────────────────────────────────┐
│ [████████▓▓▓▓░░░░░░░░]  177          │
│  ↑excl    ↑incl  ↑track   ↑unmatched │
└──────────────────────────────────────┘
   66px meter          6px gap   40px numeral   = 112px block
```

| Property | Value |
| --- | --- |
| Meter track | **66** × 8px, `border-radius: 1px`, background `$q-track` (`#E0E0E0`) |
| Solid segment | width `matchedExclDraft / original`, colour `*-bar` |
| Draft segment | width `matchedInclDraft / original`, colour `*-bar` at `opacity: .45`, painted **behind** the solid one |
| Numeral | **40px** column, right-aligned, 15px/16 weight 600, tabular numerals, colour `*-ink`. 40 rather than 34 because the over-run case prints four characters (`-305`). |
| Gap | 6px |
| Total block | 112px, `flex: 0 0 112px` — `66 + 6 + 40`. **Keep the block at 112** however you split it internally: the header strip's Unmatched cell is 112 and the two must not drift. |

Both segments start at the left edge; the solid one is drawn over the alpha one, so the visible alpha
band is the draft delta. **Alpha, not hatching** — hatching belongs to Pending.

Segment widths clamp to `[0%, 100%]`. Reach for `matchedExclDraft` and `matchedInclDraft` from the
DTO; never derive one from the other.

**The four ink colours have exactly one definition**, the `quantity-ink` mixin in
`_card-geometry.scss`, included by the card, the expanded card and both dialogs. Phase 8 found why
that matters: the rules had lived inside the `card-shell` mixin, which the expanded card does not
include, so **an over-committed record's `-24` rendered in plain body text on the one surface that
spells the state out in words** — while two further copies sat in the two dialogs' own stylesheets. A
colour defined four times is a colour that comes to differ in three of them.

### 4.1 Which colour

Keyed on `quantityState` **and the side** — `Over` means opposite things on the two sides:

| `quantityState` | Processor Space | Livestock Availability |
| --- | --- | --- |
| `Under` | `$q-under-*` orange | `$q-under-*` orange |
| `Exact` | `$q-exact-*` green | `$q-exact-*` green |
| `Over` | `$q-over-*` blue — permitted and expected | `$q-pink-*` pink — **a bug flag** |

### 4.2 Past 100% — the over-run treatment

A meter cannot grow past its track, so the over state is drawn instead of measured:

1. Both segments sit at 100%.
2. The track gets `box-shadow: inset 0 0 0 1px <bar colour>` and `overflow: visible`.
3. A **3 × 12px over-run cap** in the bar colour sits at `top: -2px; right: -6px` — a tick past the
   track's right end, taller than the track, reading as "it went past".
4. The numeral is the negative unmatched figure, e.g. `-305`, in `*-ink`.
5. The literal label — **`Over-filled`** on a space, **`Over-committed`** on an availability record —
   appears on the card's line 2 whenever there is room, and always in the expanded card and in every
   dialog. The wording comes from the DTO's `quantityStateLabel`; do not compose it in TypeScript.

**The seeded example moved.** It was Processor Space #1 at 354 matched against 49 required
(`unmatched -305`), which was a 7× over-fill and looked like a seeder artefact. After the processor
mix was corrected the over-filled space is a different record with a plausible over-run — one space,
in the tens rather than the hundreds. Check the numeral column against a **four-character** figure
anyway: the width is set for `-305` and the seed no longer produces one, so nothing else will catch
it if that column narrows.

### 4.3 The pink state

Pink should never appear. Supply is hard-capped at the point of the drag (resolved question 1), so the
only route to it in pass 1 is Phase 7's edit form reducing `quantityAvailable` below what is already
matched — which is allowed, and warned about, because farmers really do sell stock elsewhere. Phase 8
must confirm pink renders correctly by forcing it, then confirm no ordinary flow produces it.

---

## 5. Type, spacing, radii, elevation

### 5.1 Type scale (Roboto)

| Role | Size / line | Weight | Colour | Notes |
| --- | --- | --- | --- | --- |
| Card primary (line 1) | 13 / 16 | 500 | `#212121` | |
| Card meta (line 2) | 11.5 / 14 | 400 | `#757575` | |
| Card numerals | 13 / 16 | 500 | `#212121` | `font-variant-numeric: tabular-nums` |
| Unmatched numeral | 15 / 16 | 600 | `*-ink` | tabular; the biggest number on the card |
| Micro-caps (column headers, band meta labels) | 10.5 / 12 | 500 | `#757575` | `uppercase`, `letter-spacing: .7px` |
| Band header label | 12 / 14 | 500 | `#757575` / petrol | `uppercase`, `letter-spacing: .6px` |
| Week rail label | 10 / 13 | 500 | `#757575` | `uppercase`, `letter-spacing: .5px`, wraps to 2 lines |
| Week rail tag | 8.5 / 11 | 700 | petrol / `#9E9E9E` | `uppercase` |
| Expanded-card field value | 12.5 / 16 | 400 | `#212121` | |
| Match table cell | 12.5 | 400 | `#212121` | |
| Column title | 13 | 500 | petrol / `#37393C` | |
| Dialog title | 18 / 24 | 400 | `#212121` | |
| Dialog body | 13.5 / 20 | 400 | `#212121` | |
| Form field value | 13 | 400 | `#212121` | |
| Form field label / hint | 11 | 400 | `#757575` | |
| Button | 13 | 500 | — | `letter-spacing: .3px`, **not** uppercase |

**Every quantity, price and date gets `font-variant-numeric: tabular-nums`.** Columns of proportional
digits do not line up, and this screen is columns of digits.

### 5.2 Spacing scale

`4 / 8 / 12 / 16 / 24`. Card internals use 7–8px; page-level gutters use 12–16px; dialog padding uses
Material's own 24px horizontal.

### 5.3 Radii

| Element | Radius |
| --- | --- |
| Card, band, column, frame, filter panel | **0** |
| Chip | 13px — a pill, half its 26px height |
| Fill meter track and over-run cap | 1px |
| Dialog / modal | **4px** (overriding M3's 28px — §1.1) |
| Snack bar | 4px |
| Button | 4px |
| Icon button, flip button, FAB | 50% |

Square corners are most of why this reads as LMS. Resist rounding cards.

### 5.4 Elevation

| State | Shadow |
| --- | --- |
| Card at rest | **none** — 1px `#E0E0E0` bottom rule instead |
| Expanded card's drawer | `0 3px 8px -3px rgba(0,0,0,.30)` — **the only shadow on the matching screen** (§6.2) |
| Card hover | **none** — colour only (`$lms-hover`) |
| Card dragging (CDK preview) | `0 8px 16px rgba(0,0,0,.24)` + `2px solid #00567E` outline |
| Dialog / modal | `0 11px 15px rgba(0,0,0,.20), 0 9px 46px rgba(0,0,0,.12)` |
| Snack bar | `0 3px 5px rgba(0,0,0,.20)` |

**One direction, one user (2026-09-07).** The drawer used to *sink* — two inset shadows, the screen's
one recess — while a hovered card *rose* 1px and band headers did neither. Three shadow directions
inside 200px of screen, all in the same soft grey, and they cancelled: nothing read as raised or
sunk, only as slightly smudged. The list is flat now, hover is a colour change, and the shadow is
spent on the one thing that has something to say with it — an open drawer standing out of the run of
52px rows. If a second user for shadow is ever proposed on this screen, it has to displace this one.

---

## 6. Card anatomy

### 6.1 Geometry

Collapsed card: **52px tall**, two lines.

```
6px  ┌────────────────────────────────────────────────────────────┬──────┐
spine│ line 1  (17px)   ← aligns to the micro-cap header strip    │ chev │
     │ line 2  (14px)   ← unlabelled meta                         │ 24px │
     └────────────────────────────────────────────────────────────┴──────┘
```

- **The height is set explicitly, not derived from padding** — otherwise a 1px change anywhere in the
  card changes the density target:

  ```scss
  .card  { display: flex; height: 52px; border-bottom: 1px solid #E0E0E0; }  // border-box
  .cbody { flex: 1 1 auto; min-width: 0; padding: 0 8px;
           display: flex; flex-direction: column; justify-content: center; gap: 3px; }
  ```

  52px includes the 1px bottom rule, so the content box is 51px. The two lines plus their gap are
  `17 + 3 + 14 = 34px`, centred vertically, leaving 8.5px above and below. Booked's 3px spine rather
  than 6px does not change the height — the spine is `align-self: stretch`.
- `line 1` items: `gap: 8px`, `align-items: center`.
- Chevron column: `flex: 0 0 24px`, centred, `#757575`.

**Line-1 column widths — identical on both sides, and the header strip must match them exactly:**

| Column | Width | Demand content | Supply content |
| --- | --- | --- | --- |
| Name | `1 1 auto`, `min-width: 0` | `plant` (`-` if blank) | `locationName` |
| Stock class | `0 0 96px` | `stockClass` | `stockClass` |
| Date | `0 0 50px` | `deliveryDateLabel` | `availableFromLabel` |
| Quantity | `0 0 40px`, right | `quantityRequired` | `quantityAvailable` |
| Meter block | `0 0 112px` | §4 | §4 |
| Chevron | `0 0 24px` | | |

**What the name column actually gets.** The fixed columns and gaps consume
`20 + 96 + 50 + 40 + 112 = 318px` plus five 8px gaps = **358px**. The card body's inner width is the
card width less the spine (6), the chevron (24) and its own 8px horizontal padding — so at the real
518px card (§8.2) the name column gets **114px**, and at the artboards' conservative 508px it gets
104px. Both are enough for `Alliance Group` and for most location names; longer values ellipse.

**The demand card's two names traded places (2026-09-08).** Line 1 led with `processor` from Phase 3
until then, and roughly 70% of the column is ANZCO (`SeedConfig.ProcessorMix`; APG say the real share
is higher), so the cell the eye starts on named most of the column in one word while the **plant** —
the thing that identifies the slot — sat on line 2. They are simply swapped: `plant` on line 1 under a
`Plant` heading, `processor` on line 2 where the plant was, 17px below. Same finding as the drag chip,
which stopped carrying `processor` alone the same day (§10.1); the chip has no line 2 and so composes
both into `ANZCO Kokiri`. The plant can be blank on a hand-built record, so line 1 falls back to `-`
rather than rendering an empty bold cell (§13).

The name column truncates with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. So
does the stock-class column — `Nat Beef - Premium` is the longest value and fits 96px at 13px Roboto
with a few pixels to spare; anything longer ellipses rather than wrapping. **Never let a card grow a
third line.**

Header strip: 28px, `#FAFAFA`, 1px `#E0E0E0` bottom rule, `position: sticky; top: 0` within the
column's scroll container, with a 54px leading pad (48px rail + 6px spine) so its cells sit over the
card cells.

Micro-cap header text: demand `Plant · Stock class · Delivery · Req'd · Unmatched`; supply
`Location · Stock class · Avail fr · Avail · Unmatched`.

**Line 2** is unlabelled meta, `gap: 8px`:

| Position | Demand | Supply |
| --- | --- | --- |
| Left, flexes and truncates | `processor · deliveryTime` (`-` if null) | `farmerName · transactionType` |
| Then, only when over | `Over-filled` in `$q-over-ink`, weight 500 | `Over-committed` in `$q-pink-ink`, weight 500 |
| Then | match count — `no matches` / `1 match` / `n matches` | same |
| Right | status icon + status label (§3.1) | same |

`transactionType` renders as `Finance Stock` / `Grazing Stock` / `Other` — never the enum spelling.

**When line 2 runs out of room**, drop from the right in this order and never wrap: the match count
goes first, then the over-state label, then the left-hand meta truncates with an ellipsis. The status
icon and its word are the last things standing, because status must be legible on every card in every
state. The left-hand meta is the only item that truncates; everything else is present or absent.

**Phase 7 addition — the cancelled-partner badge.** When any of a record's matches hangs off a partner
record that has been **cancelled**, a **solid `$lms-error` square sits behind the expand chevron**,
with the chevron's `title` naming how many and saying that the matches themselves are not cancelled.
Nothing is added to line 2, so the drop order above is untouched.

It is an addition to this section rather than something it specified, recorded here because §0 asks to
be told. Cancelling a record never cascades (Phase 7, 5.2), so a live match under a cancelled parent is
a normal state — and one nothing else on the row would reveal, since this card's own status, meter and
counts are all untouched by what happened on the other side.

**It is the one place hue means something other than fill, and that is deliberate** (Mark's direction,
2026-09-01, having first shipped as a muted grey glyph). What it marks is not a status — it is *work
outstanding* — and `$lms-error` is a semantic token that is no part of the quantity ramp, so the
meter's three colours are untouched. The chevron is the control marked because it is the one that opens
the table naming the match.

### 6.2 Expanded card

The collapsed row **stays exactly where it is** and the expansion opens below it, so nothing above the
pointer moves (Phase 3, 5.2). The chevron flips to `expand_less`.

**The drawer is a framed sheet, not another band of the list.** That is the whole of its treatment,
and it exists because an open card did not read as one object: the column is a run of white /
`#F5F5F5` striped 52px rows, and the drawer opened below one of them as four more bands of white /
`#FAFAFA` / white + `#F5F5F5`, at a 30px rhythm, with no boundary of its own. Its match table striped
with `$lms-card-zebra` — the list's own stripe. It was built out of the list's vocabulary, so it
dissolved into it.

**Five** devices say "different kind of thing". Four are neither a hue nor a ground; the fifth, the
filled rail, is the one exception and is argued for in its own bullet:

- **A frame.** 1px `$lms-rule-strong` `#BDBDBD` on all four sides — the leading one transparent since
  2026-09-09, see the spine below. Nothing else on this screen is framed, so a frame is unambiguous
  by scarcity alone, and `$lms-divider` would not do: it is the same weight as the rule under every
  card.
- **A rail, filled since 2026-09-09 — and it is the first of these devices to touch the row.** The
  drag grip's own 1px `$lms-divider` hairline, continued down the sheet's leading edge, with the
  sheet's content indented past it — so the drawer's first label, the sums, and the
  match table's `Qty` column all begin at **x=38**, where the card's own name begins (30px grip +
  8px `$card-edge`). Nothing inside the drawer used to line up with the row that owns it. The rail is
  `$expansion-rail` = **29px, not 30**: the card's grip paints its border *inside* its own 30px box,
  so the rule is the pixel at x=29, and the sheet's rail is positioned inside a 1px frame. Verified
  by pixel scan against the grip, in the running app — `gripRuleX` and the rail both on x=232,
  `cardNameX` and the sheet's first label both on x=241.

  Until 2026-09-09 every device in this section belonged to the *sheet* and `.card` carried no open
  state at all: the only thing that changed on the row when it opened was that its chevron flipped.
  So the part of the open object that still looked closed was the 52px row — the click target for
  closing it and the drop target for matching onto it. Ten answers were drawn in
  `Documents/open-row-lab.html`; this and the spine below are the two that shipped.

  The rail is **filled with `$open-rail` `#DDEAF1`, and so is the 30px grip on the row above it**, so
  an open card carries one unbroken stroke from the top of its row to the foot of its sheet. The grip
  is the right column to spend: it is the row's only always-visible cell carrying neither a status nor
  a quantity, so nothing had to be displaced to say "open". `$open-rail` is **not**
  `$lms-petrol-tint` — that is the current-week band's ground, and a card inside the current week
  would then have a grip the same colour as the header directly above it. It sits one step below the
  tint and one step above `$lms-drop-target`, so the column reads *open* `#DDEAF1` < *droppable*
  `#D1E1E8`: a card under the pointer is more urgent than a card that happens to be open.

  **The rule must not move**, and the fill is where that gets fragile. An absolutely positioned child
  is laid out against its ancestor's *padding* box, inside the sheet's 1px frame, and there is no
  global `box-sizing: border-box` in this app — so the fill is a **28px content width plus a 1px
  `border-right`**, totalling 29 and landing the rule on x=29, the pixel the grip's own border paints
  on. Written as a 29px box with a border it lands on x=28; the lab drew it that way and is a pixel
  out. Verified live: `gripRuleX` and `railRuleX` both 1133, `nameX` and the sheet's first label both
  1142.

  The grip's **hover** is restated for an open card — `$lms-hover` rather than the `$lms-surface` a
  closed card's grip uses, because `#FAFAFA` punches a grey hole in the column exactly where the
  pointer is. It has to out-weigh both `.grip:hover` and `.card:hover .grip`, the second of which
  would otherwise drop the glyph from petrol to muted grey: a downgrade under the pointer.
- **A spine, continued.** The record's own status spine runs down the sheet's leading edge at
  `left: 0` — 3px `$lms-divider` for Booked, 6px for everything else, hatched for Pending, dashed for
  Cancelled — so the open object's whole leading edge is one status-weighted stroke and its other
  three are the frame. The sheet's leading border goes transparent to let it through; two lines
  inside the same 6px would read as a seam of their own. It is positioned against the component
  host rather than the sheet, so it spans the drawer's full height including the frame, and it is
  derived in `CardExpansion` from the same `spineClass` the card calls, so the row's spine and the
  sheet's cannot disagree.

  **The card's own bottom rule goes transparent with it**, so the row and the sheet meet on the
  frame's top edge alone rather than on the frame *plus* a `$lms-divider` hairline. That second line
  was the seam — the same rule that separates any two cards, sitting between a row and its own
  drawer — and two lines there read as two objects.
- **A notch.** An 11px square rotated 45°, on the top edge, **centred on the chevron that opened the
  drawer** — `right: calc($card-edge + $col-chevron / 2 - 1px)`, the -1px being the frame, because
  the notch is placed from the sheet's padding box and the chevron from the card's outer edge. It
  says *which card this belongs to*, which before it was inferred from adjacency alone — the one
  signal that fails when two drawers are open in a column of near-identical bands. The rail and the
  spine now say the same thing from the leading edge; this says it from the trailing one, where the
  control that opened the sheet actually is. Verified live: chevron centre and notch centre both on
  x=801.
- **A shadow.** `0 3px 8px -3px rgba(0,0,0,.30)` on `.expansion`, and after §5.4's revision it is the
  only shadow on the screen. The sheet rises out of a flat list.

**And a sixth thing that is not a treatment at all: only one drawer is open per column** (see below).

The `.expansion` div is the sheet and it is **full-bleed**: the component host carries the open
animation and the continued spine, and nothing else. The row's own open state is one class,
`:host(.open)` on `SpaceCard` / `AvailabilityCard`, bound to the same `expanded()` the chevron's
`aria-expanded` reads, and its rules live in `card-shell` so both columns get them from one place. Its 1px `$lms-divider` bottom rule is gone with
the shadow change — a sheet that stands proud of the list closes itself, and a rule beneath it read
as one more of the rules between cards. There is no `$expansion-inset` and no `$leading-offset`
indent.

**Two further devices were tried and pulled, both within a day of shipping. Read this before adding a
third.**

- **A grey ground** (`#E8EAED`). Certainly separate from the white / `#F5F5F5` rows around it, and it
  read as **read only** — precisely how everything disabled on this screen recedes, from a greyed
  `Confirm space` to a past week's label. The drawer is the most interactive region on the card: it
  holds the only route to a match, and the record's own Edit and Cancel. It sits on `$lms-card`, the
  surface an operator associates with live content.
- **A gutter** — 10px of `$lms-surface` around the sheet. The right instinct and the wrong value:
  `#FAFAFA` between a white card above and a white or `#F5F5F5` card below is very nearly invisible,
  so it read as a gap where something was missing rather than as a ground the sheet sat on. Six
  alternatives were drawn (`Documents/expansion-lab.html`, gutter A–G: a grey tray, a top-flush
  version, sides only, a hanging indent, the card's own ground) and the conclusion was that the sheet
  needs none of them. The caption bar gives the block a top edge, the frame gives it four, and the
  gutter was the only device paying no rent.

- **A recess**, `inset 0 3px 5px -1px rgba(0,0,0,.16)` + `inset 0 -2px 4px -2px rgba(0,0,0,.10)`.
  Replaced by the outer shadow above, for the reason §5.4 now records: it was one of three shadow
  directions inside 200px and the three cancelled.
- **A sums caption bar**, `$lms-expansion-head` `#DFE4E8` over `$lms-expansion-head-rule` `#CCD2D7`.
  It separated the block by **value**, and value is the axis this screen has spent: eight named greys
  inside ten L\* points (`#FFF` card, `#F5F5F5` zebra, `#FAFAFA` surface, `#F0F0F0` band, `#EFEFEF`
  rule-soft, `#ECEFF1` th, `#E0E0E0` divider, `#DFE4E8` caption). With two or three drawers open the
  column read as one undifferentiated field of white, near-white and cool grey — which is the
  complaint the second lab was drawn to answer. The two tokens are deleted.

Separation is the four devices above, and **not one of them touches the ink**. That is the constraint
any future attempt has to meet: the drawer must stay on a live-content surface and must not spend
width or height saying so. **And it may not spend another grey** — there is none left to spend.

**`Documents/expansion-lab-2.html`** is the second lab: ten alternatives, live, side by side with what
shipped before them, with presets and a `cards open: 1 / 2 / 3` control (the count being the variable
that matters). Ideas 3, 5, 6, 8 and 0 were chosen from it on 2026-09-07 and are what §6.2 now
describes. The six that were not are still in the file with their costs and risks; read them before
proposing a fifth device.

**Only one drawer is open per column, and opening a card closes the other one on its side**
(`board/card-state.ts`). Every other part of this treatment is styling; this is the one part that
treats the problem as arithmetic. A column of 52px rows interrupted by two or three ~200px drawers
is a run of near-identical bands whatever the drawer is made of, and the count is the only variable
that removes the problem instead of decorating around it. **Per column, not per screen** — comparing
a Processor Space against an Availability record is the screen's central task, so a supply drawer
opening must never close a demand one. Comparing two records on the *same* side is a scroll either
way. Guarded by `board/card-state.spec.ts`, whose real subject is the per-column half: clearing the
whole set on open is shorter code and would pass any test that only ever opens one column.

It still has **three** parts in this order — **the sums come first**, and that is the reason the block
reads top-down as answer-then-detail. What changed on 2026-09-08 is what is *in* the first two:

1. **The sums strip, as the drawer's anchor** — `padding: 8px 39px 6px $card-edge`, **no ground**, 1px
   `$lms-rule-soft` bottom rule, `gap: 26px`. **Figure over label**: the value at **20px/600
   tabular**, the micro-cap label beneath it, broken over two deliberate lines
   (`Quantity Matched` / `excl. Draft`). Three cells, **left-aligned**, with `Quantity unmatched`
   alone on the trailing edge.

   The 39 is the card's own 40px trailing run (`$card-edge * 2 + $col-chevron` — `.card`'s padding,
   `.cbody`'s padding, and the 24px chevron between them) less the sheet's 1px frame, **not** the 10px
   the drawer's other edges keep. Only the unmatched cell reaches it, and reaching it is the point:
   that figure lands directly beneath the meter numeral on the row above. Write it as its terms;
   §16.10 is the standing warning about spelling this run as a literal.

   - `Quantity Matched excl. Draft` → `matchedExclDraft`, as a **fraction**: `29 of 77`.
   - `Quantity Matched incl. Draft` → `matchedInclDraft`, likewise, with `· 30 drafted` after it.
   - `Quantity unmatched` → `unmatched` in `*-ink`, followed by the DTO's `quantityStateLabel`.
   - The denominator is `quantityRequired`, or `quantityAvailable` on the supply side. Everything hung
     off a figure — the ` of 77`, the drafted count, the state word — rides at 12.5px/400 in
     `$lms-text-muted`, so the figure keeps the size to itself.
   - `30 drafted` is `draftedQuantity` off the DTO: the two sums' difference, **not** to be composed
     client-side, and the figure the `Confirm space` gate below turns on.

   20px is the one place on the screen where a quantity is set larger than a card's own figures, and
   it is deliberate — these are the answer the drawer was opened for, and until they were set at a
   size that says so the block had no focal point at all: everything in it sat between 10.5 and 13px,
   so the eye drifted across grounds looking for one. The type scale was the axis that had never been
   spent (§5.1 has no step above 15px on this screen); value was the axis that had been spent eight
   times over.

   **Those are the labels.** APG-facing wording, never the DTO field names — and **both** sums carry
   their qualifier, which is a change. The excl-draft one used to read simply "Quantity Matched",
   because that is what a processor or farmer would see; but they are the two roles that never see the
   other sum, and on an APG-only screen an unqualified "Quantity Matched" sitting beside a larger
   figure labelled "incl. Draft" read as the grand total when it is the subset.

   Two faults were fixed here on 2026-09-08 and both are the kind that survive review:

   - **`Quantity required` / `Quantity available` and `Quantity unmatched` were printed twice.** They
     had a right-aligned cell each in the field row below, and they were verbatim copies of two cells
     on the **collapsed row 40px above** — same figures, same order, with the meter between them.
     Every review read past it because the eye does not compare a 12.5px caption to a 15px numeral it
     has already accepted. `required` survives as each sum's denominator; `unmatched` survives once,
     in this strip.
   - **The sums were printed bare.** `59` and `29` with nothing to divide into send the eye back up to
     the collapsed row for the 77. The requirements specify these two sums **four times** — both list
     views and both record views — and every one says the same thing about placement: *"displayed as
     read-only beside the Quantity Required value"*. So the fraction is not a flourish; the spec asked
     for the denominator and Phase 3 dropped it. Note also that the matching screen's own field list
     (`Matches – Create`) includes **neither** sum: they are imported from the record views, which is
     exactly why they arrived without the context those views give them.

   **Two other layouts were tried the same day and rejected.** Read these before proposing a third,
   because both were defensible on paper:

   - **One row**, prose leading and all four figures trailing, to spend the drawer's unused width
     instead of its height. It **wrapped**: four micro-cap labels of this length plus a line of notes
     exceed the column, so the figures dropped to a second line and the drawer opened on its notes
     instead of on its numbers.
   - **Two blocks with all four figures grouped on the trailing edge**, prose beneath. It did not
     wrap, and the alignment against the collapsed row's `Req'd` and `Unmatched` columns was real —
     but a strip whose content all sits at one end reads as the fragment of a row rather than as the
     drawer's head, and the eye enters the sheet from the leading edge, where the card's own name is.
     The unmatched figure stays right on its own account, because it is the one figure the row above
     also ends with.

   The lesson both attempts point at: **the strip's height was never the problem the drawer had.**
   Removing the duplicated pair took ~35px out of it, and that was the whole of the win available.

   **`Documents/sums-strip-lab.html` draws ten further ideas against this strip, plus one variant**
   — the alignment fixes that keep the wording, the wording cuts that keep the layout, three changes
   of shape and two changes of what is shown — each in six records including nothing-matched,
   over-filled, four-digit and a supply record — and each under a **quantity-state** control that
   swaps Under / Exact / Over while keeping the record's identity, so `0 Filled` in green and
   `-9 Over-filled` in blue (and `Over-committed` in pink on the supply side) can be judged without
   changing six other things at once. Read it before proposing an eleventh, and note what it is *not*
   about: the two rejected layouts above are deliberately absent from it.
2. **Field row** — `padding: 8px 39px 6px $card-edge`, 1px `$lms-rule-soft` bottom rule,
   `gap: 4px 24px`. Each field is a micro-cap label over a 12.5px value — the other way round from
   the strip above, where the figure leads because the figure is what is being read. Empty values
   render `-`. **It holds no quantities**; see item 1.
   - *Demand:* `Notes`.
   - *Supply:* `Availability details`, `Transaction type`, `Notes`.
3. **Match table** — an LMS table, and it must read as a table rather than as more rows.
   `th`: 26px, micro-caps, ground `$lms-expansion-th` `#ECEFF1` — the only ground left inside the
   sheet, and with the caption bar gone it is simply the table's own head, 1px `$lms-divider` bottom
   rule.
   `td`: 30px, 12.5px, 1px `$lms-rule-soft` bottom rule, hover `$lms-hover`. **No row zebra** — see
   §3.2. Columns are separated by **vertical rules** instead (`th + th` in `$lms-expansion-rule`,
   `td + td` in `$lms-rule-soft`): every other structure on this screen is horizontal, which is
   exactly why a vertical reads instantly as "table". Numerics and dates right-aligned with tabular
   numerals.

   | Side | Columns |
   | --- | --- |
   | Demand | `Qty` (right) · `Farmer & location` · `Stock class` · `Match status` · `$/kg` (right) · `Transport` |
   | Supply | `Qty` (right) · `Processor & plant` · `Stock class` · `Delivery` (right, with the delivery time in muted text after the date) · `Match status` · `$/kg` (right) · `Transport` |

   Both sides carry `Transport`, because Phase 3 §2.4 and §3.4 both ask for it. On the supply side
   the delivery time rides inside the `Delivery` cell in muted text (`08-09-26 PM kill`) rather than
   taking a column of its own — seven columns fit 508px, eight do not.

   `Stock class` is always the **counterparty's** class, in `#757575`. Both vocabularies appear on the
   screen at once by design — the two lists not lining up is the point, and a mismatched pair must
   never be presented as an error.

   Match status uses `schedule` for `Drafted`, `check_circle` for `Confirmed`, in `#757575` with the
   status word beside it. **No hue.**

   A missing price renders `no default price` in `#9E9E9E`, never a blank and never `$0.00`.

   With no matches: one full-width row, `#9E9E9E`, 12px — *"No matches yet — drag a livestock
   availability record onto this space."* / *"…drag this record onto a processor space."* Deliberately
   empty, not broken.
4. **Actions** (Phase 6 onwards) — `padding: 10px 10px 8px` (`$expansion-actions-padding`; the
   bottom was 0 while the drawer had no edge of its own, and 0 puts the buttons on the frame). On a
   Processor Space, a
   `Confirm space` button, enabled from the DTO's `canConfirm`. **When disabled it says why**, beside
   it, in card-meta type: *"Needs at least one confirmed match and no drafts."* A control that greys
   out for unstated reasons is exactly what makes non-technical users think the app is broken.

   **Phase 7 added `Edit` and `Cancel` here, on both sides**, and the supply card gained this row for
   them — it had none before. They are text buttons rather than stroked ones, muted and `$lms-error`
   respectively, so the debug scaffolding never outranks the real action beside it. They are here and
   not on the 52px row for the reason the per-match affordance is: the row has no width to give, and
   §16.10 pins its trailing edge — at 40px since 2026-09-07.

   **In the match table, a counterparty cell whose record has been cancelled carries a `block` glyph
   and the word `cancelled` in a solid `$lms-error` box**, white on red. Same reason as the chevron
   badge above, and the same exception to the no-hue rule: the match is still live, still needs
   cancelling by hand, and this is the row that says which one.

Expand state is per-card, independent, and held for the session (Phase 3, 5.1).

### 6.3 Column identity — because the columns flip

Position cannot identify a column (Phase 4, 5.4). Five channels do, none of them competing with the
meter:

1. **Column header** — **48px** (40px until Mark asked for breathing space around its controls; the
   header holds a 26px `+ Add` and a 26px `Filtered` chip). Note what the change actually turned out
   to be: `.chead` had no `flex: 0 0 auto`, and `.column` is a column flex box whose list has an auto
   basis running to the full height of its cards, so the deficit was shared out in proportion to
   every basis and the header was squashed to its **27px min-content height** on every viewport. The
   declared 40 had never been in force, and neither would 48 have been. Both numbers on the header —
   the height and the flip's centre line — depend on that one line. Sticky, with a 3px top rule: **petrol `#00567E`** on demand, **`#37393C`**
   on supply. The title takes the same colour. This is the shell's own brand blue on a header, not a
   hue on a card, so it does not collide with §3.
2. **Lead glyph** — a works/factory outline on demand, a location pin on supply, in the header.
3. **Header strip labels** — `Plant / Delivery / Req'd` versus `Location / Avail fr / Avail`.
4. **Noun set, everywhere** — `Required`/`Filled`/`Over-filled` versus
   `Available`/`Committed`/`Over-committed`, on cards, in dialogs and in the DTO's own
   `quantityStateLabel`.
5. **The pink state** exists only on supply, the blue only on demand.

Column header contents, left to right: lead glyph · title · `showing n of m` in micro-caps (right of
the title, pushed right) · the `Filtered` badge and `Reset` when away from default (§9) · the debug
`+ Add` stroked button.

---

## 7. Stock class carries no hue — and now no badge either

**Stock class does now carry a behaviour (2026-09-09), and still no ink.** §10.2's "Filter on drag"
narrows the far column by stock-class compatibility while a card is held, so the class finally decides
something on this screen — but it decides *which rows are present*, and it adds no colour, no badge
and no glyph to the rows that are. Nothing below changes.

**Stock class carries no hue.** `Data/stock-class-configs.csv` ships a hex colour per class, and
Phase 8 §3.1 asks for it — but resolved question 16 commits hue exclusively to the quantity meter, and
the roadmap's resolved questions outrank a phase document. Twenty-two saturated swatches on a screen
whose entire scanning task is a three-colour quantity ramp would destroy the ramp. The CSV's
**`color`** column is therefore **not used on the matching screen**, and Phase 8 inherits that
decision rather than re-deciding it.

**The 20px monogram tile that replaced the colour is gone too (2026-09-08, Mark's call), and with it
the whole idea of abbreviating a stock class.** It was a `#EEEEEE` square, circle or diamond carrying
two upper-case letters — `PR`, `LM`, `GU` — with the *shape* standing for the species, a channel
neither status nor quantity used. It came off the screen in three steps, and the reason is the same
one each time: **wherever there was room for the badge, there was room for the words.**

| When | Where it came off | Why |
| --- | --- | --- |
| §16.10 | both card rows, and the header strip | line 1 spells the class out in full two cells along, so the tile said it twice in the row's tightest 20px |
| §11.1, §11.4 | the quantity prompt and the match modal | both dialogs name the class in each block's sub-line |
| this section | the drag chip (§10) | the last surface, and the one with no room for a class name — see below |

**The chip is the case worth recording,** because for a day it was the argument for keeping the tile:
200px holding three fields, no room to spell `Nat Beef - Premium` out, so the monogram was the only
thing in the operator's hand saying what species it held. What settled it is that **nobody could read
it.** A two-letter abbreviation of a vocabulary the operator meets a dozen times a day is legible; one
of a vocabulary of twenty-two, half of them cattle grades that differ in the second word, is a puzzle
mid-gesture — and a puzzle in the one place a drag cannot afford one. The species shape does not
rescue it either: three shapes over twenty-two classes distinguishes sheep from cattle, which is
rarely the question. **The chip is two fields now** — the name and the head count — and the record it
came from is still on screen, unmoved, under the `origin` treatment.

**And note what happened to the "no room" argument hours later:** the chip grew to 232px to fit
`ANZCO Kokiri`, so the room was there for the asking (§10.1). That is not a reason to reconsider the
tile. The 20px bought back nothing that could be read; the 32px bought the plant, in words.

**So: no abbreviation of a stock class exists anywhere in the application.** Every place a class
appears — card line 1, both dialogs' sub-lines, the filter chips' menus, both record forms — it
appears in words. If a surface is ever too tight for the words, that is a sign the surface is carrying
too much, not that it needs a code.

---

## 8. The content area, week bands and the rail

### 8.1 How the content area sits inside the shell

The shell is fixed and already built: 52px petrol top bar with the hamburger, `LMS` wordmark and the
`# DEV ENVIRONMENT #` flag; 190px sidebar with its petrol header block, full nav list (`Matching`
active) and grey version footer. The top bar and sidebar **do not scroll**.

Inside the content area, top to bottom:

| Element | Height |
| --- | --- |
| ~~Shared search strip~~ | **Not built** — see §12.1. The 52px went back to the list. |
| Columns wrapper | fills; `padding: 0 12px 12px`, `gap: 16px` |
| — Column header | 40 |
| — Filter row | 40 |
| — Micro-cap header strip | 28 (sticky) |
| — Scrolling list | fills |

The two columns scroll **independently**. The flip button is a 28px circular icon button on the
gutter between them, at the top, `z-index: 2`.

### 8.2 Width arithmetic at 1366px

```
1366  viewport
-190  sidebar
- 24  content padding (12 + 12)
- 16  gutter between columns
=1136 / 2  =  568px per column
- 2   column border (1 + 1)
- 48  week rail
= 518px of card
```

**The real card at 1366px is 518px wide. The artboards are drawn at 508px** — deliberately 10px
conservative, so anything that fits on the canvas fits in the build with room to spare. The only
column that changes is the flexing name column (§6.1). Both columns must stay intact and usable at
1366 × 768 (Phase 8 §7.1).

### 8.3 Density target — hold yourself to this

```
768  viewport
- 52  top bar
- 12  bottom padding
- 40  column header
- 40  filter row
- 28  header strip
= 596px of list
```

**Phase 4 raised this from 544px by not building the shared search strip** (§12.1): the 52px it had
reserved went back to the list, which is worth about one more card per column.

596px is the list's *total*, and band chrome shares it. Since every record is drawn once and there
are no sub-headers, the only chrome inside the list is the 30px band headers — and, in a week with
nothing in it, a 44px empty row. A realistic scroll position shows two or three headers, so 60–90px.
The honest figure is:

| Visible band chrome | Cards per column |
| --- | --- |
| none (one long band) | 11 |
| two band headers (60px) | 10 |
| three headers, or two plus an empty week (90px+) | 9 |

**9 to 11 cards per column, so 18 to 22 across both** — against LMS's ~20 rows. That is the family
resemblance, and it is checkable: **if the screen ends up showing four cards per column, the design
has failed and the card must shrink, not the target.**

**One caveat for Phase 3 specifically.** The 40px filter row belongs to Phase 4. Phase 3 must
nevertheless **reserve it** — render the 40px band empty, or leave the gap — so that the density it
measures is the density that ships. Measuring 11 cards in Phase 3 and losing one in Phase 4 is how a
target quietly stops being met.

### 8.4 Week bands

One band per week commencing Sunday, always in date order, soonest first. Bands are the spine of the
screen: sorting reorders cards **inside** a band and never dissolves it (Phase 4, 4.3).

Each band is a flex row of `rail` + `band-body`.

| Part | Spec |
| --- | --- |
| Band top rule | 1px `#E0E0E0`; **2px `#00567E`** for the current week |
| Band header | 30px, `padding: 0 10px`, background `#F0F0F0` (`#E8F1F6` current week) |
| Band header label | `Week of 16 Aug` — 12/14 micro-caps; `#757575`, petrol for current, `#9E9E9E` for past |
| Band meta | right-aligned, 11px, `#757575` / `#9E9E9E` — `7 spaces · 1,674 head` |
| Empty band | header still renders, then a **44px** row, `#9E9E9E`, 12px, on `#FAFAFA`: `- no processor spaces this week` on demand, `- no livestock availability this week` on supply |

**Band header text is composed around the DTO's `weekCommencingLabel`.** That label ships as
`dd-MM-yy` (`23-08-26`). The friendlier `Week of 23 Aug` form the band header wants is a **second
formatter added to `NzTime`** — never formatted in TypeScript, and never built by constructing a
JavaScript `Date` from the ISO value. Phase 1's build log calls this out explicitly; Phase 3 must add
`NzTime.WeekBandLabel` (or similar) in C# and ship it on the DTO.

### 8.5 The rail

| Property | Value |
| --- | --- |
| Width | 48px, `flex: 0 0 48px` |
| Padding | `8px 6px` |
| Right border | 1px `#E0E0E0` |
| Background | `#FAFAFA`; `#E8F1F6` current week; `#F0F0F0` past week |
| Label | `Week of` / `16 Aug` on two lines, 10/13 micro-caps; petrol **700** for the current week |
| Tag | `This week` in petrol, or `Past` in `#9E9E9E`, 8.5/11 weight 700, 4px below the label |
| Sticky | the label block is `position: sticky; top: 0` inside the band |
| Leader | a 1px dotted petrol line down the rail at 45% opacity, from below the label to the band's end, showing the band's extent |

**The band header does not stick — only the rail label does.** Two stuck elements would eat 58px of a
596px list, and the rail already answers "which week am I in". If Phase 3 reaches for virtualisation,
check the sticky rail first; plain rendering is expected to be fine at ~50 records per side.

### 8.6 Past, current, future

- **Current week** — 2px petrol top rule, `#E8F1F6` rail and header, petrol bold label, `This week` tag.
- **Past** — `#F0F0F0` rail, `#9E9E9E` label and meta, `Past` tag.
- **Future** — plain `#FAFAFA` rail, `#F0F0F0` header.

**De-emphasis sits on the band chrome, never on the cards.** Fading a past card would collide with
Cancelled's desaturation — the one treatment that legitimately drains a card — and a past week's
records are still live and still matchable. Past weeks are de-emphasised, not hidden (Phase 3, 1.5).

---

## 9. The backlog — past bands, and where each column begins

> **The Phase 2 canvas is stale on this section and was not regenerated.** Its `CarryOver` artboard,
> and the carry-over rows visible on `WeekBands` and `Main`, show a design that no longer exists.
> Phase 3b removed it (resolved question 17) and rewrote this section; where the canvas and this
> document disagree, this document wins — as §0 says it always does. Nothing else on the canvas is
> affected: the card, the meter, the spines, the strip and the geometry are unchanged.

### 9.1 The problem

A Processor Space belongs to one day. An Availability record becomes available on a date and stays
available until it is used up — so a record from three weeks ago with unmatched quantity is still
matchable *this* week, and an operator working this week has to be able to find it.

An earlier draft answered that by **reprinting** the record, muted, at the top of every later week.
That was rejected: it duplicated records on screen so every total needed a double-counting guard, it
made dragging ambiguous about which instance was picked up, and scattering one record across five
weeks made the amount of outstanding supply impossible to read at a glance. **Do not reintroduce
it.**

### 9.2 The answer: every record once, and a backlog you scroll up into

**Every record appears exactly once**, in the band of its own date. Nothing is reprinted, echoed or
summarised into a later week. Three things make carried-over supply findable anyway:

1. **The default filters hide finished work** (§12.2) — spaces `Status = Booked`; availability
   `Status ∈ {Booked, Pending}` with `unmatched > 0`. So whatever sits **above the current week** is
   a genuine backlog of unfinished business rather than a history.
2. **The leading empty bands are trimmed** (§9.3), so the top of the column is immediately
   meaningful.
3. **Each column opens scrolled to the top**, so the oldest outstanding record is the first thing an
   operator sees. The list reads as a priority order before it reads as a calendar, and nothing
   scrolls to "today".

The **height of the region above the current week is the signal**: it shows at a glance how much
unfinished supply has accumulated. As records are matched and confirmed they fall out of the default
filter, and the backlog burns down.

Two consequences, both deliberate — do not "fix" either:

- **There is no horizon cap.** A record never matched and never cancelled stays at the top
  indefinitely and the column grows upward without limit. Outstanding supply *should* nag; cancelling
  the record is the intended remedy. No cut-off, no "archive older than N weeks".
- **The `unmatched > 0` clause stays.** It drops more than Confirmed records: a `Pending` record with
  all its supply allocated but some matches unconfirmed also leaves the column. On a *matching*
  screen that is right — there is nothing left to match. The backlog means "supply still to
  allocate", not "everything unfinished".

### 9.3 Where the list begins and ends — trimmed per column

**Each column spans the weeks its own surviving records occupy**: from the week of its earliest to
the week of its latest. The runs of empty bands at each end are not rendered.

| Rule | Why |
| --- | --- |
| Each column trims **independently** | A shared start week hides a past-dated Booked space older than the earliest availability record, with nothing on screen to say so. Neither column's start may be decided by the other's data. |
| Only the runs at **each end** go | An empty week *between* two populated weeks still renders its header (§8.4): a gap in the calendar is information. Trimming both ends is not the same as dropping every empty band. |
| A column may **end before the current week** | Changed in Phase 4, overturning an earlier rule that the run always reached today. Filtering the demand column to one delivery week left a stack of empty headers under the only band holding anything, which reads as missing data. The `Past` tag on every past band, and its absence on every future one, still says which side of today a record falls on. |
| A column with **no records at all** shows the current week alone | Rather than render nothing. Its empty-band row (§8.4) then says the week is empty. |
| The trim is **recomputed, never cached** | Filtering rebuilds the board, and both ends move when a filter changes which records survive. |

**The two columns will often start at different weeks, and their rails will show different weeks at
the same vertical position.** That is expected and correct — they scroll independently and each trims
to its own data. **Do not add scroll synchronisation to compensate**; locking two lists of different
lengths together would make one of them lie about which week the operator is in.

The calendar itself still comes from the server (`GET /api/week-bands`): an ordered, gapless, labelled
run of Sundays. Trimming is choosing where to start reading that array — an index, not date
arithmetic — so no `Date` is constructed in TypeScript. Week generation must not move into the
client.

### 9.4 A past week band

Past bands are **de-emphasised but fully usable**. They hold live, draggable records — that is the
entire point of the backlog — and must never read as disabled, greyed out or archived.

| Element | Past | Current | Future |
| --- | --- | --- | --- |
| Band top rule | 1px `#E0E0E0` | **2px `#00567E`** | 1px `#E0E0E0` |
| Band header fill | `#F0F0F0` | `#E8F1F6` | `#F0F0F0` |
| Band header label and meta | `#9E9E9E` | petrol, and the rail label bold | `#757575` |
| Rail | `#F0F0F0` | `#E8F1F6` | `#FAFAFA` |
| Rail tag | `Past` in `#9E9E9E` | `This week` in petrol | none |
| Rail leader line | not drawn | dotted petrol | dotted petrol |
| **The cards themselves** | **unchanged** | unchanged | unchanged |

**De-emphasis sits on the band chrome and never on the cards** (§8.6). Fading a past card would
collide with Cancelled's desaturation — the one treatment that legitimately drains a card — and would
suggest the record is no longer actionable when it is the most actionable thing on the screen.

There is no separate "backlog" heading, divider or summary strip. The `Past` tag on the rail and the
2px petrol rule opening the current week are the only markers, and they are enough: everything above
that rule is the backlog.

### 9.5 Under filters (Phase 4)

- The trim is computed from the **currently visible** records, so filtering the oldest record out
  moves the column's first band forward. Both columns re-trim independently on every filter change.
- **The availability column has no "week commencing" filter.** Filtering supply to a single week
  would hide exactly the older unmatched records the backlog exists to surface. Processor Spaces keep
  theirs, because a delivery date genuinely is a single-week event.
- A record excluded by a filter is simply not drawn. There is no second place it could appear.

---

## 10. Interaction states

| State | Treatment |
| --- | --- |
| **Card hover** | background `#F5F9FB`, **`cursor: pointer` over the body and `cursor: grab` over the grip**. **Nothing resizes** — a growing row makes a list of ten cards jitter under the pointer. **Superseded 2026-09-07 (§16.12):** the hover-only six-dot glyph in the right gutter, and the whole-body drag handle it hinted at, are both gone. The card now has *two* pointer paths and each states which it is: a permanent 30 × 51px grip first in the row drags (with the status spine painted over its leading 6px, so the glyphs line up whatever the status), and the rest of the row expands. |
| **Card active / pressed** | background `#EEEEEE`, no movement |
| **Dragging (CDK preview)** | **1:1 scale** — no tilt, no shrink; the operator is aiming at a 52px row and a transformed preview lies about where the pointer is. `0 8px 16px rgba(0,0,0,.24)` + `2px solid #00567E` outline, `cursor: grabbing`. Escape cancels. |
| **Drag placeholder** (the gap left behind) | a flat `#EEEEEE` silhouette at the **same 52px height**, carrying the record name at 55% opacity. Same height matters: the list must not reflow mid-drag. **Not a dashed outline** — dashed already means Cancelled. |
| **Valid drop target** | `2px solid #00567E` outline inset, background `#E8F1F6`, a `+` badge left of the chevron. The whole opposite column also takes a `#F6FAFC` wash the moment a drag starts. |
| **Invalid target — same column** | **nothing changes at all.** No outline, no shake, no message. Dropping within a column is a no-op by specification (Phase 5, 1.3), and an error for a gesture that simply does not apply teaches an operator to fear the screen. The only cue is `cursor: no-drop`. |
| **Blocked target — no unmatched quantity** | background `#EEEEEE`, a `block` glyph, `cursor: not-allowed`, `matTooltip="No unmatched quantity"`. Distinct from the same-column case because here the gesture *would* apply — the record is simply full. |
| **Auto-scroll zone** | 48px at the top and bottom of each column, marked by a petrol gradient veil to 14% opacity while dragging. Must scroll **through** band headers, not only within a band. |
| **Disabled control** | Material's own disabled styling, **plus a stated reason** beside it wherever the reason is not obvious (see §6.2's Confirm). |
| **Focus** | Material's own, exactly as it arrives. Do not remove it; do not build on it. |

### 10.1 The drag chip

**232 × 30px, `#FFFFFF`, 2px `#00567E`, 3px radius, `0 6px 14px rgba(0,0,0,.24)`.** Not a copy of the
card: Phase 5's preview was the row at full 518px width, so the thing in the operator's hand covered
the row they were aiming at. **Two fields, and the pill:**

| Cell | Demand | Supply |
| --- | --- | --- |
| Name — `1 1 auto`, `min-width: 0`, ellipsis | **`processor` + `plant`** — `ANZCO Kokiri` | `locationName`, or `-` |
| Head count — `0 0 auto`, `#757575`, tabular | `quantityRequired` | `quantityAvailable` |
| Outcome pill — under the chip, right-aligned, petrol on white | `Match 8 head`, **only when it disagrees with the head count above it** (§11.2's sibling: a pill repeating the chip has cost a glance and said nothing, so its presence *means* the drop is partial) | same |

**The demand name is the whole slot, not the processor (2026-09-08).** It was `processor` alone, and
about 70% of the seeded column is ANZCO's — APG say the real share is higher still — so the chip
named most of the column with one word. The plant is the part that identifies the slot. Card line 1
gets away with the processor alone because line 2 carries the plant 17px below it; the chip has no
line 2. One composition, `card-chrome.spaceName`, shared with both dialog titles, so a record with no
plant yet cannot produce `ANZCO ` with a trailing space.

**The 232px is measured, not chosen** (headless Chrome, 12px/500 Roboto): 142.8px for
`Alliance Group Dannevirke` — the longest name either column can produce, against the supply side's
130.1px `Spring Creek Agriculture`, which was already clipping at 200px — plus a 6px gap, 55.8px for
a tabular `1180 head`, plus 8px of padding a side. 220.6px, rounded up for cushion. **Do not add a
third field**: what makes the chip work is that it is under half the card it is dragged over, and the
next field would come out of the name.

### 10.2 Filter on drag (2026-09-09)

**A toggle in the top bar, left of `Reset demo data`. While a card is held, the other column shows
only the stock classes that could take it.** Grab a Lamb availability record and the demand column
drops from 33 booked spaces to the 8 lamb ones; grab a Bulls space and the supply column drops from
42 records to 15. Off by default, persisted with the rest of the view preferences, and cleared by
`Reset demo data`.

| Piece | Treatment |
| --- | --- |
| **The toggle** | §14.1's white-on-petrol chrome button, 26px, and the same shape as the reset beside it — one selector, not a copy, because two chrome controls 1px apart look like a mistake. **Filled white with petrol text while on**, `aria-pressed`, glyph `filter_alt` / `filter_alt_off`. A toggle whose only ON cue is its wording is a state nobody notices they are in. It is **not** marked as debug scaffolding: unlike the reset and `+ Add`, this is a real feature of the screen. |
| **The narrowed column** | nothing is added to the cards. The list simply holds fewer of them, the bands re-trim (§9.3), and `showing 4 of 47` states it — the *loaded* total never changes, because the aid hides records and does not unload them. |
| **The header chip** | the §12.3 `Filtered` chip's shape in petrol on `#E8F1F6`, reading `Lamb only`, and it **takes that chip's place** rather than adding a fifth item to a 596px header. `Reset` stands down with it; it was never clickable mid-gesture. Petrol is identity and no part of the quantity ramp, so it borrows no meaning from the meters below it. |
| **Narrowed to nothing** | §13's third empty state. Reachable in the demo: Alliance Group books `Deer` and the supply vocabulary has none. |

**It hides; it never refuses.** No drop is blocked on stock class, and no endpoint knows the aid
exists. The two vocabularies do not map onto one another and the operator is the one who judges
compatibility, so a pairing the table has not thought of costs one click, not a dead end.

**The pairings live in `Apg.Domain/Matching/StockClassCompatibility.cs`** and reach the client only as
tags on each record (`stockClassGroups`); the client's whole contribution is asking whether two tag
lists intersect. An unrecognised class carries *every* tag, so it fails towards being visible — a
record that cannot be seen cannot be matched. Lamb and Mutton are deliberately not interchangeable:
different products, different schedules ($7–9 against $4.50–5.80 in the seed), and neither vocabulary
has a class spanning them.

**It narrows on the pointer move that starts the drag — not on the press — and that timing is not a
matter of taste.** Two things pin it from either side:

- **Not the press.** A grip is a drag handle on a row whose commonest action is expanding it, so it
  gets clicked by mistake constantly. This narrowed on `pointerdown` until 2026-09-09, and every one
  of those clicks emptied half the far column and filled it back in — which reads as the screen
  glitching, in the one place §10 insists nothing may move under the pointer.
- **Not `cdkDragStarted`, either.** Every card is its own `cdkDropList`, and CDK measures *all* of
  them inside the handler that crosses the drag threshold. Narrow any later and every surviving card
  sits somewhere CDK does not believe it is: the pointer enters nothing, no row lights up, and the drop
  lands nowhere.

So it happens on the **same pointer move CDK starts the drag on, one listener earlier** — CDK's own
threshold (`CDK_DRAG_CONFIG.dragStartThreshold`, 5px, `|dx| + |dy|`), with `ApplicationRef.tick()` to
settle the DOM inside the handler before CDK measures. The release hangs off `pointerup` rather than
`cdkDragEnded`, because a grip pressed and let go without a drag emits nothing from CDK at all.
`drag/drag-narrowing.ts` carries the full account.

**Nothing keyboard-driven is designed, on purpose.** A mouse is assumed available at all times
(resolved question 14): no keyboard drag path, no "press space to lift" hint, no drag-handle focus
ring, no screen-reader live region for the drag. Its absence is a decision, not an oversight to be
helpfully corrected. Material's controls remain keyboard-operable because they arrive that way.

Motion: 120ms `ease-out` for expand/collapse and hover; Material's own durations for dialogs.
Quick, and never blocking the next action.

---

## 11. Dialogs

### 11.1 Quantity prompt (on drop)

`MatDialog`, **560px**, 4px radius. Title names the act and the slot —
**`Draft match: ANZCO Kokiri`**. **`Draft`, not just `Match`**: pressing `Create match` produces a
`Drafted` match, and the dialog that comes next (§11.4) says `Confirm match: …`. The two said only
`Match` until 2026-09-07 and left the operator to work out which of the two acts they were being
asked for.

**The head count is not in the title** (changed 2026-09-07, Mark's call, same pass that added the
processor). It read `Draft match: 132 head` and followed the quantity field as it was edited — a
figure restated 200px above the field it came from. The processor and plant are the thing the operator
*cannot* recover once the dialog covers the board, on a screen where a dozen ANZCO spaces differ only
by plant and date.

**Body, in order:**

1. **Livestock Availability summary block**, an arrow, then the **Processor Space summary block** —
   stacked in that order, because that is the way the stock moves: supply into demand. The arrow is
   muted `#757575`, 20px, and `aria-hidden` (the DOM order already reads top to bottom).
   Each block: `#FAFAFA` fill, 1px `#E0E0E0` border, **its own status spine on the left**, then
   - micro-cap kicker (`Processor Space` in petrol / `Livestock Availability` in `#37393C`) with the
     status in micro-caps at the right;
   - the record's name at 13.5/500, then the stock class in `#757575`. **No stock-class tile** —
     see below;
   - a row of micro-cap fact pairs: demand `Delivery · Time · Required · Unmatched`; supply
     `Available from · Transaction type · Available · Unmatched`. Unmatched in `*-ink` weight 500.
2. **Three fields in a row**, all `appearance="fill"`:
   - `Quantity matched` — 148px, suffix `head`, hint `Default 132 · max 142`
   - `Price per kg` — 148px, prefix `$`, suffix `/kg`, hint
     `Default for Alliance Group · Cattle · w/c 23-08-26`
   - `Transport company (optional)` — flexes, `mat-autocomplete`, hint `Can be added later`

**There is no stock-class note.** This section used to specify a bordered info row naming both classes
and saying the two lists do not map; it is gone from both dialogs (2026-09-07, Mark's call). The
classes are still on screen beside each record's name, and the judgement is the operator's whether or
not a paragraph says so.

**And no monogram tile either** (same day, same call). §16.10 took the tile off the card rows and the
header strip as match noise; these two dialogs and the drag chip were the only places it survived, and
a badge beside each name in a dialog that also spells the class out in words was the last place it
read as meaningful. The drag chip kept its tile for one more day on the grounds that it had no room
for the words — **and then lost it too (2026-09-08), which took the monogram out of the application
altogether.** §7 carries why.

**Actions:** `Cancel` (`mat-button`) · `Create match` (`mat-flat-button`, petrol).

**Rules the dialog enforces:**

- Default quantity = `min(unmatched_space, unmatched_availability)`, from the server.
- Minimum 1. Maximum = **the availability's** unmatched quantity. **No maximum on the space side** —
  over-filling demand is allowed and produces the blue state.
- **Explain the cap inline; never silently clamp.** On hitting it, the field's label and underline go
  `#BA1A1A` and the hint becomes an error:
  `Capped at 142 — Totara Kauri Trust has 142 head unmatched`.
- The default price is keyed on the **Processor Space** stock class (resolved question 7). If Phase 5
  reads the availability side's class the lookup will look plausible and be wrong.
- Where no default price exists, say so plainly rather than showing a blank or a zero.

### 11.2 Refusal — no dialog at all

When `min(unmatched, unmatched) < 1`, **nothing opens.** Opening a dialog to disable its button makes
the operator work to learn they cannot proceed. Refuse at the point of the drop, in a `MatSnackBar`:

> **There is no unmatched quantity**

That string is exactly `MatchCreation.NoUnmatchedQuantity` from the domain. The client renders the
constant; it does not compose the sentence.

### 11.3 Creation confirmation

A `MatSnackBar`, brief and non-blocking, with **undo** — a mis-drag is the most common mistake this
screen will produce:

> `Match created — 132 head, Alliance Group Wallacetown`  **UNDO**

Snack bar: 48px, `#37393C`, white 13.5px text, action in `#91CDFB` uppercase 13px/500 with `.5px`
tracking, 4px radius.

### 11.4 Match management modal

`MatDialog`, **640px**. Title names the act and the slot: **`Confirm match: ANZCO Rangitikei`** while
the match is `Drafted`, because confirming it is what the operator opened it to do and what the filled
button offers; **`Edit match: ANZCO Rangitikei`** past `Drafted`, where there is nothing left to
confirm and the dialog is an editor. Read with §11.1's `Draft match: ANZCO Kokiri`, the pair of
titles says which of the two acts each dialog is asking for.

**The match id is no longer in the title** (changed 2026-09-07, Mark's call). `Confirm match #3` named
a row in the `Matches` table, which no operator sees and no other screen shows; the processor and plant
name the slot in front of them. Both parent blocks still carry their own record ids in their kickers,
so nothing identifying has left the dialog. `spaceName()` in `card/card-chrome.ts` composes the two
words for both dialogs, and drops the trailing space when a record has no plant.

1. **Both parent records, read-only, stacked exactly as §11.1 stacks them** — Livestock Availability,
   the arrow, then Processor Space — full width, with the arrow's 4px margins holding them apart. Each
   block is §11.1's plus the side glyph, the record id in the kicker (`Processor Space #3`), a sub-line
   carrying the stock class (`Lamb · delivery 01-09-26 · no time set`), and the fact pairs
   `Originally required`/`Originally available` and `Quantity unmatched` with its state label.

   **This supersedes "side by side, each `flex: 1 1 0`, 10px apart"** (changed 2026-09-07, Mark's
   call). The two halves had 300px each to hold a record's identity, its sub-line and two fact pairs,
   and most of them truncated; and a match confirmed should read the way the same match was drafted a
   moment earlier. The arrow is the reason the stack is not merely a narrower layout — it says which
   way the animals travel, which a left/right pair only implied.
2. **Three editable fields**: `Quantity matched` (150px, min 1), `Price per kg` (150px),
   `Transport company` (flexes, autocomplete).
3. **The ceiling is spelled out in the quantity field's own hint** —
   *"Ceiling 472 = the availability's 177 unmatched **plus this match's own 295**."* — and becomes that
   field's `mat-error` when the entry goes past it.

   **This supersedes the "micro-note under the fields" this section used to specify** (changed
   2026-09-01, at Mark's direction, after the note and the field had spent a phase disagreeing about
   which owned the sentence). The field a sentence sits in is what says which field it is about, and
   the ceiling constrains exactly one. There is no note under the row any more; printing it in both
   places would say the same thing twice, 10px apart.

   **A wrapping hint needs two things, not one**, and this is where every dialog in the app got caught:
   `subscriptSizing="dynamic"` on the field *and* `height: auto` on the subscript wrapper. Material's
   hint wrapper is `position: absolute` inside a fixed-height subscript by default, so `height: auto`
   alone sizes to nothing and the wrapped text paints over whatever follows. Wrapping margins are 8px
   a side, against Material's default 16px.

**No stock-class note here either.** This section used to carry §11.1's bordered paragraph, with the
warning that `Cows` on a space against `Cow` on an availability record looks like a typo and is not.
The vocabularies still do not align — `Cattle` against `Mixed Cattle`, `Nat Beef - Ultra` against
`GFNB ultra`, and neither side is validated against the other — but by the time a match exists the
operator has already made that judgement at the prompt, and the paragraph only crowded the dialog.
Both classes are still on screen, in each block's sub-line — which is now the only place this dialog
states them, the monogram tile having come out the same day (see §11.1) and off the whole screen the
day after (§7).

**Footer — destructive left, constructive right:**

| Match status | Left | Right |
| --- | --- | --- |
| `Drafted` | `Cancel match` (`mat-button`, `#BA1A1A`) | `Close` · `Save changes` · `Confirm match` (flat petrol) |
| `Confirmed` | `Cancel match…` (`mat-button`, `#BA1A1A`) | `Close` · `Save changes` |

Delete is offered **only** at `Drafted`, needs no reason, and is not a cancellation (resolved
question 3). Cancel-with-reason is offered only past `Drafted`.

**Both buttons read `Cancel match`, and the ellipsis is the only difference** (changed 2026-09-08).
The label went `Delete draft` → `Undo match` (2026-09-07, Mark's call) → `Cancel match`, and the last
step is the one that matters: `Undo` and `Cancel` sat in the same footer slot, in the same red, for
the same intent — getting rid of this match — and an operator who has just been shown one of them has
no way to know the other exists, so the two words read as two mechanisms rather than one act at two
stages of its life. They never appear together (`canDelete` is `Drafted`-only, `canCancel` is
everything past it), so a shared verb costs nothing and the **ellipsis** carries the real
distinction: `Cancel match` acts on the press, `Cancel match…` asks for a reason first — which is
exactly what the ellipsis means everywhere else in the application. Resolved question 3's
distinction is unchanged underneath: the draft is *removed*, the confirmed match is *kept with its
reason*. That difference is record keeping, not intent, and the footer is not where it needs saying.

It keeps the `#BA1A1A` destructive treatment: the row is gone for good. **The snack says
`Match cancelled` in both cases** — a confirmation that reports a different verb from the one pressed
makes an operator wonder whether something else happened.

The snackbar `UNDO` action on the drop snack (§11.1) is untouched: that one *is* an undo, in the
standard snackbar idiom, offered seconds after the drag and taking the same `DELETE` path.

### 11.5 Editing a Confirmed match — prompt first

A nested dialog, **440px**, with a warning glyph in `$lms-error`:

> **Change a confirmed match?**
> Match #6 is **Confirmed**. Changing its quantity from 354 to 300 head will change what Alliance
> Group Wallacetown expects on 28-08-26.
> `Keep 354` · `Change to 300`

The prompt names the consequence in the processor's terms, not the field's. Quantity and transport
edits prompt at `Confirmed`; nothing prompts at `Drafted`.

### 11.6 Cancel with reason

`MatDialog`, **480px**. A `mat-radio-group` of exactly three options, 36px rows:

- Change from Agent/Farmer
- Change from Processor
- Internal decision by APG

**No warning panel** (removed 2026-09-08). It used to sit under the radio group — `$lms-attention-bg`
behind a 3px `$lms-error` left border — spelling out that a cancelled match disappears from the
matching screen, that pass 1 has no Match list view, and that neither parent record is touched. All
three are still true; none of them is worth a paragraph in front of every cancellation, and the last
two are pass-1 scaffolding facts that belong in `DEMO.md`, not in an operator's way. The dialog is now
its title, the three reasons, and the two buttons.

Actions: `Keep match` · `Cancel match` (`mat-flat-button`, `#BA1A1A`).

---

## 12. Filter and sort bar

### 12.1 Shared search strip — not built, and not to be reinstated casually

> **Phase 4 decided against it, with Mark, and reclaimed its 52px** (§8.1, §8.3). What this section
> specified was a full-width `appearance="fill"` field with a stacked `× Clear` / `^ Hide` pair,
> searching record text across processor, plant, location, farmer and stock class.
>
> Three reasons it went:
>
> 1. **The per-column filters cover it.** Everything it would have searched is already a filter on the
>    column that owns it, and the filter says what it is doing where the search would not have.
> 2. **It would have been the one control filtering both columns at once**, which is the ambiguity
>    §12.2 avoids by giving each column its own controls — and it would have muddied per-column
>    `Reset`, which cannot clear a field it does not own.
> 3. **Nothing later needs it.** Every other "search" in Phases 5–8 is a type-ahead picker inside a
>    dialog or form (transport company, location), not this strip.
>
> **Requirement 2.3's "searchable" location filter is not this.** It is a type-ahead *inside* the
> supply column's Location control, narrowing the ~300 location **options** so one can be picked. It
> is built, and it lives in §12.2's `More`.
>
> If a later phase wants record-text search back, it is a new decision — and it costs a card per
> column.

### 12.2 Per-column filter row — 40px

Each column owns its own controls, so a filter can never be ambiguous about which side it applies to.

```
[ Status: Booked ▾ ] [ Stock class: All ▾ ] [ Processor: All ▾ ] [ More ▾ ]   ↓ Soonest
```

- **Status**, **Stock class** and one **"who"** filter are chips, 26px, 12px text, 13px radius,
  rather than selects — they must show their current value without being opened. Selected chips:
  `#E8F1F6` fill, 1px petrol, petrol text. The third chip is `Processor` on demand and `Location` on
  supply; three chips plus `More` and the sort control is what fits a 40px row at 1366px, and a
  fourth would start ellipsing the values it exists to show.
- **More** holds what did not fit: demand `Plant · Delivery week (W.C.) · Has unmatched quantity`;
  supply `Transaction type · Has unmatched quantity`. The chip reads `More (2)` with the count of
  filters **inside it** currently restricting the list — the promoted chips show their own state on
  the row, so counting them here would say a filter was hidden when it is in plain sight. The supply
  column opens on `More (1)`, because its `Has unmatched quantity` default really does hide records.
- **`Has unmatched quantity` is worded identically on both sides**, because it is the same rule —
  `unmatched > 0` — with a different default: off on demand, on on supply.

  **As built (Phase 4), `More` opens a menu with a submenu per field rather than a second row.** An
  inline second row costs 40px of a 596px list — a card per column, which §8.3 exists to protect —
  and a `mat-select` opened inside a `mat-menu` is an overlay inside an overlay. Every control in the
  row is therefore the same shape: a chip that shows its value, and a menu behind it. Sort is its own
  right-aligned control, as the line below says, and not a field inside `More`.
- **The supply side has no week filter, deliberately** (§9.5, resolved question 17). Filtering supply
  to one week would hide the older unmatched records the backlog exists to surface. Demand keeps its
  `Delivery week`, because a delivery date genuinely is a single-week event.
- **Sort** is right-aligned micro-caps with a direction glyph. Sorting operates **within** bands.
- **Plant narrows to the chosen processor**, and the **demand stock-class list narrows to that
  processor's own vocabulary** — the demand lists are processor-specific. The supply side never offers
  a demand stock class or vice versa.

**Defaults, visible on the chips:**

| Column | Default |
| --- | --- |
| Processor Spaces | `Status = Booked` |
| Livestock Availability | `Status in (Booked, Pending)` **and** `Unmatched > 0` |

Both defaults show on the chip face, so nobody concludes a record has vanished when it is merely
filtered out.

### 12.3 Counts, and away-from-default

- The count lives in the column header in micro-caps: `showing 44 of 50`. Every record is drawn once,
  so the shown figure is a straight count of what is on screen.
- A column away from its defaults grows two things in its header: a `Filtered` chip in
  `$lms-attention-ink` (`#5C5F62` border and text, info glyph) and an explicit `Reset` text button.
  **No hidden or timed resets.** The chip is deliberately **hueless** — "you have filtered this column"
  is information, not a warning, and every amber worth using collides with the quantity ramp's orange.
- When filters exclude everything, show §13's empty state with a one-click way out — never a blank
  column.

### 12.4 Flip

A 28px circular `mat-icon-button` with a `swap_horiz` glyph, on the gutter between the columns, on
white with a `#BDBDBD` ring. It is **centred on the column-header row** — `top: calc(1px + $column-header-height / 2)`
with a `translate(-50%, -50%)`, so it reads as part of that row rather than as a circle floating near
the top of the seam. The number is read from `_card-geometry.scss`, never typed: a hard-coded offset
is how the circle and the header came to disagree in the first place. Purely presentational: no filter, sort, expansion or selection
state is lost, and the preference persists to `localStorage`. Column identity is carried by §6.3.

---

## 13. Empty and edge states

Every empty state names **what** is empty and offers a way out. An absent value is `-`, matching the
existing app. Nothing ever shows a raw `undefined`, `NaN` or `Invalid Date`.

| State | Treatment |
| --- | --- |
| **No results after filtering** | 44px vertical padding, centred: a 34px `filter_alt_off` glyph in `#9E9E9E`, `No processor spaces match these filters` at 14/500, **the active filters restated** in card-meta type, then `Clear filters` (flat) + `Reset to default` (text). "No results" without the reason is how an operator concludes the app is broken. |
| **Empty column** | same layout, the column's own glyph, `No livestock availability yet`, *"Records appear here as farmers and agents submit them."*, and the debug `+ Add a record` stroked button. Distinct from the filtered case — nothing to clear. **Built in Phase 8** (`column/empty-column.ts`); Phase 4 and Phase 7 both parked it. It is checked *before* the filtered case, and its condition is "nothing loaded for this side", not "nothing shown". |
| **Loading** | **Phase 8.** The same centred block, a spinning `progress_activity` glyph and one line: *"Loading processor spaces and livestock availability…"*. Before Phase 8 the screen drew nothing until the week bands arrived, so a cold start's first paint was indistinguishable from an empty data set. |
| **API unreachable** | **Phase 8.** The same block with a `cloud_off` glyph in `$lms-error`, the sentence naming the port, the command that starts the API, and a **Try again** button that re-issues all three reads. Colour on the glyph and the border only — `$lms-error` is semantic and no part of the quantity ramp. |
| **Narrowed to nothing** | **2026-09-09.** §10.2's aid has left the column empty: the card in hand has no compatible stock class on this side. The same centred block, a `filter_alt_off` glyph, `No livestock availability for Deer`, and one sentence naming the two ways out — let go, or switch the aid off. **No control**, because the pointer is down and a button cannot be clicked mid-gesture; and **not** the filtered-empty panel, because no filter of the operator's is hiding anything and `Clear filters` would send them after a cause that does not exist. Checked before the filtered case, like the empty column. |
| **Empty week band** | §8.4: the header renders, then a 44px `- no processor spaces this week`. |
| **Record with no matches** | §6.2's table placeholder. Deliberately empty, not broken. |
| **Missing default price** | `no default price` in `#9E9E9E`. Never blank, never `$0.00`. |
| **Over-filled space** | §4.2 — outlined blue track, over-run cap, negative numeral, literal `Over-filled` label. |
| **Over-committed record** | §4.2 in pink, literal `Over-committed` label. |
| **Fully confirmed record** | solid petrol spine, filled tick, green meter at 100%, numeral `0`. Note it drops out of the default `Unmatched > 0` filter — correct, not a bug. |
| **Long values** | a 30-character location, a four-digit quantity and a wordy note must not break the card. Name and stock-class columns ellipse; notes wrap inside the expansion only. |

---

## 14. Debug affordances (Phase 7)

The `+ Add` controls are demo scaffolding, not the farmer's real submission flow, and must never be
mistaken for it. Treatment: `mat-stroked-button`, 26px, 12px text, 3px radius, petrol text on white
with a `#BDBDBD` ring — visibly lighter than any primary action on the screen, and grouped in the
column header rather than floating as a FAB. They follow the columns when flipped.

Note the deliberate departure from LMS here: the existing app uses a circular petrol `+` FAB at the
top right of the content area for create. Ours does not, precisely so these read as tooling rather
than as the product's create action. If Phase 8 wants the FAB back for a real create flow, that is a
new decision, not a regression.

**As built (Phase 7), the marking is doubled.** The button carries a `construction` glyph and the
labels are `+ Add space` / `+ Add record`, with a `title` that says in words that it is a demo tool.
The **dialog behind it opens with a `# DEMO DATA TOOL #` ribbon** — the shell's dev-flag `#CCD457` on
`#37393C`, 6px × 10px, with one line of prose: *"Debug scaffolding for demos — not the farmer or agent
submission form."* That colour is the top bar's own, and it already means "this is not the real thing"
in this application; it is not a card, a status or a quantity, so it does not touch §3's rule. One
`app-debug-ribbon` component serves both forms, so Phase 8 has a single place to restyle.

The `Edit` and `Cancel` controls in a card's actions row (§6.2) are the same scaffolding and are
deliberately quieter than `Confirm space` beside them.

### 14.1 Reset demo data (Phase 8)

**In the top bar, immediately left of the `# DEV ENVIRONMENT #` flag.** This section did not specify
it and §12.1 left it as the one unhoused screen-level control; Phase 8 placed it there, with Mark.

Three reasons, in order of weight: the flag beside it already means "this is not the real thing" in
this application, so the control inherits the reading rather than having to argue for it; a shell
control costs the 596px list nothing (§8.3), where the alternative cost about half a card per column;
and a reset replaces the **whole database**, not one screen's data, so the matching screen is not
where it belongs.

Treatment is §14's, in the one variant that works on a petrol ground: 26px, 12px text, 3px radius, a
`restart_alt` glyph, **white text and a white 55%-alpha ring** rather than petrol-on-white — because
petrol on petrol reads as nothing. It is deliberately quieter than the flag: the flag is the
statement, this is the tool.

**It confirms first** (Phase 8, 1.2). The dialog carries the same `app-debug-ribbon` both record forms
carry, and lists what is lost rather than summarising it — matches, records, and both columns' filters
— because "this cannot be undone" is a claim and the list is the evidence for it. On confirm: re-seed,
then clear the stored preferences, then reload the page. That order matters: a failed reset must not
take the operator's filters with it.

The reload is deliberate. A refetch would leave behind everything that is not fetched — expanded
cards, a drag in flight, an open dialog, the in-memory half of the preference store — and a reset that
leaves a card expanded on a match that no longer exists is worse than one that takes a second.

**Its neighbour is not scaffolding.** §10.2's `Filter on drag` toggle (2026-09-09) sits immediately
left of the reset and shares this button's shape exactly — same 26px, same ring, same type — because
two chrome controls a pixel apart look like a mistake rather than a distinction. What separates them
is the toggle's filled ON state, which the reset has no equivalent of and needs none. It carries **no
demo-data marking of any kind**, and must not acquire one: it is a real feature of the matching
screen, and the ribbon and the `construction` glyph mean something specific in this application.

### 14.2 The record forms' layout (2026-09-08)

Both debug forms are **one two-column grid** — `web/src/app/matching/record/_record-form.scss`, shared,
so the demand and supply dialogs cannot drift. Three rules, and each of them replaces something the
first cut got wrong:

1. **The column count is fixed at two, not derived from the width.** The forms were a wrapping flex
   row off a 180px basis, so the 640px dialog fitted *three* columns and `Availability details` — a
   textarea with a two-line hint — landed in a 180px cell. Only a window narrow enough to clip the
   dialog to Material's 80vw default produced the two the layout was drawn for, which is why the
   screenshots that found this look right in the pairing and wrong in everything else. Two columns at
   ~290px hold `Alliance Group Dannevirke` and a farm name; three at 180px hold neither. Below 560px
   of viewport they stack to one.
2. **`align-items: start`. A field's box is its own height.** A flex line stretches its items, so the
   field *without* a hint grew its filled ground to match the field *with* one: `Processor` ran ~20px
   taller than `Stock class` beside it — fill, focus underline and all — with dead grey below its
   value, and `Transaction type` grew to the full height of the textarea and hint opposite it. A
   filled field's ground is a control-sized object; stretching it says the control is that size.
3. **The gutter is the grid's — 14px between rows, 16px between columns — and the subscript is not a
   gutter.** Every field used to reserve `min-height: 18px` of subscript whether or not it had a hint
   to put there, which meant a field *with* a hint spent that 18px on the words and butted straight
   into the row below, while a field without one held 18px of nothing. A hint belongs to the field
   above it, not to the space between two rows.

Two consequences worth knowing. `.f-notes` / `.f-details` had asked for `flex: 1 1 100%` at
specificity 0,1,0 while `.fields mat-form-field` answered `flex: 1 1 180px` at 0,1,1 — **the
full-width rule never applied at all**, and Notes only *looked* full width because it was the last
item on a line with room to grow; the span rules are now scoped `.fields` so they win. And `.fixed`,
the read-only cell an edit uses for processor and stock class (requirement 4.2), takes its height from
`--mat-form-field-container-height` and a 16px inset from Material's own filled padding, rather than
repeating the 52 that `styles.scss` sets — it has to *be* a field's height, not happen to match it
until someone changes the density row.

`Documents/browser-checklist.md` carries the geometry claims. They are **unrun**.

---

---

## 15. Strings — use these exactly

Wording is part of the design, and non-technical users are the audience. No jargon that isn't APG's
own: "Quantity Matched", never `matchedExclDraft`. On the expanded card **both** sums are qualified
(`excl. Draft` / `incl. Draft`), because APG is the only role that sees both and the bare title is the
processor's and farmer's name for the excl-draft one.

| Where | String |
| --- | --- |
| Refused drop | `There is no unmatched quantity` |
| Space over-filled | `Over-filled` |
| Availability over-committed | `Over-committed` |
| Space quantity states | `Under-filled` / `Filled` / `Over-filled` |
| Availability quantity states | `Under-committed` / `Fully committed` / `Over-committed` |
| Expanded sums | `Quantity Matched excl. Draft` and `Quantity Matched incl. Draft`, each as a fraction: `29 of 77` |
| Expanded drafted figure | `Drafted` |
| Cancellation reasons | `Change from Agent/Farmer` · `Change from Processor` · `Internal decision by APG` |
| Column counts | `showing 44 of 50` |
| Away from default | `Filtered` / `Reset` |
| Band header | `Week of 23 Aug` |
| Empty value | `-` |
| Confirm-space reason when disabled | `Needs at least one confirmed match and no drafts` |

**The six quantity-state strings live in `QuantityStateLabels` in C# and arrive on the DTO as
`quantityStateLabel`.** Render what you are given. A phase may reword them **in that one file**.

---

## 16. Things the canvas shows but does not explain

1. **Line 2 is unlabelled on purpose.** Only line 1 aligns to the header strip. Labelling both would
   need two header rows and cost 28px of the 596px list.
2. **The card's `title` attributes** carry the full stock-class name on the `.sclass` cell (which
   truncates at 96px) and `708 matched / 1003 incl. draft of 1180` on the meter, so a truncated value
   is always recoverable by hover. Nothing on the card is *abbreviated* any more — the monogram tile
   that was went out on 2026-09-08 (§7).
3. **The match count on line 2 is live matches only.** Cancelled matches are excluded from the DTO's
   `matches` array entirely (resolved question 4) — but they are still correctly excluded from both
   sums. Do not blend those two facts.
4. **`Unmatched` comes from the incl-draft sum, not the excl-draft one.** Both are on the DTO and it is
   easy to reach for the wrong one; a draft has already spoken for the stock.
5. **The artboards showing Confirmed and Cancelled Processor Spaces are constructed**, because when
   they were drawn the seed held nothing but `Booked` spaces. **It no longer does**: after Phase 4 the
   seed carries 34 Booked, 4 Confirmed and 2 Cancelled, so both spines can now be checked against real
   records. A Confirmed space is only seeded where the domain agrees it could be confirmed, and one
   Cancelled space deliberately keeps its live matches, because cancelling never cascades. There are
   still no cancelled *availability* records.
6. **The seed used to group processors by week** — week 16-08 all ANZCO, 23-08 all Alliance, 30-08 all
   SFF — which is what the artboards show. That was a bug, not a design intention: the seeder picked
   `Processors[i % 3]` while the week came from `i % 6`, and with three processors and six weeks the
   two aliased exactly. Fixed after Phase 4; the mix is now ANZCO 70% / Alliance Group 20% / SFF 10%,
   shuffled, so a week holds several processors. **Nothing may assume either arrangement.**
7. **The current week in every artboard is w/c Sunday 2026-08-23**, with bands running 16-08 (past)
   through 20-09. Bands and colours will land differently against a reseeded database; the geometry
   will not.
8. **Both columns' scroll containers are the `.list` element**, below the sticky header strip — not the
   page. The header strip sticks to the top of that container, and the rail label sticks within each
   band inside it.
9. **The header strip has two leading offsets and they are not interchangeable.** Inside a week band a
   card's tile sits at 54px from the column's left edge (48px rail + 6px spine), so the strip's leading
   pad is 54px. On the canvas's standalone card sheets there is no rail, so those use a 6px pad. Phase
   3 only ever needs the 54px form; the 6px form exists because artboards 2, 3, 6 and 10 show cards
   outside a band. Getting this wrong is invisible in code review and glaring on screen — it was in
   fact wrong in the first cut of the canvas, in exactly the artboards meant to demonstrate the
   alignment.
10. **The trailing edge matches too, at 40px — and this item was WRONG until 2026-09-07.** It read:
    *"at 32px. The card spends 8px of body padding then a 24px chevron; the strip spends a 24px
    spacer cell then 8px of cell padding."* Both halves are arithmetic over the same two numbers, so
    they looked like they agreed. They did not: `.strip` is a flex row with `gap: $col-gap`, and the
    gap before `.s-chev` is real, so the strip has always spent **40px** — 8px padding + 8px gap +
    24px cell — against the card's 32. `Unmatched` therefore sat **8px left of the numerals beneath
    it**, from Phase 3 until the card was given a `padding-right: $card-edge` and the two became 40
    each. Measured live in the running app after the fix: the card's meter block and the strip's
    `.s-meter` both end on x=781.

    Two things are worth taking from it. The first is that this is exactly the failure item 9 warns
    about — *invisible in code review and glaring on screen* — and it survived four phases of review
    precisely because the doc's own arithmetic was the thing being checked against. The second is
    that it was found while implementing something unrelated (§6.2's notch needed the chevron off the
    card's edge), and it was found by **measuring pixels in a browser**, which is the one pass no
    test in this repo can do. `Documents/browser-checklist.md` exists for this reason.
11. **~~The stock-class tile is not in the 17px line-1 height.~~** Moot since the tile came off the
    card rows (§16.10) and out of the application entirely (§7): the 20px box that overflowed the
    17px line by 1.5px a side no longer exists. The point it was making does survive it — the card
    height is set explicitly rather than summed from its parts (§6.1), which is what made the
    overflow harmless and is still what keeps a 51px content box from being redefined by whatever the
    tallest thing in the row happens to be.
12. **The grip is a real cell, and the leading offset now says so (2026-09-07).** §10 originally gave
    the drag affordance as a six-dot glyph appearing on hover in the body's right gutter, with the
    *whole card body* as the `cdkDragHandle`, and item 10 above was the reason it was positioned
    rather than laid out. On screen that read backwards: every card offered a grab cursor across all
    508px of a row whose commonest action is expanding it, and expanding it meant finding the 24px
    chevron at the far end. Mark asked for the two gestures to be separated and for the drag target to
    be a large one, so the glyph became **a full-height 30px cell, the first in the row**, carrying
    Material's `drag_indicator`, always visible, with a 1px rule on its trailing edge. The body below
    it is now the expand target, `cursor: pointer`, and the chevron stays as the focusable control with
    the `aria-expanded` state.

    **The spine is painted over the grip's leading 6px rather than laid out beside it**, and that is
    the load-bearing half. The grip's first cut *followed* the spine, whose width is status-dependent —
    3px for Booked, 6px for everything else (§3.1) — so the column of glyphs zig-zagged by 3px down
    the list, which is precisely the misalignment this whole geometry exists to prevent. Out of flow
    (`.card > .spine { position: absolute }`, scoped to the card so `status-legend.scss` can still
    include the bare `spines` mixin) it costs the row no width, and the grip reserves 6px of padding
    for it so the glyph sits at one x on every card, Booked or not.

    The consequence item 10 warns about is real and is paid deliberately: the strip's leading pad is
    now **30px grip + 8px padding = 38px** (`$col-grip + 8px` in `matching-column.scss`), spine
    included, and those 30px come off the name column, the only one that flexes. `$leading-offset` is
    gone with the spine's cell — the strip was its only reader, and adding it back would double-count
    the 6px. The trailing edge is untouched at 32px, because the gutter the six-dot glyph used to sit
    in was reserved space and never a cell: giving it up returned the row nothing and moved nothing.

---

## 16a. Where this knowingly diverges from LMS

Phase 8 has to judge whether the finished screen "reads as part of LMS". Four things will differ, all
deliberately, and it is better that the list is written down than rediscovered as bugs:

1. **The status spine has no precedent anywhere in LMS.** Status in the existing app is plain,
   uncoloured text — no bar, no icon, no pattern, on any row of any of the four screenshots. The spine
   is a new visual device, sanctioned by resolved question 16: hue was already committed to the
   quantity ramp, so status needed a channel of its own. Held next to the PNGs this is the single most
   visible addition. It is not a regression.
2. **The filter chrome is a fifth of LMS's footprint.** In the Killsheets and Purchases screenshots
   the search field plus the row of underline selects occupies on the order of 190–200px before the
   column headers begin; Killsheets alone shows eight filter fields. This design budgets **40px per
   column and nothing else** — Phase 4 dropped the 52px search strip as well (§12.1) — and defers
   everything past Status and Stock class behind "More". That is a measurable departure, taken because
   the cards need the vertical space (§8.3) and reversing it would cost two or three cards per column.
3. **Chips are an idiom LMS does not use.** All four reference screens filter exclusively through
   underline selects with floating labels. The Status and Stock class chips are new. They are still
   themed Material components, so nothing reads as a foreign framework, but the idiom is an addition —
   taken because those two filters must show their current value without being opened.
4. **The column header strip has a fill, a rule and sticky behaviour.** LMS's column headers sit
   directly on the page background as plain grey text with no fill and no rule beneath. Ours get
   `#FAFAFA`, a 1px bottom rule and `position: sticky`, because unlike a paginated table our list
   scrolls and the header has to survive it.

5. **Sorting is a control, not a column header.** LMS sorts by clicking a column header, which then
   carries the arrow — `DATE ↓` in the Purchases and Killsheets screenshots. Ours is a right-aligned
   sort control on the filter row, and the micro-cap strip is not clickable. **Found in Phase 8's
   comparison against the PNGs and recorded rather than fixed**: the strip's cells are 40–112px and
   several would not hold a label plus an arrow, sorting here reorders cards *within* week bands
   rather than the whole list so a header arrow would overstate what it does, and Phase 4 owned the
   sort control. It is a fifth deliberate divergence, not a defect — but it is the one a
   pixel-for-pixel comparison notices next, so it is written down here with the other four.

Everything else — the blues, Roboto, `-` for empty, `appearance="fill"` form fields, square corners,
zebra striping, the muted micro-cap headers, the deliberate refusal to reuse LMS's create FAB for debug
tooling — is carried straight from the screenshots. Phase 8 held the finished markup and tokens against
all four PNGs and found nothing else off-family: the shell is faithful down to the user's name in the
sidebar header, the version and copyright block, and the inert nav list in its original order.

---

## 17. Checklist for Phase 3

- [ ] `density: -2` and the 4px dialog radius applied in `web/src/styles.scss`.
- [ ] Colour tokens from §2 added alongside the Phase 0 tokens, as SCSS variables **and** CSS custom
      properties.
- [ ] Header strip column widths (§6.1) match the card's line-1 widths exactly, both sides.
- [ ] Collapsed card measures 52px and never grows a third line at 508px.
- [ ] ~10 cards visible per column at 1366 × 768 (§8.3). Measure it.
- [ ] Fill meter: two segments, alpha for the draft delta, over-run treatment defined in §4.2.
- [ ] Status spines exactly as §3.1. No hue on status; no pattern on the meter.
- [ ] No stock-class abbreviation anywhere: every class in words, on the cards, both dialogs, the
      forms and the drag chip (§7). CSV hex colours **not** used.
- [ ] A `NzTime` formatter added in C# for `Week of 23 Aug` and shipped on the DTO — no date formatting
      in TypeScript, and no `new Date()` from an ISO value.
- [ ] Every record drawn exactly once, in the band of its own date (§9.2).
- [ ] Each column trimmed to the week of its own earliest record, interior empty bands kept (§9.3).
- [ ] Both columns open scrolled to the top.
- [ ] Every number on every card read straight from the DTO. No domain arithmetic in `web/`.
- [ ] The 40px filter row is **reserved** even though Phase 4 fills it (§8.3), so the measured density
      is the shipped density.
- [ ] The header strip's leading offset matches the card's: 54px (48 rail + 6 spine) inside a week
      band. A card shown outside a band needs the 6px variant instead — the two are not
      interchangeable (§16, item 9).
- [ ] Both match tables carry a Transport column, and sit in an `overflow-x: auto` wrapper so a long
      farmer-and-location value scrolls rather than widening the card.
