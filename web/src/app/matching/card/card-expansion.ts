import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LivestockAvailabilityDto, MatchStatus, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { MatchActions } from '../match/match-actions';
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
