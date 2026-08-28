import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LivestockAvailabilityDto } from '../../api/models';
import { CardStateStore } from '../board/card-state';
import { CardExpansion } from './card-expansion';
import { FillMeter } from './fill-meter';
import { StockClassTile } from './stock-class-tile';
import {
  matchCountLabel,
  quantityClass,
  spineClass,
  statusIcon,
  transactionTypeLabel,
} from './card-chrome';

/**
 * A Livestock Availability record as a card — the full one, in its home band.
 *
 * Identical geometry to the demand card and a different set of DTO fields in the same cells. Note the
 * status here is the *derived* one: the server works it out from the match set, and this card renders
 * the answer without knowing the rule.
 *
 * The record is drawn here and nowhere else. A record still unmatched weeks later stays in this one
 * band and is found by scrolling up into the backlog (resolved question 17).
 */
@Component({
  selector: 'app-availability-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, StockClassTile, FillMeter, CardExpansion],
  templateUrl: './availability-card.html',
  styleUrl: './availability-card.scss',
})
export class AvailabilityCard {
  private readonly state = inject(CardStateStore);

  readonly record = input.required<LivestockAvailabilityDto>();

  readonly zebra = input(false);

  // Named apart from the helpers they call, so neither reads as self-recursion.
  readonly spine = computed(() => spineClass(this.record().status));

  readonly statusGlyph = computed(() => statusIcon(this.record().status));

  readonly isCancelled = computed(() => this.record().status === 'Cancelled');

  readonly statusFilled = computed(() => this.record().status === 'Confirmed');

  /**
   * `Over` on this side is pink and is a **bug flag**: supply is hard-capped at the point of the drag,
   * so it should be unreachable. That it is drawn at all is the point of it.
   */
  readonly overInk = computed(() => quantityClass(this.record().quantityState, 'supply'));

  readonly isOver = computed(() => this.record().quantityState === 'Over');

  readonly transactionType = computed(() => transactionTypeLabel(this.record().transactionType));

  readonly matchesLabel = computed(() => matchCountLabel(this.record().matches.length));

  readonly expanded = computed(() => this.state.isExpanded('supply', this.record().id));

  toggle(): void {
    this.state.toggleExpanded('supply', this.record().id);
  }
}
