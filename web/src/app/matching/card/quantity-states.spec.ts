import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchActions } from '../match/match-actions';
import { RecordActions } from '../record/record-actions';
import { anAvailability, aSpace } from '../testing/dto-fixtures';
import { AvailabilityCard } from './availability-card';
import { CardExpansion } from './card-expansion';
import { SpaceCard } from './space-card';

/**
 * Phase 8, requirement 2: the quantity states, finished.
 *
 * Three things this file exists to hold down, none of which had a test before Phase 8:
 *
 * 1. **The ramp is keyed on the state *and the side*.** `Over` means opposite things: blue and
 *    expected on a Processor Space, pink and a bug flag on an availability record (design-system.md
 *    4.1). One `q-over` where a `q-pink` belongs would render an over-committed record in the colour
 *    that means "over-filled, and that is fine".
 * 2. **The over states are unmistakable** (2.1) — the literal words `Over-filled` and
 *    `Over-committed`, the negative numeral, and the drawn over-run cap, all three at once.
 * 3. **Colour is never the only signal** (2.4). Every assertion below is on a word or a number.
 *
 * ## The figures are real
 *
 * The blue case is seeded Processor Space **#4** — Alliance Group Dannevirke, 726 matched against 660
 * required, `unmatched -66`. The pink case is availability **#6** as the debug form leaves it when its
 * quantity is edited from 144 down to 100 against 122 already matched, `unmatched -22`: run live
 * against the API during Phase 8, and the one route to pink that exists (design-system.md 4.3,
 * Phase 7's requirement 4.4). Using the real figures means this file breaks if either case stops being
 * reachable, rather than passing against numbers invented to suit it.
 */
describe('Quantity states, on both sides', () => {
  async function configure(): Promise<void> {
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
      ],
    }).compileComponents();
  }

  async function mount(
    component: unknown,
    inputs: Record<string, unknown>,
  ): Promise<HTMLElement> {
    await configure();
    const fixture = TestBed.createComponent(component as never);

    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }

    fixture.detectChanges();
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  /** Seeded space #4. Over-filling demand is permitted and expected (resolved question 1). */
  const overFilledSpace: ProcessorSpaceDto = aSpace({
    id: 4,
    processor: 'Alliance Group',
    plant: 'Dannevirke',
    stockClass: 'Mutton',
    quantityRequired: 660,
    matchedInclDraft: 726,
    matchedExclDraft: 436,
    unmatched: -66,
    quantityState: 'Over',
    quantityStateLabel: 'Over-filled',
  });

  /** Availability #6, after its quantity is edited below what is already matched. */
  const overCommittedRecord: LivestockAvailabilityDto = anAvailability({
    id: 6,
    locationName: 'Lower Mount Pastures',
    stockClass: 'Bull',
    quantityAvailable: 100,
    matchedInclDraft: 122,
    matchedExclDraft: 86,
    unmatched: -22,
    quantityState: 'Over',
    quantityStateLabel: 'Over-committed',
    status: 'Pending',
  });

  // --- the ramp, keyed on state and side ----------------------------------------------------------

  it('paints an over-filled space blue and an over-committed record pink', async () => {
    const space = await mount(SpaceCard, { space: overFilledSpace });
    const record = await mount(AvailabilityCard, { record: overCommittedRecord });

    expect(space.querySelector('.meter')?.className).toContain('q-over');
    expect(space.querySelector('.meter')?.className).not.toContain('q-pink');

    expect(record.querySelector('.meter')?.className).toContain('q-pink');
    expect(record.querySelector('.meter')?.className).not.toContain('q-over');
  });

  it('paints under orange and exact green on both sides alike', async () => {
    const underSpace = await mount(SpaceCard, { space: aSpace() });
    const underRecord = await mount(AvailabilityCard, { record: anAvailability() });

    expect(underSpace.querySelector('.meter')?.className).toContain('q-under');
    expect(underRecord.querySelector('.meter')?.className).toContain('q-under');

    const exactSpace = await mount(SpaceCard, {
      space: aSpace({ matchedInclDraft: 100, unmatched: 0, quantityState: 'Exact' }),
    });
    const exactRecord = await mount(AvailabilityCard, {
      record: anAvailability({ matchedInclDraft: 90, unmatched: 0, quantityState: 'Exact' }),
    });

    expect(exactSpace.querySelector('.meter')?.className).toContain('q-exact');
    expect(exactRecord.querySelector('.meter')?.className).toContain('q-exact');
  });

  // --- unmistakable, and never colour alone -------------------------------------------------------

  it('draws the over-run cap and the negative numeral on both over states', async () => {
    for (const [element, numeral, surface] of [
      [await mount(SpaceCard, { space: overFilledSpace }), '-66', 'space'],
      [await mount(AvailabilityCard, { record: overCommittedRecord }), '-22', 'record'],
    ] as const) {
      // design-system.md 4.2: a meter cannot grow past its track, so the over state is drawn.
      expect(element.querySelector('.over-run'), `${surface} over-run cap`).not.toBeNull();
      expect(element.querySelector('.numeral')?.textContent?.trim()).toBe(numeral);
    }
  });

  // Scoped to .l2 deliberately: the fill meter's own root also takes an `over` class when the state
  // is Over, so a bare '.over' finds the meter and reads the numeral. The two are in different
  // components and Angular scopes their styles, so it is only a selector hazard — but it is one.
  it('says the literal word on line 2, from the DTO and never composed here', async () => {
    const space = await mount(SpaceCard, { space: overFilledSpace });
    const record = await mount(AvailabilityCard, { record: overCommittedRecord });

    expect(space.querySelector('.l2 .over')?.textContent?.trim()).toBe('Over-filled');
    expect(record.querySelector('.l2 .over')?.textContent?.trim()).toBe('Over-committed');

    // The ink beside the word is the same ramp entry the meter took, not a second decision.
    expect(space.querySelector('.l2 .over')?.className).toContain('q-over');
    expect(record.querySelector('.l2 .over')?.className).toContain('q-pink');
  });

  it('carries no over label at all when the record is not over', async () => {
    // The word is a statement, not a slot. An empty one would read as a value that failed to load.
    const space = await mount(SpaceCard, { space: aSpace() });

    expect(space.querySelector('.l2 .over')).toBeNull();
  });

  // --- the expanded card, which spells the state out in words -------------------------------------

  it('repeats the state and its ink in both expansions', async () => {
    const demand = await mount(CardExpansion, { side: 'demand', space: overFilledSpace });
    const supply = await mount(CardExpansion, {
      side: 'supply',
      availability: overCommittedRecord,
    });

    expect(demand.textContent).toContain('Over-filled');
    expect(supply.textContent).toContain('Over-committed');

    // The regression Phase 8 found: these carried a ramp class that no stylesheet painted, because
    // the four rules lived inside the card-shell mixin and the expansion does not include it. The
    // class is asserted here; that it now resolves to a colour is a one-line @include in the
    // stylesheet, and the two must not come apart again.
    expect(demand.querySelector('.ink')?.className).toContain('q-over');
    expect(supply.querySelector('.ink')?.className).toContain('q-pink');
  });

  it('shows the negative unmatched figure in the expansion too, exactly as given', async () => {
    const supply = await mount(CardExpansion, {
      side: 'supply',
      availability: overCommittedRecord,
    });

    expect(supply.querySelector('.ink')?.textContent?.trim()).toBe('-22');
  });
});
