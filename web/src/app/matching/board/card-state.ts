import { Injectable, signal } from '@angular/core';
import { CARRY_OVER_EXPAND_LIMIT } from './carry-over';
import { MatchSide } from './matching-board';

/**
 * Which cards are expanded, and which carry-over groups are open.
 *
 * Provided at the root rather than on the screen so the state survives navigating away and back —
 * "remembered while the session lasts" (Phase 3, 5.1). Nothing is written to `localStorage`: a session
 * is exactly as long as the design asks for, and a card that is still expanded tomorrow would be a
 * small mystery rather than a convenience.
 */
@Injectable({ providedIn: 'root' })
export class CardStateStore {
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  private readonly carryOverGroups = signal<ReadonlyMap<string, boolean>>(new Map());

  /**
   * Expansion is keyed per **card**, not per record, and that distinction is load-bearing.
   *
   * A carried-over record has one card in its home band and one in each later band. They show the same
   * data because they are the same object, but they are different cards in different places on a long
   * scroll. Keying by record id alone would expand all of them at once, and the home band's card
   * growing would push everything below it — including the carry-over the pointer is over — down the
   * page, which is exactly what Phase 3, 5.2 forbids.
   */
  isExpanded(side: MatchSide, recordId: number, bandWeek: string): boolean {
    return this.expanded().has(cardKey(side, recordId, bandWeek));
  }

  toggleExpanded(side: MatchSide, recordId: number, bandWeek: string): void {
    const key = cardKey(side, recordId, bandWeek);

    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });
  }

  /**
   * Whether a band's carry-over group is showing its cards.
   *
   * Until the operator touches it, the answer comes from the count: at or below
   * `CARRY_OVER_EXPAND_LIMIT` the cards are visible and immediately draggable, above it the group
   * collapses to its one-line summary so a pile-up cannot bury the week's own work. Once toggled, the
   * operator's choice sticks for that band and that column.
   */
  isCarryOverGroupOpen(side: MatchSide, bandWeek: string, count: number): boolean {
    return this.carryOverGroups().get(groupKey(side, bandWeek)) ?? count <= CARRY_OVER_EXPAND_LIMIT;
  }

  toggleCarryOverGroup(side: MatchSide, bandWeek: string, count: number): void {
    const key = groupKey(side, bandWeek);
    const open = this.isCarryOverGroupOpen(side, bandWeek, count);

    this.carryOverGroups.update((current) => new Map(current).set(key, !open));
  }
}

function cardKey(side: MatchSide, recordId: number, bandWeek: string): string {
  return `${side}:${recordId}@${bandWeek}`;
}

function groupKey(side: MatchSide, bandWeek: string): string {
  return `${side}@${bandWeek}`;
}
