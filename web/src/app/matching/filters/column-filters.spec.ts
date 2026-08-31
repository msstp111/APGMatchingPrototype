import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { anAvailability, aSpace } from '../testing/dto-fixtures';
import { ColumnFilters } from './column-filters';
import { MatchingPreferences } from './matching-preferences';

/**
 * The filter row as rendered, rather than as modelled.
 *
 * `filter-defaults.spec.ts` proves the supply column has no week filter in the *state*; this proves
 * it has no such **control**, by opening the menu and reading it. Resolved question 17 is worth
 * guarding twice: a week filter on supply hides every older record that still has unmatched stock,
 * which is the one failure this screen's whole design exists to prevent, and it would be added back
 * by someone acting in good faith from the .docx.
 */
describe('Column filters', () => {
  const spaces: ProcessorSpaceDto[] = [
    aSpace({ id: 1, processor: 'ANZCO', plant: 'Rangitikei', stockClass: 'Cows' }),
    aSpace({
      id: 2,
      processor: 'Alliance Group',
      plant: 'Lorneville',
      stockClass: 'Cattle',
      weekCommencing: '2026-08-30',
      weekCommencingLabel: '30-08-26',
    }),
  ];

  const records: LivestockAvailabilityDto[] = [
    anAvailability({ id: 1, locationId: 7, locationName: 'Alford Farms HQ' }),
    anAvailability({ id: 2, locationId: 8, locationName: 'Bracken Downs' }),
    anAvailability({ id: 3, locationId: 9, locationName: 'Cairnbrae Station' }),
  ];

  let fixture: ComponentFixture<ColumnFilters>;

  async function mount(side: 'demand' | 'supply'): Promise<ColumnFilters> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ColumnFilters],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ColumnFilters);
    fixture.componentRef.setInput('side', side);
    fixture.componentRef.setInput('spaces', side === 'demand' ? spaces : []);
    fixture.componentRef.setInput('availability', side === 'supply' ? records : []);
    await fixture.whenStable();

    return fixture.componentInstance;
  }

  /** A `mat-menu` renders into an overlay on the body, not inside the component. */
  async function openMenu(testId: string): Promise<string> {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `[data-testid="${testId}"]`,
    );

    trigger!.click();
    await fixture.whenStable();

    const panels = document.querySelectorAll('.mat-mdc-menu-panel');

    return panels[panels.length - 1]?.textContent ?? '';
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('offers a delivery-week filter on the demand column', async () => {
    await mount('demand');

    const more = await openMenu('more-chip');

    expect(more).toContain('Plant');
    expect(more).toContain('Delivery week');
    expect(more).toContain('Has unmatched quantity');

    // Processor has a chip of its own on the row, so it is not also inside More.
    expect(more).not.toContain('Processor');
  });

  /** The promoted chip on each side, and the reason `More (n)` does not count them. */
  it('puts the who filter on the row rather than inside More', async () => {
    await mount('demand');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Processor: All');
    expect(await openMenu('processor-chip')).toContain('ANZCO');

    await mount('supply');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Location: All');
    expect(await openMenu('location-chip')).toContain('Bracken Downs');
  });

  /**
   * Resolved question 17. Not "there is no week submenu today" but "nothing in this menu mentions a
   * week at all", so a cumulative `Available by` variant — considered and declined for the same
   * reason — fails this too.
   */
  it('offers no week filter of any kind on the supply column', async () => {
    await mount('supply');

    const more = await openMenu('more-chip');

    expect(more).toContain('Transaction type');
    expect(more).toContain('Has unmatched quantity');
    expect(more).not.toMatch(/week/i);
    expect(more).not.toMatch(/available.?by/i);
  });

  /** Both sides say the same thing about the same rule; only the default differs. */
  it('words the unmatched filter identically on both sides', async () => {
    await mount('demand');
    const demandMore = await openMenu('more-chip');

    await mount('supply');
    const supplyMore = await openMenu('more-chip');

    expect(demandMore).toContain('Has unmatched quantity');
    expect(supplyMore).toContain('Has unmatched quantity');
    expect(supplyMore).not.toContain('more than zero');
  });

  it('shows each chip current value without being opened', async () => {
    await mount('demand');

    const row = (fixture.nativeElement as HTMLElement).textContent ?? '';

    // The defaults are on the chip faces, so nobody concludes a record has vanished (12.2).
    expect(row).toContain('Status: Booked');
    expect(row).toContain('Stock class: All');
    expect(row).toContain('Soonest');
  });

  it('reads the supply column defaults onto its own chips', async () => {
    await mount('supply');

    const row = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(row).toContain('Status: 2 selected');

    // `Unmatched > 0` is on by default and does hide records, so the More chip says so.
    expect(row).toContain('More (1)');
  });

  /**
   * Requirement 2.3: the type-ahead narrows the location **options** so one can be picked. It is a
   * selection aid for the filter and never a search of the cards — nothing on this screen searches
   * record text.
   */
  it('narrows the location options as the operator types, and never the records', async () => {
    const component = await mount('supply');

    expect(component.visibleLocations().map((option) => option.label)).toEqual([
      'Alford Farms HQ',
      'Bracken Downs',
      'Cairnbrae Station',
    ]);

    component.setLocationQuery('brack');
    await fixture.whenStable();

    expect(component.visibleLocations().map((option) => option.label)).toEqual(['Bracken Downs']);

    // Case-insensitive, and a miss says so rather than silently offering everything.
    component.setLocationQuery('ZZZ');

    expect(component.visibleLocations()).toEqual([]);
    expect(component.hiddenLocationCount()).toBe(0);
  });

  it('toggles a filter through the store rather than holding its own copy', async () => {
    const component = await mount('demand');
    const preferences = TestBed.inject(MatchingPreferences);

    component.toggleStatus('Cancelled');

    expect(preferences.demandFilters().statuses).toEqual(['Booked', 'Cancelled']);

    component.toggleStatus('Booked');

    expect(preferences.demandFilters().statuses).toEqual(['Cancelled']);
  });

  /**
   * The narrowing requirements 1.2 and 1.4 ask for, through the control rather than the helper:
   * choosing a processor must take the other processors' plants and classes off the menus, and must
   * drop any that were already selected — otherwise the column empties for a reason no visible
   * control is showing.
   */
  it('narrows plant and stock class to the chosen processor, dropping what it takes away', async () => {
    const component = await mount('demand');
    const preferences = TestBed.inject(MatchingPreferences);

    component.togglePlant('Lorneville');
    component.toggleStockClass('Cattle');
    component.toggleProcessor('ANZCO');
    await fixture.whenStable();

    expect(component.demandOptions().plants).toEqual(['Rangitikei']);
    expect(component.demandOptions().stockClasses).toEqual(['Cows']);
    expect(preferences.demandFilters().plants).toEqual([]);
    expect(preferences.demandFilters().stockClasses).toEqual([]);
  });

  it('sorts within the week and says so on the control', async () => {
    const component = await mount('demand');
    const preferences = TestBed.inject(MatchingPreferences);

    const sortMenu = await openMenu('sort-control');

    expect(sortMenu).toContain('Sort within each week');

    component.selectSortField('quantityRequired');
    component.toggleSortDirection();
    await fixture.whenStable();

    expect(preferences.demandSort()).toEqual({ field: 'quantityRequired', direction: 'desc' });

    // The direction is said in the field's own words, not as `desc`.
    expect(component.sortSummary()).toBe('Most');
  });
});
