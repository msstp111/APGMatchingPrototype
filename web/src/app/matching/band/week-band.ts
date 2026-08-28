import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { AvailabilityCard } from '../card/availability-card';
import { CarryOverCard } from '../card/carry-over-card';
import { SpaceCard } from '../card/space-card';
import { BandView, MatchSide } from '../board/matching-board';
import { CardStateStore } from '../board/card-state';

/**
 * One week in one column: the sticky rail on the left, the band's cards on the right.
 *
 * Bands are always rendered in a continuous run, including weeks with nothing in them — an empty week
 * is information (requirement 1.6), and hiding it would make two adjacent bands look consecutive when
 * they are three weeks apart.
 *
 * Carry-overs come first, under their own sub-header, then a divider, then the week's own records.
 * That order is the reading order of the decision: what is still outstanding, then what is new.
 */
@Component({
  selector: 'app-week-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, SpaceCard, AvailabilityCard, CarryOverCard],
  templateUrl: './week-band.html',
  styleUrl: './week-band.scss',
})
export class WeekBand {
  private readonly state = inject(CardStateStore);

  readonly band = input.required<BandView>();

  readonly side = input.required<MatchSide>();

  readonly isDemand = computed(() => this.side() === 'demand');

  /** Carry-overs are a supply-side idea: a processor space belongs to one delivery day and one only. */
  readonly carryOver = computed(() => (this.isDemand() ? [] : this.band().carryOver));

  readonly nativeCount = computed(() =>
    this.isDemand() ? this.band().spaces.length : this.band().availability.length,
  );

  readonly isEmpty = computed(() => this.nativeCount() === 0 && this.carryOver().length === 0);

  /**
   * A "New this week" divider only earns its 26px when there is something above it to divide from.
   * With no carry-overs the band's own cards are all there is, and the label would be noise.
   */
  readonly showsNewThisWeek = computed(() => this.carryOver().length > 0 && this.nativeCount() > 0);

  readonly carryOverOpen = computed(() =>
    this.state.isCarryOverGroupOpen(
      this.side(),
      this.band().week.weekCommencing,
      this.carryOver().length,
    ),
  );

  toggleCarryOver(): void {
    this.state.toggleCarryOverGroup(
      this.side(),
      this.band().week.weekCommencing,
      this.carryOver().length,
    );
  }
}
