import { Injectable, signal } from '@angular/core';
import { MatchSide } from './matching-board';

/**
 * Which cards are expanded — **at most one per column** (2026-09-07).
 *
 * Provided at the root rather than on the screen so the state survives navigating away and back —
 * "remembered while the session lasts" (Phase 3, 5.1). Nothing is written to `localStorage`: a session
 * is exactly as long as the design asks for, and a card that is still expanded tomorrow would be a
 * small mystery rather than a convenience.
 *
 * **Opening a card closes the other one in its column.** Every other part of the expanded-card work
 * treats the drawer's legibility as a styling problem; this is the one part that treats it as an
 * arithmetic one. A column of 52px rows interrupted by two or three ~200px drawers is a run of
 * near-identical white and near-white bands whatever the drawer is made of, and the count is the
 * only variable that removes the problem rather than decorating around it.
 *
 * **Per column, not per screen**, and the distinction is the whole of the design: comparing a
 * Processor Space against an Availability record is the screen's central task, so closing a demand
 * drawer because a supply drawer opened would break the thing the two columns exist for. Comparing
 * two records on the SAME side is a scroll either way — they are in one list, and at 52px collapsed
 * plus a drawer each they were rarely both on screen even when both could be open.
 */
@Injectable({ providedIn: 'root' })
export class CardStateStore {
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /**
   * Keyed by side and record id, which is enough because a record is drawn exactly once in its
   * column. (Phase 3 keyed the band in as well, for a design that drew one record in several bands.
   * That design is gone — resolved question 17 — and so is the band component of the key.)
   */
  isExpanded(side: MatchSide, recordId: number): boolean {
    return this.expanded().has(cardKey(side, recordId));
  }

  toggleExpanded(side: MatchSide, recordId: number): void {
    const key = cardKey(side, recordId);

    this.expanded.update((current) => {
      // Collapsing is just a delete: nothing else changes, and in particular the other column's
      // open card is never touched by either branch.
      if (current.has(key)) {
        const next = new Set(current);
        next.delete(key);

        return next;
      }

      // Opening replaces this side's entry rather than adding to it. Built from the keys of the
      // OTHER side and this one key, so a third side — were there ever one — would keep its own
      // card open without this line needing to know about it.
      const otherSide = [...current].filter((open) => !open.startsWith(sideKeyPrefix(side)));

      return new Set([...otherSide, key]);
    });
  }
}

function sideKeyPrefix(side: MatchSide): string {
  return `${side}:`;
}

function cardKey(side: MatchSide, recordId: number): string {
  return `${sideKeyPrefix(side)}${recordId}`;
}
