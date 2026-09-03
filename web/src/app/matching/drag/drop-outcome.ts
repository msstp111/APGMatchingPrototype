import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchProposalDto } from '../../api/models';
import { pairOf } from './card-drag';
import { DragStore } from './drag-state';

/**
 * What the drop would actually create, asked while the pointer is still holding the card.
 *
 * ## Why this is a fetch and not a `Math.min`
 *
 * The quantity a drop defaults to is `min(unmatched on each side)`, and that rule lives in
 * `MatchCreation.DefaultMatchQuantity` in `Apg.Domain`. Writing it again here — two DTO fields and a
 * `Math.min` — is three lines, and it is exactly the breach `no-domain-arithmetic.spec.ts` exists to
 * catch: the moment the rule exists in both languages the two drift, and this one has already moved
 * once (the cancelled-counterparty rule of 2026-09-01 changed which matches count toward `unmatched`,
 * and a client-side copy would have kept quoting the old figure at the operator).
 *
 * So the pill quotes the server. `GET /api/match-proposal` is the same endpoint the drop already
 * calls, asked earlier — the pill and the dialog that follows it therefore cannot disagree, because
 * they are the same answer to the same question.
 *
 * ## What it costs
 *
 * One request per card hovered, on localhost, during a gesture that is already going to make one.
 * They are cached for the life of the drag: sweeping back and forth over two cards asks twice, not
 * twenty times. The drop still asks again rather than reusing the cache — requirement 3.2 wants the
 * refusal to be the server's word at the moment of release, and a cached `isAllowed` is a promise
 * about a record that another operator may have filled since.
 */
@Injectable({ providedIn: 'root' })
export class DropOutcome {
  private readonly api = inject(ApiClient);
  private readonly drag = inject(DragStore);

  /** Cleared at the end of every drag: a proposal is only true of the moment it was asked. */
  private readonly cache = new Map<string, MatchProposalDto>();

  private readonly proposal = signal<MatchProposalDto | null>(null);

  private request: Subscription | null = null;

  /** The key the in-flight request was made for, so a late answer to a stale question is dropped. */
  private pending: string | null = null;

  /**
   * The pair the pointer is currently over, through the same function the drop uses.
   *
   * Not "the hot card" — the hot card is half of it. Both directions resolve here so the pill on a
   * space dragged onto an availability record says the same thing as the reverse (requirement 1.2).
   */
  private readonly pair = computed(() => pairOf(this.drag.active(), this.drag.hot()));

  constructor() {
    effect(() => {
      const pair = this.pair();

      if (pair === null) {
        untracked(() => this.clear());

        return;
      }

      untracked(() => this.ask(key(pair.space.id, pair.availability.id), pair));
    });
  }

  /**
   * The head count the drop would default to, or null while it is unknown or refused.
   *
   * Null covers three cases that all mean "say nothing": no card is hovered, the answer has not come
   * back yet, and the server has refused the pair outright. A pill that guessed during the first of
   * those, then corrected itself, would be worse than one that waits — this is a figure the operator
   * is about to commit livestock against.
   */
  readonly quantity = computed(() => {
    const proposal = this.proposal();

    return proposal && proposal.isAllowed ? proposal.quantity : null;
  });

  private ask(cacheKey: string, pair: { space: { id: number }; availability: { id: number } }): void {
    const cached = this.cache.get(cacheKey);

    if (cached) {
      this.proposal.set(cached);

      return;
    }

    // The previous card's answer must not survive the move to this one: an outcome pill showing the
    // last card's figure over this card's row is the one failure this feature must not have.
    this.proposal.set(null);
    this.request?.unsubscribe();
    this.pending = cacheKey;

    this.request = this.api.matchProposal(pair.space.id, pair.availability.id).subscribe({
      next: (proposal) => {
        this.cache.set(cacheKey, proposal);

        if (this.pending === cacheKey) {
          this.proposal.set(proposal);
        }
      },
      // Silent, deliberately. The drop will ask again and report properly; a snack bar fired from a
      // hover would put an error on screen for a gesture the operator has not yet committed to.
      error: () => {
        if (this.pending === cacheKey) {
          this.proposal.set(null);
        }
      },
    });
  }

  private clear(): void {
    this.request?.unsubscribe();
    this.request = null;
    this.pending = null;
    this.proposal.set(null);

    if (this.drag.active() === null) {
      this.cache.clear();
    }
  }
}

function key(spaceId: number, availabilityId: number): string {
  return `${spaceId}:${availabilityId}`;
}
