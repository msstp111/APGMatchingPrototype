import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiClient } from '../../api/api-client';
import {
  MatchCancellationReason,
  MatchEditContextDto,
  MatchWriteResultDto,
  ProcessorSpaceDto,
  UpdateMatchRequest,
} from '../../api/models';
import { CancelMatch, CancelMatchData } from './cancel-match';
import { ConfirmChange, ConfirmChangeData } from './confirm-change';
import { MatchModal, MatchModalResult } from './match-modal';
import { RecordPatches } from './record-patches';

const SNACK_MS = 4000;
const SNACK_PANEL = 'apg-snack';

/**
 * Everything that can be done to a match once it exists, and confirming a Processor Space.
 *
 * **A match is opened by id and nothing else** — {@link open} fetches the context, which carries the
 * match, both parents in full and the edit ceiling. That is the whole of why the same match is
 * openable from its space and from its availability record (requirement 1.2): both cards call the same
 * method with the same number, and neither has any notion of a side.
 *
 * Every footer action closes the modal and lands here. Each one writes, publishes the recomputed
 * records to {@link RecordPatches} and reports what happened — which is what makes an edit's effect on
 * both columns immediate (requirement 3.4) without a refetch anywhere.
 *
 * A service rather than code on the card for the same reason `MatchDrop` is one: a match concerns
 * three records, and the card the operator happened to open it from owns none of them.
 */
@Injectable({ providedIn: 'root' })
export class MatchActions {
  private readonly api = inject(ApiClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly patches = inject(RecordPatches);

  /** Opens a match. The id is all either card has to know. */
  open(matchId: number): void {
    this.api.match(matchId).subscribe({
      next: (context) => this.openModal(context),
      error: (error: unknown) => this.report(error),
    });
  }

  /**
   * Confirms a Processor Space — the explicit APG action that sets its **stored** status
   * (requirement 5.4). Nothing computes it, here or anywhere.
   *
   * The card's button is already gated on the DTO's `canConfirm`, and this exists because that is not
   * a reason to trust it: the server re-asks the domain and refuses with the same sentence the card
   * would have printed.
   */
  confirmSpace(spaceId: number): void {
    this.api.confirmSpace(spaceId).subscribe({
      next: (space) => this.applySpace(space),
      error: (error: unknown) => this.report(error),
    });
  }

  private openModal(context: MatchEditContextDto): void {
    this.dialog
      .open<MatchModal, MatchEditContextDto, MatchModalResult>(MatchModal, {
        data: context,
        width: '640px',
        maxHeight: '90vh',
        panelClass: 'apg-match-modal',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.perform(context, result);
        }
      });
  }

  private perform(context: MatchEditContextDto, result: MatchModalResult): void {
    switch (result.action) {
      case 'save':
        this.save(context, result.request);
        break;

      case 'confirm':
        this.confirmMatch(context, result.request);
        break;

      case 'delete':
        this.deleteDraft(context);
        break;

      case 'cancel':
        this.askForReason(context);
        break;
    }
  }

  /**
   * Saving, with the Confirmed-match prompt in front of it where the spec asks for one.
   *
   * The prompt is the client's rather than the server's on purpose: it is a question for a human about
   * a consequence, not a rule about validity. The server enforces the ceiling and the minimum whatever
   * the dialog allowed.
   */
  private save(context: MatchEditContextDto, request: UpdateMatchRequest): void {
    this.prompted(context, request, () =>
      this.api.updateMatch(context.match.id, request).subscribe({
        next: (result) => this.applyWrite(result, `Match updated: ${request.quantityMatched} head`),
        error: (error: unknown) => this.report(error),
      }),
    );
  }

  /**
   * Drafted to Confirmed, carrying the form's values so an edited match is saved and confirmed in one
   * write. There is no prompt: the match has been communicated to nobody yet, which is what `Drafted`
   * means.
   */
  private confirmMatch(context: MatchEditContextDto, request: UpdateMatchRequest): void {
    this.api.confirmMatch(context.match.id, request).subscribe({
      next: (result) => this.applyWrite(result, `Match confirmed: ${request.quantityMatched} head`),
      error: (error: unknown) => this.report(error),
    });
  }

  /**
   * Resolved question 3: a drafted match is removed outright, with no reason asked for.
   *
   * The button says `Undo match` and so does the snack — a confirmation that reports a different verb
   * from the one just pressed makes the operator wonder whether a different thing happened.
   */
  private deleteDraft(context: MatchEditContextDto): void {
    this.api.deleteMatch(context.match.id).subscribe({
      next: (result) => this.applyWrite(result, 'Match undone'),
      error: (error: unknown) => this.report(error),
    });
  }

  private askForReason(context: MatchEditContextDto): void {
    const data: CancelMatchData = { match: context.match };

    this.dialog
      .open<CancelMatch, CancelMatchData, MatchCancellationReason>(CancelMatch, {
        data,
        width: '480px',
        panelClass: 'apg-cancel-match',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((reason) => {
        if (reason) {
          this.cancelMatch(context, reason);
        }
      });
  }

  /**
   * The match is kept, with its reason, and leaves the matching screen — it is excluded from both
   * parents' collections, so the response carries no match and the cards simply stop listing it. In
   * pass 1 it is then not visible anywhere, which is what the dialog warned about.
   */
  private cancelMatch(context: MatchEditContextDto, reason: MatchCancellationReason): void {
    this.api.cancelMatch(context.match.id, reason).subscribe({
      next: (result) => this.applyWrite(result, 'Match cancelled'),
      error: (error: unknown) => this.report(error),
    });
  }

  /**
   * The prompt before changing a `Confirmed` match (requirements 3.1 and 3.3, design-system.md 11.5).
   *
   * **Quantity and transport prompt; price does not**, and nothing prompts at `Drafted`. The rule is
   * about who else is affected: a quantity is what the meatworks expects to receive and a carrier is
   * who is turning up, both already agreed with somebody. A price is between APG and the farmer and
   * changes nothing anyone is planning around.
   */
  private prompted(
    context: MatchEditContextDto,
    request: UpdateMatchRequest,
    write: () => void,
  ): void {
    const prompt = this.promptFor(context, request);

    if (!prompt) {
      write();

      return;
    }

    this.dialog
      .open<ConfirmChange, ConfirmChangeData, boolean>(ConfirmChange, {
        data: prompt,
        width: '440px',
        panelClass: 'apg-confirm-change',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((agreed) => {
        // Keeping the old value is a decision, not a failure: it earns no message.
        if (agreed) {
          write();
        }
      });
  }

  private promptFor(
    context: MatchEditContextDto,
    request: UpdateMatchRequest,
  ): ConfirmChangeData | null {
    const match = context.match;

    if (match.status !== 'Confirmed') {
      return null;
    }

    const quantityChanged = request.quantityMatched !== match.quantityMatched;
    const carrier = request.transportCompany;
    const carrierChanged = carrier !== (match.transportCompany ?? null);

    if (!quantityChanged && !carrierChanged) {
      return null;
    }

    const expects = `what ${match.processor} ${match.plant} expects on ${match.deliveryDateLabel}`;
    const was = match.transportCompany ?? 'none';
    const now = carrier ?? 'none';

    // Both consequences are named when both fields changed. A prompt that mentioned only the quantity
    // would have the operator agree to one change and unknowingly apply two — and the write applies
    // both, so the sentence has to account for both.
    const consequences = [
      quantityChanged
        ? `Changing its quantity from ${match.quantityMatched} to ${request.quantityMatched} head ` +
          `will change ${expects}.`
        : null,
      carrierChanged
        ? `Changing its transport company from ${was} to ${now} will change who collects this stock.`
        : null,
    ].filter((sentence): sentence is string => sentence !== null);

    // The buttons carry the values of whichever field is the headline — the quantity when it moved,
    // since that is the figure the whole screen is scanned for, and the carrier otherwise.
    return quantityChanged
      ? {
          match,
          from: `${match.quantityMatched}`,
          to: `${request.quantityMatched}`,
          consequence: consequences.join(' '),
        }
      : {
          match,
          from: match.transportCompany ?? 'no carrier',
          to: carrier ?? 'no carrier',
          consequence: consequences.join(' '),
        };
  }

  private applyWrite(result: MatchWriteResultDto, message: string): void {
    this.patches.publishWrite(result);
    this.snackBar.open(message, '', { duration: SNACK_MS, panelClass: SNACK_PANEL });
  }

  /** Only the space comes back, because confirming one touches nothing else. */
  private applySpace(space: ProcessorSpaceDto): void {
    this.patches.publish({ space });
    this.snackBar.open(
      `Processor space #${space.id} confirmed`,
      '',
      { duration: SNACK_MS, panelClass: SNACK_PANEL },
    );
  }

  /**
   * Every failure the API can answer with carries a `message` the operator can act on — the ceiling,
   * the status gate, the missing reason — so it is shown as it arrived. Only a request that never
   * reached the API needs a sentence of our own.
   */
  private report(error: unknown): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : 'That could not be saved. The API may not be running.';

    this.snackBar.open(message, '', { duration: SNACK_MS, panelClass: SNACK_PANEL });
  }
}
