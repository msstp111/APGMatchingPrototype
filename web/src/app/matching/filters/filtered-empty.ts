import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { demandFilterOptions, supplyFilterOptions } from './filter-options';
import { ActiveFilter, activeDemandFilters, activeSupplyFilters } from './filter-service';
import { MatchingPreferences } from './matching-preferences';

/**
 * What a column shows when its filters exclude everything (requirement 7.3, design-system.md 13).
 *
 * **"No results" without the reason is how an operator concludes the app is broken**, so this
 * restates the filters that are actually being applied — the defaults included, since
 * `Status = Booked` and `Unmatched > 0` are the likeliest reason a record an operator expected is
 * not on screen.
 *
 * Two ways out, and they are not the same (design-system.md 13):
 *
 * - **Clear filters** shows everything that is loaded, including the Confirmed and Cancelled records
 *   the default deliberately hides. Someone who has filtered themselves into an empty column usually
 *   wants to see what is actually there.
 * - **Reset to default** puts the column back to its opening state.
 *
 * This is the *filtered* empty state. A column with nothing loaded at all is a different case, and
 * the one design-system.md 13 pairs with the debug `+ Add a record` button, which is Phase 7's.
 */
@Component({
  selector: 'app-filtered-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filtered-empty.html',
  styleUrl: './filtered-empty.scss',
})
export class FilteredEmpty {
  private readonly preferences = inject(MatchingPreferences);

  readonly side = input.required<MatchSide>();

  /** The unfiltered lists, so the summary can name a location or a week the filter is hiding. */
  readonly spaces = input<readonly ProcessorSpaceDto[]>([]);
  readonly availability = input<readonly LivestockAvailabilityDto[]>([]);

  readonly isDemand = computed(() => this.side() === 'demand');

  readonly headline = computed(() =>
    this.isDemand()
      ? 'No processor spaces match these filters'
      : 'No livestock availability matches these filters',
  );

  readonly active = computed<readonly ActiveFilter[]>(() => {
    if (this.isDemand()) {
      const options = demandFilterOptions(this.spaces(), this.preferences.demandFilters());

      return activeDemandFilters(this.preferences.demandFilters(), options.weekLabels);
    }

    const options = supplyFilterOptions(this.availability());

    return activeSupplyFilters(this.preferences.supplyFilters(), options.locationNames);
  });

  clear(): void {
    if (this.isDemand()) {
      this.preferences.clearDemand();

      return;
    }

    this.preferences.clearSupply();
  }

  reset(): void {
    if (this.isDemand()) {
      this.preferences.resetDemand();

      return;
    }

    this.preferences.resetSupply();
  }
}
