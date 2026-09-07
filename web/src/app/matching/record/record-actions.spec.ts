import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { RecordWriteResultDto } from '../../api/models';
import { MatchingPreferences } from '../filters/matching-preferences';
import { RecordPatch, RecordPatches } from '../match/record-patches';
import { aMatch, anAvailability, aSpace, aWeek } from '../testing/dto-fixtures';
import { RecordActions } from './record-actions';
import { ConfirmOverCommit } from './confirm-over-commit';
import { CancelRecord } from './cancel-record';

/**
 * The service behind the debug controls, and the two rules the phase actually turns on: an
 * over-committing edit warns without blocking, and cancelling a record leaves its matches alone and
 * says so.
 */
describe('Record actions', () => {
  const published: RecordPatch[] = [];
  const opened: { component: unknown; data: unknown }[] = [];
  const snacks: { message: string; action: string }[] = [];

  const action = new Subject<void>();

  /** Each dialog answers with the next value queued here, oldest first. */
  let answers: unknown[] = [];

  const api = {
    referenceData: vi.fn(() =>
      of({
        processors: [{ name: 'ANZCO', plants: ['Kokiri'], stockClasses: ['Cows'] }],
        availabilityStockClasses: ['Prime'],
        transactionTypes: ['GrazingStock'],
      }),
    ),
    locations: vi.fn(() => of([])),
    updateAvailability: vi.fn(() => of(write())),
    updateSpace: vi.fn(() => of(write())),
    cancelSpace: vi.fn(() => of(write())),
    cancelAvailability: vi.fn(() => of(write())),
    createSpace: vi.fn(() => of(write())),
    createAvailability: vi.fn(() => of(write())),
  };

  function write(overrides: Partial<RecordWriteResultDto> = {}): RecordWriteResultDto {
    return {
      space: aSpace({ id: 7, matches: [aMatch({ id: 1 }), aMatch({ id: 2 })] }),
      availability: null,
      weeks: [aWeek('2026-08-23')],
      ...overrides,
    };
  }

  const dialog = {
    open: (component: unknown, config: { data: unknown }) => {
      opened.push({ component, data: config.data });

      return { afterClosed: () => of(answers.shift()) };
    },
  };

  const snackBar = {
    open: (message: string, act: string) => {
      snacks.push({ message, action: act });

      return { onAction: () => action.asObservable() };
    },
  };

  function actions(): RecordActions {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiClient, useValue: api },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: RecordPatches, useValue: { publish: (p: RecordPatch) => published.push(p) } },
      ],
    });

    return TestBed.inject(RecordActions);
  }

  beforeEach(() => {
    localStorage.clear();
    published.length = 0;
    opened.length = 0;
    snacks.length = 0;
    answers = [];
    Object.values(api).forEach((fn) => fn.mockClear());
  });

  // --- the over-commit prompt -------------------------------------------------------------------

  it('asks before an edit that leaves a record over-committed, and writes when told to', () => {
    const record = anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 124 });

    // The form's result, then the prompt's answer.
    answers = [{ action: 'update', request: { ...request(), quantityAvailable: 100 } }, true];

    actions().editAvailability(record);

    const prompt = opened.find((entry) => entry.component === ConfirmOverCommit);

    expect(prompt).toBeDefined();
    expect(prompt?.data).toMatchObject({ side: 'supply', from: 144, to: 100, matched: 124 });
    expect(api.updateAvailability).toHaveBeenCalledWith(
      6,
      expect.objectContaining({
        quantityAvailable: 100,
      }),
    );
  });

  it('writes nothing when the prompt is declined', () => {
    const record = anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 124 });

    answers = [{ action: 'update', request: { ...request(), quantityAvailable: 100 } }, false];

    actions().editAvailability(record);

    expect(api.updateAvailability).not.toHaveBeenCalled();
    // Keeping the quantity is a decision, not a failure: it earns no message either.
    expect(snacks).toEqual([]);
  });

  it('does not ask when the quantity stays above what is matched', () => {
    const record = anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 124 });

    answers = [{ action: 'update', request: { ...request(), quantityAvailable: 130 } }];

    actions().editAvailability(record);

    expect(opened.some((entry) => entry.component === ConfirmOverCommit)).toBe(false);
    expect(api.updateAvailability).toHaveBeenCalled();
  });

  it('does not ask when the record has no matches to disagree with', () => {
    const record = anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 0 });

    answers = [{ action: 'update', request: { ...request(), quantityAvailable: 1 } }];

    actions().editAvailability(record);

    expect(opened.some((entry) => entry.component === ConfirmOverCommit)).toBe(false);
    expect(api.updateAvailability).toHaveBeenCalled();
  });

  // --- cancelling a record ----------------------------------------------------------------------

  it('lists the matches that will survive before cancelling anything', () => {
    const space = aSpace({ id: 7, matches: [aMatch({ id: 1 }), aMatch({ id: 2 })] });

    answers = [false];
    actions().cancelSpace(space);

    const prompt = opened.find((entry) => entry.component === CancelRecord);

    expect(prompt?.data).toMatchObject({ side: 'demand' });
    expect((prompt?.data as { matches: unknown[] }).matches).toHaveLength(2);
    expect(api.cancelSpace).not.toHaveBeenCalled();
  });

  it('says the matches are untouched, and offers the way back to the record', () => {
    const space = aSpace({ id: 7, matches: [aMatch({ id: 1 }), aMatch({ id: 2 })] });

    answers = [true];
    actions().cancelSpace(space);

    expect(api.cancelSpace).toHaveBeenCalledWith(7);
    expect(snacks[0].message).toContain('its 2 matches are untouched');
    expect(snacks[0].action).toBe('SHOW IT');

    // The recomputed record and the recomputed calendar both reach the screen.
    expect(published[0].space?.id).toBe(7);
    expect(published[0].weeks).toHaveLength(1);
  });

  /**
   * A cancelled record leaves both columns' default filters, which is correct and is exactly when
   * someone concludes the matches went with it. SHOW IT is the way back (requirements 5.3 and 5.4).
   */
  it('reveals the cancelled record by ticking Cancelled into that column status filter', () => {
    const space = aSpace({ id: 7, matches: [aMatch({ id: 1 })] });

    answers = [true];
    const service = actions();
    const preferences = TestBed.inject(MatchingPreferences);

    expect(preferences.demandFilters().statuses).not.toContain('Cancelled');

    service.cancelSpace(space);
    action.next();

    expect(preferences.demandFilters().statuses).toContain('Cancelled');
    // The rest of the filter is left exactly as it was: this reveals a record, it does not reset.
    expect(preferences.demandFilters().statuses).toContain('Booked');
    expect(preferences.supplyFilters().statuses).not.toContain('Cancelled');
  });

  it('does the same on the supply side, against that column own filter', () => {
    const record = anAvailability({ id: 6, matches: [aMatch({ id: 1 })] });

    answers = [true];
    const service = actions();
    const preferences = TestBed.inject(MatchingPreferences);

    api.cancelAvailability.mockReturnValueOnce(
      of(
        write({
          space: null,
          availability: anAvailability({ id: 6, matches: [aMatch({ id: 1 })] }),
        }),
      ),
    );

    service.cancelAvailability(record);
    action.next();

    expect(preferences.supplyFilters().statuses).toContain('Cancelled');
    expect(preferences.demandFilters().statuses).not.toContain('Cancelled');
    expect(snacks[0].message).toContain('its 1 match is untouched');
  });

  it('says nothing about matches when there were none', () => {
    answers = [true];
    api.cancelSpace.mockReturnValueOnce(of(write({ space: aSpace({ id: 9, matches: [] }) })));

    actions().cancelSpace(aSpace({ id: 9, matches: [] }));

    expect(snacks[0].message).toBe('Space #9 cancelled');
  });

  // --- creating ---------------------------------------------------------------------------------

  /**
   * A record added while the column is filtered to something else lands in the list and is filtered
   * straight back out. The write worked and nothing appeared, which is the worst thing a demo tool can
   * do — so the message says so, using the same filter functions the screen renders through.
   */
  it('says when the record it just wrote is hidden by the current filters', () => {
    answers = [true];
    api.cancelSpace.mockReturnValueOnce(
      // A cancelled space fails the default `Status = Booked` filter, so it is off screen at once.
      of(write({ space: aSpace({ id: 7, status: 'Cancelled', matches: [aMatch({ id: 1 })] }) })),
    );

    actions().cancelSpace(aSpace({ id: 7, matches: [aMatch({ id: 1 })] }));

    expect(snacks[0].message).toContain('untouched');

    answers = [
      {
        action: 'create',
        request: {
          processor: 'ANZCO',
          plant: 'Kokiri',
          stockClass: 'Cows',
          quantityRequired: 60,
          deliveryDate: '2026-09-10',
          deliveryTime: null,
          notes: null,
        },
      },
    ];
    api.createSpace.mockReturnValueOnce(
      of(write({ space: aSpace({ id: 8, status: 'Cancelled' }) })),
    );

    actions().addSpace();

    expect(snacks[1].message).toBe("Processor space added, hidden by this column's filters");
  });

  it('creates a record and publishes it with the recomputed calendar', () => {
    answers = [
      {
        action: 'create',
        request: {
          processor: 'ANZCO',
          plant: 'Kokiri',
          stockClass: 'Cows',
          quantityRequired: 60,
          deliveryDate: '2026-09-10',
          deliveryTime: null,
          notes: null,
        },
      },
    ];

    actions().addSpace();

    expect(api.referenceData).toHaveBeenCalled();
    expect(api.createSpace).toHaveBeenCalled();
    expect(published[0].weeks).toHaveLength(1);
    expect(snacks[0].message).toBe('Processor space added');
  });

  function request() {
    return {
      stockClass: 'Prime',
      quantityAvailable: 144,
      locationId: 11,
      availableFrom: '2026-08-24',
      availabilityDetails: null,
      transactionType: 'GrazingStock' as const,
      notes: null,
    };
  }
});
