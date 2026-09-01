import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatchSide } from '../board/matching-board';

/** What is about to happen to a record whose new quantity sits under its matched total. */
export interface ConfirmOverCommitData {
  /** `Livestock availability #12 — Totara Kauri Trust`, so the prompt names a record and not a form. */
  readonly title: string;
  readonly side: MatchSide;
  /** The quantity as it stands, and as it is about to be. Both are the operator's own figures. */
  readonly from: number;
  readonly to: number;
  /** The record's matched total, from the DTO. Nothing here works one out. */
  readonly matched: number;
  readonly matchCount: number;
}

/**
 * The warning before an edit that leaves a record over-committed — and it is a warning, not a gate
 * (requirements 4.4 and 4.5).
 *
 * Reducing a farmer's available quantity below what has already been matched is the **one intended
 * route** to the pink "Over-committed" state (design-system.md 4.3), and the spec contemplates it
 * plainly: a farmer can sell stock elsewhere after offering it. So the operator is told what the edit
 * will do and then allowed to do it. Nothing on the server refuses it either.
 *
 * The prompt is the client's for the reason Phase 6 recorded of its own: it is a question for a human
 * about a consequence, not a rule about validity.
 */
@Component({
  selector: 'app-confirm-over-commit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-over-commit.html',
  styleUrl: './confirm-over-commit.scss',
})
export class ConfirmOverCommit {
  readonly data = inject<ConfirmOverCommitData>(MAT_DIALOG_DATA);

  readonly isSupply = this.data.side === 'supply';

  /** The state the record is about to land in, in the words its own side uses (design-system.md 15). */
  readonly stateLabel = this.isSupply ? 'Over-committed' : 'Over-filled';

  /** The same word inside a sentence, so the template needs no pipe for it. */
  readonly stateWord = this.stateLabel.toLowerCase();

  /** Each side's own noun, so a space is never called a record (design-system.md 6.3's noun sets). */
  readonly recordWord = this.isSupply ? 'record' : 'space';

  readonly matchesWord = this.data.matchCount === 1 ? 'match' : 'matches';

  /**
   * Why it matters, in the terms of the thing on the other end rather than the field.
   *
   * On supply this is the bug-flag state the whole screen is coloured to make visible, so the sentence
   * says so. On demand an over-filled space is ordinary and expected (resolved question 1) — the
   * prompt still appears, because the operator is still about to make a record disagree with its own
   * matches, but it does not pretend anything has gone wrong.
   */
  readonly consequence = this.isSupply
    ? `Its ${this.data.matchCount} ${this.matchesWord} are not changed by this, so the record will ` +
      `show as Over-committed until they are re-cut or cancelled.`
    : `Its ${this.data.matchCount} ${this.matchesWord} are not changed by this. An over-filled space ` +
      `is a normal state — the meter turns blue and reads Over-filled.`;
}
