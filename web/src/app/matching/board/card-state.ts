import { Injectable, signal } from '@angular/core';
import { MatchSide } from './matching-board';

/**
 * Which cards are expanded.
 *
 * Provided at the root rather than on the screen so the state survives navigating away and back —
 * "remembered while the session lasts" (Phase 3, 5.1). Nothing is written to `localStorage`: a session
 * is exactly as long as the design asks for, and a card that is still expanded tomorrow would be a
 * small mystery rather than a convenience.
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
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });
  }
}

function cardKey(side: MatchSide, recordId: number): string {
  return `${side}:${recordId}`;
}
