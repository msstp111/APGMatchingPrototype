import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The client half of `DomainPurityTests`.
 *
 * The architecture's central rule is that a domain value has exactly one implementation, in
 * `Apg.Domain`, and the client renders what it is handed. That rule is easy to state and easy to
 * breach by accident — a `new Date(dto.deliveryDate)` to sort by week, a `required - matched` because
 * a DTO field was not to hand. Both look reasonable in review. Both put a second implementation of a
 * rule in a second language, and the two then disagree quietly, on a screen APG commits real livestock
 * with.
 *
 * So this scans the matching screen's own sources and fails on the two shapes that breach it. It
 * cannot catch every possible breach — nothing short of a type system could — but it catches the two
 * that a hurried change actually reaches for.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Both files are named, and both reasons are recorded here rather than in a commit message, so a
 * future phase adding a third has to justify it in the same place.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    'card/fill-meter.ts',
    'Segment widths are ratios of two DTO figures, clamped to [0, 100]. A CSS width is not a ' +
      'displayed figure and the clamp is a design rule, so neither belongs in the wire format. ' +
      'Every value the component actually renders — the numeral, the state, the label — arrives ' +
      'computed.',
  ],
  [
    'board/matching-board.ts',
    'Band header totals roll up DTO quantities over a band. A presentation aggregate over a list, ' +
      'not a domain rule, and it has to be here because Phase 4 filtering changes which records are ' +
      'in the list — a per-band total on the DTO would be right today and wrong under a filter. The ' +
      'per-column trim in the same file does no arithmetic at all: it is an index into an ordered ' +
      'array the server sent.',
  ],
]);

/** Anything that hands the browser's timezone a decision the server has already settled. */
const DATE_PATTERNS: readonly RegExp[] = [
  /\bnew Date\b/,
  /\bDate\.parse\b/,
  /\bDate\.now\b/,
  /\btoLocaleDate\w*/,
  /\bIntl\.DateTimeFormat\b/,
  /\bgetTime\(\)/,
];

/**
 * An arithmetic operator next to one of the DTO's quantity fields — the shape of recomputing a sum,
 * an unmatched figure or a fill ratio.
 *
 * `+` is included, not excluded. A `.reduce((total, r) => total + r.unmatched, 0)` is the single most
 * likely way a domain sum gets reimplemented here, and leaving addition out to avoid tripping over
 * string concatenation would have blinded the test to exactly that. Requiring the field name adjacent
 * to the operator is what keeps concatenation elsewhere from matching.
 */
const QUANTITY_FIELDS = [
  'unmatched',
  'matchedInclDraft',
  'matchedExclDraft',
  'quantityRequired',
  'quantityAvailable',
  'quantityMatched',
];

const QUANTITY_PATTERNS: readonly RegExp[] = QUANTITY_FIELDS.flatMap((field) => [
  // `x.unmatched - y`, `unmatched() * 2`, `r.unmatched + total`
  new RegExp(`\\b${field}\\b\\s*(\\(\\))?\\s*[-+*/]`),
  // `y - x.unmatched`, `total + r.unmatched`
  new RegExp(`[-+*/]\\s*[\\w.()]*\\b${field}\\b`),
]);

describe('No domain arithmetic in the matching screen', () => {
  const sources = collectSources(HERE);

  it('scans both components and templates, so a broken walk cannot pass silently', () => {
    // A test that reads nothing passes everything, and one that reads only .ts files misses the
    // surface where a breach is most likely — so both counts are asserted, not just the total.
    const components = sources.filter((f) => f.path.endsWith('.ts'));
    const templates = sources.filter((f) => f.path.endsWith('.html'));

    expect(components.length).toBeGreaterThan(10);
    expect(templates.length).toBeGreaterThan(5);
  });

  /**
   * The test testing the test. Both of these are real breaches that an earlier draft of this spec let
   * through — a `+` was excluded to avoid tripping over string concatenation, and templates were not
   * read at all. Pinning them here means neither gap can quietly reopen.
   */
  it('detects the breaches it is meant to detect', () => {
    const breaches = [
      'const left = dto.quantityRequired - dto.matchedInclDraft;',
      'const total = a.unmatched + b.unmatched;',
      'records.reduce((total, r) => total + r.unmatched, 0)',
      '{{ space().quantityRequired - space().matchedInclDraft }}',
    ];

    for (const breach of breaches) {
      expect(matches(breach, QUANTITY_PATTERNS), breach).toBe(true);
    }

    for (const breach of ['new Date(dto.deliveryDate)', 'Date.parse(dto.availableFrom)']) {
      expect(matches(breach, DATE_PATTERNS), breach).toBe(true);
    }
  });

  it('does not fire on the bindings and labels these templates are full of', () => {
    // The corollary: a test that flags everything gets disabled, and a disabled test guards nothing.
    const innocent = [
      '[matchedInclDraft]="space().matchedInclDraft"',
      '<td class="num">{{ m.quantityMatched }}</td>',
      '<app-stock-class-tile [stockClass]="record().stockClass" />',
      '{{ band().meta.spaceCount === 1 ? \'space\' : \'spaces\' }}',
    ];

    for (const line of innocent) {
      expect(matches(line, QUANTITY_PATTERNS), line).toBe(false);
    }
  });

  it('never constructs or parses a date', () => {
    const offenders = sources.filter((file) => matches(file.text, DATE_PATTERNS));

    // Every business date arrives twice: an ISO value and a preformatted label. Render the label.
    // Banding compares the ISO strings for equality, and trimming a column's leading empty weeks is a
    // slice of the server's ordered band array — no parsing required, which is the whole design.
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('never does arithmetic on a quantity outside the two allow-listed files', () => {
    const offenders = sources
      .filter((file) => !ALLOWED.has(file.path))
      .filter((file) => matches(file.text, QUANTITY_PATTERNS));

    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('still finds both allow-listed files, so the list cannot rot unnoticed', () => {
    // If one is renamed or deleted the entry is stale, and a stale allow-list quietly permits a file
    // that no longer exists while hiding the one that replaced it.
    const paths = sources.map((f) => f.path);

    for (const allowed of ALLOWED.keys()) {
      expect(paths).toContain(allowed);
    }
  });
});

interface Source {
  /** Forward-slashed and relative to `matching/`, so the allow-list reads the same on any OS. */
  readonly path: string;
  readonly text: string;
}

function collectSources(root: string): Source[] {
  const found: Source[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);

      if (statSync(full).isDirectory()) {
        // The fixtures under testing/ exist to build DTOs, not to render them.
        if (entry !== 'testing') {
          walk(full);
        }

        continue;
      }

      // Templates are scanned as well as components, and that is not incidental: this codebase's
      // convention is that a card's cells are plain DTO bindings in its .html, so the template is the
      // surface a hurried change actually edits. A `{{ s.quantityRequired - s.matchedInclDraft }}`
      // must fail this test just as loudly as the same expression in a .ts file.
      const isSource = entry.endsWith('.ts') && !entry.endsWith('.spec.ts');

      if (isSource || entry.endsWith('.html')) {
        found.push({
          path: relative(root, full).replace(/\\/g, '/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };

  walk(root);

  return found;
}

function matches(text: string, patterns: readonly RegExp[]): boolean {
  const code = withoutComments(text);

  return patterns.some((pattern) => pattern.test(code));
}

/**
 * Comments are stripped before scanning — block, line and HTML. These files explain at length *why*
 * they do not construct a `Date` and *why* the two allow-listed sites exist, and a doc comment saying
 * "never `new Date`" would otherwise fail the very test it is describing.
 */
function withoutComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}
