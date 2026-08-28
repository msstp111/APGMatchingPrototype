import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { stockClassTile } from './stock-classes';

/**
 * A 20px monogram tile whose **shape carries species** — circle sheep, square cattle, diamond deer.
 *
 * Shape rather than colour, because hue belongs to the quantity meter and twenty-two saturated
 * swatches would destroy the three-colour ramp the screen is scanned for (design-system.md 7).
 *
 * The tile is 20px inside a 17px line box, so it overflows by 1.5px top and bottom. That is harmless —
 * the row is centred inside a 51px content box with 8.5px of slack either side — and it is precisely
 * why the card's height is set explicitly rather than summed from its parts (design-system.md 16.11).
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
