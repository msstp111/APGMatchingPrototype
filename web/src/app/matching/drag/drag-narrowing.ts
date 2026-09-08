import { DOCUMENT } from '@angular/common';
import { CDK_DRAG_CONFIG } from '@angular/cdk/drag-drop';
import { ApplicationRef, Injectable, computed, inject, signal } from '@angular/core';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { MatchingPreferences } from '../filters/matching-preferences';
import { DragCard, dragStockClass } from './drag-state';
import { compatibleWith } from './stock-class-affinity';

/**
 * "Filter on drag": while a card is in the operator's hand, the **other** column shows only the
 * records whose stock class could take it.
 *
 * Grab a Lamb availability record and the demand column drops to the lamb spaces — ANZCO's, Alliance
 * Group's, SFF's — and the cattle and mutton slots go until the card is released. It works the same
 * way in the other direction, and it is switched from the top bar next to "Reset demo data", because
 * one switch governs both columns.
 *
 * Three things about it are deliberate and easy to undo by accident:
 *
 * - **It hides, and never refuses.** No drop is blocked on stock class. The two vocabularies do not
 *   map onto one another and the operator is the one who judges compatibility, so a class pairing the
 *   table has not thought of is one click (the toggle) away, not a dead end. The pairings themselves
 *   are the domain's — see `stock-class-affinity.ts`, which does nothing but intersect two lists of
 *   server-supplied tags.
 * - **It narrows on the pointer move that starts the drag** — not on the press, and not on CDK's
 *   `cdkDragStarted`. See {@link grab} and {@link onMove}; the timing is the delicate part of the
 *   whole feature.
 * - **It is off by default** (`DEFAULT_FILTER_ON_DRAG`), because a screen that reorganises itself the
 *   first time anyone picks up a card is a screen a new operator cannot tell from a broken one.
 */
@Injectable({ providedIn: 'root' })
export class DragNarrowing {
  private readonly appRef = inject(ApplicationRef);
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(MatchingPreferences);

  /** The card being dragged, or null. Set when the drag threshold is crossed, not when it is pressed. */
  private readonly grabbedCard = signal<DragCard | null>(null);

  /**
   * A grip is held but the pointer has not moved far enough to be a drag yet.
   *
   * Not a signal: nothing renders from it, and it changes on a pointer event. It is the *press*, and
   * a press is not yet news.
   */
  private pending: { readonly card: DragCard; readonly x: number; readonly y: number } | null = null;

  /**
   * The distance that makes a press a drag — **CDK's own threshold**, read from its config so the two
   * cannot come to disagree, and applied with CDK's own formula (`|dx| + |dy|`, not the hypotenuse).
   *
   * Matching it exactly is what lets this narrow on the very pointer move that starts the drag rather
   * than a moment before or after it. If it ever drifted, the safe direction is *lower*: narrowing
   * early costs a repaint, narrowing late costs the drop (see {@link onMove}).
   */
  private readonly threshold = inject(CDK_DRAG_CONFIG, { optional: true })?.dragStartThreshold ?? 5;

  private moveListener: ((event: PointerEvent) => void) | null = null;

  private releaseListener: (() => void) | null = null;

  private escapeListener: ((event: KeyboardEvent) => void) | null = null;

  /** The switch itself, straight off the persisted preferences. Read by the top bar. */
  readonly enabled = this.preferences.filterOnDrag;

  /**
   * The card the far column is currently being narrowed by, or null.
   *
   * Everything below reads this rather than {@link grabbedCard}, so switching the aid off mid-session
   * cannot leave a stale narrowing in force anywhere.
   */
  private readonly narrowedBy = computed(() =>
    this.preferences.filterOnDrag() ? this.grabbedCard() : null,
  );

  /**
   * A grip has been pressed. **Nothing is narrowed yet** — this only starts watching the pointer.
   *
   * A click on the grip is not a drag, and until 2026-09-09 this method narrowed the far column on the
   * press itself: every stray click on a grip emptied half the other side and filled it again a
   * moment later. The press is now only an intent to watch, and {@link onMove} decides.
   */
  grab(card: DragCard, from: MouseEvent): void {
    // Nothing changes on screen when the aid is off, so nothing is watched, measured or ticked.
    if (!this.preferences.filterOnDrag()) {
      return;
    }

    this.pending = { card, x: from.clientX, y: from.clientY };
    this.listen();
  }

  /**
   * The pointer has moved. Once it has moved far enough to be a drag, the far column narrows — and it
   * has to happen **on this event, ahead of CDK's own handler for it**.
   *
   * That is the delicate part of the feature, and it is not a matter of taste. Every card is its own
   * `cdkDropList`, and CDK measures every one of them once, inside the handler that crosses the drag
   * threshold. A column narrowed after that leaves every surviving card somewhere CDK does not believe
   * it is: the pointer enters nothing, no row lights up, and the drop lands nowhere.
   *
   * Two things put this handler in front of CDK's, and either would do on its own:
   *
   * - **`pointermove` precedes `mousemove`** for the same physical movement, and CDK listens for
   *   `mousemove` (its `touchmove` equivalent is likewise later than `pointermove`);
   * - this listener is registered during the grip's own `pointerdown`, whereas CDK registers its
   *   global listeners from a `mousedown` handler on the card **root** — an ancestor, so it runs after
   *   the grip in the same dispatch.
   *
   * The {@link ApplicationRef.tick} is what makes the DOM settle inside this handler rather than at
   * the end of the task: the app is zoneless, so a signal write alone would repaint a microtask too
   * late, which is to say after CDK had measured. It costs one synchronous refresh per drag, and only
   * while the aid is on.
   */
  private readonly onMove = (event: PointerEvent): void => {
    const pending = this.pending;

    if (pending === null) {
      return;
    }

    const travelled =
      Math.abs(event.clientX - pending.x) + Math.abs(event.clientY - pending.y);

    if (travelled < this.threshold) {
      return;
    }

    // The press has become a drag. Stop watching the pointer — the release listeners stay — and
    // narrow before CDK's handler for this same event measures anything.
    this.pending = null;
    this.stopTracking();
    this.grabbedCard.set(pending.card);
    this.appRef.tick();
  };

  /**
   * The pointer is up, the drag is over, or Escape was pressed: the far column comes back.
   *
   * Deliberately **not** ticked. CDK's drop lands in the same task as this, and it reads the pair off
   * its own refs rather than off the DOM, so letting Angular restore the column on its next ordinary
   * pass keeps the two out of each other's way — and it means a released drag repaints once, not
   * twice.
   */
  release(): void {
    if (this.pending === null && this.grabbedCard() === null) {
      return;
    }

    // Both halves, because a press that never became a drag still has a listener to take down and
    // nothing on screen to restore. That is the ordinary case now: it is what a click on the grip is.
    this.pending = null;
    this.grabbedCard.set(null);
    this.stopListening();
  }

  /** Whether this side is the one currently being narrowed — the far side of the grab. */
  narrows(side: MatchSide): boolean {
    const card = this.narrowedBy();

    return card !== null && card.side !== side;
  }

  /**
   * The stock class the far column is narrowed by, for the chip in its header and the state it draws
   * when nothing at all is compatible. Null when nothing is being narrowed.
   */
  narrowedTo(side: MatchSide): string | null {
    const card = this.narrowedBy();

    return card !== null && card.side !== side ? dragStockClass(card) : null;
  }

  /** The demand column's records, narrowed if a supply card is in hand. */
  spaces(records: readonly ProcessorSpaceDto[]): readonly ProcessorSpaceDto[] {
    const card = this.narrowedBy();

    return card === null || card.side === 'demand' ? records : compatibleWith(records, card);
  }

  /** The supply column's records, narrowed if a demand card is in hand. */
  availability(
    records: readonly LivestockAvailabilityDto[],
  ): readonly LivestockAvailabilityDto[] {
    const card = this.narrowedBy();

    return card === null || card.side === 'supply' ? records : compatibleWith(records, card);
  }

  /**
   * Three listeners for one gesture: the pointer's travel, its release, and Escape.
   *
   * One `pointerup` restores the column whether a drag happened or not.
   *
   * A grip click that never moves far enough to start a drag still went down and still came up, and
   * CDK emits nothing at all for it — so the release cannot hang off `cdkDragEnded`, or a stray click
   * on the grip would leave the far column narrowed with no drag in flight to explain it.
   *
   * Escape is handled too, though the pointer is still down when it arrives: `DragStore.cancel` takes
   * the preview and every highlight away at that instant, and a column that stayed narrowed until the
   * button came up would be the one part of the screen still acting on a cancelled gesture.
   */
  private listen(): void {
    if (this.releaseListener) {
      return;
    }

    this.moveListener = this.onMove;
    this.releaseListener = () => this.release();
    this.escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.release();
      }
    };

    this.document.addEventListener('pointermove', this.moveListener);
    this.document.addEventListener('pointerup', this.releaseListener);
    this.document.addEventListener('pointercancel', this.releaseListener);
    this.document.addEventListener('keydown', this.escapeListener);
  }

  /** The pointer no longer needs watching — either it has travelled far enough, or the gesture is over. */
  private stopTracking(): void {
    if (this.moveListener) {
      this.document.removeEventListener('pointermove', this.moveListener);
      this.moveListener = null;
    }
  }

  private stopListening(): void {
    this.stopTracking();

    if (this.releaseListener) {
      this.document.removeEventListener('pointerup', this.releaseListener);
      this.document.removeEventListener('pointercancel', this.releaseListener);
      this.releaseListener = null;
    }

    if (this.escapeListener) {
      this.document.removeEventListener('keydown', this.escapeListener);
      this.escapeListener = null;
    }
  }
}
