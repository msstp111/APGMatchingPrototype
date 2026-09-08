import { DragCard } from './drag-state';

/**
 * Whether two records could plausibly be matched on stock class, and the list narrowing that follows
 * from it — the pure half of "Filter on drag".
 *
 * **The judgement is not here.** Which classes go with which lives in one place,
 * `Apg.Domain/Matching/StockClassCompatibility.cs`, and reaches the client as a list of tags on each
 * record (`stockClassGroups`). This file performs the one test that list is designed for: do the two
 * sets intersect. That is a membership test over strings the server chose, in the same shape as the
 * status filter's `includes` — no table, no aliases, no species, nothing to drift.
 *
 * It is also, deliberately, **only ever a filter**. A drop is never refused for stock class: the two
 * vocabularies do not map onto one another, the operator is the one who judges compatibility
 * (`CLAUDE.md`, "Stock class is not a shared vocabulary"), and everything this module hides comes
 * straight back when the aid is switched off.
 */

/** Any record either column holds, seen only through the field this module needs. */
interface HasStockClassGroups {
  readonly stockClassGroups: readonly string[];
}

/**
 * The two tag sets intersect.
 *
 * An empty list on either side means "compatible with nothing", which is not a state the server
 * produces — an unrecognised stock class is given *every* tag, so it fails towards being visible —
 * but it is what a hand-built fixture or a half-migrated wire format would send, and hiding a column
 * for it would be the worse of the two answers. So an empty list is treated as no opinion.
 */
export function sharesStockClassGroup(
  one: readonly string[],
  other: readonly string[],
): boolean {
  if (one.length === 0 || other.length === 0) {
    return true;
  }

  return one.some((group) => other.includes(group));
}

/**
 * The records on one side that the grabbed card could go to, in the order they were given.
 *
 * One generic function used from both columns, for the same reason `pairFromDrop` is one function
 * used in both directions: two of these is how the two sides of the screen come to disagree about
 * the same rule.
 */
export function compatibleWith<T extends HasStockClassGroups>(
  records: readonly T[],
  grabbed: DragCard,
): readonly T[] {
  const groups = dragStockClassGroups(grabbed);

  return records.filter((record) => sharesStockClassGroup(record.stockClassGroups, groups));
}

/** The grabbed card's own tags, whichever side it came from. */
export function dragStockClassGroups(card: DragCard): readonly string[] {
  return card.side === 'demand'
    ? card.space.stockClassGroups
    : card.availability.stockClassGroups;
}
