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
 * The class the card is offering or asking for.
 *
 * Named apart from the two above because it is not a figure and not a title: it is what
 * "Filter on drag" narrows the far column *by*, and what that column names as its reason for being
 * short. The two vocabularies do not map onto one another, so this string is only ever displayed or
 * compared through the server's own tags — never parsed.
 */
export function dragStockClass(card: DragCard): string {
  return card.side === 'demand' ? card.space.stockClass : card.availability.stockClass;
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
   * un-learned where it is going, and flickering the far side off and on again as it drifts across
   * the gutter would be worse than either state.
   *
   * It is the *only* thing the pointer's column decides now. There was a live `overTarget` signal
   * beside it until 2026-09-09, read by nothing but the target-column scrim; deleting the scrim
   * (drag-lab-2 idea 1) left it with no readers, and a signal written on every pointer move that
   * nothing renders from is a change-detection pass per frame for nobody.
   */
  private readonly isArmed = signal(false);

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
    this.targetRect = this.measureTargetColumn(card.side);
    // Fail open. If no column has registered — a test harness, or a render order nobody has hit yet —
    // there is no gutter to cross, and a drag that can never arm is a drag where nothing lights up at
    // all. Degrading to Phase 5's "armed from pickup" is far better than a dead screen.
    this.isArmed.set(this.targetRect === null);
    this.document.body.classList.remove(CANCELLED_CLASS);
    this.document.body.classList.add(DRAGGING_CLASS);

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
    this.document.body.classList.remove(DRAGGING_CLASS);
    this.document.body.classList.add(CANCELLED_CLASS);
    this.stopListening();
  }

  /** The drag finished, whether or not anything came of it. */
  end(): void {
    this.current.set(null);
    this.clearDragState();
    this.document.body.classList.remove(DRAGGING_CLASS);
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
   * Whether this card recedes so the row the card came from is the only lit one near it.
   *
   * **The source column, and nothing else** (lab idea 12c): every card except the one that was picked
   * up, from the moment it is picked up. It marks the origin by subtraction — nothing is added to the
   * row the drag came from, everything around it is taken away — and it deliberately does not wait
   * for {@link armed}, because it answers a question the operator has at pickup rather than at the
   * drop: *which row did this come from*.
   *
   * **The target column is never dimmed** (2026-09-09, drag-lab-2 idea 1). Phase 9's other spotlight
   * scrimmed every card in the far column but the hot one, and it was the one device in the gesture
   * that removed information: the operator is choosing between those rows, and choosing means reading
   * their meters, their statuses and their dates against one another. The card under the pointer is
   * already the only card in the list carrying a 2px petrol outline and a $lms-drop-target fill, so
   * the scrim was a second answer to a question that was answered, paid for in thirty rows of
   * contrast and a repaint on every row the pointer crossed. `drag-lab-2.html` is where the ten
   * alternatives were drawn; this is the one that shipped, and it ships by deleting a clause.
   *
   * The refusal is untouched — a card with no unmatched quantity still recedes to 0.45 through
   * `.target.blocked`, which is a statement about that record and not about the other twenty-nine.
   */
  isDimmed(side: MatchSide, id: number): boolean {
    const source = this.current();

    if (source === null || source.side !== side) {
      return false;
    }

    return !this.isSource(side, id);
  }

  /**
   * The same scrim over a column's week-band headers, which are chrome rather than candidates.
   *
   * They dim with the cards around them: a lit band header over a column of receded cards reads as
   * the header being the thing selected. Which is now the source column only — see {@link isDimmed}.
   */
  isColumnDimmed(side: MatchSide): boolean {
    const source = this.current();

    return source !== null && source.side === side;
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
   * Whether the pointer has ever been on the far side of the gutter, which is the whole of what the
   * pointer's column decides.
   *
   * It runs on every pointer move and writes **once per drag**: the flag is one-way, so the first
   * crossing sets it and every later move returns on the guard without so much as measuring. A signal
   * written per frame would schedule change detection per frame, which is why the pointer position
   * itself stays a plain field.
   */
  private trackColumn(): void {
    const rect = this.targetRect;

    if (rect === null || this.isArmed()) {
      return;
    }

    const inside =
      this.pointerX >= rect.left &&
      this.pointerX <= rect.right &&
      this.pointerY >= rect.top &&
      this.pointerY <= rect.bottom;

    if (inside) {
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

/**
 * On `document.body` for as long as a card is in flight, so the cursor can say `grabbing` across the
 * whole screen rather than only over the element the gesture started on.
 *
 * It exists because the middle of a card shows `cursor: pointer` at rest — it is a click target first
 * — and a drag that began there would otherwise be the one gesture on this screen that never changes
 * the cursor at all. The rule itself is in `_card-geometry.scss`, beside the other cursors, and is
 * deliberately weak enough that `no-drop` and `not-allowed` still win over it.
 */
const DRAGGING_CLASS = 'apg-dragging';
