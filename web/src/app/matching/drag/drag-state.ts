import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';

/**
 * What a card hands the drag layer when it is picked up, and what a drop target is judged against.
 *
 * A union on `side` rather than one shape with two optional records, so the pair a drop resolves to is
 * right by construction: there is no way to read a Processor Space off a supply card, and no cast
 * anywhere in the drop path. It carries the whole DTO because the dialog needs both records in full
 * and the drop is the only place that has both.
 */
export type DragCard =
  | { readonly side: 'demand'; readonly space: ProcessorSpaceDto }
  | { readonly side: 'supply'; readonly availability: LivestockAvailabilityDto };

/**
 * The dragged record's own unmatched figure, straight off its DTO.
 *
 * Carried so a target can show the blocked affordance before the pointer is released. The
 * *authoritative* refusal is still the server's, on the drop (requirement 3.2).
 */
export function dragUnmatched(card: DragCard): number {
  return card.side === 'demand' ? card.space.unmatched : card.availability.unmatched;
}

/** What the card calls itself, for the messages that have to name what moved. */
export function dragName(card: DragCard): string {
  return card.side === 'demand'
    ? `${card.space.processor} ${card.space.plant}`
    : (card.availability.locationName ?? '-');
}

/**
 * How a card looks to an in-flight drag (design-system.md 10).
 *
 * - `none` — no drag is happening. Nothing changes at all.
 * - `same` — the drag came from this column. Nothing changes except `cursor: no-drop`. Dropping
 *   within a column is a no-op (requirement 1.3); an outline or a message for a gesture that simply
 *   does not apply teaches an operator to fear the screen.
 * - `valid` — the pair has quantity to match.
 * - `blocked` — the gesture *would* apply, but one of the two records is full. Distinct from `same`
 *   for exactly that reason.
 */
export type DropState = 'none' | 'same' | 'valid' | 'blocked';

/**
 * The state of the one drag in flight, and the single place the screen agrees on it.
 *
 * Root-provided because four unrelated places need the same answer at once: the dragged card, every
 * possible target card, the opposite column's wash, and both columns' auto-scroll. Passing it down
 * the component tree would mean threading it through the column and the band, neither of which has
 * any business knowing about a drag.
 *
 * **The pointer is not a signal.** It changes on every pointer move, and a signal write per frame
 * would schedule a change-detection pass per frame for a value only the auto-scroll loop reads. The
 * things that *do* change appearance — which drag is active, and whether it was cancelled — change
 * once per drag and are signals.
 */
@Injectable({ providedIn: 'root' })
export class DragStore {
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<DragCard | null>(null);

  private pointerX = 0;
  private pointerY = 0;

  /**
   * Set by Escape and cleared by the next pickup, never by the end of a drag.
   *
   * The order matters: CDK emits `ended` on the drag *before* `dropped` on the container it was
   * released over, so anything that reset this on `ended` would have cleared it before the drop
   * handler could read it.
   */
  private cancelledDrag = false;

  private escapeListener: ((event: KeyboardEvent) => void) | null = null;

  private pointerListener: ((event: PointerEvent) => void) | null = null;

  /** The card currently being dragged, or null. Read by every card and by both columns. */
  readonly active = this.current.asReadonly();

  /**
   * A card has been picked up. Starts listening for the pointer and for Escape, and stops on
   * {@link end} or {@link cancel} — nothing is listening between drags.
   *
   * The pointer is tracked here rather than through CDK's `cdkDragMoved` output on the card. An output
   * binding marks its view dirty, so binding one would have scheduled a change-detection pass for
   * every pointer move of every drag, for a value only the auto-scroll loop reads.
   */
  begin(card: DragCard): void {
    this.cancelledDrag = false;
    this.current.set(card);
    this.document.body.classList.remove(CANCELLED_CLASS);

    this.escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancel();
      }
    };

    this.pointerListener = (event: PointerEvent) => {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
    };

    this.document.addEventListener('keydown', this.escapeListener);
    this.document.addEventListener('pointermove', this.pointerListener, { passive: true });
  }

  pointer(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  /**
   * Escape cancels the drag in flight (requirement 1.8).
   *
   * CDK has no Escape handling of its own, and there is no supported way to end its pointer sequence
   * early, so the cancel is expressed as: drop the active drag so every highlight and wash goes,
   * hide the preview, and remember that the drop which arrives on pointer-up must be ignored.
   */
  cancel(): void {
    if (!this.current()) {
      return;
    }

    this.cancelledDrag = true;
    this.current.set(null);
    this.document.body.classList.add(CANCELLED_CLASS);
    this.stopListening();
  }

  /** The drag finished, whether or not anything came of it. */
  end(): void {
    this.current.set(null);
    this.document.body.classList.remove(CANCELLED_CLASS);
    this.stopListening();
  }

  /** Whether the drag that has just ended was cancelled with Escape, so its drop must do nothing. */
  cancelled(): boolean {
    return this.cancelledDrag;
  }

  /** Whether this record is the one currently in flight — the stay-behind copy keys off it. */
  isSource(side: MatchSide, id: number): boolean {
    const source = this.current();

    if (source === null || source.side !== side) {
      return false;
    }

    return source.side === 'demand' ? source.space.id === id : source.availability.id === id;
  }

  /** A drag is in flight and it did not start in this column, so this column may receive it. */
  isTargetSide(side: MatchSide): boolean {
    const source = this.current();

    return source !== null && source.side !== side;
  }

  /**
   * How a card on `side`, holding `unmatched` head, should look to the drag in flight.
   *
   * The `< 1` comparisons are comparisons against a figure the server computed, in the same shape as
   * the supply column's `unmatched > 0` filter. Nothing here works out a quantity: the drop still
   * asks the server for the default, the ceiling and the refusal.
   */
  dropState(side: MatchSide, unmatched: number): DropState {
    const source = this.current();

    if (source === null) {
      return 'none';
    }

    if (source.side === side) {
      return 'same';
    }

    return dragUnmatched(source) < 1 || unmatched < 1 ? 'blocked' : 'valid';
  }

  private stopListening(): void {
    if (this.escapeListener) {
      this.document.removeEventListener('keydown', this.escapeListener);
      this.escapeListener = null;
    }

    if (this.pointerListener) {
      this.document.removeEventListener('pointermove', this.pointerListener);
      this.pointerListener = null;
    }
  }
}

/**
 * Put on `<body>` while a cancelled drag runs out its pointer sequence, so the preview disappears the
 * moment Escape is pressed rather than at pointer-up. The rule itself is in `styles.scss`, because
 * CDK appends the preview to the body where no component's styles can reach it.
 */
const CANCELLED_CLASS = 'apg-drag-cancelled';
