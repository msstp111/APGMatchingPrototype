import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DOCUMENT, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LivestockAvailabilityDto, MatchStatus, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { MatchActions } from '../match/match-actions';
import { RevealRecord } from '../match/reveal-record';
import { RecordActions } from '../record/record-actions';
import { matchStatusIcon, quantityClass, spineClass, transactionTypeLabel } from './card-chrome';

/**
 * What opens below a card: the fields that did not fit, both matched sums, and an LMS table of the
 * record's matches.
 *
 * **One component serves both sides.** The demand and supply expansions differ only in which DTO
 * fields fill which cells and in the counterparty column of the match table, so a single component
 * keeps them structurally identical the way _card-geometry.scss keeps the collapsed rows identical.
 *
 * The collapsed row stays exactly where it is and this opens beneath it, so nothing above the pointer
 * moves (Phase 3, 5.2).
 *
 * **Since Phase 6 it is also the way into a match.** Every row of the table opens that match, from
 * either side, and the demand side carries the `Confirm space` action beneath it. Both were placed
 * here rather than on the collapsed row for the same reason: a 52px row has no space for a per-match
 * control, and the table already says which match is which.
 */
@Component({
  selector: 'app-card-expansion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatTooltipModule],
  // Only the two elements meant to read as continuous with the row above use this — the rail and the
  // continued spine. The drawer's CONTENT stays at full strength deliberately: it is the most
  // interactive region on the card, and everything that recedes on this screen recedes because it is
  // read-only. See the note on `:host(.cancelled)` in card-expansion.scss.
  host: { '[class.cancelled]': 'isCancelled()' },
  templateUrl: './card-expansion.html',
  styleUrl: './card-expansion.scss',
})
export class CardExpansion {
  private readonly actions = inject(MatchActions);
  private readonly records = inject(RecordActions);
  private readonly reveal = inject(RevealRecord);
  private readonly document = inject(DOCUMENT);

  readonly side = input.required<MatchSide>();

  /** Exactly one of these is set; the template branches on which. */
  readonly space = input<ProcessorSpaceDto | null>(null);
  readonly availability = input<LivestockAvailabilityDto | null>(null);

  /**
   * The sums strip was clicked and the card should close.
   *
   * An output rather than a call into `CardStateStore`, because this component does not own the
   * expansion and must not learn to: the card above it holds the side and the record id, and it
   * already has a `toggle()` that both the chevron and the match count go through. A third writer
   * would be a third place the open state could be set from.
   */
  readonly collapse = output<void>();

  // Re-exposed for the template under different names, so neither line reads as assigning to itself.
  readonly transactionTypeText = transactionTypeLabel;
  readonly matchGlyph = matchStatusIcon;

  /**
   * The drawer's head is also its close control (2026-09-10).
   *
   * **Guarded on the selection**, and that is the whole of why this is not a bare `(click)`. The
   * strip is nothing but figures, and figures are the one thing on this screen someone will want to
   * drag-select and copy; a selection that ended by shutting the drawer would make the numbers
   * unreadable in the act of reading them. A collapsed selection is a plain click.
   *
   * Nothing here is focusable. The chevron on the row above is the control carrying
   * `aria-expanded`, and a second tab stop saying the same thing about the same card would only be
   * one more thing to tab past — the same argument `.cbody` settles on the row itself.
   */
  collapseClicked(): void {
    if (this.document.getSelection()?.isCollapsed === false) {
      return;
    }

    this.collapse.emit();
  }

  /**
   * Why Confirm is unavailable, from the DTO — never composed here.
   *
   * A control that greys out for unstated reasons is exactly what makes a non-technical operator
   * conclude the application is broken (requirement 5.3), and the three answers are not recoverable
   * from `canConfirm` alone.
   */
  readonly confirmBlockedReason = computed(() => this.space()?.confirmBlockedReason ?? null);

  /**
   * The record's own status spine, continued down the sheet's leading edge (2026-09-09).
   *
   * The card's spine used to stop at its bottom rule, so an open card was a row followed by a
   * separate block. With the seam between them removed (card-shell's `:host(.open)`) the two are one
   * object, and this runs its whole leading edge: 3px of `$lms-divider` for Booked, 6px for
   * everything else, hatched for Pending and dashed for Cancelled.
   *
   * Derived here rather than passed in from the card. Both call `spineClass` on the same record's
   * status, so the row's spine and the sheet's cannot come to disagree — and the specs that mount
   * this component on its own do not need a new input to satisfy.
   *
   * Null only in a degenerate mount with neither record set; the template draws nothing then.
   */
  readonly spine = computed(() => {
    const record = this.space() ?? this.availability();
    return record ? spineClass(record.status) : null;
  });

  /** Inks the unmatched figure in the ramp colour for this state and this side. */
  quantityInk(record: ProcessorSpaceDto | LivestockAvailabilityDto): string {
    return quantityClass(record.quantityState, this.side());
  }

  /**
   * Already cancelled, on whichever side this is. The Cancel control is disabled rather than left to
   * fail: the server refuses a second cancellation, and the card itself already says why — a cancelled
   * card is desaturated with its title struck through, so the cause is on screen.
   */
  readonly isCancelled = computed(
    () => (this.space()?.status ?? this.availability()?.status) === 'Cancelled',
  );

  /** Cancelled matches never reach the client, so every row here is live (resolved question 4). */
  isConfirmed(status: MatchStatus): boolean {
    return status === 'Confirmed';
  }

  /**
   * Opens a match. **By id alone** — which is what makes this row and the same match's row on the
   * other card the same thing rather than two things that resemble each other (requirement 1.2).
   */
  openMatch(matchId: number): void {
    this.actions.open(matchId);
  }

  /**
   * Follow a match to its counterparty in the other column (2026-09-10).
   *
   * Two methods rather than one with a side, because the id spaces are separate and the wrong one
   * would resolve to a real record of the other kind rather than to nothing — a bug that shows up
   * as the wrong card lighting, which is much harder to see than a card that does not light at all.
   *
   * `stopPropagation` because the row this cell sits in opens the match. Both handlers are real and
   * both are wanted; what decides between them is where in the row the click landed.
   */
  revealSpace(spaceId: number, event: Event): void {
    event.stopPropagation();
    this.reveal.space(spaceId);
  }

  /** @see revealSpace */
  revealAvailability(recordId: number, event: Event): void {
    event.stopPropagation();
    this.reveal.availability(recordId);
  }

  /**
   * The debug edit form for whichever record this expansion belongs to (requirement 4.1).
   *
   * One method for both sides, because the card knows which of its two inputs is set and the service
   * knows nothing about cards. The demand form edits five fields; the supply form edits every
   * attribute (requirements 4.2 and 4.3).
   */
  editRecord(): void {
    const space = this.space();

    if (space) {
      this.records.editSpace(space);

      return;
    }

    const availability = this.availability();

    if (availability) {
      this.records.editAvailability(availability);
    }
  }

  /**
   * Cancels this record — and **not** its matches (requirement 5.2).
   *
   * The matches listed in the table above survive untouched and have to be cancelled one at a time.
   * The dialog names every one of them before the fact, because a rule this surprising should not be
   * discovered afterwards.
   */
  cancelRecord(): void {
    const space = this.space();

    if (space) {
      this.records.cancelSpace(space);

      return;
    }

    const availability = this.availability();

    if (availability) {
      this.records.cancelAvailability(availability);
    }
  }

  /**
   * Confirms this Processor Space. Its status is stored, set by this explicit action, and computed
   * nowhere (requirement 5.4).
   */
  confirmSpace(): void {
    const space = this.space();

    if (space) {
      this.actions.confirmSpace(space.id);
    }
  }
}
