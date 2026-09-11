import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchProposalDto } from '../../api/models';
import { DragPreview } from '../drag/drag-preview';
import { DragStore } from '../drag/drag-state';
import { MatchActions } from '../match/match-actions';
import { RecordActions } from '../record/record-actions';
import { anAvailability, aSpace } from '../testing/dto-fixtures';
import { AvailabilityCard } from './availability-card';
import { SpaceCard } from './space-card';

/**
 * Phase 9's drag chrome, on the card rather than in the store.
 *
 * `drag-state.spec.ts` proves the store answers correctly; this proves the two templates ask. They
 * are separate failures: every one of these classes is a binding that can be dropped from one card
 * and left on the other, and design-system.md 6.1's "identical on both sides" then quietly stops
 * being true in the one place no unit test would notice.
 */
describe('The card’s drag chrome', () => {
  const space = aSpace({ id: 7, unmatched: 40 });
  const availability = anAvailability({ id: 11, unmatched: 20, matchedInclDraft: 30 });

  const demand = { side: 'demand' as const, space };
  const supply = { side: 'supply' as const, availability };

  const proposal: MatchProposalDto = {
    isAllowed: true,
    refusalMessage: null,
    quantity: 33,
    maximum: 20,
    defaultPricePerKg: null,
  };

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
          useValue: { transportCompanies: () => of([]), matchProposal: () => of(proposal) },
        },
      ],
    }).compileComponents();
  }

  function column(left: number, right: number): HTMLElement {
    const element = document.createElement('div');

    element.getBoundingClientRect = () =>
      ({ left, right, top: 0, bottom: 900, width: right - left, height: 900 }) as DOMRect;

    return element;
  }

  /** Crosses the gutter, through the document listener the store installs at pickup. */
  function crossTheGutter(): void {
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 700, clientY: 400 }));
  }

  interface Mounted {
    readonly fixture: ComponentFixture<unknown>;
    readonly target: HTMLElement;
    readonly drag: DragStore;
  }

  async function mount(component: unknown, inputs: Record<string, unknown>): Promise<Mounted> {
    const fixture = TestBed.createComponent(component as never);

    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }

    fixture.detectChanges();
    await fixture.whenStable();

    const drag = TestBed.inject(DragStore);

    drag.registerColumn('demand', column(0, 500));
    drag.registerColumn('supply', column(500, 1000));

    return {
      fixture,
      target: (fixture.nativeElement as HTMLElement).querySelector('.target')!,
      drag,
    };
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    localStorage.clear();
    await configure();
  });

  describe('on the supply card, as the drag runs demand → supply', () => {
    it('marks nothing at all until the pointer has crossed the gutter', async () => {
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: availability });

      drag.begin(demand);
      await settle(fixture);

      expect(target.classList.contains('valid')).toBe(false);
      expect(target.classList.contains('hot')).toBe(false);
      expect(target.classList.contains('dim')).toBe(false);
      expect(target.querySelector('.ghost')).toBeNull();
    });

    it('becomes an eligible target on the crossing, and the hot one when entered', async () => {
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: availability });

      drag.begin(demand);
      crossTheGutter();
      await settle(fixture);

      expect(target.classList.contains('valid')).toBe(true);
      expect(target.classList.contains('hot')).toBe(false);

      drag.enter(supply);
      await settle(fixture);

      expect(target.classList.contains('hot')).toBe(true);
    });

    /**
     * 2026-09-09, drag-lab-2 idea 1. A card in the far column is not dimmed at any point of the
     * gesture — not on the crossing, not while the pointer is three rows below it, not while another
     * card is hot. The whole column stays as readable as it was before the card was picked up,
     * because comparing those rows is what the operator is doing while the card is in the air.
     */
    it('never recedes, however the drag moves over its column', async () => {
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: availability });

      drag.begin(demand);
      crossTheGutter();
      await settle(fixture);

      expect(target.classList.contains('dim')).toBe(false);

      drag.enter({ side: 'supply', availability: anAvailability({ id: 99 }) });
      await settle(fixture);

      // Another card in the same column is the hot one, and this one still reads at full strength.
      expect(target.classList.contains('hot')).toBe(false);
      expect(target.classList.contains('dim')).toBe(false);
    });

    /**
     * Phase 9's inversion, and the rule most likely to be undone by a later hand reaching for "a bit
     * more feedback". The whole opposite column is eligible; a badge on all of it is not information.
     */
    it('draws no badge while it is merely eligible', async () => {
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: availability });

      drag.begin(demand);
      crossTheGutter();
      await settle(fixture);

      expect(target.classList.contains('valid')).toBe(true);
      expect(target.querySelector('.dropcue')).toBeNull();

      drag.enter(supply);
      await settle(fixture);

      // Not even when it is the hot one: it is marked by being the only card left lit, and the chip
      // in the operator's hand states the outcome.
      expect(target.querySelector('.dropcue')).toBeNull();
    });

    it('badges the one record that would refuse the drop, and only that one', async () => {
      const full = anAvailability({ id: 12, unmatched: 0 });
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: full });

      drag.begin(demand);
      crossTheGutter();
      await settle(fixture);

      expect(target.classList.contains('blocked')).toBe(true);
      expect(target.querySelector('.dropcue')?.textContent).toContain('block');
    });

    /**
     * The figure is the server's, and the ghost is the only place on a card where a drop in flight
     * writes anything into the record's own meter.
     */
    it('ghosts the proposed quantity into its meter, and only while it is the hot card', async () => {
      const { fixture, target, drag } = await mount(AvailabilityCard, { record: availability });

      drag.begin(demand);
      crossTheGutter();
      drag.enter(supply);
      await settle(fixture);

      const ghost = target.querySelector<HTMLElement>('.ghost');

      expect(ghost).not.toBeNull();
      // 30 of 90 already matched, so the ghost starts a third of the way along.
      expect(ghost!.style.left).toBe('33.33333333333333%');

      drag.leave('supply', availability.id);
      await settle(fixture);

      expect(target.querySelector('.ghost')).toBeNull();
    });
  });

  describe('on the card that was picked up', () => {
    it('marks itself the origin, from pickup, and never dims', async () => {
      const { fixture, target, drag } = await mount(SpaceCard, { space });

      drag.begin(demand);
      await settle(fixture);

      expect(target.classList.contains('origin')).toBe(true);
      expect(target.classList.contains('dim')).toBe(false);
      // Its own column is never a target, whether or not the gutter has been crossed.
      expect(target.classList.contains('valid')).toBe(false);
    });

    it('dims its neighbours from pickup, before anything else on the screen changes', async () => {
      const other = aSpace({ id: 8 });
      const { fixture, target, drag } = await mount(SpaceCard, { space: other });

      drag.begin(demand);
      await settle(fixture);

      expect(target.classList.contains('dim')).toBe(true);
      expect(target.classList.contains('origin')).toBe(false);
    });
  });

  describe('the demand card, as the drag runs the other way', () => {
    it('carries exactly the same chrome, because it is the same wiring', async () => {
      const { fixture, target, drag } = await mount(SpaceCard, { space });

      drag.begin(supply);
      document.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 400 }));
      await settle(fixture);

      expect(target.classList.contains('valid')).toBe(true);

      drag.enter(demand);
      await settle(fixture);

      expect(target.classList.contains('hot')).toBe(true);
      expect(target.querySelector('.ghost')).not.toBeNull();
    });
  });

  describe('the preview chip', () => {
    /**
     * The chip carried `processor` alone until 2026-09-08, which named ~70% of the demand column
     * identically. The composition is `card-chrome.spaceName`, the same one both dialog titles use.
     */
    it('labels a space with its plant as well as its processor', async () => {
      const fixture = TestBed.createComponent(SpaceCard);

      fixture.componentRef.setInput('space', aSpace({ processor: 'ANZCO', plant: 'Kokiri' }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.dragName()).toBe('ANZCO Kokiri');

      // A hand-built or partly filled record has no plant, and `ANZCO ` with a trailing space in a
      // 232px chip is exactly the kind of thing nobody notices until a demo.
      fixture.componentRef.setInput('space', aSpace({ processor: 'SFF', plant: '' }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.dragName()).toBe('SFF');
    });

    /**
     * The chip carries `unmatched`, on both sides (2026-09-10).
     *
     * Asserted through `dragHeadCount` because the chip itself lives in a `cdkDragPreview`, which
     * CDK only instantiates during a real pointer drag and therefore never in jsdom — the rendered
     * figure was checked in a browser instead, and the browser checklist carries that row.
     *
     * The fixtures are deliberately built with a total that DIFFERS from unmatched. Equal values
     * would pass against either field and the test would guard nothing, which is exactly how the
     * total came to be shipped in the first place.
     */
    it('labels the chip with what is left to match, not the record’s size', async () => {
      const demandFixture = TestBed.createComponent(SpaceCard);
      demandFixture.componentRef.setInput('space', aSpace({ quantityRequired: 800, unmatched: 305 }));
      demandFixture.componentRef.setInput('zebra', false);
      demandFixture.detectChanges();
      await demandFixture.whenStable();

      expect(demandFixture.componentInstance.dragHeadCount()).toBe(305);

      const supplyFixture = TestBed.createComponent(AvailabilityCard);
      supplyFixture.componentRef.setInput(
        'record',
        anAvailability({ quantityAvailable: 730, unmatched: 96 }),
      );
      supplyFixture.componentRef.setInput('zebra', false);
      supplyFixture.detectChanges();
      await supplyFixture.whenStable();

      expect(supplyFixture.componentInstance.dragHeadCount()).toBe(96);
    });

    it('names the record and carries the outcome once the server has answered', async () => {
      const fixture = TestBed.createComponent(DragPreview);

      fixture.componentRef.setInput('name', 'Moss Gate Lodge');
      fixture.componentRef.setInput('headCount', 730);
      fixture.detectChanges();
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('.cname')?.textContent).toContain('Moss Gate Lodge');
      expect(element.querySelector('.chead')?.textContent).toContain('730 head');
      // Nothing hovered yet, so the chip states no outcome. It never guesses one.
      expect(element.querySelector('.outcome')).toBeNull();

      const drag = TestBed.inject(DragStore);

      drag.begin(demand);
      drag.enter(supply);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(element.querySelector('.outcome')?.textContent).toContain('Match 33 head');
    });

    /**
     * The pill earns its place by disagreeing with the chip. A whole-record drop — 23 head onto a
     * space wanting 60 — moves all 23, so `Match 23 head` under `23 head` is two statements of one
     * fact. It is withheld, and its presence therefore *means* the drop is partial.
     */
    it('withholds the outcome when it would only repeat the head count above it', async () => {
      const fixture = TestBed.createComponent(DragPreview);

      fixture.componentRef.setInput('name', 'Stone Stead Farming');
      // The chip's own figure, and what the server proposes for this pair: the same 33.
      fixture.componentRef.setInput('headCount', 33);
      fixture.detectChanges();
      await fixture.whenStable();

      const drag = TestBed.inject(DragStore);

      drag.begin(demand);
      drag.enter(supply);
      fixture.detectChanges();
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('.chead')?.textContent).toContain('33 head');
      expect(element.querySelector('.outcome')).toBeNull();
    });
  });
});
