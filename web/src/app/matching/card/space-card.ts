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
import { ProcessorSpaceDto } from '../../api/models';
import { CardStateStore } from '../board/card-state';
import { acceptsFrom, pairFromDrop } from '../drag/card-drag';
import { DragCard, DragStore } from '../drag/drag-state';
import { MatchDrop } from '../match/match-drop';
import { CardExpansion } from './card-expansion';
import { FillMeter } from './fill-meter';
import { StockClassTile } from './stock-class-tile';
import {
  cancelledPartnerCount,
  cancelledPartnerTitle,
  matchBreakdown,
  matchSummaryLabel,
  quantityClass,
  spineClass,
  statusIcon,
} from './card-chrome';

/**
 * A Processor Space as a card: a table row that has grown a status spine, a fill meter and an expand
 * chevron (design-system.md 0).
 *
 * Since Phase 5 it is **both ends of the drag**: a draggable, and a drop list that holds no items and
 * exists only to be a target. The same wiring appears on the availability card, and the shared
 * `acceptsFrom` / `pairFromDrop` are what make the two directions identical rather than similar.
 *
 * Every figure on it still comes off the DTO. The card computes nothing, and the drop computes nothing
 * either: it asks the server what the pair may become.
 */
@Component({
  selector: 'app-space-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatTooltipModule,
    NgTemplateOutlet,
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
    CdkDropList,
    StockClassTile,
    FillMeter,
    CardExpansion,
  ],
  templateUrl: './space-card.html',
  styleUrl: './space-card.scss',
})
export class SpaceCard {
  private readonly state = inject(CardStateStore);
  private readonly drag = inject(DragStore);
  private readonly matchDrop = inject(MatchDrop);

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

  readonly matchesLabel = computed(() => matchSummaryLabel(this.space().matches));

  readonly matchesTitle = computed(() => matchBreakdown(this.space().matches));

  /** With none, the label is a statement rather than a way in, so it stays plain text. */
  readonly hasMatches = computed(() => this.space().matches.length > 0);

  /**
   * How many of this space's matches sit under a cancelled availability record.
   *
   * Nearly always zero, and worth a glyph when it is not: cancelling a record never cascades, so those
   * matches are still live and still counted in this card's own figures while the record on the other
   * end has gone. Nothing else on this card would say so.
   */
  readonly orphanedCount = computed(() => cancelledPartnerCount(this.space().matches, 'demand'));

  readonly orphanedTitle = computed(() => cancelledPartnerTitle(this.orphanedCount(), 'demand'));

  readonly expanded = computed(() => this.state.isExpanded('demand', this.space().id));

  /** What this card hands a drop: itself, in full, on the demand side. */
  readonly dragCard = computed<DragCard>(() => ({ side: 'demand', space: this.space() }));

  /** How this card should look to the drag in flight — nothing at all unless it could receive it. */
  readonly dropState = computed(() => this.drag.dropState('demand', this.space().unmatched));

  /** The stay-behind face: CDK will have moved or hidden the dragged node. */
  readonly isSource = computed(() => this.drag.isSource('demand', this.space().id));

  /** A property, not a method: CDK reads the predicate once per drag and it must not be rebound. */
  readonly accepts = acceptsFrom('demand');

  toggle(): void {
    this.state.toggleExpanded('demand', this.space().id);
  }

  dragStarted(): void {
    this.drag.begin(this.dragCard());
  }

  dragEnded(): void {
    this.drag.end();
  }

  /**
   * A card was released over this one.
   *
   * Escape is checked here rather than intercepted at the source, because CDK has no way to abandon a
   * pointer sequence early: the gesture always finishes and always emits its drop. Ignoring it is the
   * cancel (requirement 1.8).
   */
  dropped(event: CdkDragDrop<DragCard, DragCard>): void {
    const pair = pairFromDrop(event);

    if (!pair || this.drag.cancelled()) {
      return;
    }

    this.matchDrop.dropped(pair);
  }
}
