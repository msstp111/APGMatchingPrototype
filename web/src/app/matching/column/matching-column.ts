import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WeekBand } from '../band/week-band';
import { BandView, MatchSide } from '../board/matching-board';

/**
 * One side of the matching screen: a header, a reserved filter row, a sticky column-header strip, and
 * a scrolling run of week bands.
 *
 * The two columns are the same component with a different `side`, which is what keeps them
 * structurally identical — design-system.md 6.1 requires their line-1 columns to line up exactly, and
 * two separate column components would let that quietly stop being true.
 *
 * The filter row is **reserved and empty** in this phase. It holds 40px open so the density the design
 * is calculated against is the density Phase 4 inherits; putting a disabled control in it would
 * suggest an interaction that does not exist yet.
 */
@Component({
  selector: 'app-matching-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, WeekBand],
  templateUrl: './matching-column.html',
  styleUrl: './matching-column.scss',
})
export class MatchingColumn {
  readonly side = input.required<MatchSide>();

  readonly bands = input.required<readonly BandView[]>();

  readonly isDemand = computed(() => this.side() === 'demand');

  readonly title = computed(() => (this.isDemand() ? 'Processor Spaces' : 'Livestock Availability'));

  /** Demand and supply, said in glyphs: a works on one side, a location pin on the other. */
  readonly glyph = computed(() => (this.isDemand() ? 'factory' : 'location_on'));

  /**
   * `showing n of n` reads identically in both numbers until Phase 4 filters something out, at which
   * point the pair is the only honest way to say a list is incomplete. Counting the band views rather
   * than the raw input is what will make it true once filtering exists.
   */
  readonly shown = computed(() =>
    this.bands().reduce(
      (total, band) => total + (this.isDemand() ? band.spaces.length : band.availability.length),
      0,
    ),
  );

  /**
   * The count before filtering. Phase 4 passes it; until then the two numbers are equal, which is the
   * truth rather than a placeholder — nothing is being filtered out yet.
   */
  readonly total = input<number | null>(null);

  readonly totalCount = computed(() => this.total() ?? this.shown());
}
