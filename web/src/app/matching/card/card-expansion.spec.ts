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
});
