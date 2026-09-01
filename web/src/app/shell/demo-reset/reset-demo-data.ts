import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { DebugRibbon } from '../../matching/record/debug-ribbon';

/**
 * The confirmation in front of "Reset demo data" (requirement 1.2).
 *
 * A demo's worth of drag-and-drop can be lost to a stray click, so this is the one control in the
 * application that asks before acting on a keystroke's worth of intent. It lists what goes rather
 * than summarising it, for the same reason the record-cancellation dialog lists the surviving matches:
 * "this cannot be undone" is a claim, and the list is the evidence for it.
 *
 * It writes nothing and closes `true` or `false`; {@link DemoReset} performs the reset. Same division
 * of labour as every other dialog in the application.
 *
 * The ribbon is deliberately the one both record forms already carry rather than a second treatment —
 * it lives under `matching/record/` because Phase 7 put it there and its build log points at that
 * path. Nothing about it is specific to those forms.
 */
@Component({
  selector: 'app-reset-demo-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, DebugRibbon],
  templateUrl: './reset-demo-data.html',
  styleUrl: './reset-demo-data.scss',
})
export class ResetDemoData {}
