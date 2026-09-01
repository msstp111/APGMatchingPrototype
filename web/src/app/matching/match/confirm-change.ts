import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatchDto } from '../../api/models';

/**
 * What is about to change on a Confirmed match, and what it will mean to the processor.
 */
export interface ConfirmChangeData {
  readonly match: MatchDto;
  /** The field's own name, for the buttons: `354` / `300`, or a carrier's name. */
  readonly from: string;
  readonly to: string;
  /** The consequence, in the processor's terms rather than the field's. */
  readonly consequence: string;
}

/**
 * The prompt before changing a Confirmed match (design-system.md 11.5, Phase 6, 3.1 and 3.3).
 *
 * **It names the consequence, not the field.** "Changing its quantity from 354 to 300 head will change
 * what Alliance Group Wallacetown expects on 28-08-26" is a sentence an operator can weigh; "are you
 * sure?" is not. The two buttons carry the two values rather than Yes and No, for the same reason —
 * the choice is legible without reading back up the dialog.
 *
 * It appears for **quantity and transport** and not for price, and only at `Confirmed`. A drafted
 * match has been communicated to nobody, so editing one prompts for nothing.
 */
@Component({
  selector: 'app-confirm-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-change.html',
  styleUrl: './confirm-change.scss',
})
export class ConfirmChange {
  readonly data = inject<ConfirmChangeData>(MAT_DIALOG_DATA);
}
