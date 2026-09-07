import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { CreateMatchRequest, MatchProposalDto, MatchWriteResultDto } from '../../api/models';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { MatchDrop } from './match-drop';
import { QuantityPrompt, QuantityPromptData } from './quantity-prompt';
import { RecordPatch, RecordPatches } from './record-patches';

describe('Match drop', () => {
  const pair = { space: aSpace({ id: 4 }), availability: anAvailability({ id: 8 }) };
  const allowed: MatchProposalDto = {
    isAllowed: true,
    refusalMessage: null,
    quantity: 40,
    maximum: 90,
    defaultPricePerKg: 6.45,
  };
  const request: CreateMatchRequest = {
    processorSpaceId: 4,
    livestockAvailabilityId: 8,
    quantityMatched: 40,
    pricePerKg: 6.45,
    transportCompany: null,
  };
  const created: MatchWriteResultDto = {
    match: aMatch({ id: 99, status: 'Drafted', quantityMatched: 40 }),
    space: aSpace({ id: 4, unmatched: 60 }),
    availability: anAvailability({ id: 8, unmatched: 50 }),
  };

  const matchProposal = vi.fn();
  const createMatch = vi.fn();
  const deleteMatch = vi.fn();
  const openDialog = vi.fn();
  const openSnack = vi.fn();
  const dialogClosed = new Subject<CreateMatchRequest | undefined>();
  const snackAction = new Subject<void>();

  beforeEach(() => {
    matchProposal.mockReset();
    createMatch.mockReset();
    deleteMatch.mockReset();
    openDialog.mockReset();
    openSnack.mockReset();

    openDialog.mockReturnValue({
      afterClosed: () => dialogClosed.asObservable(),
    } as MatDialogRef<QuantityPrompt, CreateMatchRequest>);

    openSnack.mockReturnValue({
      onAction: () => snackAction.asObservable(),
    } as MatSnackBarRef<TextOnlySnackBar>);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MatchDrop,
        {
          provide: ApiClient,
          useValue: { matchProposal, createMatch, deleteMatch, transportCompanies: () => of([]) },
        },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnack } },
      ],
    });
  });

  it('refuses at the drop and never opens the dialog', () => {
    matchProposal.mockReturnValue(
      of({
        isAllowed: false,
        refusalMessage: 'There is no unmatched quantity',
        quantity: 0,
        maximum: 0,
        defaultPricePerKg: null,
      } satisfies MatchProposalDto),
    );

    TestBed.inject(MatchDrop).dropped(pair);

    expect(openSnack).toHaveBeenCalledWith('There is no unmatched quantity', '', expect.anything());
    expect(openDialog).not.toHaveBeenCalled();
    expect(createMatch).not.toHaveBeenCalled();
  });

  it('opens the prompt with the server proposal and creates nothing on cancel', () => {
    matchProposal.mockReturnValue(of(allowed));

    TestBed.inject(MatchDrop).dropped(pair);
    dialogClosed.next(undefined);

    expect(openDialog).toHaveBeenCalledWith(
      QuantityPrompt,
      expect.objectContaining({
        data: { pair, proposal: allowed } satisfies QuantityPromptData,
        width: '560px',
      }),
    );
    expect(createMatch).not.toHaveBeenCalled();
  });

  it('creates the match and offers undo, which deletes the draft', () => {
    matchProposal.mockReturnValue(of(allowed));
    createMatch.mockReturnValue(of(created));
    deleteMatch.mockReturnValue(
      of({
        match: null,
        space: aSpace({ id: 4, unmatched: 100 }),
        availability: anAvailability({ id: 8, unmatched: 90 }),
      } satisfies MatchWriteResultDto),
    );

    // Phase 6 moved the write stream to RecordPatches, so every writer on the screen publishes to one
    // place and `matching-screen` subscribes once. The drop is now one of six.
    const writes: RecordPatch[] = [];
    const drop = TestBed.inject(MatchDrop);

    TestBed.inject(RecordPatches).patches.subscribe((patch) => writes.push(patch));
    drop.dropped(pair);
    dialogClosed.next(request);
    snackAction.next();

    expect(createMatch).toHaveBeenCalledWith(request);
    expect(deleteMatch).toHaveBeenCalledWith(99);
    // A patch carries the recomputed records, not the match: the screen replaces two cards by id.
    expect(writes).toHaveLength(2);
    expect(writes[0].space?.id).toBe(4);
    expect(writes[0].availability?.id).toBe(8);
    expect(writes[1].availability?.unmatched).toBe(90);
    expect(openSnack).toHaveBeenCalledWith(
      'Match created: 40 head, ANZCO Rangitikei',
      'Undo',
      expect.anything(),
    );
  });

  it('shows the API message when the request fails', () => {
    matchProposal.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Capped at 12, which is all this livestock availability record has unmatched' },
          }),
      ),
    );

    TestBed.inject(MatchDrop).dropped(pair);

    expect(openSnack).toHaveBeenCalledWith(
      'Capped at 12, which is all this livestock availability record has unmatched',
      '',
      expect.anything(),
    );
  });
});
