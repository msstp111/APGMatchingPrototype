import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatchDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { matchStatusIcon } from '../card/card-chrome';

/** The record about to be cancelled, and the matches that will outlive it. */
export interface CancelRecordData {
  readonly side: MatchSide;
  /** `Processor Space #7 — ANZCO Marlborough`, so the dialog names a record rather than a form. */
  readonly title: string;
  /** Live matches only; cancelled ones never reach the client (resolved question 4). */
  readonly matches: readonly MatchDto[];
}

/**
 * The confirmation in front of cancelling a record — and the one place the non-cascade is stated
 * before it happens rather than discovered afterwards (requirements 5.1 to 5.3).
 *
 * **Cancelling a record does not cancel its matches.** They stay live, on their own cards, and have to
 * be cancelled one at a time. That is deliberate and it is the point: it lets APG arrange alternatives
 * with the processor or the farmer on the other end before anybody is told their booking has gone. It
 * is also the most surprising rule in the domain, which is why every surviving match is listed here by
 * quantity, status and counterparty instead of being summarised as a number.
 *
 * The dialog writes nothing. It closes `true` or nothing at all, and `RecordActions` performs the
 * cancellation — the same division of labour as every other dialog on this screen.
 */
@Component({
  selector: 'app-cancel-record',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './cancel-record.html',
  styleUrl: './cancel-record.scss',
})
export class CancelRecord {
  readonly data = inject<CancelRecordData>(MAT_DIALOG_DATA);

  readonly matchGlyph = matchStatusIcon;

  readonly isDemand = this.data.side === 'demand';

  readonly recordWord = this.isDemand ? 'processor space' : 'livestock availability record';

  readonly hasMatches = this.data.matches.length > 0;

  readonly matchesWord = this.data.matches.length === 1 ? 'match' : 'matches';

  /** The counterparty, which is whichever side this record is not. */
  counterparty(match: MatchDto): string {
    return this.isDemand
      ? `${match.farmerName ?? '-'} · ${match.locationName ?? '-'}`
      : `${match.processor} · ${match.plant}`;
  }
}
