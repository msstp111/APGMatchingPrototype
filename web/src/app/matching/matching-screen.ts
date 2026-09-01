import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '../api/api-client';
import {
  LivestockAvailabilityDto,
  ProcessorSpaceDto,
  WeekBandDto,
} from '../api/models';
import { MatchingColumn } from './column/matching-column';
import { buildBoard } from './board/matching-board';
import {
  filterAvailability,
  filterSpaces,
  sortAvailability,
  sortSpaces,
} from './filters/filter-service';
import { MatchingPreferences } from './filters/matching-preferences';
import { RecordPatch, RecordPatches } from './match/record-patches';

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
  imports: [MatchingColumn, CdkDropListGroup],
  templateUrl: './matching-screen.html',
  styleUrl: './matching-screen.scss',
})
export class MatchingScreen {
  private readonly api = inject(ApiClient);
  private readonly preferences = inject(MatchingPreferences);
  private readonly patches = inject(RecordPatches);

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

  /**
   * Fetching, as distinct from empty (requirement 4.1).
   *
   * Before Phase 8 this state drew nothing at all, so the first paint of a cold start was an empty
   * content area — indistinguishable from an API that had answered with no data, and the first thing
   * anyone handed the laptop would see.
   *
   * The `error` clause is what keeps this and the error panel from both being true. The template's
   * chain does the same for the columns: an error outranks a populated board, because the three reads
   * land independently and a half-loaded screen that looks whole is worse than a stated failure.
   */
  readonly loading = computed(() => !this.ready() && this.error() === null);

  constructor() {
    this.load();

    this.patches.patches.pipe(takeUntilDestroyed()).subscribe((patch) => this.applyPatch(patch));
  }

  /** Re-issues all three reads. The error panel's way out (requirement 4.1: every state has one). */
  retry(): void {
    this.error.set(null);
    this.load();
  }

  private load(): void {
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
   * Every write on this screen lands here, and every record in it arrives already recomputed by the
   * server. Replacing them by id is what makes the meters, the counts, the match lines and the derived
   * availability status update without a refetch — and what makes a fully consumed availability record
   * leave the default-filtered view, because `visibleAvailability` re-runs over the patched list.
   *
   * **Either half may be absent, and that is information rather than an omission.** A match write
   * carries both parents because a match changes both at once; confirming a Processor Space carries
   * only the space, because it touches nothing else. Patching a record that was not returned would be
   * this screen quietly asserting something the server did not say.
   */
  private applyPatch(patch: RecordPatch): void {
    // The calendar first, and only when the write carried one: a record created for a week these
    // columns were not drawn on has to bring that week with it, or it would place into no band at all
    // and simply not appear. Only Phase 7's record writes can move the range; a match has no date.
    if (patch.weeks) {
      this.weeks.set(patch.weeks);
    }

    if (patch.space) {
      this.spaces.update((list) => upsertById(list, patch.space!));
    }

    if (patch.availability) {
      this.availability.update((list) => upsertById(list, patch.availability!));
    }
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

/**
 * Replaces a record by id, or appends it when this screen has never seen it.
 *
 * The append is Phase 7's: a record created from the debug form is not in either list yet, and
 * replacing by id alone would drop it silently — the one failure mode where nothing errors and nothing
 * appears. Position does not matter, because both lists are sorted before they are banded.
 */
function upsertById<T extends { readonly id: number }>(list: readonly T[], next: T): T[] {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => (item.id === next.id ? next : item))
    : [...list, next];
}
