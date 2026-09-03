import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPreview,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LivestockAvailabilityDto } from '../../api/models';
import { CardStateStore } from '../board/card-state';
import { acceptsFrom, pairFromDrop } from '../drag/card-drag';
import { DragCard, DragStore } from '../drag/drag-state';
import { DragPreview } from '../drag/drag-preview';
import { DropOutcome } from '../drag/drop-outcome';
import { MatchDrop } from '../match/match-drop';
import { CardExpansion } from './card-expansion';
import { FillMeter } from './fill-meter';
import {
  cancelledPartnerCount,
  cancelledPartnerTitle,
  matchBreakdown,
  matchSummaryLabel,
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
 * band and is found by scrolling up into the backlog (resolved question 17) — and is dragged from
 * exactly there (requirement 1.5), which is why there is no second instance of it to disambiguate.
 */
@Component({
  selector: 'app-availability-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatTooltipModule,
    NgTemplateOutlet,
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
    CdkDropList,
    FillMeter,
    CardExpansion,
    DragPreview,
  ],
  templateUrl: './availability-card.html',
  styleUrl: './availability-card.scss',
})
export class AvailabilityCard {
  private readonly state = inject(CardStateStore);
  private readonly drag = inject(DragStore);
  private readonly matchDrop = inject(MatchDrop);
  private readonly outcome = inject(DropOutcome);

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

  readonly matchesLabel = computed(() => matchSummaryLabel(this.record().matches));

  readonly matchesTitle = computed(() => matchBreakdown(this.record().matches));

  /** With none, the label is a statement rather than a way in, so it stays plain text. */
  readonly hasMatches = computed(() => this.record().matches.length > 0);

  /** @see SpaceCard.orphanedCount — the same flag, counting cancelled processor spaces. */
  readonly orphanedCount = computed(() => cancelledPartnerCount(this.record().matches, 'supply'));

  readonly orphanedTitle = computed(() => cancelledPartnerTitle(this.orphanedCount(), 'supply'));

  readonly expanded = computed(() => this.state.isExpanded('supply', this.record().id));

  readonly dragCard = computed<DragCard>(() => ({ side: 'supply', availability: this.record() }));

  readonly dropState = computed(() => this.drag.dropState('supply', this.record().unmatched));

  readonly isSource = computed(() => this.drag.isSource('supply', this.record().id));

  /** The one card under the pointer (Phase 9). Every other treatment on this row keys off it. */
  readonly isHot = computed(() => this.drag.isHot('supply', this.record().id));

  /**
   * This row recedes so the two ends of the gesture are the only lit ones.
   *
   * Both spotlights are the same call: in the target column it is everything but the hot card, in the
   * source column everything but the one that was picked up. `DragStore.isDimmed` decides which
   * question this card is being asked, because only it knows where the pointer is.
   */
  readonly isDimmed = computed(() => this.drag.isDimmed('supply', this.record().id));

  /**
   * The head count the drop would add here, or null unless this is the hovered card.
   *
   * Guarded on `isHot` as well as on the service, because `DropOutcome` holds one answer for the
   * whole screen: without the guard every card in the column would ghost the same segment.
   */
  readonly proposedQuantity = computed(() =>
    this.isHot() && this.dropState() === 'valid' ? this.outcome.quantity() : null,
  );

  /** A property, not a method: CDK reads the predicate once per drag and it must not be rebound. */
  readonly accepts = acceptsFrom('supply');

  toggle(): void {
    this.state.toggleExpanded('supply', this.record().id);
  }

  /** CDK says the pointer is over this card. The enter predicate has already refused same-column. */
  entered(): void {
    this.drag.enter(this.dragCard());
  }

  leftCard(): void {
    this.drag.leave('supply', this.record().id);
  }

  dragStarted(): void {
    this.drag.begin(this.dragCard());
  }

  dragEnded(): void {
    this.drag.end();
  }

  /** Identical to the demand card's, and for the same reasons — see `SpaceCard.dropped`. */
  dropped(event: CdkDragDrop<DragCard, DragCard>): void {
    const pair = pairFromDrop(event);

    if (!pair || this.drag.cancelled()) {
      return;
    }

    this.matchDrop.dropped(pair);
  }
}
