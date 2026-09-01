/**
 * How a stock class renders: a two-letter monogram and a species shape.
 *
 * **Stock class carries no hue.** `Data/stock-class-configs.csv` ships a hex colour per class and
 * Phase 8 section 3.1 asks for it, but resolved question 16 commits hue exclusively to the quantity
 * meter and the roadmap's resolved questions outrank a phase document. Twenty-two saturated swatches
 * on a screen whose entire scanning task is a three-colour quantity ramp would destroy the ramp. So
 * the CSV's `icon` column informs the grouping below and its `color` column is not used here. Phase 8
 * inherits this decision rather than re-deciding it (design-system.md 7).
 *
 * Shape carries species instead — a channel neither status nor quantity uses.
 *
 * The table lives in this one module rather than scattered through components, mirroring how
 * `SeedConfig.cs` holds every invented list on the server, so APG's real vocabularies stay a one-file
 * swap (design-system.md 7, Phase 8 section 3.3).
 */

export type Species = 'sheep' | 'cattle' | 'deer';

export interface StockClassTile {
  readonly monogram: string;
  readonly species: Species;
}

/**
 * Both vocabularies at once, and note they do not line up: `Cow` is supply's spelling and `Cows` is
 * ANZCO's and SFF's, `Cattle` is Alliance's where supply says `Mixed Cattle`. That mismatch is the
 * point of the screen and must never be presented as an error.
 *
 * `Lambs` is kept as an alias although nothing produces it any more: SFF's list said `Lambs` until
 * APG confirmed it is `Lamb`, and a one-line alias costs nothing if that is ever reverted.
 */
const TILES: ReadonlyMap<string, StockClassTile> = new Map([
  ['Lamb', { monogram: 'LM', species: 'sheep' as Species }],
  ['Lambs', { monogram: 'LM', species: 'sheep' as Species }],
  ['Mutton', { monogram: 'MU', species: 'sheep' as Species }],
  ['Cows', { monogram: 'CO', species: 'cattle' as Species }],
  ['Cow', { monogram: 'CO', species: 'cattle' as Species }],
  ['Prime', { monogram: 'PR', species: 'cattle' as Species }],
  ['Bulls', { monogram: 'BU', species: 'cattle' as Species }],
  ['Bull', { monogram: 'BU', species: 'cattle' as Species }],
  ['Sire Bull', { monogram: 'SB', species: 'cattle' as Species }],
  ['Cattle', { monogram: 'CA', species: 'cattle' as Species }],
  ['Mixed Cattle', { monogram: 'MC', species: 'cattle' as Species }],
  ['Nat Beef - Ultra', { monogram: 'NU', species: 'cattle' as Species }],
  ['Nat Beef - Premium', { monogram: 'NP', species: 'cattle' as Species }],
  ['GFNB ultra', { monogram: 'GU', species: 'cattle' as Species }],
  ['GFNB premium', { monogram: 'GP', species: 'cattle' as Species }],
  ['Deer', { monogram: 'DE', species: 'deer' as Species }],
]);

/**
 * Every stock class this table maps explicitly, in either vocabulary.
 *
 * Exported for one reason: Phase 8's acceptance criterion is that *every* stock class on both sides
 * renders with an icon or a deliberate fallback, and the fallback is indistinguishable from a mapping
 * once `stockClassTile` has returned. `stock-class-coverage.spec.ts` reads the two vocabularies out
 * of `SeedConfig.cs` and checks each one against this set, so a class APG adds server-side fails a
 * test by name instead of quietly rendering `WE` on a square.
 *
 * Application code should call {@link stockClassTile} and never consult this.
 */
export const MAPPED_STOCK_CLASSES: ReadonlySet<string> = new Set(TILES.keys());

/**
 * Any class not in the table renders a square tile with its first two characters upper-cased.
 * **Nothing ever renders bare** — a stock class APG adds later still gets a tile, and the full name is
 * always on the tile's `title` attribute so an abbreviation is recoverable by hover.
 */
export function stockClassTile(stockClass: string): StockClassTile {
  return TILES.get(stockClass) ?? { monogram: fallbackMonogram(stockClass), species: 'cattle' };
}

function fallbackMonogram(stockClass: string): string {
  const trimmed = stockClass.trim();

  return trimmed.length > 0 ? trimmed.slice(0, 2).toUpperCase() : '?';
}
