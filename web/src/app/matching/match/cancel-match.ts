import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatchCancellationReason, MatchDto } from '../../api/models';
import { CANCELLATION_REASONS } from './cancellation-reasons';

/** The match being cancelled, so the dialog can name what is about to go. */
export interface CancelMatchData {
  readonly match: MatchDto;
}

/**
 * Cancelling a match, with a reason and a warning (design-system.md 11.6).
 *
 * Two things this dialog exists to do, and neither is optional:
 *
 * - **A reason is required.** The three are the spec's, exactly, and the action stays disabled until
 *   one is chosen. A cancellation with no reason recorded is a booking that vanished and nobody can
 *   account for later.
 * - **The operator is warned first.** A cancelled match is excluded from both parents' collections
 *   (resolved question 4), and pass 1 has no Match list view, so it will not be visible anywhere at
 *   all afterwards. Saying so before the fact is the difference between a considered act and a
 *   surprise — and the panel also states the thing that is *not* about to happen: both records keep
 *   their own status, because cancelling a match never touches its parents.
 *
 * Deleting a draft has none of this: it needs no reason and no warning, because a mis-drag is not a
 * decision anyone has to account for (resolved question 3).
 */
@Component({
  selector: 'app-cancel-match',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatRadioModule],
  templateUrl: './cancel-match.html',
  styleUrl: './cancel-match.scss',
})
export class CancelMatch {
  private readonly dialogRef =
    inject<MatDialogRef<CancelMatch, MatchCancellationReason>>(MatDialogRef);

  readonly data = inject<CancelMatchData>(MAT_DIALOG_DATA);

  readonly reasons = CANCELLATION_REASONS;

  /** Nothing is preselected: a default reason is a reason nobody chose. */
  readonly reason = signal<MatchCancellationReason | null>(null);

  cancelMatch(): void {
    const reason = this.reason();

    if (reason) {
      this.dialogRef.close(reason);
    }
  }
}
