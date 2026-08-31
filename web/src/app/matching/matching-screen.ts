import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../api/models';
import { MatchingColumn } from './column/matching-column';
import { buildBoard } from './board/matching-board';
import {
  filterAvailability,
  filterSpaces,
  sortAvailability,
  sortSpaces,
} from './filters/filter-service';
import { MatchingPreferences } from './filters/matching-preferences';

/**
 * The matching screen: Processor Spaces and Livestock Availability as week-banded card lists, either
 * way round.
 *
 * **Filtering and sorting happen on `buildBoard`'s inputs, never inside it**, which is the seam Phase
 * 3b left for exactly this. Two things fall out of that for free and neither needs code here:
 *
 * - the band header totals count the filtered set, because they are rolled up from the list that was
 *   passed in;
 * - **each column's leading empty bands are re-trimmed** on every filter change, because
 *   `buildBoard` trims from the records it is given. Filter out the oldest surviving space and the
 *   demand column's first band moves forward, while the supply column's stays exactly where it was.
 *
 * Nothing on this screen is recomputed from a DTO figure. Filtering compares against values the
 * server worked out, sorting compares two of them, and the band calendar arrives already ordered.
 */
@Component({
  selector: 'app-matching-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchingColumn],
  templateUrl: './matching-screen.html',
  styleUrl: './matching-screen.scss',
})
export class MatchingScreen {
  private readonly api = inject(ApiClient);
  private readonly preferences = inject(MatchingPreferences);

  readonly spaces = signal<readonly ProcessorSpaceDto[]>([]);
  readonly availability = signal<readonly LivestockAvailabilityDto[]>([]);
  readonly weeks = signal<readonly WeekBandDto[]>([]);
  readonly error = signal<string | null>(null);

  /** Which side sits on the left. Purely presentational, and persisted (requirement 5). */
  readonly flipped = this.preferences.flipped;

  /**
   * Sorted after filtering, and both before banding: `buildBoard` keeps the order it is handed inside
   * each band, so a sort reorders cards **within** each week and can never dissolve the bands.
   */
  readonly visibleSpaces = computed(() =>
    sortSpaces(
      filterSpaces(this.spaces(), this.preferences.demandFilters()),
      this.preferences.demandSort(),
    ),
  );

  readonly visibleAvailability = computed(() =>
    sortAvailability(
      filterAvailability(this.availability(), this.preferences.supplyFilters()),
      this.preferences.supplySort(),
    ),
  );

  readonly board = computed(() =>
    buildBoard(this.weeks(), this.visibleSpaces(), this.visibleAvailability()),
  );

  /**
   * The three requests land in any order, and with no bands there is nothing to place records into —
   * `buildBoard` would correctly report every record as unplaced and the screen would render two empty
   * columns for one round trip, which reads as an empty data set rather than a pending one.
   *
   * Zero bands is unambiguous: the endpoint always includes the current week, so an empty list means
   * "not arrived" and never "no weeks".
   */
  readonly ready = computed(() => this.weeks().length > 0);

  constructor() {
    this.api.processorSpaces().subscribe({
      next: (records) => this.spaces.set(records),
      error: () => this.error.set(UNREACHABLE),
    });

    this.api.livestockAvailability().subscribe({
      next: (records) => this.availability.set(records),
      error: () => this.error.set(UNREACHABLE),
    });

    this.api.weekBands().subscribe({
      next: (bands) => this.weeks.set(bands),
      error: () => this.error.set(UNREACHABLE),
    });
  }

  /**
   * Swaps the columns and nothing else (requirement 5.2).
   *
   * Implemented as CSS order rather than by reordering the template, so neither column component is
   * destroyed and recreated: filters, sort, expanded cards and scroll position all survive the flip
   * because nothing about them is touched.
   */
  toggleFlip(): void {
    this.preferences.toggleFlipped();
  }
}

const UNREACHABLE = 'Could not reach the API. Is it running on http://localhost:5286?';
