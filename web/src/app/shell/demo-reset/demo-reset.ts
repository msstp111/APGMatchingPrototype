import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiClient } from '../../api/api-client';
import { clearStoredPreferences } from '../../matching/filters/matching-preferences';
import { ResetDemoData } from './reset-demo-data';

/**
 * "Reset demo data" — the control that puts the prototype back to its seeded state (requirement 1).
 *
 * Three things happen, in this order, and the order matters:
 *
 * 1. **The database is re-seeded.** If that fails, nothing else has happened yet, so a failed reset
 *    does not silently take the operator's filters with it.
 * 2. **The stored view preferences are cleared** (requirement 1.1), so the columns open at the
 *    spec's own defaults rather than at whatever a demo left behind.
 * 3. **The page reloads.**
 *
 * The reload is deliberate rather than lazy. A refetch would leave behind everything that is *not*
 * fetched: which cards are expanded (`CardStateStore`), a drag in flight, an open dialog, and the
 * in-memory half of the preference store. A reset that leaves an expanded card pointing at a match
 * that no longer exists is worse than one that takes a second, and the one thing this control must be
 * is trustworthy — it is what a demo falls back on when something has gone wrong.
 *
 * Held in the shell rather than on the matching screen because the control is in the top bar and
 * because the reset is not a matching-screen concern: it replaces the whole database.
 */
@Injectable({ providedIn: 'root' })
export class DemoReset {
  private readonly api = inject(ApiClient);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  /**
   * Asks first (requirement 1.2) — a demo's worth of drag-and-drop can be lost to a stray click —
   * then resets.
   */
  confirmAndReset(): void {
    this.dialog
      .open(ResetDemoData, { width: '520px', autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          this.reset();
        }
      });
  }

  private reset(): void {
    this.api.resetDatabase().subscribe({
      next: () => {
        clearStoredPreferences();
        this.reload();
      },
      // Named plainly rather than swallowed: a reset that quietly did nothing would leave the
      // operator demonstrating against data they believe has been restored.
      error: () =>
        this.snack.open(
          'Could not reset the demo data. Is the API running on http://localhost:5286?',
          'DISMISS',
          { panelClass: 'apg-snack', duration: 8000 },
        ),
    });
  }

  /** Its own method so a spec can watch for it without a real navigation. */
  protected reload(): void {
    window.location.reload();
  }
}
