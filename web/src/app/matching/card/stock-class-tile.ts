import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { stockClassTile } from './stock-classes';

/**
 * A 20px monogram tile whose **shape carries species** — circle sheep, square cattle, diamond deer.
 *
 * Shape rather than colour, because hue belongs to the quantity meter and twenty-two saturated
 * swatches would destroy the three-colour ramp the screen is scanned for (design-system.md 7).
 *
 * **It is no longer on the cards.** Mark had it removed from both card rows and from the header strip:
 * line 1 already spells the stock class out in full two cells along, so the monogram was saying the
 * same thing twice in the row's tightest 20px. It remains on the three surfaces where nothing else
 * says it — the quantity prompt, the match modal and the drag preview — which is also why the
 * `stock-class-coverage.spec.ts` guard still matters.
 */
@Component({
  selector: 'app-stock-class-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-class-tile.html',
  styleUrl: './stock-class-tile.scss',
})
export class StockClassTile {
  readonly stockClass = input.required<string>();

  private readonly tile = computed(() => stockClassTile(this.stockClass()));

  readonly monogram = computed(() => this.tile().monogram);

  readonly species = computed(() => this.tile().species);
}
