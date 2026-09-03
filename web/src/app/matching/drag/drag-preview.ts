import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { StockClassTile } from '../card/stock-class-tile';
import { DropOutcome } from './drop-outcome';

/**
 * What follows the pointer during a drag: a 200px chip, not a copy of the 52px card.
 *
 * Phase 5's preview was the card itself at full width, which meant the thing in your hand covered the
 * row you were aiming at — a 518px card obscuring the 518px card underneath it. The chip carries the
 * three fields a drag actually needs to stay oriented (what species, whose, how many) and gets out of
 * the way of the answer.
 *
 * It also carries the outcome (design-system.md 10, Phase 9). The pill hangs under the chip rather
 * than sitting on the target card, at Mark's direction: the outcome belongs to the card in your hand,
 * travels with it, and cannot be mistaken for something the target row is asserting about itself.
 *
 * The figure in the pill is the **server's**, from `DropOutcome` — never `min()` of two DTO fields.
 * See that service for why that distinction is worth a network call.
 *
 * **And the pill is withheld whenever it would only repeat the chip.** Most drops move the whole
 * record: 23 head onto a space wanting 60 transfers 23, and a pill reading `Match 23 head` under a
 * chip reading `23 head` has told the operator nothing while costing them a glance. It appears only
 * when the two differ — which is exactly the case worth flagging, because a different figure means
 * the drop is a *partial* one and some of what is in their hand will be left behind.
 */
@Component({
  selector: 'app-drag-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StockClassTile],
  templateUrl: './drag-preview.html',
  styleUrl: './drag-preview.scss',
})
export class DragPreview {
  private readonly outcome = inject(DropOutcome);

  readonly stockClass = input.required<string>();

  /** The processor on a space, the location on an availability record. */
  readonly name = input.required<string>();

  /** `quantityRequired` or `quantityAvailable`, rendered as given. */
  readonly headCount = input.required<number>();

  /** The head count the drop would default to, or null while unknown, unhovered or refused. */
  readonly proposed = this.outcome.quantity;

  /**
   * Not arithmetic: two figures that are both already on screen, compared for equality to decide
   * whether to draw the second one. Nothing here works a quantity out — the chip's figure is the
   * DTO's and the pill's is the server's, and this only asks whether saying both is worth the ink.
   */
  readonly hasOutcome = computed(() => {
    const proposed = this.proposed();

    return proposed !== null && proposed !== this.headCount();
  });
}
