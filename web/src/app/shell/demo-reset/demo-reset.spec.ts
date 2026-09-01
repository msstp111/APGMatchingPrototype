import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, throwError } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { PREFERENCES_STORAGE_KEY } from '../../matching/filters/matching-preferences';
import { DemoReset } from './demo-reset';

/**
 * Phase 8, requirement 1. The reset is the most destructive control in the application and the one a
 * demo falls back on when something has gone wrong, so the order of its three steps is the thing
 * worth pinning:
 *
 * 1. re-seed the database,
 * 2. clear the stored view preferences,
 * 3. reload the page.
 *
 * **Two of those orderings are wrong and neither would fail loudly.** Clearing the preferences before
 * the POST would take the operator's filters with a reset that then failed; reloading before clearing
 * them would reload into the old filters and leave the clear to a page that no longer exists.
 *
 * `reload()` is `protected` on the service for exactly this: a spec can override it without a real
 * navigation, and nothing in the application can call it by accident.
 */
describe('Reset demo data', () => {
  /** Records what happened, in order, so the assertions are about sequence and not just occurrence. */
  let log: string[];
  let reloaded: number;
  let confirmation: unknown;
  let resetResult: Observable<unknown>;

  /** Exposes the reload for the spec, and nothing else. */
  class TestableDemoReset extends DemoReset {
    protected override reload(): void {
      log.push('reload');
      reloaded += 1;
    }
  }

  function configure(): DemoReset {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TestableDemoReset,
        {
          provide: ApiClient,
          useValue: {
            resetDatabase: () => {
              log.push('reset');

              return resetResult;
            },
          },
        },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmation) }) } },
        {
          provide: MatSnackBar,
          useValue: {
            open: (message: string) => {
              log.push(`snack: ${message}`);
            },
          },
        },
      ],
    });

    return TestBed.inject(TestableDemoReset);
  }

  beforeEach(() => {
    log = [];
    reloaded = 0;
    confirmation = true;
    resetResult = of({ reset: true });
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{"version":2,"flipped":true}');
  });

  afterEach(() => localStorage.clear());

  it('re-seeds, then clears the preferences, then reloads — in that order', () => {
    const reset = configure();

    reset.confirmAndReset();

    expect(log).toEqual(['reset', 'reload']);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(reloaded).toBe(1);
  });

  it('does nothing at all when the confirmation is declined', () => {
    confirmation = false;
    const reset = configure();

    reset.confirmAndReset();

    // Requirement 1.2 exists because a demo's worth of drag-and-drop can be lost to a stray click.
    // "Keep it" must be inert, not merely reversible.
    expect(log).toEqual([]);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull();
  });

  it('does nothing when the dialog is dismissed without an answer', () => {
    // Escape and a backdrop click both close with undefined, and neither is a yes.
    confirmation = undefined;
    const reset = configure();

    reset.confirmAndReset();

    expect(log).toEqual([]);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull();
  });

  it('keeps the stored preferences and says so when the re-seed fails', () => {
    resetResult = throwError(() => new Error('connection refused'));
    const reset = configure();

    reset.confirmAndReset();

    // The whole reason the POST goes first. A failed reset that had already cleared the filters would
    // leave the operator with a demo they had not restored and a column they had not meant to change.
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull();
    expect(reloaded).toBe(0);
    expect(log[0]).toBe('reset');
    expect(log[1]).toContain('Could not reset the demo data');
  });
});
