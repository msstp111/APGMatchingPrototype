import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPPED_STOCK_CLASSES, stockClassTile } from './stock-classes';

/**
 * Phase 8, requirement 3.2 and its acceptance criterion: **every stock class on both sides renders
 * with an icon or a deliberate fallback**, and nothing renders bare.
 *
 * The fallback is real and tested next door in `stock-classes.spec.ts` — a class nobody has seen still
 * gets a square tile and its first two characters. But a fallback is a safety net, not the intended
 * outcome: `GFNB premium` rendering as `GF` on a square would be *working* and *wrong*, and nothing on
 * screen would say so.
 *
 * So this reads the two real vocabularies out of `SeedConfig.cs` — the server's single home for every
 * invented list (resolved question 11) — and asserts each class is mapped explicitly. When APG's real
 * lists arrive as the one-file swap `SeedConfig` exists for, this fails and names the classes that
 * need tiles, in the same change rather than in a demo.
 *
 * Reading a C# file from a TypeScript spec is the technique `no-domain-arithmetic.spec.ts` already
 * uses, and for the same reason: the alternative is a second copy of the vocabularies in TypeScript,
 * which is the drift the architecture exists to prevent.
 *
 * **`Data/stock-class-configs.csv`'s hex colours are deliberately not used.** Requirement 3.1 asks for
 * them; resolved question 16 and design-system.md 7 override it — hue belongs exclusively to the
 * quantity meter, and twenty-odd saturated swatches would destroy the three-colour ramp the whole
 * screen is scanned for. Its `icon` column informs the species shapes instead, and it only partly
 * overlaps these lists: it has no row for `Deer`, `Cattle`, `Sire Bull`, `Mixed Cattle`, either
 * `GFNB` class or either `Nat Beef` class, which is why the shapes are a table here rather than a
 * lookup into that file.
 */
describe('Stock-class coverage against the real vocabularies', () => {
  const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
  const SEED_CONFIG = join(REPO_ROOT, 'src', 'Apg.Api', 'Seeding', 'SeedConfig.cs');

  const source = readFileSync(SEED_CONFIG, 'utf8');

  const PROCESSORS = ['ANZCO', 'Alliance Group', 'SFF'];

  /**
   * Every double-quoted string inside the named C# collection initialiser, less the processor names
   * that the per-processor list interleaves with its classes.
   *
   * Line comments are stripped first: the one above SFF's list quotes both "Lambs" and "Lamb" while
   * explaining that the seed says the latter, and a parser that read a comment as data would be
   * asserting against prose.
   */
  function classesIn(field: string): string[] {
    const declaration = source.indexOf(` ${field} =`);
    if (declaration < 0) {
      throw new Error(`${field} is no longer declared in SeedConfig.cs`);
    }

    const end = source.indexOf('];', declaration);
    if (end < 0) {
      throw new Error(`Could not find the end of ${field} in SeedConfig.cs`);
    }

    const body = source
      .slice(declaration, end)
      .split('\n')
      .map((line) => line.split('//')[0])
      .join('\n');

    return [...body.matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((value) => !PROCESSORS.includes(value));
  }

  const demandClasses = classesIn('ProcessorSpaceStockClasses');
  const supplyClasses = classesIn('AvailabilityStockClasses');

  /**
   * The guard against this whole file passing vacuously.
   *
   * A parser that stopped matching would return an empty list, and "every class in an empty list is
   * mapped" is true and worthless — the failure this suite exists to catch would then be invisible.
   * The bounds are loose on purpose: they say "these lists were genuinely read", not "these lists have
   * not changed", which is what the assertions below are for.
   */
  it('actually read both vocabularies out of SeedConfig.cs', () => {
    expect(demandClasses.length).toBeGreaterThanOrEqual(10);
    expect(supplyClasses.length).toBeGreaterThanOrEqual(8);
    expect(demandClasses).toContain('Nat Beef - Premium');
    expect(supplyClasses).toContain('GFNB ultra');
  });

  it('maps every Processor Space stock class explicitly, for all three processors', () => {
    const unmapped = [...new Set(demandClasses)].filter((c) => !MAPPED_STOCK_CLASSES.has(c));

    expect(unmapped).toEqual([]);
  });

  it('maps every Livestock Availability stock class explicitly', () => {
    const unmapped = [...new Set(supplyClasses)].filter((c) => !MAPPED_STOCK_CLASSES.has(c));

    expect(unmapped).toEqual([]);
  });

  it('gives every one of them a monogram and a species, so none renders bare', () => {
    for (const stockClass of [...demandClasses, ...supplyClasses]) {
      const tile = stockClassTile(stockClass);

      expect(tile.monogram.length).toBeGreaterThan(0);
      expect(['sheep', 'cattle', 'deer']).toContain(tile.species);
    }
  });
});
