import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatchSide } from '../board/matching-board';

/**
 * What a column shows when "Filter on drag" has narrowed it to nothing: the card in hand has no
 * counterpart of a compatible stock class on this side.
 *
 * It is a **third** empty state, and it needs to be. The other two both make a claim this one must
 * not: `empty-column` says nothing is loaded, `filtered-empty` says the column's own filters are
 * hiding things and offers to clear them. Here nothing is loaded differently, no filter of the
 * operator's is involved, and the column comes back on its own the instant the grip is released — so
 * there is no control to offer, only an explanation. Alliance Group's `Deer` spaces reach it against
 * the seeded data: the supply vocabulary has no deer at all.
 *
 * It offers no way out because the pointer is down: a button cannot be clicked mid-gesture. The
 * sentence names the two ways out instead — let go, or switch the aid off in the top bar.
 *
 * One imprecision is accepted knowingly. If this column's own filters would have emptied it anyway,
 * this state still shows while the card is held, and "release to see the whole column" then overstates
 * what release will reveal. Distinguishing them would mean the screen passing down a second,
 * un-narrowed count for a case an operator reaches by grabbing a card while already looking at an
 * empty column.
 */
@Component({
  selector: 'app-nothing-compatible',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="material-symbols-outlined glyph" aria-hidden="true">filter_alt_off</span>

      <p class="headline">{{ headline() }}</p>
      <p class="prose">
        Filter on drag is showing only the stock classes that could take it. Let go to bring the whole
        column back, or switch the filter off in the top bar.
      </p>
    </div>
  `,
  // The empty-column block, borrowed rather than restated: the three empty states are one family
  // (design-system.md 13) and a second copy of the same 44px padding is a second thing to keep true.
  styleUrl: '../column/empty-column.scss',
})
export class NothingCompatible {
  readonly side = input.required<MatchSide>();

  /** The grabbed card's own stock class, named because it is the reason this state exists. */
  readonly stockClass = input.required<string>();

  readonly headline = computed(() =>
    this.side() === 'demand'
      ? `No processor spaces for ${this.stockClass()}`
      : `No livestock availability for ${this.stockClass()}`,
  );
}
