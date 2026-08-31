import { Directive, ElementRef, effect, inject } from '@angular/core';
import { DragStore } from './drag-state';

/**
 * The band at the top and bottom of a column's list where a drag starts scrolling it
 * (design-system.md 10).
 *
 * **This is one number in two places**: `$auto-scroll-zone` in `_card-geometry.scss` draws the veil
 * that marks the zone, and this drives the scrolling inside it. If they disagree, the column scrolls
 * somewhere other than where it says it will.
 */
export const AUTO_SCROLL_ZONE = 48;

/** Pixels per frame at the very edge of the zone. Ramps up from 2 at its inner boundary. */
export const AUTO_SCROLL_MAX_STEP = 16;

interface Bounds {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/**
 * How far, and which way, to scroll a list whose bounds are `rect` given a pointer at `pointer`.
 *
 * Negative scrolls up, positive down, zero not at all. Pure, and exported, because it is the whole
 * behaviour of the directive below and jsdom has no layout engine to test it through: a directive
 * that asked a real element for its rectangle would be untestable, so the element only supplies the
 * numbers.
 *
 * The pointer must be within the column horizontally, so a drag hovering over one column's edge never
 * scrolls the other. It may overshoot the list vertically by one zone — dragging past the last card
 * keeps scrolling — but not further, so holding the card over the column header does nothing.
 */
export function scrollStep(
  rect: Bounds,
  pointer: { x: number; y: number },
  zone = AUTO_SCROLL_ZONE,
  maxStep = AUTO_SCROLL_MAX_STEP,
): number {
  if (pointer.x < rect.left || pointer.x > rect.right) {
    return 0;
  }

  if (pointer.y < rect.top - zone || pointer.y > rect.bottom + zone) {
    return 0;
  }

  if (pointer.y < rect.top + zone) {
    return -ramp(rect.top + zone - pointer.y, zone, maxStep);
  }

  if (pointer.y > rect.bottom - zone) {
    return ramp(pointer.y - (rect.bottom - zone), zone, maxStep);
  }

  return 0;
}

/**
 * Scrolls this element while a drag hovers near its top or bottom edge.
 *
 * **CDK's own auto-scroll is disabled on the card drop lists and replaced by this**, which is a
 * decision worth stating because it looks like reinventing a wheel. `DragRef` scrolls the scrollable
 * parents of the drop container the pointer is currently over, and when the pointer is over no
 * container at all it falls back to the container the drag *started* in — so hovering over a band
 * header, an empty band or the gap between two cards in the target column would have scrolled the
 * source column instead. Requirement 1.6 asks for the target column, and design-system.md 10 asks
 * that it scroll *through* band headers, which is precisely the case CDK cannot cover here.
 *
 * The pointer comes from the drag store rather than from a DOM listener of our own, so there is one
 * source of pointer truth per drag and it is the one CDK is already reporting.
 */
@Directive({
  selector: '[columnAutoScroll]',
})
export class ColumnAutoScroll {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly drag = inject(DragStore);

  private frame = 0;

  constructor() {
    effect((onCleanup) => {
      if (this.drag.active()) {
        this.startScrolling();
        onCleanup(() => this.stopScrolling());
      }
    });
  }

  private startScrolling(): void {
    const element = this.host.nativeElement;

    const tick = () => {
      const step = scrollStep(element.getBoundingClientRect(), this.drag.pointer());

      if (step !== 0) {
        element.scrollTop += step;
      }

      this.frame = requestAnimationFrame(tick);
    };

    this.stopScrolling();
    this.frame = requestAnimationFrame(tick);
  }

  private stopScrolling(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
}

/**
 * 2px per frame at the inner boundary of the zone, `maxStep` at its outer edge and beyond.
 *
 * A flat rate cannot serve both jobs: CDK's own 2px per frame is fine for nudging a list by a card
 * but would take twenty seconds to cross a six-week column, and a flat fast rate makes precise
 * targeting near the edge impossible. Depth into the zone is the operator's throttle.
 */
function ramp(depth: number, zone: number, maxStep: number): number {
  const proportion = Math.min(Math.max(depth, 0), zone) / zone;

  return 2 + (maxStep - 2) * proportion;
}
