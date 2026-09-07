import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchActions } from '../match/match-actions';
import { RecordActions } from '../record/record-actions';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { AvailabilityCard } from './availability-card';
import { SpaceCard } from './space-card';

/**
 * The card's two pointer paths, separated 2026-09-07: the grip drags, the body expands.
 *
 * Before that the whole 508px body was the `cdkDragHandle`, so a hand cursor sat over a row whose
 * commonest action is expanding it and expanding meant hitting the 24px chevron in the far corner.
 * Both halves of the separation are one attribute each, on two templates, and either can be dropped
 * from one card and left on the other — which is exactly the drift design-system.md 6.1 forbids and
 * which nothing else here would notice.
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
      it('drags from the grip and from nothing else', async () => {
        const fixture = await side.open();
        const row = card(fixture);

        // CDK stamps the class on whatever carries the directive, which is how this asserts the
        // *only* rather than merely the presence: the body used to be the handle.
        expect(row.querySelector('.grip.cdk-drag-handle')).not.toBeNull();
        expect(row.querySelectorAll('.cdk-drag-handle')).toHaveLength(1);
        expect(row.querySelector('.cbody')!.classList).not.toContain('cdk-drag-handle');
      });

      it('expands and collapses on a click anywhere in the body', async () => {
        const fixture = await side.open();
        const body = card(fixture).querySelector<HTMLElement>('.cbody')!;

        expect(isExpanded(fixture)).toBe(false);

        body.click();
        await settle(fixture);
        expect(isExpanded(fixture)).toBe(true);

        // The expanded card's own body still collapses it — the drawer below is a sibling of the row,
        // so nothing about being open takes the click away.
        card(fixture).querySelector<HTMLElement>('.cbody')!.click();
        await settle(fixture);
        expect(isExpanded(fixture)).toBe(false);
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
