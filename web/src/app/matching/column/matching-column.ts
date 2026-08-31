import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WeekBand } from '../band/week-band';
import { BandView, MatchSide } from '../board/matching-board';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { ColumnAutoScroll } from '../drag/column-auto-scroll';
import { DragStore } from '../drag/drag-state';
import { ColumnFilters } from '../filters/column-filters';
import { FilteredEmpty } from '../filters/filtered-empty';
import { isDemandDefault, isSupplyDefault } from '../filters/filter-service';
import { MatchingPreferences } from '../filters/matching-preferences';

/**
 * One side of the matching screen: a header, the filter row, a sticky column-header strip, and a
 * scrolling run of week bands.
 *
 * The two columns are the same component with a different `side`, which is what keeps them
 * structurally identical — design-system.md 6.1 requires their line-1 columns to line up exactly, and
 * two separate column components would let that quietly stop being true.
 *
 * The column identifies itself by its header colour, its glyph, its strip labels and its noun set
 * rather than by which side of the screen it is on (design-system.md 6.3), because from this phase on
 * the two can swap position.
 */
@Component({
  selector: 'app-matching-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, WeekBand, ColumnFilters, FilteredEmpty, ColumnAutoScroll],
  templateUrl: './matching-column.html',
  styleUrl: './matching-column.scss',
})
export class MatchingColumn {
  private readonly preferences = inject(MatchingPreferences);
  private readonly drag = inject(DragStore);

  readonly side = input.required<MatchSide>();

  /** Already filtered, sorted and banded. The column renders; it decides nothing. */
  readonly bands = input.required<readonly BandView[]>();

  /**
   * The column's whole working set, unfiltered — what the filter row builds its menus from and what
   * the empty state names its locations and weeks from. Exactly one is ever populated.
   */
  readonly spaces = input<readonly ProcessorSpaceDto[]>([]);
  readonly availability = input<readonly LivestockAvailabilityDto[]>([]);

  readonly isDemand = computed(() => this.side() === 'demand');

  readonly title = computed(() =>
    this.isDemand() ? 'Processor Spaces' : 'Livestock Availability',
  );

  /** Demand and supply, said in glyphs: a works on one side, a location pin on the other. */
  readonly glyph = computed(() => (this.isDemand() ? 'factory' : 'location_on'));

  /** Counts the bands it was handed, which is the filtered set: every record is drawn once. */
  readonly shown = computed(() =>
    this.bands().reduce(
      (total, band) => total + (this.isDemand() ? band.spaces.length : band.availability.length),
      0,
    ),
  );

  /** The count before filtering, so `showing 12 of 47` can be honest about what is missing. */
  readonly total = input<number | null>(null);

  readonly totalCount = computed(() => this.total() ?? this.shown());

  /**
   * Whether this column is in its default filter and sort state (requirement 6.2).
   *
   * When it is not, the header grows a hueless `Filtered` chip and an explicit `Reset`, so nobody
   * concludes a record has vanished when it is merely filtered out.
   */
  readonly isDefault = computed(() =>
    this.isDemand()
      ? isDemandDefault(this.preferences.demandFilters(), this.preferences.demandSort())
      : isSupplyDefault(this.preferences.supplyFilters(), this.preferences.supplySort()),
  );

  /**
   * Filters have excluded everything, as opposed to there being nothing loaded.
   *
   * The two need different answers: this one has a way out (design-system.md 13), and a run of empty
   * week bands would not offer it.
   */
  readonly isFilteredEmpty = computed(() => this.shown() === 0 && this.totalCount() > 0);

  /** The opposite column takes the wash the moment a drag starts (design-system.md 10). */
  readonly isDropTarget = computed(() => this.drag.isTargetSide(this.side()));

  readonly isDragging = computed(() => this.drag.active() !== null);

  reset(): void {
    if (this.isDemand()) {
      this.preferences.resetDemand();

      return;
    }

    this.preferences.resetSupply();
  }
}
