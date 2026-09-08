import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { MatchEditContextDto } from '../api/models';
import { AvailabilityCard } from './card/availability-card';
import { CardExpansion } from './card/card-expansion';
import { SpaceCard } from './card/space-card';
import { MatchActions } from './match/match-actions';
import { MatchModal } from './match/match-modal';
import { RecordActions } from './record/record-actions';
import { aMatch, anAvailability, aSpace } from './testing/dto-fixtures';

/**
 * Phase 8, requirement 4.4 and the acceptance criterion behind it: **nothing in the UI ever shows a
 * raw `undefined`, `NaN`, `null` or `Invalid Date`** — and, requirement 4.2 and design-system.md 13,
 * an absent value reads as `-` rather than as a blank.
 *
 * Every optional field on all three DTOs is empty here at once — notes, delivery time, availability
 * details, transport company, price per kg, farmer name, the confirm-blocked reason. That combination
 * really does occur: a record created from the debug form with only its required fields filled in has
 * most of them, and a match drafted without a carrier, against a space outside the seeded price
 * table's range, has the rest.
 *
 * **Two halves, because they catch different failures, and the first alone would be vacuous.**
 *
 * Angular interpolates `null` as an empty string, so a template that dropped its `|| '-'` would not
 * print the word "null" — it would print nothing, and the forbidden-strings sweep would pass a real
 * defect. (Verified during Phase 8 by removing a guard and watching the sweep pass.) So the sweep
 * covers what it genuinely covers — strings assembled in TypeScript, and every `title`, which is a
 * hover string somebody really does read and where an unguarded field survives longest because
 * nothing shows it until the pointer stops — and the second half asserts the fallbacks themselves.
 */
describe('Absent values never render raw, and never render blank', () => {
  /** `null` is in the list because it reaches a TypeScript template literal as the word. */
  const FORBIDDEN = ['undefined', 'NaN', 'Invalid Date', 'null'];

  const emptySpace = aSpace({ deliveryTime: null, notes: null, confirmBlockedReason: null });

  const emptyAvailability = anAvailability({
    availabilityDetails: null,
    notes: null,
    farmerName: null,
  });

  const emptyMatch = aMatch({
    pricePerKg: null,
    transportCompany: null,
    deliveryTime: null,
    farmerName: null,
    locationName: null,
    availabilityDetails: null,
    cancellationReason: null,
  });

  function expectNothingRaw(element: HTMLElement, surface: string): void {
    const text = element.textContent ?? '';

    for (const forbidden of FORBIDDEN) {
      expect(`${surface} — ${text}`).not.toContain(forbidden);
    }

    for (const node of Array.from(element.querySelectorAll('[title]'))) {
      const title = node.getAttribute('title') ?? '';

      for (const forbidden of FORBIDDEN) {
        expect(`${surface} title — ${title}`).not.toContain(forbidden);
      }
    }
  }

  /** The stubs are the ones the individual specs use; nothing here exercises a write. */
  async function configure(extra: unknown[] = []): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: MatchActions,
          useValue: { open: () => undefined, confirmSpace: () => undefined },
        },
        {
          provide: RecordActions,
          useValue: { editSpace: () => undefined, editAvailability: () => undefined },
        },
        { provide: ApiClient, useValue: { transportCompanies: () => of([]) } },
        ...extra,
      ],
    }).compileComponents();
  }

  async function mount(
    component: unknown,
    inputs: Record<string, unknown>,
    extra: unknown[] = [],
  ): Promise<HTMLElement> {
    await configure(extra);
    const fixture = TestBed.createComponent(component as never);

    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }

    fixture.detectChanges();
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  const context: MatchEditContextDto = {
    match: emptyMatch,
    space: emptySpace,
    availability: emptyAvailability,
    maximumQuantity: 90,
  };

  const dialogProviders = [
    { provide: MAT_DIALOG_DATA, useValue: context },
    { provide: MatDialogRef, useValue: { close: () => undefined } },
  ];

  beforeEach(() => localStorage.clear());

  // -----------------------------------------------------------------------------------------------
  // Half one — the four strings, everywhere
  // -----------------------------------------------------------------------------------------------

  it('on both collapsed cards with every optional field empty', async () => {
    expectNothingRaw(await mount(SpaceCard, { space: emptySpace }), 'space card');
    expectNothingRaw(
      await mount(AvailabilityCard, { record: emptyAvailability }),
      'availability card',
    );
  });

  it('on both expanded cards, with a match carrying no price, no carrier and no time', async () => {
    expectNothingRaw(
      await mount(CardExpansion, {
        side: 'demand',
        space: { ...emptySpace, matches: [emptyMatch] },
      }),
      'demand expansion',
    );

    expectNothingRaw(
      await mount(CardExpansion, {
        side: 'supply',
        availability: { ...emptyAvailability, matches: [emptyMatch] },
      }),
      'supply expansion',
    );
  });

  it('on both expanded cards with no matches at all', async () => {
    expectNothingRaw(
      await mount(CardExpansion, { side: 'demand', space: emptySpace }),
      'demand expansion, no matches',
    );

    expectNothingRaw(
      await mount(CardExpansion, { side: 'supply', availability: emptyAvailability }),
      'supply expansion, no matches',
    );
  });

  it('in the match modal, whose sub-lines are assembled in TypeScript', async () => {
    await configure(dialogProviders);
    const fixture = TestBed.createComponent(MatchModal);
    fixture.detectChanges();
    await fixture.whenStable();

    expectNothingRaw(fixture.nativeElement as HTMLElement, 'match modal');
  });

  // -----------------------------------------------------------------------------------------------
  // Half two — the fallbacks themselves
  //
  // These are the assertions that can actually fail. Each one names a guard that, removed, leaves an
  // empty cell where design-system.md 13 requires a dash — a failure the sweep above cannot see,
  // because an empty string contains none of the four forbidden words.
  // -----------------------------------------------------------------------------------------------

  it('drops the separator entirely when the space has no delivery time', async () => {
    const card = await mount(SpaceCard, { space: emptySpace });

    // Line 2 is unlabelled, so an absent time takes its separator with it rather than dashing.
    expect(card.querySelector('.meta')?.textContent?.trim()).toBe('ANZCO');
  });

  it('keeps the separator when the space does have a delivery time', async () => {
    const card = await mount(SpaceCard, { space: aSpace({ deliveryTime: 'Morning' }) });

    expect(card.querySelector('.meta')?.textContent?.trim()).toBe('ANZCO · Morning');
  });

  it("renders a missing farmer as '-' on the availability card", async () => {
    const card = await mount(AvailabilityCard, { record: emptyAvailability });

    expect(card.querySelector('.meta')?.textContent?.trim()).toBe('- · Finance Stock');
  });

  it("renders missing notes and details as '-' in both expansions", async () => {
    const demand = await mount(CardExpansion, { side: 'demand', space: emptySpace });
    const supply = await mount(CardExpansion, { side: 'supply', availability: emptyAvailability });

    for (const [element, surface] of [
      [demand, 'demand'],
      [supply, 'supply'],
    ] as const) {
      const values = Array.from(element.querySelectorAll('.field .value')).map((n) =>
        n.textContent?.trim(),
      );

      expect(`${surface}: ${values.join(' | ')}`).toContain('-');
    }
  });

  it('says a match has no default price in words, never as a blank or a zero', async () => {
    const expansion = await mount(CardExpansion, {
      side: 'demand',
      space: { ...emptySpace, matches: [emptyMatch] },
    });

    expect(expansion.textContent).toContain('no default price');
    expect(expansion.textContent).not.toContain('$0.00');
  });

  it("renders a missing transport company as '-' in the match table", async () => {
    const expansion = await mount(CardExpansion, {
      side: 'demand',
      space: { ...emptySpace, matches: [emptyMatch] },
    });

    const cells = Array.from(expansion.querySelectorAll('tbody td')).map((n) =>
      n.textContent?.trim(),
    );

    // The last cell of the row is Transport on both sides (design-system.md 6.2).
    expect(cells.at(-1)).toBe('-');
  });

  it('names the missing farmer in the modal sub-line rather than trailing off', async () => {
    await configure(dialogProviders);
    const fixture = TestBed.createComponent(MatchModal);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('no time set');
    expect(text).toContain('no farmer on file');
  });
});
