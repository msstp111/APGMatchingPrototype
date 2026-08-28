import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LivestockAvailabilityDto } from '../../api/models';
import { CardStateStore } from '../board/card-state';
import { CardExpansion } from './card-expansion';
import { FillMeter } from './fill-meter';
import { StockClassTile } from './stock-class-tile';
import { spineClass } from './card-chrome';

/**
 * A record still available from an earlier week, repeated at the top of this band.
 *
 * **It is the same record, not a copy.** The `record` input is the very object the home band's full
 * card is bound to, so its matches, sums and status cannot diverge — there is nothing to keep in sync.
 * Phase 5's drag on this row will create a match against that record, and the moment its unmatched
 * quantity reaches zero the row simply stops being produced.
 *
 * One line, 40px, because it is a repeat: the full detail lives in its home band. What survives is
 * what makes the decision *this* week — what it is, where from, how long it has been sitting there,
 * and how much is left. There is no line 2 and no quantity-available column.
 *
 * ## Two details that look like mistakes and are not
 *
 * - **The dash is on the outer border, not the left edge.** The roadmap says "muted, dashed", but a
 *   dashed left edge is already the Cancelled spine, and a carry-over must keep showing its own true
 *   status — a record can carry over while Pending. So the spine stays as it is and the dash becomes a
 *   real border on the other three sides (design-system.md 9.2).
 * - **Its line 1 does not align to the header strip.** It is not one of the band's own rows, and
 *   saying so visually is the point of the treatment.
 */
@Component({
  selector: 'app-carry-over-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, StockClassTile, FillMeter, CardExpansion],
  templateUrl: './carry-over-card.html',
  styleUrl: './carry-over-card.scss',
})
export class CarryOverCard {
  private readonly state = inject(CardStateStore);

  readonly record = input.required<LivestockAvailabilityDto>();

  /** The band this repeat sits in — not the record's home week. */
  readonly bandWeek = input.required<string>();

  readonly spine = computed(() => spineClass(this.record().status));

  readonly isCancelled = computed(() => this.record().status === 'Cancelled');

  /**
   * Expansion is keyed on this band, so expanding the repeat does not also expand the home card and
   * shove everything between them down the page (Phase 3, 5.2).
   */
  readonly expanded = computed(() =>
    this.state.isExpanded('supply', this.record().id, this.bandWeek()),
  );

  toggle(): void {
    this.state.toggleExpanded('supply', this.record().id, this.bandWeek());
  }
}
