import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AvailabilityCard } from '../card/availability-card';
import { SpaceCard } from '../card/space-card';
import { BandView, MatchSide } from '../board/matching-board';
import { DragStore } from '../drag/drag-state';

/**
 * One week in one column: a sticky header naming the week, then the band's cards.
 *
 * Bands render in a continuous run, including weeks with nothing in them — an empty week is
 * information (requirement 1.6), and hiding it would make two adjacent bands look consecutive when
 * they are three weeks apart. The one exception is the *leading* run of empty bands, which
 * `buildBoard` trims off per column before this component ever sees it.
 *
 * Every record in the band is one of the band's own: nothing is repeated here from an earlier week.
 */
@Component({
  selector: 'app-week-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SpaceCard, AvailabilityCard],
  templateUrl: './week-band.html',
  styleUrl: './week-band.scss',
})
export class WeekBand {
  private readonly drag = inject(DragStore);

  readonly band = input.required<BandView>();

  readonly side = input.required<MatchSide>();

  readonly isDemand = computed(() => this.side() === 'demand');

  /**
   * The header recedes with the cards under it during a drag (Phase 9).
   *
   * Chrome, not a candidate: a lit band header over a column of dimmed cards reads as the header
   * being the thing selected, which is the one thing it can never be.
   */
  readonly isDimmed = computed(() => this.drag.isColumnDimmed(this.side()));

  readonly isEmpty = computed(
    () => (this.isDemand() ? this.band().spaces.length : this.band().availability.length) === 0,
  );
}
