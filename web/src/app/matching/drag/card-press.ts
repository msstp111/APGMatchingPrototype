import { CDK_DRAG_CONFIG } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, Provider, inject, input, output } from '@angular/core';

/**
 * How far the pointer must travel before a press becomes a drag — **the one number that separates a
 * click from a drag on a card's middle region** (design-system.md 10, 16.13).
 *
 * CDK's own default is 5. Eight is deliberately more generous, because that region now carries both
 * gestures and the commoner of the two is the click: a trackpad click that skids four pixels must
 * still expand the card, or the screen behaves exactly the way the 2026-09-07 separation was meant to
 * cure. It applies to the grip as well — one `DragRef` per card, one threshold — where three extra
 * pixels are imperceptible.
 *
 * It is Manhattan distance (`|dx| + |dy|`), not the hypotenuse, because that is what `DragRef`
 * measures against it.
 */
export const DRAG_SLOP = 8;

/**
 * {@link DRAG_SLOP}, in the form CDK reads it.
 *
 * Registered in `app.config.ts`, at the **root**, and that placement is load-bearing rather than
 * lazy: `DragNarrowing` is a root-provided service and reads `dragStartThreshold` off this same token
 * to decide when a press has become a drag. Provided any lower down — on the two card components, say
 * — CDK would see eight while the narrowing still saw its own fallback of five, which is precisely
 * the disagreement that file says must not arise.
 */
export const CARD_DRAG_CONFIG: Provider = {
  provide: CDK_DRAG_CONFIG,
  useValue: { dragStartThreshold: DRAG_SLOP },
};

/**
 * Click-or-drag on a card's middle region (2026-09-09).
 *
 * The row has three pointer regions. The grip drags and only drags; the chevron clicks and only
 * clicks; and the ~478px between them does both, whenever "Drag anywhere" is on. Two or three power
 * users run this screen and will learn it once, so making them travel to one end of a row for a drag
 * and the other for a click is a tax they need not pay — but the two ends stay unambiguous, so there
 * is always somewhere to go when a gesture is not being read the way it was meant.
 *
 * **The hazard this exists to remove is the one that took whole-body dragging off the card.** Until
 * 2026-09-07 `.cbody` was the drag handle, and a click that drifted a pixel lifted the card instead
 * of opening it. So the rule has no dead zone and no timer:
 *
 * - a press that never crosses {@link DRAG_SLOP} is a **click**, however long it is held;
 * - a press that crosses it is a **drag**, and never also a click.
 *
 * Note what this directive does *not* do. It does not start the drag — the `cdkDragHandle` beside it
 * does. It does not narrow the far column — `DragNarrowing` watches the pointer for that, from the
 * press this reports, and it does so for the grip and the body through one code path. And it does not
 * decide whether the release was a drag: the card asks CDK, through the `(cdkDragStarted)` binding it
 * already had. Re-deriving that answer here would put a second implementation of CDK's own rule in
 * this file, and the two would disagree the first time page and client coordinates parted company.
 *
 * Two costs are accepted rather than worked around, both consequences of `.cbody` becoming a
 * `cdkDragHandle`: CDK stamps `touch-action: none` and `user-select: none` on every handle, so while
 * the toggle is on, touch and pen cannot scroll a column by dragging a card body and the card's text
 * is not selectable. A mouse is assumed available at all times (resolved question 14); the wheel, the
 * trackpad and the scrollbar are unaffected; the grip has carried the same restriction since
 * 2026-09-07 without anyone noticing; and the toggle is the way back.
 */
@Directive({
  selector: '[cardPress]',
  host: { '(pointerdown)': 'down($event)' },
})
export class CardPress implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  /**
   * Whether a drag can begin in this region — "Drag anywhere", straight off the stored preferences.
   *
   * The directive is told rather than reading the preference itself, so one recogniser serves both
   * states and exactly one place — the card — knows which is in force.
   */
  readonly cardPress = input(false);

  /**
   * A press has begun here, carrying the event that began it.
   *
   * The card does two things with it: resets its per-press "did CDK start a drag" flag, which is only
   * correct at this moment (`cdkDragEnded` arrives *before* the pointer comes up, so a flag cleared
   * there would already be gone by the time the release is judged), and hands the event to
   * `DragNarrowing` exactly as the grip does.
   */
  readonly pressStarted = output<PointerEvent>();

  /**
   * The press ended as a click. The card decides what that means.
   *
   * What counts as one depends on {@link cardPress}, and that is the honest reading rather than a
   * convenience: with the region draggable, a release past {@link DRAG_SLOP} belongs to the drag and
   * cannot also be a click; with it not draggable there is no drag to confuse it with, so a press
   * that wanders is still a press — exactly as the plain `(click)` binding this replaced behaved.
   */
  readonly clicked = output<void>();

  private origin: { x: number; y: number } | null = null;

  private endListener: ((event: PointerEvent) => void) | null = null;

  private cancelListener: (() => void) | null = null;

  ngOnDestroy(): void {
    this.stopListening();
  }

  /**
   * The press starts, unless it is one this region has no business claiming.
   *
   * Nested controls are excluded here rather than by a `stopPropagation` on each of them, so a button
   * added to line 2 later cannot quietly acquire a second toggle. CDK is a separate matter — it binds
   * `mousedown` on the card root and will still arm a drag from anything inside the handle — which is
   * why `button.mcount` stops `mousedown` itself.
   */
  down(event: PointerEvent): void {
    if (event.button !== 0 || this.isNestedControl(event.target)) {
      return;
    }

    this.origin = { x: event.clientX, y: event.clientY };
    this.listen();
    this.pressStarted.emit(event);
  }

  /**
   * The release is watched on the document, not on the host, so a press that ends elsewhere still
   * resolves — which is what every successful drag does, and what a press that slides off the row
   * does too.
   */
  private listen(): void {
    if (this.endListener) {
      return;
    }

    this.endListener = (event: PointerEvent) => this.up(event);
    this.cancelListener = () => this.reset();

    this.document.addEventListener('pointerup', this.endListener);
    this.document.addEventListener('pointercancel', this.cancelListener);
  }

  private up(event: PointerEvent): void {
    const origin = this.origin;

    this.reset();

    if (origin === null) {
      return;
    }

    // A release past the drag threshold is CDK's to interpret, not ours: the card is in flight, and
    // whatever it came down on is a drop. Only a press that stayed put can be a click — and only
    // while there is a drag it might otherwise have been.
    if (!this.cardPress() || distance(origin, event) < DRAG_SLOP) {
      this.clicked.emit();
    }
  }

  private reset(): void {
    this.origin = null;
    this.stopListening();
  }

  private stopListening(): void {
    if (this.endListener) {
      this.document.removeEventListener('pointerup', this.endListener);
      this.endListener = null;
    }

    if (this.cancelListener) {
      this.document.removeEventListener('pointercancel', this.cancelListener);
      this.cancelListener = null;
    }
  }

  /** Whether the press landed on something inside the region that has a click of its own. */
  private isNestedControl(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    const control = target.closest('button, a, input, select, textarea');

    return control !== null && this.host.nativeElement.contains(control);
  }
}

/**
 * Manhattan distance, because that is what `DragRef` measures against its own threshold.
 *
 * Pointer coordinates, not quantities: `no-domain-arithmetic.spec.ts` keys its patterns to the DTO's
 * quantity field names, and this file names none of them.
 */
function distance(origin: { x: number; y: number }, event: PointerEvent): number {
  return Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
}
