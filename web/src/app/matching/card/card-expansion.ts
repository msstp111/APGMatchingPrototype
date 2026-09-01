import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LivestockAvailabilityDto, MatchStatus, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { MatchActions } from '../match/match-actions';
import { RecordActions } from '../record/record-actions';
import { matchStatusIcon, quantityClass, transactionTypeLabel } from './card-chrome';

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
  imports: [DecimalPipe, MatButtonModule],
  templateUrl: './card-expansion.html',
  styleUrl: './card-expansion.scss',
})
export class CardExpansion {
  private readonly actions = inject(MatchActions);
  private readonly records = inject(RecordActions);

  readonly side = input.required<MatchSide>();

  /** Exactly one of these is set; the template branches on which. */
  readonly space = input<ProcessorSpaceDto | null>(null);
  readonly availability = input<LivestockAvailabilityDto | null>(null);

  // Re-exposed for the template under different names, so neither line reads as assigning to itself.
  readonly transactionTypeText = transactionTypeLabel;
  readonly matchGlyph = matchStatusIcon;

  /**
   * Why Confirm is unavailable, from the DTO — never composed here.
   *
   * A control that greys out for unstated reasons is exactly what makes a non-technical operator
   * conclude the application is broken (requirement 5.3), and the three answers are not recoverable
   * from `canConfirm` alone.
   */
  readonly confirmBlockedReason = computed(() => this.space()?.confirmBlockedReason ?? null);

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
