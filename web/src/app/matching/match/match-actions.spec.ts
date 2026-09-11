import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import {
  MatchCancellationReason,
  MatchEditContextDto,
  MatchWriteResultDto,
  UpdateMatchRequest,
} from '../../api/models';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { CancelMatch } from './cancel-match';
import { ConfirmChange } from './confirm-change';
import { MatchActions } from './match-actions';
import { MatchModal, MatchModalResult } from './match-modal';
import { RecordPatch, RecordPatches } from './record-patches';

describe('Match actions', () => {
  const context = (
    status: 'Drafted' | 'Confirmed',
    overrides: Partial<MatchEditContextDto> = {},
  ): MatchEditContextDto => ({
    canNotify: status === 'Drafted',
    match: aMatch({
      id: 12,
      status,
      quantityMatched: 40,
      pricePerKg: 6.1,
      transportCompany: 'Kaikoura Carriers',
    }),
    space: aSpace({ id: 4 }),
    availability: anAvailability({ id: 8, unmatched: 60 }),
    maximumQuantity: 100,
    ...overrides,
  });

  const written: MatchWriteResultDto = {
    match: aMatch({ id: 12, quantityMatched: 55 }),
    space: aSpace({ id: 4, unmatched: 45 }),
    availability: anAvailability({ id: 8, unmatched: 45 }),
  };

  const edit = (overrides: Partial<UpdateMatchRequest> = {}): UpdateMatchRequest => ({
    quantityMatched: 40,
    pricePerKg: 6.1,
    transportCompany: 'Kaikoura Carriers',
    ...overrides,
  });

  const match = vi.fn();
  const updateMatch = vi.fn();
  const notifyMatch = vi.fn();
  const confirmMatch = vi.fn();
  const cancelMatch = vi.fn();
  const deleteMatch = vi.fn();
  const confirmSpace = vi.fn();
  const openDialog = vi.fn();
  const openSnack = vi.fn();

  let modalClosed: Subject<MatchModalResult | undefined>;
  let nestedClosed: Subject<unknown>;
  let patches: RecordPatch[];

  /** Opens the modal, then closes it with `result` — the whole of what a footer button does. */
  function act(status: 'Drafted' | 'Confirmed', result: MatchModalResult): void {
    match.mockReturnValue(of(context(status)));
    TestBed.inject(MatchActions).open(12);
    modalClosed.next(result);
  }

  beforeEach(() => {
    for (const stub of [
      match,
      updateMatch,
      notifyMatch,
      confirmMatch,
      cancelMatch,
      deleteMatch,
      confirmSpace,
      openDialog,
      openSnack,
    ]) {
      stub.mockReset();
    }

    modalClosed = new Subject<MatchModalResult | undefined>();
    nestedClosed = new Subject<unknown>();
    patches = [];

    // The modal opens first and any nested dialog second, so the stub hands back whichever stream
    // belongs to the component being opened rather than guessing from call order.
    openDialog.mockImplementation((component: unknown) => ({
      afterClosed: () =>
        component === MatchModal ? modalClosed.asObservable() : nestedClosed.asObservable(),
    }));

    updateMatch.mockReturnValue(of(written));
    notifyMatch.mockReturnValue(of(written));
    confirmMatch.mockReturnValue(of(written));
    cancelMatch.mockReturnValue(of({ ...written, match: null }));
    deleteMatch.mockReturnValue(of({ ...written, match: null }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MatchActions,
        {
          provide: ApiClient,
          useValue: {
            match,
            updateMatch,
            notifyMatch,
            confirmMatch,
            cancelMatch,
            deleteMatch,
            confirmSpace,
            transportCompanies: () => of([]),
          },
        },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnack } },
      ],
    });

    TestBed.inject(RecordPatches).patches.subscribe((patch) => patches.push(patch));
  });

  // --- getting to a match -------------------------------------------------------------------------

  it('opens a match by id and hands the modal the whole context', () => {
    const fetched = context('Drafted');
    match.mockReturnValue(of(fetched));

    TestBed.inject(MatchActions).open(12);

    expect(match).toHaveBeenCalledWith(12);
    expect(openDialog).toHaveBeenCalledWith(
      MatchModal,
      expect.objectContaining({ data: fetched, width: '640px' }),
    );
  });

  it('writes nothing when the modal is dismissed', () => {
    match.mockReturnValue(of(context('Drafted')));

    TestBed.inject(MatchActions).open(12);
    modalClosed.next(undefined);

    expect(updateMatch).not.toHaveBeenCalled();
    expect(deleteMatch).not.toHaveBeenCalled();
    expect(patches).toHaveLength(0);
  });

  // --- the prompt before changing a Confirmed match -----------------------------------------------

  it('saves a drafted match with no prompt at all', () => {
    act('Drafted', { action: 'save', request: edit({ quantityMatched: 55 }) });

    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(updateMatch).toHaveBeenCalledWith(12, edit({ quantityMatched: 55 }));
  });

  it('prompts before changing a confirmed match quantity, and writes only if agreed', () => {
    act('Confirmed', { action: 'save', request: edit({ quantityMatched: 55 }) });

    expect(openDialog).toHaveBeenCalledWith(
      ConfirmChange,
      expect.objectContaining({
        data: expect.objectContaining({ from: '40', to: '55' }),
      }),
    );
    expect(updateMatch).not.toHaveBeenCalled();

    nestedClosed.next(true);
    expect(updateMatch).toHaveBeenCalledWith(12, edit({ quantityMatched: 55 }));
  });

  /** Keeping the old value is a decision, not a failure — nothing is written and nothing is said. */
  it('writes nothing when the operator keeps the old quantity', () => {
    act('Confirmed', { action: 'save', request: edit({ quantityMatched: 55 }) });
    nestedClosed.next(false);

    expect(updateMatch).not.toHaveBeenCalled();
    expect(openSnack).not.toHaveBeenCalled();
  });

  /**
   * Both changes named in one prompt. Naming only the quantity would have the operator agree to one
   * change and unknowingly apply two, because the write applies both fields regardless.
   */
  it('names both consequences when quantity and transport changed together', () => {
    act('Confirmed', {
      action: 'save',
      request: edit({ quantityMatched: 55, transportCompany: 'Rangiora Transport' }),
    });

    const [, options] = openDialog.mock.calls.at(-1) as [unknown, { data: { consequence: string } }];

    expect(options.data.consequence).toContain('quantity from 40 to 55');
    expect(options.data.consequence).toContain('Kaikoura Carriers to Rangiora Transport');
  });

  it('prompts before changing a confirmed match transport company', () => {
    act('Confirmed', { action: 'save', request: edit({ transportCompany: 'Rangiora Transport' }) });

    expect(openDialog).toHaveBeenCalledWith(
      ConfirmChange,
      expect.objectContaining({
        data: expect.objectContaining({ from: 'Kaikoura Carriers', to: 'Rangiora Transport' }),
      }),
    );
  });

  /**
   * A price is between APG and the farmer and changes nothing anyone else is planning around, so it
   * is editable at every status with no prompt — unlike the quantity the meatworks expects and the
   * carrier who is turning up.
   */
  it('does not prompt when only the price changed on a confirmed match', () => {
    act('Confirmed', { action: 'save', request: edit({ pricePerKg: 7.25 }) });

    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(updateMatch).toHaveBeenCalledWith(12, edit({ pricePerKg: 7.25 }));
  });

  // --- the five actions ---------------------------------------------------------------------------

  it('notifies a draft in one write, carrying the form values and asking nothing first', () => {
    act('Drafted', { action: 'notify', request: edit({ quantityMatched: 55 }) });

    expect(notifyMatch).toHaveBeenCalledWith(12, edit({ quantityMatched: 55 }));
    expect(updateMatch).not.toHaveBeenCalled();
    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(patches).toHaveLength(1);
  });

  /**
   * The snack is the second place the prototype's silence is stated, after the dialog's caption, and
   * it is the one an operator sees when they press the button without reading anything. `Notify` is
   * a word that promises an outbound message; nothing here sends one.
   */
  it('says in the snack that no message was sent', () => {
    act('Drafted', { action: 'notify', request: edit() });

    const [message] = openSnack.mock.calls.at(-1) as [string];

    expect(message).toContain('no message sent');
    expect(message).toContain('ANZCO');
  });

  it('confirms a draft in one write, carrying the form values', () => {
    act('Drafted', { action: 'confirm', request: edit({ quantityMatched: 55 }) });

    expect(confirmMatch).toHaveBeenCalledWith(12, edit({ quantityMatched: 55 }));
    expect(updateMatch).not.toHaveBeenCalled();
    expect(patches).toHaveLength(1);
  });

  it('deletes a draft with no reason and no second dialog', () => {
    act('Drafted', { action: 'delete' });

    expect(deleteMatch).toHaveBeenCalledWith(12);
    expect(openDialog).toHaveBeenCalledTimes(1);
  });

  it('asks for a reason before cancelling, and cancels nothing without one', () => {
    act('Confirmed', { action: 'cancel' });

    expect(openDialog).toHaveBeenCalledWith(CancelMatch, expect.objectContaining({ width: '480px' }));
    expect(cancelMatch).not.toHaveBeenCalled();

    nestedClosed.next(undefined);
    expect(cancelMatch).not.toHaveBeenCalled();
  });

  it('cancels with the chosen reason', () => {
    act('Confirmed', { action: 'cancel' });
    nestedClosed.next('ChangeFromProcessor' satisfies MatchCancellationReason);

    expect(cancelMatch).toHaveBeenCalledWith(12, 'ChangeFromProcessor');
    expect(patches).toEqual([{ space: written.space, availability: written.availability }]);
  });

  // --- confirming a Processor Space ---------------------------------------------------------------

  /**
   * Only the space comes back, and only the space is patched. Confirming a space touches no
   * availability record, and a patch claiming otherwise would be the screen asserting something the
   * server did not say.
   */
  it('patches only the space when a space is confirmed', () => {
    const confirmed = aSpace({ id: 4, status: 'Confirmed', canConfirm: false });
    confirmSpace.mockReturnValue(of(confirmed));

    TestBed.inject(MatchActions).confirmSpace(4);

    expect(confirmSpace).toHaveBeenCalledWith(4);
    expect(patches).toEqual([{ space: confirmed }]);
  });

  it('shows the API message when a write is refused', () => {
    updateMatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Capped at 100, which is the availability record’s remaining supply' },
          }),
      ),
    );

    act('Drafted', { action: 'save', request: edit({ quantityMatched: 900 }) });

    expect(openSnack).toHaveBeenCalledWith(
      'Capped at 100, which is the availability record’s remaining supply',
      '',
      expect.anything(),
    );
    expect(patches).toHaveLength(0);
  });
});
