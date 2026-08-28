import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../api/models';
import { MatchingColumn } from './column/matching-column';
import { buildBoard } from './board/matching-board';

/**
 * The matching screen: Processor Spaces on the left, Livestock Availability on the right, both as week-
 * banded card lists.
 *
 * Read-only in this phase. Expanding and collapsing a card is the only interaction — filtering and
 * sorting are Phase 4, dragging is Phase 5, opening a match is Phase 6.
 *
 * Three streams, because the week bands are a calendar and not a record set. Everything on screen is
 * either a value the server computed or a shape `buildBoard` arranged those values into; this component
 * itself decides nothing.
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

  readonly spaces = signal<readonly ProcessorSpaceDto[]>([]);
  readonly availability = signal<readonly LivestockAvailabilityDto[]>([]);
  readonly weeks = signal<readonly WeekBandDto[]>([]);
  readonly error = signal<string | null>(null);

  /**
   * Recomputed whenever any of the three arrive. Phase 4 will filter the inputs to this call rather
   * than reaching inside the result, which is why `buildBoard` takes lists and not a filter.
   */
  readonly board = computed(() =>
    buildBoard(this.weeks(), this.spaces(), this.availability()),
  );

  /**
   * The three requests land in any order, and with no bands there is nothing to place records into —
   * `buildBoard` would correctly report every record as unplaced and the screen would render two empty
   * columns for one round trip. So the columns wait for the calendar.
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
}

const UNREACHABLE = 'Could not reach the API. Is it running on http://localhost:5286?';
