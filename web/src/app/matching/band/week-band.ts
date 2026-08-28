import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AvailabilityCard } from '../card/availability-card';
import { SpaceCard } from '../card/space-card';
import { BandView, MatchSide } from '../board/matching-board';

/**
 * One week in one column: the sticky rail on the left, the band's cards on the right.
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
  readonly band = input.required<BandView>();

  readonly side = input.required<MatchSide>();

  readonly isDemand = computed(() => this.side() === 'demand');

  readonly isEmpty = computed(
    () => (this.isDemand() ? this.band().spaces.length : this.band().availability.length) === 0,
  );
}
