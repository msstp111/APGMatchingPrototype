import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchActions } from '../match/match-actions';
import { MatchingPreferences } from '../filters/matching-preferences';
import { RecordActions } from '../record/record-actions';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { AvailabilityCard } from './availability-card';
import { SpaceCard } from './space-card';

/**
 * The card's three pointer regions: the grip drags, the chevron clicks, and the middle does whichever
 * the gesture turns out to be.
 *
 * The separation is from 2026-09-07 — before it the whole 508px body was the `cdkDragHandle`, so a
 * hand cursor sat over a row whose commonest action is expanding it and expanding meant hitting the
 * 24px chevron in the far corner. "Drag anywhere" (2026-09-09) gives the middle its drag back without
 * giving up the click, and the whole risk of that is one thing: a press meant as a click being taken
 * for a drag. Most of what is asserted below is that boundary.
 *
 * Every case runs over both cards in one loop. Each is a handful of attributes on two templates, and
 * any of them can be dropped from one card and left on the other — exactly the drift
 * design-system.md 6.1 forbids and which nothing else here would notice.
 */
describe('The card’s grip and its clickable body', () => {
  async function configure(): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DOCUMENT, useValue: document },
        {
          provide: MatchActions,
          useValue: { open: () => undefined, confirmSpace: () => undefined },
        },
        {
          provide: RecordActions,
          useValue: { editSpace: () => undefined, editAvailability: () => undefined },
        },
        {
          provide: ApiClient,
          useValue: { transportCompanies: () => of([]) },
        },
      ],
    }).compileComponents();
  }

  async function mount(
    component: unknown,
    inputs: Record<string, unknown>,
  ): Promise<ComponentFixture<unknown>> {
    const fixture = TestBed.createComponent(component as never);

    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }

    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function element(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function isExpanded(fixture: ComponentFixture<unknown>): boolean {
    return element(fixture).querySelector('app-card-expansion') !== null;
  }

  /** The live card, never the stay-behind clone, which carries a grip for width alone. */
  function card(fixture: ComponentFixture<unknown>): HTMLElement {
    return element(fixture).querySelector<HTMLElement>('.card:not(.stay)')!;
  }

  function body(fixture: ComponentFixture<unknown>): HTMLElement {
    return card(fixture).querySelector<HTMLElement>('.cbody')!;
  }

  /**
   * The `CdkDragHandle` instance on a cell, so a test can ask whether it is *live* rather than merely
   * present.
   *
   * The distinction is the whole of what "Drag anywhere" switches. CDK stamps `cdk-drag-handle` on
   * every element carrying the directive whether or not it is disabled, so counting the class — which
   * is what this spec did until 2026-09-09 — cannot tell the two states apart, and would have passed
   * unchanged if the toggle did nothing at all.
   */
  function handleOn(fixture: ComponentFixture<unknown>, selector: string): CdkDragHandle | null {
    const found = fixture.debugElement
      .queryAll(By.directive(CdkDragHandle))
      .filter((it) => (it.nativeElement as HTMLElement).matches(selector))
      .filter((it) => !(it.nativeElement as HTMLElement).closest('.card.stay'));

    return found.length === 0 ? null : (found[0].injector.get(CdkDragHandle) as CdkDragHandle);
  }

  /** Turns "Drag anywhere" on, the way the top-bar toggle does. */
  async function enableDragAnywhere(fixture: ComponentFixture<unknown>): Promise<void> {
    TestBed.inject(MatchingPreferences).toggleDragAnywhere();
    await settle(fixture);
  }

  /**
   * A whole press: down here, up `travel` pixels away.
   *
   * `MouseEvent` under a pointer-event name is this repo's idiom for synthetic pointer input
   * (`card-drag-chrome.spec.ts` does the same); jsdom has no `PointerEvent` constructor, and the only
   * fields any of this reads are `button`, `clientX` and `clientY`. The release goes to the document
   * because that is where `CardPress` listens: a press that ends off the row still has to resolve.
   */
  async function press(
    fixture: ComponentFixture<unknown>,
    target: HTMLElement,
    travel = 0,
    between: () => void = () => undefined,
  ): Promise<void> {
    target.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }),
    );

    between();

    document.dispatchEvent(
      new MouseEvent('pointerup', { clientX: 100 + travel, clientY: 100, bubbles: true }),
    );

    await settle(fixture);
  }

  const mountDemand = (inputs: Record<string, unknown> = {}) =>
    mount(SpaceCard, { space: aSpace({ id: 7 }), ...inputs });

  const mountSupply = (inputs: Record<string, unknown> = {}) =>
    mount(AvailabilityCard, { record: anAvailability({ id: 11 }), ...inputs });

  beforeEach(async () => {
    localStorage.clear();
    await configure();
  });

  for (const side of [
    { name: 'demand', open: mountDemand },
    { name: 'supply', open: mountSupply },
  ]) {
    describe(`on the ${side.name} card`, () => {
      it('always drags from the grip, whatever the preference says', async () => {
        const fixture = await side.open();

        expect(handleOn(fixture, '.grip')?.disabled).toBe(false);

        await enableDragAnywhere(fixture);
        expect(handleOn(fixture, '.grip')?.disabled).toBe(false);
      });

      it('drags from the body only while “Drag anywhere” is on', async () => {
        const fixture = await side.open();

        // Present but inert. The class alone would say "handle" in both states.
        expect(handleOn(fixture, '.cbody')?.disabled).toBe(true);

        await enableDragAnywhere(fixture);
        expect(handleOn(fixture, '.cbody')?.disabled).toBe(false);
      });

      it('never drags from the chevron, which needs no attribute to stay out of it', async () => {
        const fixture = await side.open();
        await enableDragAnywhere(fixture);

        const chevron = card(fixture).querySelector<HTMLElement>('.chev')!;

        // A sibling of the body, not a descendant — and CDK arms only from a handle that *contains*
        // the event target. This is the assertion that would catch someone nesting it into `.cbody`.
        expect(handleOn(fixture, '.chev')).toBeNull();
        expect(chevron.closest('.cdk-drag-handle')).toBeNull();
      });

      it('expands and collapses on a press anywhere in the body', async () => {
        const fixture = await side.open();

        expect(isExpanded(fixture)).toBe(false);

        await press(fixture, body(fixture));
        expect(isExpanded(fixture)).toBe(true);

        // The expanded card's own body still collapses it — the drawer below is a sibling of the row,
        // so nothing about being open takes the press away.
        await press(fixture, body(fixture));
        expect(isExpanded(fixture)).toBe(false);
      });

      /**
       * The generosity the whole design turns on. Seven pixels is inside CDK's eight, so no drag ever
       * began and the press is still a click — which is the failure mode that took whole-body dragging
       * off the card in 2026-09-07: a click that drifted lifted the row instead of opening it.
       */
      it('still expands when the press wobbles, up to CDK’s own threshold', async () => {
        const fixture = await side.open();
        await enableDragAnywhere(fixture);

        await press(fixture, body(fixture), 7);

        expect(isExpanded(fixture)).toBe(true);
      });

      it('does not expand when the press became a drag', async () => {
        const fixture = await side.open();
        await enableDragAnywhere(fixture);

        // What `(cdkDragStarted)` does, at the point in the sequence CDK does it: after the press,
        // before the release. The card reads the flag on the way up.
        const started = () => (fixture.componentInstance as { dragStarted(): void }).dragStarted();

        await press(fixture, body(fixture), 40, started);

        expect(isExpanded(fixture)).toBe(false);
      });

      /**
       * With the toggle off there is no drag on this surface to be confused with, so a press that
       * wanders is still a press — which is what the plain `(click)` binding it replaced did.
       */
      it('expands however far the press wanders while “Drag anywhere” is off', async () => {
        const fixture = await side.open();

        await press(fixture, body(fixture), 40);

        expect(isExpanded(fixture)).toBe(true);
      });

      it('leaves the chevron working, since it is the focusable control', async () => {
        const fixture = await side.open();

        card(fixture).querySelector<HTMLElement>('.chev')!.click();
        await settle(fixture);

        expect(isExpanded(fixture)).toBe(true);
      });

      /**
       * The regression the separation invites. The match count sits INSIDE the body and toggles too,
       * so without its `stopPropagation` the body's handler runs second, toggles back, and the card
       * looks like it ignored the click entirely.
       */
      it('opens the card once when the match count itself is clicked', async () => {
        const record = side.name === 'demand' ? 'space' : 'record';
        const fixture = await side.open({
          [record]:
            side.name === 'demand'
              ? aSpace({ id: 7, matches: [aMatch({ id: 3 })] })
              : anAvailability({ id: 11, matches: [aMatch({ id: 3 })] }),
        });

        card(fixture).querySelector<HTMLElement>('button.mcount')!.click();
        await settle(fixture);

        expect(isExpanded(fixture)).toBe(true);
      });
    });
  }
});
