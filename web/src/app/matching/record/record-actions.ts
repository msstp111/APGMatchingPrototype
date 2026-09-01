import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiClient } from '../../api/api-client';
import {
  LivestockAvailabilityDto,
  ProcessorSpaceDto,
  RecordWriteResultDto,
} from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { filterAvailability, filterSpaces } from '../filters/filter-service';
import { MatchingPreferences } from '../filters/matching-preferences';
import { RecordPatches } from '../match/record-patches';
import {
  AvailabilityForm,
  AvailabilityFormData,
  AvailabilityFormResult,
} from './availability-form';
import { CancelRecord, CancelRecordData } from './cancel-record';
import { ConfirmOverCommit, ConfirmOverCommitData } from './confirm-over-commit';
import { RecordVocabularies, RecordVocabulary } from './record-vocabularies';
import { SpaceForm, SpaceFormData, SpaceFormResult } from './space-form';

const SNACK_MS = 4000;

/** Long enough to read a sentence and reach for the action that reveals what it describes. */
const CANCEL_SNACK_MS = 10000;

const SNACK_PANEL = 'apg-snack';

/**
 * Adding, editing and cancelling records — the debug half of the screen.
 *
 * The sibling of `MatchActions`, and the same division of labour: the dialogs decide nothing and write
 * nothing, this performs every write, publishes the recomputed record to {@link RecordPatches}, and
 * reports what happened. A service rather than code on a card because a create has no card yet.
 *
 * Two behaviours here are the phase, and neither is a form:
 *
 * **Reducing a quantity below what is already matched is allowed.** It is the one intended route to
 * the pink "Over-committed" state — a farmer can sell stock elsewhere — so the operator is asked once,
 * in the terms of what it will do, and then it is written. The server does not refuse it either.
 *
 * **Cancelling a record leaves every one of its matches alone.** The dialog lists them first, the snack
 * says so afterwards, and its action puts the cancelled record back on screen so the surviving matches
 * can be seen on it rather than taken on trust.
 */
@Injectable({ providedIn: 'root' })
export class RecordActions {
  private readonly api = inject(ApiClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly patches = inject(RecordPatches);
  private readonly preferences = inject(MatchingPreferences);
  private readonly vocabularies = inject(RecordVocabularies);

  addSpace(): void {
    this.withVocabulary((vocabulary) => this.openSpaceForm(null, vocabulary));
  }

  editSpace(space: ProcessorSpaceDto): void {
    this.withVocabulary((vocabulary) => this.openSpaceForm(space, vocabulary));
  }

  addAvailability(): void {
    this.withVocabulary((vocabulary) => this.openAvailabilityForm(null, vocabulary));
  }

  editAvailability(record: LivestockAvailabilityDto): void {
    this.withVocabulary((vocabulary) => this.openAvailabilityForm(record, vocabulary));
  }

  /** @see cancelAvailability — the same act, and the same non-cascade, on the demand side. */
  cancelSpace(space: ProcessorSpaceDto): void {
    const data: CancelRecordData = {
      side: 'demand',
      title: `Processor space #${space.id} — ${space.processor} ${space.plant}`,
      matches: space.matches,
    };

    this.confirmCancel(data, () =>
      this.api.cancelSpace(space.id).subscribe({
        next: (result) => this.applyCancellation(result, 'demand', `Space #${space.id}`),
        error: (error: unknown) => this.report(error),
      }),
    );
  }

  cancelAvailability(record: LivestockAvailabilityDto): void {
    const data: CancelRecordData = {
      side: 'supply',
      title: `Livestock availability #${record.id} — ${record.locationName ?? 'no location'}`,
      matches: record.matches,
    };

    this.confirmCancel(data, () =>
      this.api.cancelAvailability(record.id).subscribe({
        next: (result) => this.applyCancellation(result, 'supply', `Record #${record.id}`),
        error: (error: unknown) => this.report(error),
      }),
    );
  }

  /**
   * The forms are useless without their vocabularies — a stock class picker with nothing in it invites
   * a choice against an empty list — so the dialog opens only once they are in hand.
   */
  private withVocabulary(open: (vocabulary: RecordVocabulary) => void): void {
    this.vocabularies.load().subscribe({
      next: (vocabulary) => open(vocabulary),
      // Nothing was being saved here, so the failure gets its own sentence rather than the write one's.
      error: (error: unknown) =>
        this.report(error, 'The form could not be opened. The API may not be running.'),
    });
  }

  private openSpaceForm(space: ProcessorSpaceDto | null, vocabulary: RecordVocabulary): void {
    const data: SpaceFormData = { space, reference: vocabulary.reference };

    this.dialog
      .open<SpaceForm, SpaceFormData, SpaceFormResult>(SpaceForm, {
        data,
        width: '640px',
        maxHeight: '90vh',
        panelClass: 'apg-record-form',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.action === 'create') {
          this.api.createSpace(result.request).subscribe({
            next: (write) => this.applyWrite(write, 'Processor space added'),
            error: (error: unknown) => this.report(error),
          });

          return;
        }

        // An edit may leave the space over-filled, which is permitted and expected — but the operator
        // is still about to make a record disagree with its own matches, so they are told once.
        this.prompted(
          {
            title: `Processor space #${space!.id}`,
            side: 'demand',
            from: space!.quantityRequired,
            to: result.request.quantityRequired,
            matched: space!.matchedInclDraft,
            matchCount: space!.matches.length,
          },
          () =>
            this.api.updateSpace(space!.id, result.request).subscribe({
              next: (write) => this.applyWrite(write, `Space #${space!.id} updated`),
              error: (error: unknown) => this.report(error),
            }),
        );
      });
  }

  private openAvailabilityForm(
    record: LivestockAvailabilityDto | null,
    vocabulary: RecordVocabulary,
  ): void {
    const data: AvailabilityFormData = {
      record,
      reference: vocabulary.reference,
      locations: vocabulary.locations,
    };

    this.dialog
      .open<AvailabilityForm, AvailabilityFormData, AvailabilityFormResult>(AvailabilityForm, {
        data,
        width: '640px',
        maxHeight: '90vh',
        panelClass: 'apg-record-form',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.action === 'create') {
          this.api.createAvailability(result.request).subscribe({
            next: (write) => this.applyWrite(write, 'Livestock availability added'),
            error: (error: unknown) => this.report(error),
          });

          return;
        }

        this.prompted(
          {
            title: `Livestock availability #${record!.id}`,
            side: 'supply',
            from: record!.quantityAvailable,
            to: result.request.quantityAvailable,
            matched: record!.matchedInclDraft,
            matchCount: record!.matches.length,
          },
          () =>
            this.api.updateAvailability(record!.id, result.request).subscribe({
              next: (write) => this.applyWrite(write, `Record #${record!.id} updated`),
              error: (error: unknown) => this.report(error),
            }),
        );
      });
  }

  /**
   * The prompt in front of an edit that would leave a record disagreeing with its own matches
   * (requirement 4.5).
   *
   * It fires only when the new quantity is **below** what is already matched — a comparison of two
   * figures the server computed, never a sum worked out here. Declining is silent: keeping the
   * quantity is a decision, not a failure, and it earns no message.
   */
  private prompted(data: ConfirmOverCommitData, write: () => void): void {
    if (data.matched < 1 || data.to >= data.matched) {
      write();

      return;
    }

    this.dialog
      .open<ConfirmOverCommit, ConfirmOverCommitData, boolean>(ConfirmOverCommit, {
        data,
        width: '440px',
        panelClass: 'apg-confirm-over-commit',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((agreed) => {
        if (agreed) {
          write();
        }
      });
  }

  private confirmCancel(data: CancelRecordData, cancel: () => void): void {
    this.dialog
      .open<CancelRecord, CancelRecordData, boolean>(CancelRecord, {
        data,
        width: '520px',
        maxHeight: '90vh',
        panelClass: 'apg-cancel-record',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((agreed) => {
        if (agreed) {
          cancel();
        }
      });
  }

  /**
   * Every record write lands here. The record arrives already recomputed, and the calendar with it —
   * a record created for a week the columns were not drawn on has to bring that week with it or it
   * would place nowhere at all.
   */
  private applyWrite(result: RecordWriteResultDto, message: string): void {
    this.publish(result);
    this.snackBar.open(this.qualified(result, message), '', {
      duration: SNACK_MS,
      panelClass: SNACK_PANEL,
    });
  }

  /**
   * Says so when the record that was just written is not on screen.
   *
   * A record added while the column is filtered to something else lands in the list and is then
   * filtered straight back out — the write worked and nothing appeared, which is the worst thing a
   * demo tool can do. The filters that would hide it are the same pure functions the screen filters
   * with, run over the one record, so this cannot disagree with what is actually rendered.
   */
  private qualified(result: RecordWriteResultDto, message: string): string {
    const hidden = result.space
      ? filterSpaces([result.space], this.preferences.demandFilters()).length === 0
      : result.availability
        ? filterAvailability([result.availability], this.preferences.supplyFilters()).length === 0
        : false;

    return hidden ? `${message} — hidden by this column's filters` : message;
  }

  /**
   * A cancellation, and the sentence that makes the non-cascade visible rather than surprising.
   *
   * The record has left both columns' default filters, so the card is gone from view — which is
   * exactly when someone concludes the matches went with it. `SHOW IT` ticks `Cancelled` into this
   * column's status filter, and the card comes back with its match table intact, on screen, still
   * listing every match that survived (requirements 5.3 and 5.4).
   */
  private applyCancellation(result: RecordWriteResultDto, side: MatchSide, label: string): void {
    this.publish(result);

    const matches = (result.space ?? result.availability)?.matches ?? [];
    const message =
      matches.length === 0
        ? `${label} cancelled`
        : `${label} cancelled — its ${matches.length} ${matches.length === 1 ? 'match is' : 'matches are'} untouched`;

    this.snackBar
      .open(message, 'SHOW IT', { duration: CANCEL_SNACK_MS, panelClass: SNACK_PANEL })
      .onAction()
      .subscribe(() => this.showCancelled(side));
  }

  /** Adds `Cancelled` to that column's status filter, which is the way back to the record (5.4). */
  private showCancelled(side: MatchSide): void {
    if (side === 'demand') {
      const filters = this.preferences.demandFilters();

      if (!filters.statuses.includes('Cancelled')) {
        this.preferences.setDemandFilters({
          ...filters,
          statuses: [...filters.statuses, 'Cancelled'],
        });
      }

      return;
    }

    const filters = this.preferences.supplyFilters();

    if (!filters.statuses.includes('Cancelled')) {
      this.preferences.setSupplyFilters({
        ...filters,
        statuses: [...filters.statuses, 'Cancelled'],
      });
    }
  }

  private publish(result: RecordWriteResultDto): void {
    this.patches.publish({
      space: result.space,
      availability: result.availability,
      weeks: result.weeks,
    });
  }

  /**
   * The API's own message wherever it sent one — the vocabulary rules, the minimum, the missing date —
   * because each of them names something the operator can act on.
   */
  private report(
    error: unknown,
    fallback = 'That could not be saved. The API may not be running.',
  ): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : fallback;

    this.snackBar.open(message, '', { duration: SNACK_MS, panelClass: SNACK_PANEL });
  }
}
