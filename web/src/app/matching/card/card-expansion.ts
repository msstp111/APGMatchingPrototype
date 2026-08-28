import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LivestockAvailabilityDto, MatchStatus, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { matchStatusIcon, quantityClass, transactionTypeLabel } from './card-chrome';

/**
 * What opens below a card: the fields that did not fit, both matched sums, and an LMS table of the
 * record's matches.
 *
 * **One component serves the full card and the carry-over row.** A carry-over is the same record, so
 * its expansion is identical — same fields, same sums, same matches — and the only difference is that
 * the collapsed row above it is 40px rather than 52px. There is deliberately no second, reduced
 * expansion (design-system.md 9.2).
 *
 * The collapsed row stays exactly where it is and this opens beneath it, so nothing above the pointer
 * moves (Phase 3, 5.2).
 */
@Component({
  selector: 'app-card-expansion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './card-expansion.html',
  styleUrl: './card-expansion.scss',
})
export class CardExpansion {
  readonly side = input.required<MatchSide>();

  /** Exactly one of these is set; the template branches on which. */
  readonly space = input<ProcessorSpaceDto | null>(null);
  readonly availability = input<LivestockAvailabilityDto | null>(null);

  // Re-exposed for the template under different names, so neither line reads as assigning to itself.
  readonly transactionTypeText = transactionTypeLabel;
  readonly matchGlyph = matchStatusIcon;

  /** Inks the unmatched figure in the ramp colour for this state and this side. */
  quantityInk(record: ProcessorSpaceDto | LivestockAvailabilityDto): string {
    return quantityClass(record.quantityState, this.side());
  }

  /** Cancelled matches never reach the client, so every row here is live (resolved question 4). */
  isConfirmed(status: MatchStatus): boolean {
    return status === 'Confirmed';
  }
}
