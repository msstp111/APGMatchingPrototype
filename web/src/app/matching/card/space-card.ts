import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ProcessorSpaceDto } from '../../api/models';
import { CardStateStore } from '../board/card-state';
import { CardExpansion } from './card-expansion';
import { FillMeter } from './fill-meter';
import { StockClassTile } from './stock-class-tile';
import { matchCountLabel, quantityClass, spineClass, statusIcon } from './card-chrome';

/**
 * A Processor Space as a card: a table row that has grown a status spine, a fill meter and an expand
 * chevron (design-system.md 0).
 *
 * Read-only in this phase — the chevron is the only control on it. Dragging is Phase 5, opening a
 * match is Phase 6, and the Confirm-space button belongs to Phase 6 even though `canConfirm` already
 * ships on the DTO.
 *
 * Every figure on it comes off the DTO. The card computes nothing.
 */
@Component({
  selector: 'app-space-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, StockClassTile, FillMeter, CardExpansion],
  templateUrl: './space-card.html',
  styleUrl: './space-card.scss',
})
export class SpaceCard {
  private readonly state = inject(CardStateStore);

  readonly space = input.required<ProcessorSpaceDto>();

  /** Position in the rendered list within the band — the zebra stripe is positional. */
  readonly zebra = input(false);

  // These are named apart from the helpers they call. Giving a member the same name as the imported
  // function reads as self-recursion, and invites a later edit to "tidy" it into one.
  readonly spine = computed(() => spineClass(this.space().status));

  readonly statusGlyph = computed(() => statusIcon(this.space().status));

  readonly isCancelled = computed(() => this.space().status === 'Cancelled');

  /** Only Confirmed takes the filled glyph; Booked and Pending stay outline, as LMS's icons are. */
  readonly statusFilled = computed(() => this.space().status === 'Confirmed');

  /** `Over` on a space is blue and permitted — the operator may deliberately over-fill demand. */
  readonly overInk = computed(() => quantityClass(this.space().quantityState, 'demand'));

  readonly isOver = computed(() => this.space().quantityState === 'Over');

  readonly matchesLabel = computed(() => matchCountLabel(this.space().matches.length));

  readonly expanded = computed(() => this.state.isExpanded('demand', this.space().id));

  toggle(): void {
    this.state.toggleExpanded('demand', this.space().id);
  }
}
