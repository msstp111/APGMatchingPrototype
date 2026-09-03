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
 * - `none` — no drag is happening, **or the pointer has not yet crossed into the opposite column**.
 *   Phase 9's progressive disclosure (lab idea 4) lives here rather than in a class on every card: a
 *   drag with no target yet has nothing to say, and saying it on forty rows at once was the whole of
 *   what Phase 5 got wrong.
 * - `same` — the drag came from this column. Nothing changes except `cursor: no-drop`. Dropping
 *   within a column is a no-op (requirement 1.3); an outline or a message for a gesture that simply
 *   does not apply teaches an operator to fear the screen.
 * - `valid` — the pair has quantity to match.
 * - `blocked` — the gesture *would* apply, but one of the two records is full. Distinct from `same`
 *   for exactly that reason.
 */
export type DropState = 'none' | 'same' | 'valid' | 'blocked';

/** Which card the pointer is over, by side and id. Nothing else identifies a card on this screen. */
export interface HotCard {
  readonly side: MatchSide;
  readonly id: number;
}

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

  /**
   * The card the pointer is actually over (lab idea 1) — the state Phase 5 never had.
   *
   * It carries the whole `DragCard` rather than an id because the hover proposal needs both records
   * to ask the server what the pair would become, and the card under the pointer is the only place
   * the second one is known.
   */
  private readonly hotCard = signal<DragCard | null>(null);

  /**
   * The pointer has crossed into the opposite column at least once during this drag, and **stays**
   * true for the rest of it (lab idea 4).
   *
   * Once armed it never disarms: a pointer that wanders back over the source column mid-drag has not
   * un-learned where it is going, and flickering the whole target side off and on again as it drifts
   * across the gutter would be worse than either state.
   */
  private readonly isArmed = signal(false);

  /** Live, unlike {@link isArmed}: the pointer is inside the opposite column *right now*. */
  private readonly overTarget = signal(false);

  /**
   * Each column's host element, registered on init and never removed — the two columns outlive every
   * drag, and the flip is CSS `order`, so neither is ever destroyed.
   */
  private readonly columns = new Map<MatchSide, HTMLElement>();

  /**
   * The opposite column's rectangle, measured once at pickup.
   *
   * Once per drag rather than once per frame on purpose: a column does not move while a card is in
   * flight, and `getBoundingClientRect` in a pointermove handler is a forced layout on every frame of
   * every drag. The list scrolls inside it, which changes nothing about where its edges are.
   */
  private targetRect: DOMRect | null = null;

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

  /** The card under the pointer, or null. Read by the cards and by the hover proposal. */
  readonly hot = this.hotCard.asReadonly();

  /** @see isArmed — the gutter has been crossed, so the target side may speak. */
  readonly armed = this.isArmed.asReadonly();

  /**
   * A column registers itself so the store can tell which side the pointer is on.
   *
   * The alternative is `elementFromPoint` on every move, which the standalone lab used because it had
   * no components to ask. Here the two columns are known, permanent and exactly two.
   */
  registerColumn(side: MatchSide, element: HTMLElement): void {
    this.columns.set(side, element);
  }

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
    this.hotCard.set(null);
    this.isArmed.set(false);
    this.overTarget.set(false);
    this.targetRect = this.measureTargetColumn(card.side);
    // Fail open. If no column has registered — a test harness, or a render order nobody has hit yet —
    // there is no gutter to cross, and a drag that can never arm is a drag where nothing lights up at
    // all. Degrading to Phase 5's "armed from pickup" is far better than a dead screen.
    this.isArmed.set(this.targetRect === null);
    this.document.body.classList.remove(CANCELLED_CLASS);

    this.escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancel();
      }
    };

    this.pointerListener = (event: PointerEvent) => {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.trackColumn();
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
    this.clearDragState();
    this.document.body.classList.add(CANCELLED_CLASS);
    this.stopListening();
  }

  /** The drag finished, whether or not anything came of it. */
  end(): void {
    this.current.set(null);
    this.clearDragState();
    this.document.body.classList.remove(CANCELLED_CLASS);
    this.stopListening();
  }

  /**
   * The pointer entered this card, from CDK's own `cdkDropListEntered`.
   *
   * CDK is the right source for this and the cards are already the drop lists, so there is no
   * hit-testing to write: the enter predicate has already refused everything in the source column, so
   * anything that enters is a real target.
   */
  enter(card: DragCard): void {
    if (this.current() === null) {
      return;
    }

    this.hotCard.set(card);
  }

  /**
   * The pointer left this card.
   *
   * Guarded on it still being the hot one because CDK emits `entered` on the new list before
   * `exited` on the old when a pointer crosses straight from one card to the next; clearing
   * unconditionally would blank the card the pointer had just arrived at.
   */
  leave(side: MatchSide, id: number): void {
    if (this.isHot(side, id)) {
      this.hotCard.set(null);
    }
  }

  /** Whether this card is the one under the pointer (lab idea 1). */
  isHot(side: MatchSide, id: number): boolean {
    const hot = this.hotCard();

    if (hot === null || hot.side !== side) {
      return false;
    }

    return hot.side === 'demand' ? hot.space.id === id : hot.availability.id === id;
  }

  /**
   * Whether this card recedes so the two ends of the gesture are the only lit rows.
   *
   * One method for what the lab kept as two ideas, because they are one device pointed at both ends:
   *
   * - **the target column** (idea 3) dims every card except the hot one, but only while the pointer is
   *   actually in the column — leave it and the column comes back, because the operator is no longer
   *   choosing and the backlog is what they are reading instead;
   * - **the source column** (idea 12c) dims every card except the one that was picked up, from the
   *   moment it is picked up, which is what marks the origin without adding any ink to it.
   *
   * The source half deliberately does not wait for {@link armed}. It is the one thing on the screen
   * that changes before the gutter is crossed, and it earns the exception by answering a question the
   * operator has at pickup rather than at the drop: *which row did this come from*.
   */
  isDimmed(side: MatchSide, id: number): boolean {
    const source = this.current();

    if (source === null) {
      return false;
    }

    if (source.side === side) {
      return !this.isSource(side, id);
    }

    return this.isArmed() && this.overTarget() && !this.isHot(side, id);
  }

  /**
   * The same scrim over a column's week-band headers, which are chrome rather than candidates.
   *
   * They dim with the cards around them: a lit band header over a column of receded cards reads as
   * the header being the thing selected.
   */
  isColumnDimmed(side: MatchSide): boolean {
    const source = this.current();

    if (source === null) {
      return false;
    }

    return source.side === side || (this.isArmed() && this.overTarget());
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

    // Progressive disclosure: before the gutter is crossed the drag has no target in mind, so no card
    // claims to be one. Every treatment keyed on this state withholds itself for free.
    if (source === null || !this.isArmed()) {
      return 'none';
    }

    if (source.side === side) {
      return 'same';
    }

    return dragUnmatched(source) < 1 || unmatched < 1 ? 'blocked' : 'valid';
  }

  /**
   * Which side of the gutter the pointer is on, and whether it has ever been on the far side.
   *
   * Both are signals and both are written only when the answer changes — this runs on every pointer
   * move, and a signal written per frame schedules change detection per frame. The pointer position
   * itself stays a plain field for exactly that reason.
   */
  private trackColumn(): void {
    const rect = this.targetRect;

    if (rect === null) {
      return;
    }

    const inside =
      this.pointerX >= rect.left &&
      this.pointerX <= rect.right &&
      this.pointerY >= rect.top &&
      this.pointerY <= rect.bottom;

    if (inside !== this.overTarget()) {
      this.overTarget.set(inside);
    }

    if (inside && !this.isArmed()) {
      this.isArmed.set(true);
    }
  }

  private measureTargetColumn(sourceSide: MatchSide): DOMRect | null {
    const target = this.columns.get(sourceSide === 'demand' ? 'supply' : 'demand');

    return target ? target.getBoundingClientRect() : null;
  }

  private clearDragState(): void {
    this.hotCard.set(null);
    this.isArmed.set(false);
    this.overTarget.set(false);
    this.targetRect = null;
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
