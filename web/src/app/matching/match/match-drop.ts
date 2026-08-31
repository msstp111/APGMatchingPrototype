import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { CreateMatchRequest, MatchProposalDto, MatchWriteResultDto } from '../../api/models';
import { MatchPair } from '../drag/card-drag';
import { QuantityPrompt, QuantityPromptData } from './quantity-prompt';

/** design-system.md 11.2 and 11.3: a refusal reads and goes; a creation offers an undo. */
const REFUSAL_MS = 4000;
const CREATION_MS = 8000;
const SNACK_PANEL = 'apg-snack';

/**
 * The whole of what happens between letting go of a card and a match existing.
 *
 * Ordered this way because requirement 3.2 is about *when* the refusal appears: ask the server whether
 * the pair can be matched **before** opening anything, so a pair with nothing left to match produces a
 * message and no dialog, rather than a dialog whose only button is disabled.
 *
 * A service rather than code on the card because a drop concerns three records — the two being matched
 * and the match itself — and the card that happens to be underneath the pointer owns none of them. It
 * publishes what it wrote on {@link writes}; `matching-screen` replaces the two records by id.
 */
@Injectable({ providedIn: 'root' })
export class MatchDrop {
  private readonly api = inject(ApiClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly written = new Subject<MatchWriteResultDto>();

  /** Every create and every undo, with both parents already recomputed by the server. */
  readonly writes: Observable<MatchWriteResultDto> = this.written.asObservable();

  dropped(pair: MatchPair): void {
    this.api.matchProposal(pair.space.id, pair.availability.id).subscribe({
      next: (proposal) => this.propose(pair, proposal),
      error: (error: unknown) => this.report(error),
    });
  }

  private propose(pair: MatchPair, proposal: MatchProposalDto): void {
    if (!proposal.isAllowed) {
      // The words are the domain's constant, shipped on the proposal and rendered as given. There is
      // no client-side sentence to fall back on: composing one here is how two refusals for the same
      // reason come to read differently.
      if (proposal.refusalMessage) {
        this.snackBar.open(proposal.refusalMessage, '', {
          duration: REFUSAL_MS,
          panelClass: SNACK_PANEL,
        });
      }

      return;
    }

    const data: QuantityPromptData = { pair, proposal };

    this.dialog
      .open<QuantityPrompt, QuantityPromptData, CreateMatchRequest>(QuantityPrompt, {
        data,
        width: '560px',
        maxHeight: '90vh',
        panelClass: 'apg-quantity-prompt',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((request) => {
        if (request) {
          this.create(request);
        }
      });
  }

  private create(request: CreateMatchRequest): void {
    this.api.createMatch(request).subscribe({
      next: (result) => {
        this.written.next(result);
        this.confirm(result);
      },
      error: (error: unknown) => this.report(error),
    });
  }

  /**
   * design-system.md 11.3: what was created, and the way back out of it.
   *
   * The undo is a real delete of the draft rather than a stashed edit, which is why it is safe to
   * offer: nothing downstream has happened to a match this new (resolved question 3).
   */
  private confirm(result: MatchWriteResultDto): void {
    const match = result.match;

    if (!match) {
      this.snackBar.open('Match removed', '', { duration: REFUSAL_MS, panelClass: SNACK_PANEL });

      return;
    }

    const bar = this.snackBar.open(
      `Match created — ${match.quantityMatched} head, ${match.processor} ${match.plant}`,
      'Undo',
      { duration: CREATION_MS, panelClass: SNACK_PANEL },
    );

    bar.onAction().subscribe(() => this.undo(match.id));
  }

  private undo(matchId: number): void {
    this.api.deleteMatch(matchId).subscribe({
      next: (result) => {
        this.written.next(result);
        this.confirm(result);
      },
      error: (error: unknown) => this.report(error),
    });
  }

  /**
   * Every failure the API can answer with carries a `message` the operator can act on, so it is shown
   * as it arrived. Only a request that never reached the API needs a sentence of our own.
   */
  private report(error: unknown): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : 'The match could not be saved. The API may not be running.';

    this.snackBar.open(message, '', { duration: CREATION_MS, panelClass: SNACK_PANEL });
  }
}
