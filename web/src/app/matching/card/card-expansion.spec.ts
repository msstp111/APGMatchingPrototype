import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchActions } from '../match/match-actions';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { CardExpansion } from './card-expansion';

describe('Card expansion', () => {
  const open = vi.fn();
  const confirmSpace = vi.fn();

  async function mountDemand(space: ProcessorSpaceDto): Promise<ComponentFixture<CardExpansion>> {
    const fixture = await mount();
    fixture.componentRef.setInput('side', 'demand');
    fixture.componentRef.setInput('space', space);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  async function mountSupply(
    record: LivestockAvailabilityDto,
  ): Promise<ComponentFixture<CardExpansion>> {
    const fixture = await mount();
    fixture.componentRef.setInput('side', 'supply');
    fixture.componentRef.setInput('availability', record);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  async function mount(): Promise<ComponentFixture<CardExpansion>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CardExpansion],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatchActions, useValue: { open, confirmSpace } },
      ],
    }).compileComponents();

    return TestBed.createComponent(CardExpansion);
  }

  function rows(fixture: ComponentFixture<CardExpansion>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('tr.openable')];
  }

  beforeEach(() => {
    open.mockReset();
    confirmSpace.mockReset();
  });

  // --- getting to a match, from either side ---------------------------------------------------------

  /**
   * Requirement 1.2, and the reason it is satisfied by construction rather than by two code paths:
   * both sides call the same method with the same number, and neither knows which card it is on.
   */
  it('opens a match by id from the demand side', async () => {
    const fixture = await mountDemand(aSpace({ matches: [aMatch({ id: 7 }), aMatch({ id: 9 })] }));

    expect(rows(fixture)).toHaveLength(2);
    rows(fixture)[1].click();

    expect(open).toHaveBeenCalledWith(9);
  });

  it('opens the same match by the same id from the supply side', async () => {
    const fixture = await mountSupply(
      anAvailability({ matches: [aMatch({ id: 7 }), aMatch({ id: 9 })] }),
    );

    rows(fixture)[1].click();

    expect(open).toHaveBeenCalledWith(9);
  });

  it('has nothing to open on a record with no matches', async () => {
    const fixture = await mountDemand(aSpace({ matches: [] }));

    expect(rows(fixture)).toHaveLength(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No matches yet');
  });

  // --- confirming a Processor Space -----------------------------------------------------------------

  it('offers Confirm space on a space the DTO says can be confirmed', async () => {
    const fixture = await mountDemand(
      aSpace({ canConfirm: true, confirmBlockedReason: null, matches: [aMatch({ id: 7 })] }),
    );

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.actions button',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.why')).toBeNull();

    button.click();
    expect(confirmSpace).toHaveBeenCalledWith(1);
  });

  /**
   * Requirement 5.3. A control that greys out for unstated reasons is exactly what makes a
   * non-technical operator conclude the application is broken — and the reason is the DTO's, so it
   * cannot disagree with the gate beside it.
   */
  it.each([
    ['Needs at least one confirmed match and no drafts'],
    ['Already confirmed'],
    ['This space is cancelled'],
  ])('says why Confirm space is unavailable: %s', async (reason) => {
    const fixture = await mountDemand(aSpace({ canConfirm: false, confirmBlockedReason: reason }));
    const element = fixture.nativeElement as HTMLElement;

    expect((element.querySelector('.actions button') as HTMLButtonElement).disabled).toBe(true);
    expect(element.querySelector('.why')?.textContent?.trim()).toBe(reason);
  });

  /**
   * An availability record's status is derived from its matches and never set, so there is nothing on
   * the supply side to confirm. The action belongs to the demand card alone.
   */
  /**
   * Cancelling a record never cascades, so a live match under a cancelled parent is a normal state —
   * and the card on the far side is where anyone would look to see whether the matches survived. Icon
   * and word, no hue: status carries no colour anywhere on this screen.
   */
  it('flags a match whose processor space has been cancelled', async () => {
    const fixture = await mountSupply(
      anAvailability({ matches: [aMatch({ id: 7, spaceStatus: 'Cancelled' })] }),
    );
    const orphan = (fixture.nativeElement as HTMLElement).querySelector('.orphan');

    expect(orphan?.textContent).toContain('space cancelled');
    expect(orphan?.getAttribute('title')).toContain('The match itself has not');
  });

  it('flags a match whose availability record has been cancelled, from the demand card', async () => {
    const fixture = await mountDemand(
      aSpace({ matches: [aMatch({ id: 7, availabilityStatus: 'Cancelled' })] }),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('.orphan')?.textContent).toContain(
      'record cancelled',
    );
  });

  it('says nothing about a match whose parents are both live', async () => {
    const fixture = await mountSupply(anAvailability({ matches: [aMatch({ id: 7 })] }));

    expect((fixture.nativeElement as HTMLElement).querySelector('.orphan')).toBeNull();
  });

  /**
   * The badge is a solid `$lms-error` box rather than muted text, at Mark's direction — and that is a
   * deliberate exception to "status carries no hue". It is not reporting a status: the match is live,
   * still consuming this record's quantity, and needs somebody to deal with it. jsdom cannot see the
   * fill, but it can see that the element carrying it is the one styled for it.
   */
  it('carries the flag on an element the stylesheet paints, not on loose text', async () => {
    const fixture = await mountSupply(
      anAvailability({ matches: [aMatch({ id: 7, spaceStatus: 'Cancelled' })] }),
    );
    const orphan = (fixture.nativeElement as HTMLElement).querySelector('.orphan');

    expect(orphan?.tagName.toLowerCase()).toBe('span');
    expect(orphan?.querySelector('.material-symbols-outlined')?.textContent?.trim()).toBe('block');
  });

  it('offers no Confirm action on the supply side at all', async () => {
    const fixture = await mountSupply(anAvailability({ matches: [aMatch({ id: 7 })] }));
    const actions = (fixture.nativeElement as HTMLElement).querySelector('.actions');

    // The supply side gained an actions row in Phase 7 for Edit and Cancel, so the assertion is on
    // the button rather than on the row: an availability record's status is derived from its matches
    // and is never confirmed directly, so there must be no Confirm here.
    expect(actions).not.toBeNull();
    expect(actions?.textContent).not.toContain('Confirm');
    expect(actions?.textContent).toContain('Edit');
    expect(actions?.textContent).toContain('Cancel');
  });
  // --- the sums strip and the prose beneath it (2026-09-08) ------------------------------------
  //
  // The drawer used to open on two BARE sums captioned `QUANTITY MATCHED / EXCL. DRAFT` over two
  // lines each, and then repeat `Quantity required` and `Quantity unmatched` in the field row below —
  // which were verbatim copies of two cells on the collapsed row above. What ships now is idea 6b out
  // of the eleven in `Documents/sums-strip-lab.html`: captions on top, one line each, the drafted
  // figure inside them, and the sums as fractions.

  /** One cell of either block, by its micro-cap caption — the only stable handle on it. */
  function cell(fixture: ComponentFixture<CardExpansion>, label: string): string {
    const fields = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.sums .field, .fields .field',
      ),
    ];
    const match = fields.find((field) => caption(field) === label);

    // A missing cell must fail loudly here rather than as an empty string that happens to satisfy a
    // `not.toContain`, which is how the removal assertions below would silently stop testing.
    expect(match, `no cell labelled "${label}"`).toBeDefined();

    return (match?.querySelector('.value')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function caption(field: Element): string {
    return (field.querySelector('.label')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Every caption in the drawer's head, in document order — so a test can assert the ORDER too. */
  function labels(fixture: ComponentFixture<CardExpansion>): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.sums .field, .fields .field',
      ),
    ].map(caption);
  }

  /**
   * Both sums against the record's own total, and the total is the DTO's — never a sum of the table.
   * The fixture's figures are deliberately inconsistent with each other, which is the point: the
   * client prints the numbers it is given and works out none of them.
   */
  it('states both matched sums as a fraction of the quantity required', async () => {
    const fixture = await mountDemand(
      aSpace({
        quantityRequired: 77,
        matchedInclDraft: 59,
        matchedExclDraft: 29,
        draftedQuantity: 30,
      }),
    );

    expect(cell(fixture, 'excl. 30 Draft')).toBe('29 of 77');
    expect(cell(fixture, 'incl. 30 Draft')).toBe('59 of 77');
  });

  it('states both matched sums as a fraction of the quantity available on the supply side', async () => {
    const fixture = await mountSupply(
      anAvailability({
        quantityAvailable: 144,
        matchedInclDraft: 120,
        matchedExclDraft: 90,
        draftedQuantity: 30,
      }),
    );

    expect(cell(fixture, 'excl. 30 Draft')).toBe('90 of 144');
    expect(cell(fixture, 'incl. 30 Draft')).toBe('120 of 144');
  });

  /**
   * The drafted figure is in BOTH captions and on neither numeral, which is the substance of 6b: it
   * explains both sums and belongs to neither — 29 excludes those 30, 59 includes them.
   *
   * The spacing is asserted because it is fragile. Angular strips whitespace-only text nodes around an
   * element, so the template writes `&ngsp;` on both sides of the figure; drop one and the caption
   * renders `excl.30 Draft`, which no test that only looked for the number would catch.
   */
  it('carries the drafted figure inside both captions, spaced, and on neither numeral', async () => {
    const fixture = await mountDemand(
      aSpace({ matchedInclDraft: 59, matchedExclDraft: 29, draftedQuantity: 7 }),
    );

    expect(labels(fixture)).toContain('excl. 7 Draft');
    expect(labels(fixture)).toContain('incl. 7 Draft');
    // Nothing rides on the figures any more.
    expect(cell(fixture, 'incl. 7 Draft')).toBe('59 of 100');
  });

  /**
   * It comes off the DTO. Composing it here would be `matchedInclDraft - matchedExclDraft`, which
   * `no-domain-arithmetic.spec.ts` forbids — so the fixture sets a value that is NOT that difference.
   */
  it('prints the drafted quantity from the DTO rather than the difference of the two sums', async () => {
    const fixture = await mountDemand(
      aSpace({ matchedInclDraft: 59, matchedExclDraft: 29, draftedQuantity: 7 }),
    );

    expect(labels(fixture)).not.toContain('excl. 30 Draft');
  });

  /**
   * And with nothing drafted the captions drop the figure rather than printing `excl. 0 Draft`, which
   * reads as a mistake. This fires on every fully-confirmed record, so it is an ordinary state.
   */
  it('falls back to the plain captions when nothing is drafted', async () => {
    const fixture = await mountDemand(
      aSpace({ matchedInclDraft: 100, matchedExclDraft: 100, draftedQuantity: 0, unmatched: 0 }),
    );

    expect(labels(fixture).slice(0, 2)).toEqual(['excl. Draft', 'incl. Draft']);
  });

  /**
   * The lift out of the caption's muted grey is a real element, not a colour applied to the whole
   * caption: a number inside a 10.5px micro-cap is a number nobody reads, and the surrounding words
   * have to stay quiet for it to work.
   */
  it('marks the figure inside the caption so the stylesheet can lift it', async () => {
    const fixture = await mountDemand(aSpace({ draftedQuantity: 12 }));
    const marked = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.sums .label .dq'),
    ];

    expect(marked).toHaveLength(2);
    expect(marked.map((m) => m.textContent?.trim())).toEqual(['12', '12']);
  });

  it('carries the unmatched figure and its state word in the strip, in the ramp ink', async () => {
    const fixture = await mountDemand(
      aSpace({
        unmatched: -24,
        unmatchedLabel: '24',
        quantityState: 'Over',
        quantityStateLabel: 'Over-filled',
      }),
    );
    const ink = (fixture.nativeElement as HTMLElement).querySelector('.sums .ink');

    // `24`, not `-24`: the sign is carried by the ink and by the word beside it. And no space in the
    // expectation — the 6px between the two is `.sum .state`'s margin, not a text node.
    expect(cell(fixture, 'Quantity unmatched')).toBe('24Over-filled');
    expect(ink?.textContent?.trim()).toBe('24');
    expect(ink?.classList.contains('q-over')).toBe(true);
  });

  /**
   * The half of the change that removes something, and the half a hurried edit would put back. Both
   * of these were the same numbers as the collapsed row's `Req'd` cell and its meter numeral, printed
   * 40px lower in the same order.
   */
  it('names neither the required nor the available quantity in a cell of its own', async () => {
    expect(labels(await mountDemand(aSpace({})))).not.toContain('Quantity required');
    expect(labels(await mountSupply(anAvailability({})))).not.toContain('Quantity available');
  });

  /** One line per caption, in the order the fill meter builds its segments, prose beneath. */
  it('leads with the sums strip and puts the prose in a band beneath it', async () => {
    const fixture = await mountSupply(anAvailability({ draftedQuantity: 30 }));
    const host = fixture.nativeElement as HTMLElement;

    expect([...host.querySelectorAll('.sums, .fields')].map((block) => block.className)).toEqual([
      'sums',
      'fields',
    ]);
    expect(labels(fixture)).toEqual([
      'excl. 30 Draft',
      'incl. 30 Draft',
      'Quantity unmatched',
      'Availability details',
      'Transaction type',
      'Notes',
    ]);
  });
});
