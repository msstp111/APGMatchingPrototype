import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { DemoReset } from '../demo-reset/demo-reset';
import { MatchingPreferences } from '../../matching/filters/matching-preferences';

/**
 * LMS v7's top bar: full width, petrol blue, hamburger and wordmark on the left, the dev-environment
 * flag on the right — and, from Phase 8, the "Reset demo data" control immediately left of that flag.
 *
 * The bar is where the reset lives because the flag beside it already says this build is not
 * production, so the control reads as tooling without a second explanation; because a shell control
 * costs the matching screen's 596px list nothing; and because a reset replaces the whole database
 * rather than one screen's data.
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltipModule],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private readonly demo = inject(DemoReset);
  private readonly preferences = inject(MatchingPreferences);

  /** Raised by the hamburger; the shell owns whether the sidebar is open. */
  readonly toggleSidebar = output<void>();

  /** Confirms first, then re-seeds and reloads. The service owns all of it. */
  resetDemoData(): void {
    this.demo.confirmAndReset();
  }

  /**
   * Whether grabbing a card narrows the far column to compatible stock classes.
   *
   * The shell reaches into the matching screen's preference store, as `DemoReset` already does when
   * it clears them: the switch governs both columns and is a standing preference, so the top bar is
   * where it goes, and `MatchingPreferences` is root-provided precisely so it survives being read from
   * outside the screen. Nothing here decides anything — the store holds the state and the screen acts
   * on it.
   */
  readonly filterOnDrag = this.preferences.filterOnDrag;

  readonly filterTitle = computed(() =>
    this.filterOnDrag()
      ? 'On: picking up a card hides the records on the other side whose stock class could not take ' +
        'it. Nothing is blocked — release the card and the whole column comes back.'
      : 'Off: both columns show every record while a card is dragged. Turn on to hide the stock ' +
        'classes that could not be matched with the card in hand.',
  );

  toggleFilterOnDrag(): void {
    this.preferences.toggleFilterOnDrag();
  }

  /**
   * Whether a card's middle region drags as well as expands (`matching/drag/card-press.ts`).
   *
   * Reached the same way, and for the same reason, as `filterOnDrag` above: one switch governing both
   * columns, held in the root-provided store, set from the bar rather than from a column.
   */
  readonly dragAnywhere = this.preferences.dragAnywhere;

  readonly dragAnywhereTitle = computed(() =>
    this.dragAnywhere()
      ? 'On: a card can be dragged from anywhere between its grip and its chevron, and a click there ' +
        'still expands it. Turn off if a click ever lifts a card instead of opening it.'
      : 'Off: only the grip at the left of a card starts a drag, and the rest of the row expands it. ' +
        'Turn on to drag from the row itself as well.',
  );

  toggleDragAnywhere(): void {
    this.preferences.toggleDragAnywhere();
  }

  readonly keepGrips = this.preferences.keepGrips;

  readonly keepGripsTitle = computed(() =>
    this.keepGrips()
      ? 'Grips shown. Every card keeps its 30px handle at the left. Click to hide them and give ' +
        'those 30px back to the name.'
      : 'Grips hidden. Cards drag from the row itself, and the name column is 30px wider. Click ' +
        'to put the handles back.',
  );

  /**
   * Flips the grips and then shows the tooltip, which is the whole of the press's feedback.
   *
   * The thing that changes is in the list below and the operator is looking at the top bar, so
   * without this the button reports its new state only to someone who moves the pointer away and
   * back. `show()` rather than a snack: it is a one-line statement about the control just pressed,
   * and it belongs on that control.
   */
  toggleKeepGrips(tooltip: MatTooltip): void {
    this.preferences.toggleKeepGrips();
    tooltip.show();
  }
}
