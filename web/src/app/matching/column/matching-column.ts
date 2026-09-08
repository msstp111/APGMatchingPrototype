import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { WeekBand } from '../band/week-band';
import { BandView, MatchSide } from '../board/matching-board';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { ColumnAutoScroll } from '../drag/column-auto-scroll';
import { DragNarrowing } from '../drag/drag-narrowing';
import { DragStore } from '../drag/drag-state';
import { NothingCompatible } from '../drag/nothing-compatible';
import { ColumnFilters } from '../filters/column-filters';
import { EmptyColumn } from './empty-column';
import { FilteredEmpty } from '../filters/filtered-empty';
import { StatusLegend } from '../legend/status-legend';
import { isDemandDefault, isSupplyDefault } from '../filters/filter-service';
import { MatchingPreferences } from '../filters/matching-preferences';
import { RecordActions } from '../record/record-actions';
import { SideGlyph } from './side-glyph';

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
  imports: [
    DecimalPipe,
    WeekBand,
    ColumnFilters,
    FilteredEmpty,
    EmptyColumn,
    NothingCompatible,
    ColumnAutoScroll,
    SideGlyph,
  ],
  templateUrl: './matching-column.html',
  styleUrl: './matching-column.scss',
})
export class MatchingColumn {
  private readonly preferences = inject(MatchingPreferences);
  private readonly drag = inject(DragStore);
  private readonly narrowing = inject(DragNarrowing);
  private readonly records = inject(RecordActions);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The store needs to know where each column is to tell which side of the gutter the pointer is
    // on. An effect rather than a constructor call because `side` is an input and is not readable
    // until the first change detection; it settles once and never changes again.
    effect(() => this.drag.registerColumn(this.side(), this.host.nativeElement));
  }

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

  /**
   * Nothing is loaded for this side at all — as opposed to filters having excluded everything.
   *
   * Checked *before* the filtered case in the template, because the two answer different questions
   * and only one of them has a filter to blame. Before Phase 8 this case fell through to a run of
   * empty week bands, which reads as a calendar with no data rather than as a column waiting for its
   * first record (design-system.md 13; Phase 4's log parked it, Phase 7 declined it as out of its
   * scope, requirement 4.1 is where it lands).
   */
  readonly isEmpty = computed(() => this.totalCount() === 0);

  /**
   * The stock class this column is currently narrowed by, or null — "Filter on drag" (Phase 10).
   *
   * Non-null only while a card is held on the *other* side and the aid is on, which is why the chip
   * it drives replaces the `Filtered` chip rather than sitting beside it: the header has room for one
   * more thing, and for as long as a card is in hand this is the more urgent of the two statements.
   * `Reset` goes with it, and loses nothing — it was not clickable mid-gesture anyway.
   */
  readonly narrowedTo = computed(() => this.narrowing.narrowedTo(this.side()));

  readonly isNarrowed = computed(() => this.narrowedTo() !== null);

  readonly narrowedTitle = computed(
    () =>
      `Filter on drag: showing only the stock classes that could be matched with ${this.narrowedTo()}`,
  );

  /**
   * The narrowing has left this column with nothing — a state of its own, checked before the filtered
   * case for the same reason `isEmpty` is: only one of the three has a filter of the operator's to
   * blame, and offering `Clear filters` for a column that will refill itself on release would send
   * someone clearing filters that are not the cause.
   */
  readonly nothingCompatible = computed(
    () => this.isNarrowed() && this.shown() === 0 && this.totalCount() > 0,
  );

  /**
   * The opposite column takes the wash — but not at pickup any more (Phase 9, design-system.md 10).
   *
   * It waits for the pointer to cross the gutter, like every other drop treatment. A wash thrown over
   * the far column the instant a card is lifted announces a target before the operator has chosen to
   * look for one, and it was on screen for the whole of every drag including the ones that go nowhere.
   */
  readonly isDropTarget = computed(() => this.drag.isTargetSide(this.side()) && this.drag.armed());

  readonly isDragging = computed(() => this.drag.active() !== null);

  /**
   * The debug add control's hover text. It says what the button is, not what it does, because what it
   * is is the thing worth knowing: this is scaffolding for demos, not the submission form a farmer or
   * an agent would ever see.
   */
  readonly addTitle = computed(() =>
    this.isDemand()
      ? 'Demo tool: add a Processor Space. Not the real create flow.'
      : 'Demo tool: add a Livestock Availability record. Not the farmer or agent submission form.',
  );

  /**
   * Whether this column carries the legend button — true for whichever column is currently on the
   * **right**, which `matching-screen` decides from the flip.
   *
   * It is bound to a screen position rather than to a column because that is what it is: a help
   * control belongs in the top-right corner of the screen and should stay there, unlike `+ Add`,
   * which belongs to its column and rides the flip with it. The legend explains both sides equally,
   * so putting one in each header would be the same sentence written twice.
   */
  readonly showsLegend = input(false);

  /**
   * The key to the board (design-system.md 3, 4, 7).
   *
   * It writes nothing, takes no data and returns no result — it is a reference card, and the one
   * dialog on this screen that could be opened at any moment without consequence.
   */
  openLegend(): void {
    this.dialog.open(StatusLegend, { width: '760px', autoFocus: 'dialog' });
  }

  /** Opens the debug form for this column's own record type (requirements 1.1 and 1.2). */
  add(): void {
    if (this.isDemand()) {
      this.records.addSpace();

      return;
    }

    this.records.addAvailability();
  }

  reset(): void {
    if (this.isDemand()) {
      this.preferences.resetDemand();

      return;
    }

    this.preferences.resetSupply();
  }
}
