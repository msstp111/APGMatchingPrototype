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
inline styles carrying no interaction (the fill meter, the status spine, the stock-class tile, the
week rail) — those are ornament, not controls.

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

// --- lines and text -------------------------------------------------------
$lms-rule-strong:     #BDBDBD;  // form-field underline, hatch stroke, carry-over border
$lms-rule-soft:       #EFEFEF;  // rules inside an expanded card
$lms-faint:           #9E9E9E;  // tertiary text, empty-state text, cancelled spine
$lms-tile-ink:        #5C5F62;  // stock-class monogram
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
  --lms-rule-strong: #{$lms-rule-strong};  --lms-rule-soft: #{$lms-rule-soft};
  --lms-faint: #{$lms-faint};              --lms-tile-ink: #{$lms-tile-ink};
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
one step lighter, because a card carries three things a table row does not — a patterned spine, a
carry-over dashed border and a desaturated Cancelled state — and `#EEEEEE` under all three muddies
them. `#F5F5F5` keeps the family resemblance and stays clear of the `#EEEEEE` used for blocked drop
targets and drag placeholders.

Striping is by **position in the rendered list within a band**, not by record id, and **carry-over
cards are excluded from the alternation** (they have their own `#FAFAFA` fill).

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

Seeded example to check against: Processor Space #1 — 354 matched against 49 required, `unmatched`
`-305`. Space #5 shows both segments and the over-run at once: 125 solid, 209 in alpha, against 190.

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
| Stock-class tile (cattle) | 2px |
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
| Card hover | `0 1px 2px rgba(0,0,0,.10)` |
| Card dragging (CDK preview) | `0 8px 16px rgba(0,0,0,.24)` + `2px solid #00567E` outline |
| Dialog / modal | `0 11px 15px rgba(0,0,0,.20), 0 9px 46px rgba(0,0,0,.12)` |
| Snack bar | `0 3px 5px rgba(0,0,0,.20)` |

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
| Stock-class tile | `0 0 20px` | tile | tile |
| Name | `1 1 auto`, `min-width: 0` | `processor` | `locationName` |
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

The name column truncates with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. So
does the stock-class column — `Nat Beef - Premium` is the longest value and fits 96px at 13px Roboto
with a few pixels to spare; anything longer ellipses rather than wrapping. **Never let a card grow a
third line.**

Header strip: 28px, `#FAFAFA`, 1px `#E0E0E0` bottom rule, `position: sticky; top: 0` within the
column's scroll container, with a 54px leading pad (48px rail + 6px spine) so its cells sit over the
card cells.

Micro-cap header text: demand `Processor · Stock class · Delivery · Req'd · Unmatched`; supply
`Location · Stock class · Avail fr · Avail · Unmatched`.

**Line 2** is unlabelled meta, `gap: 8px`:

| Position | Demand | Supply |
| --- | --- | --- |
| Left, flexes and truncates | `plant · deliveryTime` (`-` if null) | `farmerName · transactionType` |
| Then, only when over | `Over-filled` in `$q-over-ink`, weight 500 | `Over-committed` in `$q-pink-ink`, weight 500 |
| Then | match count — `no matches` / `1 match` / `n matches` | same |
| Right | status icon + status label (§3.1) | same |

`transactionType` renders as `Finance Stock` / `Grazing Stock` / `Other` — never the enum spelling.

**When line 2 runs out of room**, drop from the right in this order and never wrap: the match count
goes first, then the over-state label, then the left-hand meta truncates with an ellipsis. The status
icon and its word are the last things standing, because status must be legible on every card in every
state. The left-hand meta is the only item that truncates; everything else is present or absent.

### 6.2 Expanded card

The collapsed row **stays exactly where it is** and the expansion opens below it, so nothing above the
pointer moves (Phase 3, 5.2). The chevron flips to `expand_less`.

The expansion block is indented `54px` on the left (rail + spine) so it aligns with the card body, and
has three parts in this order:

1. **Field row** — `padding: 8px 10px 6px`, 1px `#EFEFEF` bottom rule, `gap: 24px`. Each field is a
   micro-cap label over a 12.5px value. Empty values render `-`.
   - *Demand:* `Notes`, then right-aligned `Quantity required`, `Quantity unmatched`.
   - *Supply:* `Availability details`, `Transaction type`, `Notes`, then right-aligned
     `Quantity available`, `Quantity unmatched`.
   - The `Quantity unmatched` value is in `*-ink` at weight 500, followed by the DTO's
     `quantityStateLabel` at weight 400.
2. **Sums row** — `padding: 8px 10px`, background `#FAFAFA`, 1px `#E0E0E0` bottom rule, two fields at
   `gap: 24px`, values 14px/500 tabular:
   - `Quantity Matched incl. Draft` → `matchedInclDraft`
   - `Quantity Matched` → `matchedExclDraft`

   **Those are the labels.** APG-facing wording, never the DTO field names, and the excl-draft sum is
   labelled simply "Quantity Matched" because that is what a processor or farmer would see.
3. **Match table** — an LMS table. `th`: 26px, micro-caps, 1px `#E0E0E0` bottom rule. `td`: 30px,
   12.5px, 1px `#EFEFEF` bottom rule, `tr:nth-child(even) td { background: #F5F5F5 }`. Numerics and
   dates right-aligned with tabular numerals.

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
4. **Actions** (Phase 6 onwards) — `padding: 10px 10px 0`. On a Processor Space, a
   `Confirm space` button, enabled from the DTO's `canConfirm`. **When disabled it says why**, beside
   it, in card-meta type: *"Needs at least one confirmed match and no drafts."* A control that greys
   out for unstated reasons is exactly what makes non-technical users think the app is broken.

Expand state is per-card, independent, and held for the session (Phase 3, 5.1).

### 6.3 Column identity — because the columns flip

Position cannot identify a column (Phase 4, 5.4). Five channels do, none of them competing with the
meter:

1. **Column header** — 40px, sticky, with a 3px top rule: **petrol `#00567E`** on demand, **`#37393C`**
   on supply. The title takes the same colour. This is the shell's own brand blue on a header, not a
   hue on a card, so it does not collide with §3.
2. **Lead glyph** — a works/factory outline on demand, a location pin on supply, in the header.
3. **Header strip labels** — `Processor / Delivery / Req'd` versus `Location / Avail fr / Avail`.
4. **Noun set, everywhere** — `Required`/`Filled`/`Over-filled` versus
   `Available`/`Committed`/`Over-committed`, on cards, in dialogs and in the DTO's own
   `quantityStateLabel`.
5. **The pink state** exists only on supply, the blue only on demand.

Column header contents, left to right: lead glyph · title · `showing n of m` in micro-caps (right of
the title, pushed right) · the `Filtered` badge and `Reset` when away from default (§9) · the debug
`+ Add` stroked button.

---

## 7. Stock-class tiles

**Stock class carries no hue.** `Data/stock-class-configs.csv` ships a hex colour per class, and
Phase 8 §3.1 asks for it — but resolved question 16 commits hue exclusively to the quantity meter, and
the roadmap's resolved questions outrank a phase document. Twenty-two saturated swatches on a screen
whose entire scanning task is a three-colour quantity ramp would destroy the ramp.

So: the CSV's **`icon`** column informs the species grouping; its **`color`** column is **not used on
the matching screen**. Phase 8 inherits this decision rather than re-deciding it.

Instead — a **20 × 20px monogram tile**: `#EEEEEE` fill, `#5C5F62` text at 11px/600,
`letter-spacing: -.2px`, `line-height: 20px`, centred. **Shape carries species**, a channel neither
status nor quantity uses:

| Species | Shape |
| --- | --- |
| Sheep | circle (`border-radius: 50%`) |
| Cattle | square (`border-radius: 2px`) |
| Deer | diamond (`border-radius: 2px; transform: rotate(45deg)`, with the text counter-rotated) |

| Stock class | Vocabulary | Monogram | Shape |
| --- | --- | --- | --- |
| `Lamb` | both | `LM` | sheep |
| `Lambs` | SFF | `LM` | sheep |
| `Mutton` | both | `MU` | sheep |
| `Cows` | ANZCO, SFF | `CO` | cattle |
| `Cow` | supply | `CO` | cattle |
| `Prime` | ANZCO, SFF, supply | `PR` | cattle |
| `Bulls` | ANZCO | `BU` | cattle |
| `Bull` | supply | `BU` | cattle |
| `Sire Bull` | supply | `SB` | cattle |
| `Cattle` | Alliance | `CA` | cattle |
| `Mixed Cattle` | supply | `MC` | cattle |
| `Nat Beef - Ultra` | ANZCO | `NU` | cattle |
| `Nat Beef - Premium` | ANZCO | `NP` | cattle |
| `GFNB ultra` | supply | `GU` | cattle |
| `GFNB premium` | supply | `GP` | cattle |
| `Deer` | Alliance | `DE` | deer |

**Fallback:** any class not in the table renders a **square** tile with the first two characters
upper-cased. Nothing ever renders bare. The `title` attribute always carries the full class name.

The mapping belongs in the Phase 0 config module (`SeedConfig.cs`'s client-side counterpart), not
scattered through components (Phase 8 §3.3).

---

## 8. The content area, week bands and the rail

### 8.1 How the content area sits inside the shell

The shell is fixed and already built: 52px petrol top bar with the hamburger, `LMS` wordmark and the
`# DEV ENVIRONMENT #` flag; 190px sidebar with its petrol header block, full nav list (`Matching`
active) and grey version footer. The top bar and sidebar **do not scroll**.

Inside the content area, top to bottom:

| Element | Height |
| --- | --- |
| Shared search strip | **52** — 8px top padding + 38px field + 6px bottom padding |
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
- 52  search strip
- 12  bottom padding
- 40  column header
- 40  filter row
- 28  header strip
= 544px of list
```

544px is the list's *total*, and band chrome shares it. A realistic scroll position shows two or three
band headers at 30px, sometimes a 32px carry-over sub-header and a 26px "new this week" divider — call
it 60–120px of chrome. So the honest figure is:

| Visible band chrome | Cards per column |
| --- | --- |
| none (one long band) | 10 |
| two band headers (60px) | 9 |
| two headers + both carry-over sub-headers (118px) | 8 |

**8 to 10 cards per column, so 16 to 20 across both** — against LMS's ~20 rows. That is the family
resemblance, and it is checkable: **if Phase 3 ends up showing four cards per column, the design has
failed and the card must shrink, not the target.**

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
544px list, and the rail already answers "which week am I in". If Phase 3 reaches for virtualisation,
check the sticky rail first; plain rendering is expected to be fine at ~50 records per side.

### 8.6 Past, current, future

- **Current week** — 2px petrol top rule, `#E8F1F6` rail and header, petrol bold label, `This week` tag.
- **Past** — `#F0F0F0` rail, `#9E9E9E` label and meta, `Past` tag.
- **Future** — plain `#FAFAFA` rail, `#F0F0F0` header.

**De-emphasis sits on the band chrome, never on the cards.** Fading a past card would collide with
Cancelled's desaturation — the one treatment that legitimately drains a card — and a past week's
records are still live and still matchable. Past weeks are de-emphasised, not hidden (Phase 3, 1.5).

---

## 9. Carry-over cards

### 9.1 The problem

A Processor Space belongs to one day. An Availability record becomes available on a date and stays
available until it is used up — so a record from three weeks ago with unmatched quantity is still
matchable *this* week, and an operator working this week's band has to be able to see and drag it.
Nine seeded records carry over from week 16 Aug into week 23 Aug alone.

### 9.2 Card treatment

A carry-over is **one line, 40px** — it is a repeat, and the full detail lives in its home band.

| Property | Value |
| --- | --- |
| Height | 40px |
| Background | `#FAFAFA` |
| Border | 1px **dashed** `#BDBDBD` as an `outline` at `outline-offset: -3px`, inset inside the row |
| Left edge | **its own true status spine, unchanged** (§3.1) |
| Lead glyph | a carry/return arrow in `#9E9E9E`, before the stock-class tile |
| Name | 13px weight **400** (not 500), `#4A4A4A` |
| Date column | `since 17-08-26`, 11.5px `#9E9E9E`, `flex: 0 0 82px` — replaces the available-from column |
| Meter | the same 112px block, unchanged |
| Zebra | excluded from the alternation |

**The dash is on the outer border, not the left edge.** The roadmap says "muted, dashed", but a dashed
left edge is already the Cancelled spine, and a carry-over must keep showing its own true status —
Availability #37 carries over while Pending and must still read as Pending. This is applying the
roadmap's scheme faithfully, not departing from it.

**Its line 1, in full** — same 40px row, `gap: 8px`, and it deliberately does *not* align to the
header strip, because it is not one of the band's own rows:

| Column | Width | Content |
| --- | --- | --- |
| Carry glyph | `0 0 auto` | return arrow, `#9E9E9E`, 13px |
| Stock-class tile | `0 0 20px` | as §7 |
| Location | `1 1 auto`, `min-width: 0` | `locationName`, 13px weight **400**, `#4A4A4A` |
| Stock class | `0 0 96px` | `stockClass`, `#757575` |
| Origin | `0 0 82px` | `since 17 Aug`, 11.5px, `#9E9E9E` |
| Meter block | `0 0 112px` | §4, unchanged |
| Chevron | `0 0 24px` | 16px glyph |

There is **no line 2** and no quantity-available column: the farmer, the transaction type, the status
word and the total available are all in the record's home band. What survives is what makes the
decision *this* week — what it is, where from, how long it has been sitting there, and how much is
left.

**Expanded, a carry-over is identical to a full card expanded** (§6.2) — the same field row, the same
sums row, the same match table, because it is the same record (§9.4). The only difference is that the
collapsed row above the expansion is the 40px carry-over row rather than the 52px card. Do not build a
second, reduced expansion for it.

**The date label is `since 17 Aug`, not `since 17-08-26`.** Phase 3 §4.3's own example is
"available since 10 Aug" and the band header needs the same friendlier form (§8.4), so it is one
`NzTime` formatter serving both, shipped on the DTO. Never formatted in TypeScript.

### 9.3 Grouping, and the recommendation

Carry-overs are grouped at the top of the band under their own sub-header, above the band's native
cards (Phase 3, 4.7):

```
┌ 32px ─────────────────────────────────────────────────────────┐
│ ▸ ↩ CARRIED OVER (9) — still available from earlier weeks, …  │  #FAFAFA
├───────────────────────────────────────────────────────────────┤
│ …carry-over cards, when expanded…                             │
├ 26px ─────────────────────────────────────────────────────────┤
│ NEW THIS WEEK (7)                                             │  #FAFAFA
├───────────────────────────────────────────────────────────────┤
│ …the band's own cards…                                        │
└───────────────────────────────────────────────────────────────┘
```

Sub-header: 32px, `#FAFAFA`, 1px `#E0E0E0` bottom rule, chevron + carry glyph + micro-caps count.
`New this week` divider: 26px, same treatment, count only, and it renders **only when carry-overs are
present** — otherwise the band's cards start straight after the band header.

**The proposal, and the better answer.** The phase document asks for the concept as a proposal with
reasoning, and for any alternative found while designing. Both are on artboard 4:

- **Proposal A**, as specced: repeat every carried-over record. Everything matchable is on screen and
  draggable with no extra click. *Tradeoff:* at nine records, 360px of repeats push the week's own
  work off the screen, and the clutter grows with exactly the records that matter least.
- **Proposal B**: no repetition, one 32px summary strip per band —
  `▸ 6 records still available from earlier weeks · 1,240 head`. One line instead of nine, and the
  band's own cards are unambiguously new. *Tradeoff:* the stock is a click away, and a collapsed strip
  cannot be a drop target — in the exact case where the operator most wants to clear old stock.

> **Ship both: they are the same component in two states.** Proposal B *is* Proposal A collapsed —
> same sub-header, same chevron, same group. Build one component with a collapse toggle, persisted per
> band and per column, and pick the **opening** state from the count.

**Constants Phase 3 must name and export:**

```ts
/** Carry-overs render expanded at or below this count, collapsed above it. */
export const CARRY_OVER_EXPAND_LIMIT = 4;

/** Weeks forward of the current week that a carry-over may still appear in. */
export const CARRY_OVER_HORIZON_WEEKS = 4;
```

- `CARRY_OVER_EXPAND_LIMIT = 4` — small carry-overs stay visible and draggable for free; a
  nine-record pile-up defers to the week's own work until asked for. It also lets Mark A/B the two
  proposals at runtime rather than in another design pass, which is the point: this is the display he
  expects to iterate on.
- `CARRY_OVER_HORIZON_WEEKS = 4`, counted forward from the current week, and **carry-overs never
  render in a band before the current week** — a record cannot be carried over into the past. Four
  weeks covers the seeded span and APG's booking window; past that, a record still holding stock is a
  data-quality problem, not a matching opportunity.

### 9.4 Identity — the rule that must not break

A carry-over is **the same record, not a copy**. Expanding one shows the same matches; dragging one
creates a match against the same record; and **it never counts in a band meta, a column count, or any
total** (Phase 3, 4.6; Phase 4, 7.2). Carry-overs vanish from later bands the moment `unmatched`
reaches zero — a visible, satisfying confirmation that a drag worked (Phase 5, 4.4).

### 9.5 Under filters

- A record excluded by a filter must **not** reappear as a carry-over. The filter applies to the
  record, and a carry-over is the same record.
- **A week filter is the exception.** Filtering to week 23 Aug must still show the carry-overs
  matchable in it, because those records are precisely what makes that view correct. **The week filter
  selects bands; every other filter selects records.** State this rule in the Phase 4 code and its
  build-log entry — it is easy to get subtly wrong and hard to notice.

---

## 10. Interaction states

| State | Treatment |
| --- | --- |
| **Card hover** | background `#F5F9FB`, `cursor: grab`, a six-dot grab glyph appears left of the chevron. **Nothing resizes** — a growing row makes a list of ten cards jitter under the pointer. |
| **Card active / pressed** | background `#EEEEEE`, no movement |
| **Dragging (CDK preview)** | **1:1 scale** — no tilt, no shrink; the operator is aiming at a 52px row and a transformed preview lies about where the pointer is. `0 8px 16px rgba(0,0,0,.24)` + `2px solid #00567E` outline, `cursor: grabbing`. Escape cancels. |
| **Drag placeholder** (the gap left behind) | a flat `#EEEEEE` silhouette at the **same 52px height**, carrying the record name at 55% opacity. Same height matters: the list must not reflow mid-drag. **Not a dashed outline** — dashed already means Cancelled and carry-over. |
| **Valid drop target** | `2px solid #00567E` outline inset, background `#E8F1F6`, a `+` badge left of the chevron. The whole opposite column also takes a `#F6FAFC` wash the moment a drag starts. |
| **Invalid target — same column** | **nothing changes at all.** No outline, no shake, no message. Dropping within a column is a no-op by specification (Phase 5, 1.3), and an error for a gesture that simply does not apply teaches an operator to fear the screen. The only cue is `cursor: no-drop`. |
| **Blocked target — no unmatched quantity** | background `#EEEEEE`, a `block` glyph, `cursor: not-allowed`, `matTooltip="No unmatched quantity"`. Distinct from the same-column case because here the gesture *would* apply — the record is simply full. |
| **Auto-scroll zone** | 48px at the top and bottom of each column, marked by a petrol gradient veil to 14% opacity while dragging. Must scroll **through** band headers, not only within a band. |
| **Disabled control** | Material's own disabled styling, **plus a stated reason** beside it wherever the reason is not obvious (see §6.2's Confirm). |
| **Focus** | Material's own, exactly as it arrives. Do not remove it; do not build on it. |

**Nothing keyboard-driven is designed, on purpose.** A mouse is assumed available at all times
(resolved question 14): no keyboard drag path, no "press space to lift" hint, no drag-handle focus
ring, no screen-reader live region for the drag. Its absence is a decision, not an oversight to be
helpfully corrected. Material's controls remain keyboard-operable because they arrive that way.

Motion: 120ms `ease-out` for expand/collapse and hover; Material's own durations for dialogs.
Quick, and never blocking the next action.

---

## 11. Dialogs

### 11.1 Quantity prompt (on drop)

`MatDialog`, **560px**, 4px radius. Title states the quantity — `Match 132 head` — so the primary
number is legible before any field is read.

**Body, in order:**

1. **Processor Space summary block** and **Livestock Availability summary block**, stacked, 8px apart.
   Each: `#FAFAFA` fill, 1px `#E0E0E0` border, **its own status spine on the left**, then
   - micro-cap kicker (`Processor Space` in petrol / `Livestock Availability` in `#37393C`) with the
     status in micro-caps at the right;
   - the stock-class tile, the record's name at 13.5/500, the stock class in `#757575`;
   - a row of micro-cap fact pairs: demand `Delivery · Time · Required · Unmatched`; supply
     `Available from · Transaction type · Available · Unmatched`. Unmatched in `*-ink` weight 500.
2. **The stock-class note** — a bordered info row: *"Cattle and Bull come from different stock-class
   lists. There is no mapping between them — the judgement is yours."* Both classes named. This is
   information, not a warning: no amber, no warning icon.
3. **Three fields in a row**, all `appearance="fill"`:
   - `Quantity matched` — 148px, suffix `head`, hint `Default 132 · max 142`
   - `Price per kg` — 148px, prefix `$`, suffix `/kg`, hint
     `Default for Alliance Group · Cattle · w/c 23-08-26`
   - `Transport company (optional)` — flexes, `mat-autocomplete`, hint `Can be added later`

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

`MatDialog`, **640px**.

1. **Both parent records, read-only, side by side**, each `flex: 1 1 0`, 10px apart: the same block as
   §11.1 plus the side glyph, the record id in the kicker (`Processor Space #3`), a sub-line
   (`Lambs · delivery 01-09-26 · no time set`), and the fact pairs
   `Originally required`/`Originally available` and `Quantity unmatched` with its state label.
2. **The stock-class note**, as §11.1 — and note that `Lambs` versus `Lamb` looks like a typo and is
   not. Neither side is validated against the other.
3. **Three editable fields**: `Quantity matched` (150px, min 1, max stated in the hint),
   `Price per kg` (150px), `Transport company` (flexes, autocomplete).
4. A micro-note under the fields spelling the ceiling out:
   *"Ceiling 472 = the availability's 177 unmatched **plus this match's own 295**."*

**Footer — destructive left, constructive right:**

| Match status | Left | Right |
| --- | --- | --- |
| `Drafted` | `Delete draft` (`mat-button`, `#BA1A1A`) | `Close` · `Save changes` · `Confirm match` (flat petrol) |
| `Confirmed` | `Cancel match…` (`mat-button`, `#BA1A1A`) | `Close` · `Save changes` |

Delete is offered **only** at `Drafted`, needs no reason, and is not a cancellation (resolved
question 3). Cancel-with-reason is offered only past `Drafted`.

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

Then a warning panel — `$lms-attention-bg` (`#F5F5F5`), a 3px `$lms-error` left border, warning glyph:

> **A cancelled match disappears from the matching screen.** Pass 1 has no Match list view, so it
> will not be visible anywhere afterwards. Both records keep their own status — cancelling a match
> never touches its parents.

Actions: `Keep match` · `Cancel match` (`mat-flat-button`, `#BA1A1A`).

---

## 12. Filter and sort bar

### 12.1 Shared search strip

LMS's own signature, and the most recognisable single element on the screen: a full-width
`appearance="fill"` search field with a floating label, and a **stacked** `× Clear` / `^ Hide` pair at
the top right, 22px each, 12px text. Label:
`Search processor, plant, location, farmer, stock class`.

### 12.2 Per-column filter row — 40px

Each column owns its own controls, so a filter can never be ambiguous about which side it applies to.

```
[ Status: Booked ▾ ]  [ Stock class: All ▾ ]  [ More ▾ ]        ↓ Soonest
```

- **Status** and **Stock class** are `mat-chip-option`s, 26px, 12px text, 13px radius, rather than
  selects — they are the two filters `Frontend ideas.md` singles out, and they must show their current
  value without being opened. Selected chips: `#E8F1F6` fill, 1px petrol, petrol text.
- **More** opens a second row of `appearance="fill"` selects for the rest of Phase 4's field list:
  demand `Processor · Plant · Delivery week (W.C.) · Sort by · Has unmatched quantity`; supply
  `Location (searchable, 299) · Transaction type · Available-from week (W.C.) · Sort by ·
  Unmatched quantity`. When open, the chip reads `More (2) ▴` with the count of active filters
  inside it.
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

- The count lives in the column header in micro-caps: `showing 44 of 50`. **Carry-overs never inflate
  it.**
- A column away from its defaults grows two things in its header: a `Filtered` chip in
  `$lms-attention-ink` (`#5C5F62` border and text, info glyph) and an explicit `Reset` text button.
  **No hidden or timed resets.** The chip is deliberately **hueless** — "you have filtered this column"
  is information, not a warning, and every amber worth using collides with the quantity ramp's orange.
- When filters exclude everything, show §13's empty state with a one-click way out — never a blank
  column.

### 12.4 Flip

A 28px circular `mat-icon-button` with a `swap_horiz` glyph, on the gutter between the columns, at the
top, on white with a `#BDBDBD` ring. Purely presentational: no filter, sort, expansion or selection
state is lost, and the preference persists to `localStorage`. Column identity is carried by §6.3.

---

## 13. Empty and edge states

Every empty state names **what** is empty and offers a way out. An absent value is `-`, matching the
existing app. Nothing ever shows a raw `undefined`, `NaN` or `Invalid Date`.

| State | Treatment |
| --- | --- |
| **No results after filtering** | 44px vertical padding, centred: a 34px `filter_alt_off` glyph in `#9E9E9E`, `No processor spaces match these filters` at 14/500, **the active filters restated** in card-meta type, then `Clear filters` (flat) + `Reset to default` (text). "No results" without the reason is how an operator concludes the app is broken. |
| **Empty column** | same layout, the column's own glyph, `No livestock availability yet`, *"Records appear here as farmers and agents submit them."*, and the debug `+ Add a record` stroked button. Distinct from the filtered case — nothing to clear. |
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

---

## 15. Strings — use these exactly

Wording is part of the design, and non-technical users are the audience. No jargon that isn't APG's
own: "Quantity Matched", never `matchedExclDraft`.

| Where | String |
| --- | --- |
| Refused drop | `There is no unmatched quantity` |
| Space over-filled | `Over-filled` |
| Availability over-committed | `Over-committed` |
| Space quantity states | `Under-filled` / `Filled` / `Over-filled` |
| Availability quantity states | `Under-committed` / `Fully committed` / `Over-committed` |
| Expanded sums | `Quantity Matched incl. Draft` and `Quantity Matched` |
| Cancellation reasons | `Change from Agent/Farmer` · `Change from Processor` · `Internal decision by APG` |
| Column counts | `showing 44 of 50` |
| Away from default | `Filtered` / `Reset` |
| Carry-over group | `Carried over (9)` · `New this week (7)` · `since 17-08-26` |
| Band header | `Week of 23 Aug` |
| Empty value | `-` |
| Confirm-space reason when disabled | `Needs at least one confirmed match and no drafts` |

**The six quantity-state strings live in `QuantityStateLabels` in C# and arrive on the DTO as
`quantityStateLabel`.** Render what you are given. A phase may reword them **in that one file**.

---

## 16. Things the canvas shows but does not explain

1. **Line 2 is unlabelled on purpose.** Only line 1 aligns to the header strip. Labelling both would
   need two header rows and cost 28px of the 544px list.
2. **The card's `title` attributes** carry the full stock-class name on the tile and
   `708 matched / 1003 incl. draft of 1180` on the meter, so a truncated or abbreviated value is
   always recoverable by hover.
3. **The match count on line 2 is live matches only.** Cancelled matches are excluded from the DTO's
   `matches` array entirely (resolved question 4) — but they are still correctly excluded from both
   sums. Do not blend those two facts.
4. **`Unmatched` comes from the incl-draft sum, not the excl-draft one.** Both are on the DTO and it is
   easy to reach for the wrong one; a draft has already spoken for the stock.
5. **The artboards showing Confirmed and Cancelled Processor Spaces are constructed.** The seed
   contains only `Booked` spaces (all 40), and no cancelled availability records. Those rows show a
   real record as it would render after the action, and are labelled as such on the canvas.
6. **The seed groups processors by week** (week 16-08 is all ANZCO, 23-08 all Alliance, 30-08 all SFF).
   That is an artefact of the seeder, not a design intention — do not build anything that assumes it.
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
10. **The trailing edge matches too, at 32px.** The card spends 8px of body padding then a 24px
    chevron; the strip spends a 24px spacer cell then 8px of cell padding. If either grows, the
    Unmatched column stops lining up with its own header.
11. **The stock-class tile is not in the 17px line-1 height.** The tile is 20px and the line is 17px,
    so the tile overflows the line box by 1.5px top and bottom. That is harmless — the row is
    `align-items: center` inside a 51px content box with 8.5px of slack above and below — but it is
    why the card height is set explicitly rather than summed from its parts (§6.1).

---

## 16a. Where this knowingly diverges from LMS

Phase 8 has to judge whether the finished screen "reads as part of LMS". Four things will differ, all
deliberately, and it is better that the list is written down than rediscovered as bugs:

1. **The status spine has no precedent anywhere in LMS.** Status in the existing app is plain,
   uncoloured text — no bar, no icon, no pattern, on any row of any of the four screenshots. The spine
   is a new visual device, sanctioned by resolved question 16: hue was already committed to the
   quantity ramp, so status needed a channel of its own. Held next to the PNGs this is the single most
   visible addition. It is not a regression.
2. **The filter chrome is roughly half LMS's footprint.** In the Killsheets and Purchases screenshots
   the search field plus the row of underline selects occupies on the order of 190–200px before the
   column headers begin; Killsheets alone shows eight filter fields. This design budgets 52px for the
   shared search strip plus 40px per column — under 100px — and defers the rest behind "More". That is
   a measurable departure, taken because the cards need the vertical space (§8.3) and reversing it
   would cost two cards per column.
3. **Chips are an idiom LMS does not use.** All four reference screens filter exclusively through
   underline selects with floating labels. The Status and Stock class chips are new. They are still
   themed Material components, so nothing reads as a foreign framework, but the idiom is an addition —
   taken because those two filters must show their current value without being opened.
4. **The column header strip has a fill, a rule and sticky behaviour.** LMS's column headers sit
   directly on the page background as plain grey text with no fill and no rule beneath. Ours get
   `#FAFAFA`, a 1px bottom rule and `position: sticky`, because unlike a paginated table our list
   scrolls and the header has to survive it.

Everything else — the blues, Roboto, `-` for empty, `appearance="fill"` form fields, square corners,
zebra striping, the muted micro-cap headers, the deliberate refusal to reuse LMS's create FAB for debug
tooling — is carried straight from the screenshots.

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
- [ ] Stock-class tiles with the species shapes and the fallback (§7). CSV hex colours **not** used.
- [ ] A `NzTime` formatter added in C# for `Week of 23 Aug` and shipped on the DTO — no date formatting
      in TypeScript, and no `new Date()` from an ISO value.
- [ ] `CARRY_OVER_EXPAND_LIMIT` and `CARRY_OVER_HORIZON_WEEKS` exported as named constants.
- [ ] Carry-overs excluded from every count and total; identical record identity, not copies.
- [ ] Every number on every card read straight from the DTO. No domain arithmetic in `web/`.
- [ ] The 40px filter row is **reserved** even though Phase 4 fills it (§8.3), so the measured density
      is the shipped density.
- [ ] The header strip's leading offset matches the card's: 54px (48 rail + 6 spine) inside a week
      band. A card shown outside a band needs the 6px variant instead — the two are not
      interchangeable (§16, item 9).
- [ ] Both match tables carry a Transport column, and sit in an `overflow-x: auto` wrapper so a long
      farmer-and-location value scrolls rather than widening the card.
- [ ] A carry-over expands to the *same* expansion as a full card — not a reduced one (§9.2).
