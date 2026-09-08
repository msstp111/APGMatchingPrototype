import { DOCUMENT } from '@angular/common';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardPress, DRAG_SLOP } from './card-press';

/**
 * The gesture recogniser on its own, away from a card.
 *
 * It is worth testing here as well as through `card-grip.spec.ts` because the two ask different
 * questions. That spec asks what a card does; this one pins the boundary itself — where a press stops
 * being a click — and the cases either side of it that a card-level test would have to construct a
 * whole row to reach. The number under test is CDK's own threshold, so it is read from the export
 * rather than written out: if `DRAG_SLOP` moves, these move with it.
 */
@Component({
  selector: 'app-card-press-host',
  imports: [CardPress],
  template: `
    <div
      class="region"
      [cardPress]="draggable()"
      (pressStarted)="presses.push($event)"
      (clicked)="clicks = clicks + 1"
    >
      <span class="plain">line 1</span>
      <button type="button" class="nested">2 matches</button>
    </div>
  `,
})
class Host {
  readonly draggable = signal(true);
  readonly presses: PointerEvent[] = [];
  clicks = 0;
}

describe('CardPress — where a press stops being a click', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: DOCUMENT, useValue: document }],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function target(selector = '.region'): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector)!;
  }

  /**
   * `MouseEvent` under a pointer-event name: jsdom has no `PointerEvent` constructor, and this is the
   * idiom the rest of the matching specs already use. Only `button`, `clientX` and `clientY` are read.
   */
  function down(on: HTMLElement, button = 0): void {
    on.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 200, clientY: 200, button, bubbles: true }),
    );
  }

  function up(dx = 0, dy = 0): void {
    document.dispatchEvent(
      new MouseEvent('pointerup', { clientX: 200 + dx, clientY: 200 + dy, bubbles: true }),
    );
  }

  it('reports a press that never moves as a click', () => {
    down(target());
    up();

    expect(host.clicks).toBe(1);
  });

  it('hands the press event on, so the far column can be narrowed from it', () => {
    down(target());

    // The press is reported at once and carries its event: `DragNarrowing` needs the origin to
    // measure travel from, and it must be watching before CDK's own listeners are registered.
    expect(host.presses).toHaveLength(1);
    expect(host.presses[0].clientX).toBe(200);
  });

  it('still reports a click one pixel inside the threshold', () => {
    down(target());
    up(DRAG_SLOP - 1);

    expect(host.clicks).toBe(1);
  });

  /** Manhattan, not the hypotenuse — the two axes add, because that is what `DragRef` compares. */
  it('adds the two axes the way CDK does', () => {
    down(target());
    up(DRAG_SLOP - 2, 2);

    expect(host.clicks).toBe(0);
  });

  it('reports no click once the press reaches the threshold', () => {
    down(target());
    up(DRAG_SLOP);

    expect(host.clicks).toBe(0);
  });

  /**
   * With the region undraggable there is no drag to confuse a press with, so distance stops meaning
   * anything — which is what the plain `(click)` binding this replaced did, and what the row must go
   * back to when the toggle is off.
   */
  it('reports a click at any distance when the region cannot drag', async () => {
    host.draggable.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    down(target());
    up(500);

    expect(host.clicks).toBe(1);
  });

  it('ignores a press on a nested control, which has a click of its own', () => {
    down(target('.nested'));
    up();

    expect(host.presses).toHaveLength(0);
    expect(host.clicks).toBe(0);
  });

  it('claims a press on ordinary content inside the region', () => {
    down(target('.plain'));
    up();

    expect(host.clicks).toBe(1);
  });

  it('ignores anything but the primary button', () => {
    down(target(), 2);
    up();

    expect(host.presses).toHaveLength(0);
    expect(host.clicks).toBe(0);
  });

  it('reports nothing when the pointer is cancelled out from under it', () => {
    down(target());
    document.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
    up();

    expect(host.clicks).toBe(0);
  });

  it('does not leave a release listener behind between presses', () => {
    down(target());
    up();

    // A second release with no press before it must land on nothing. Without the teardown the
    // document would still be wired to a directive that thinks it is mid-gesture.
    up();

    expect(host.clicks).toBe(1);
  });

  it('stops listening when the host goes away mid-press', () => {
    down(target());
    fixture.destroy();
    up();

    expect(host.clicks).toBe(0);
  });
});
