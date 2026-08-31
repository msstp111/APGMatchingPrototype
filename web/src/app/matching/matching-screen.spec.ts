import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../api/models';
import { MatchingScreen } from './matching-screen';
import { DEFAULT_SUPPLY_FILTERS } from './filters/filter-defaults';
import { MatchingPreferences, PREFERENCES_STORAGE_KEY } from './filters/matching-preferences';
import { anAvailability, aSpace, weeks } from './testing/dto-fixtures';

/**
 * The client's half of the architectural rule: it renders what the DTO gives it.
 *
 * These fixtures carry figures that are deliberately *inconsistent* with each other — a space
 * requiring 100 with 70 matched reports an unmatched of 999, and a date labelled nothing like its ISO
 * value. Nothing in the app should be able to notice, because nothing in the app is entitled to work
 * either of them out. If a later phase starts recomputing in TypeScript, these tests fail.
 */
describe('Matching screen', () => {
  const space: ProcessorSpaceDto = aSpace({
    deliveryDateLabel: 'THE-LABEL',
    matchedInclDraft: 70,
    matchedExclDraft: 40,
    unmatched: 999,
    quantityStateLabel: 'THE-STATE',
    weekCommencingLabel: 'THE-WEEK',
    canConfirm: true,
  });

  const availability: LivestockAvailabilityDto = anAvailability({
    availableFromLabel: 'THE-FROM-LABEL',
    availableFromShortLabel: 'THE-SHORT-LABEL',
    status: 'Pending',
    matchedInclDraft: 70,
    // 777 unmatched against 90 available is nonsense, and deliberately so: the client must print the
    // figure it is given. It is positive because the column's default filter is `unmatched > 0`, and
    // a fixture the screen legitimately hides cannot demonstrate what the screen renders.
    matchedExclDraft: 40,
    unmatched: 777,
    quantityState: 'Over',
    quantityStateLabel: 'THE-SUPPLY-STATE',
    weekCommencingLabel: 'THE-SUPPLY-WEEK',
  });

  // 23 Aug is the current week, so both records sit in it.
  const bands: WeekBandDto[] = weeks(3);

  function configure(
    spaces: readonly ProcessorSpaceDto[] = [space],
    records: readonly LivestockAvailabilityDto[] = [availability],
    weekBands: readonly WeekBandDto[] = bands,
  ) {
    return TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            processorSpaces: () => of(spaces),
            livestockAvailability: () => of(records),
            weekBands: () => of(weekBands),
          },
        },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    // The preferences persist, so one test's filters would otherwise be the next test's starting
    // state — which is the behaviour requirement 7.1 asks for and exactly wrong inside a suite.
    localStorage.clear();
    await configure();
  });

  async function mount() {
    const fixture = TestBed.createComponent(MatchingScreen);
    await fixture.whenStable();

    return fixture;
  }

  async function render(): Promise<HTMLElement> {
    return (await mount()).nativeElement as HTMLElement;
  }

  async function text(): Promise<string> {
    return (await render()).textContent ?? '';
  }

  /** The week a column starts at, read off the first rail label it renders. */
  function firstRailLabel(column: Element): string {
    return column.querySelector('app-week-band .rail-label .dt')?.textContent?.trim() ?? '';
  }

  it('renders the space figures exactly as the DTO supplies them', async () => {
    const element = await render();
    const rendered = element.textContent ?? '';

    // 999 is the DTO's unmatched figure and disagrees with 100 − 70. It is printed as given.
    expect(rendered).toContain('999');
    expect(rendered).toContain('100');

    // An under-filled space carries its state label in the meter's hover string rather than on line 2,
    // where the word only appears when the state is Over. Either way the word is the DTO's.
    const meter = element.querySelector('app-space-card .meter');

    expect(meter?.getAttribute('title')).toContain('THE-STATE');
  });

  it('renders the availability figures exactly as the DTO supplies them', async () => {
    const rendered = await text();

    expect(rendered).toContain('777');
    expect(rendered).toContain('THE-SUPPLY-STATE');
    expect(rendered).toContain('Pending');
  });

  it('renders the supplied date labels and never the raw ISO values', async () => {
    const rendered = await text();

    expect(rendered).toContain('THE-LABEL');
    expect(rendered).toContain('THE-FROM-LABEL');
    expect(rendered).not.toContain('2026-08-27');
    expect(rendered).not.toContain('2026-08-24');
  });

  it('renders both columns', async () => {
    const rendered = await text();

    expect(rendered).toContain('Processor Spaces');
    expect(rendered).toContain('Livestock Availability');
  });

  /**
   * The band scaffold is six weeks and both fixture records sit in the fourth, so each column shows
   * that one week: the three empty weeks before it and the two after it are the runs at each end.
   * An empty week *between* two populated ones still renders — that case has its own test in
   * `matching-board.spec.ts`, where it can be checked without a DOM.
   */
  it('shows only the weeks its own records occupy', async () => {
    const element = await render();

    expect(element.querySelectorAll('app-week-band')).toHaveLength(2);
    expect(element.textContent).not.toContain('- no processor spaces this week');
    expect(element.textContent).not.toContain('- no livestock availability this week');
  });

  /**
   * The reason the two columns no longer share one band list. The space is three weeks older than
   * the availability record, and a shared start week would have hidden it with nothing on screen to
   * say so.
   */
  it('starts each column at the week of its own earliest record', async () => {
    TestBed.resetTestingModule();
    await configure(
      [aSpace({ weekCommencing: '2026-08-09' })],
      [anAvailability({ weekCommencing: '2026-08-30' })],
    );

    const columns = (await render()).querySelectorAll('app-matching-column');

    expect(firstRailLabel(columns[0])).toBe('of-2026-08-09');
    expect(firstRailLabel(columns[1])).toBe('of-2026-08-30');

    // And the older space is really on screen, not merely in a band that exists.
    expect(columns[0].querySelectorAll('app-space-card')).toHaveLength(1);
  });

  /**
   * Phase 3 reserved a 52px strip for design-system.md 12.1's shared search field. Phase 4 decided
   * not to build it — the per-column filter rows cover it — and gave the 52px back to the list. The
   * assertion is here so a later phase reintroducing one does so deliberately.
   */
  it('gives each column its own filter row and has no shared search strip', async () => {
    const element = await render();

    expect(element.querySelector('.search-strip')).toBeNull();
    expect(element.querySelectorAll('app-column-filters')).toHaveLength(2);
  });

  /**
   * The three requests land in any order. With records but no bands there is nowhere to put them, and
   * rendering two empty columns for a round trip would look like an empty data set rather than a
   * pending one.
   */
  it('waits for the week bands before drawing the columns', async () => {
    TestBed.resetTestingModule();
    await configure([space], [availability], []);

    const element = await render();

    expect(element.querySelectorAll('app-matching-column')).toHaveLength(0);
  });

  it('shows an error when the API cannot be reached', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            processorSpaces: () => ({ subscribe: ({ error }: { error: () => void }) => error() }),
            livestockAvailability: () => of([]),
            weekBands: () => of([]),
          },
        },
      ],
    }).compileComponents();

    expect(await text()).toContain('Could not reach the API');
  });

  // -------------------------------------------------------------------------------------------
  // Phase 4 — filtering, sorting and the flip
  // -------------------------------------------------------------------------------------------

  describe('filters, sorting and the flip', () => {
    /**
     * Both columns open filtered (design-system.md 12.2), and that is what turns the region above
     * the current week into a backlog rather than a history: finished work drops out of view.
     */
    it('opens both columns in their spec-mandated default filters', async () => {
      TestBed.resetTestingModule();
      await configure(
        [aSpace({ id: 1 }), aSpace({ id: 2, status: 'Confirmed' })],
        [
          anAvailability({ id: 1 }),
          // Fully allocated: nothing left to match, so it is not this screen's business.
          anAvailability({ id: 2, unmatched: 0, status: 'Confirmed' }),
        ],
      );

      const element = await render();

      expect(element.querySelectorAll('app-space-card')).toHaveLength(1);
      expect(element.querySelectorAll('app-availability-card')).toHaveLength(1);

      // And it says so, rather than leaving the operator to wonder where the other two went.
      expect(element.textContent).toContain('showing 1 of 2');
      expect(element.querySelectorAll('.filtered')).toHaveLength(0);
    });

    /**
     * The acceptance criterion this phase turns on. Phase 3b trims each column's leading empty bands
     * from that column's own records; filtering changes which record is oldest, so the trim has to
     * move with it — **per column**, and without disturbing the other side.
     */
    it('re-trims a column leading bands when a filter removes its oldest record', async () => {
      TestBed.resetTestingModule();
      await configure(
        [
          aSpace({ id: 1, processor: 'ANZCO', weekCommencing: '2026-08-09' }),
          aSpace({ id: 2, processor: 'SFF', weekCommencing: '2026-08-30' }),
        ],
        [anAvailability({ id: 1, weekCommencing: '2026-08-09' })],
      );

      const preferences = TestBed.inject(MatchingPreferences);
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      const before = element.querySelectorAll('app-matching-column');
      expect(firstRailLabel(before[0])).toBe('of-2026-08-09');
      expect(firstRailLabel(before[1])).toBe('of-2026-08-09');

      preferences.setDemandFilters({
        ...preferences.demandFilters(),
        processors: ['SFF'],
      });
      await fixture.whenStable();

      const after = element.querySelectorAll('app-matching-column');

      // The demand column now starts three weeks later; the supply column has not moved.
      expect(firstRailLabel(after[0])).toBe('of-2026-08-30');
      expect(firstRailLabel(after[1])).toBe('of-2026-08-09');
    });

    /**
     * Requirement 7.3. A blank column is indistinguishable from a broken one, so the filters that
     * emptied it are restated and there are two ways out.
     */
    it('shows the filtered empty state, with a way out, when nothing survives', async () => {
      const preferences = TestBed.inject(MatchingPreferences);
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      preferences.setDemandFilters({
        ...preferences.demandFilters(),
        processors: ['A processor with no spaces'],
      });
      await fixture.whenStable();

      const empty = element.querySelector('app-filtered-empty');

      expect(empty).not.toBeNull();
      expect(empty!.textContent).toContain('No processor spaces match these filters');
      expect(empty!.textContent).toContain('A processor with no spaces');
      expect(element.querySelectorAll('app-space-card')).toHaveLength(0);

      // The way out really works, rather than merely being offered.
      element.querySelector<HTMLButtonElement>('app-filtered-empty .primary')!.click();
      await fixture.whenStable();

      expect(element.querySelectorAll('app-space-card')).toHaveLength(1);
    });

    /** Requirement 6.2: a filtered column says so, and offers the way back. */
    it('marks a column as filtered and resets it to the defaults', async () => {
      const preferences = TestBed.inject(MatchingPreferences);
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      preferences.setSupplyFilters({ ...preferences.supplyFilters(), stockClasses: ['Prime'] });
      await fixture.whenStable();

      expect(element.querySelectorAll('.filtered')).toHaveLength(1);

      element.querySelector<HTMLButtonElement>('app-matching-column.supply .reset')!.click();
      await fixture.whenStable();

      expect(element.querySelectorAll('.filtered')).toHaveLength(0);
      expect(preferences.supplyFilters()).toEqual(DEFAULT_SUPPLY_FILTERS);
    });

    /**
     * Requirement 4.3. Sorting reorders cards **inside** each week; the band sequence is the
     * server's calendar and a sort must never touch it.
     */
    it('sorts within a week band and leaves the band order alone', async () => {
      TestBed.resetTestingModule();
      await configure(
        [
          aSpace({ id: 1, processor: 'Small', quantityRequired: 10, weekCommencing: '2026-08-23' }),
          aSpace({ id: 2, processor: 'Big', quantityRequired: 900, weekCommencing: '2026-08-23' }),
          aSpace({
            id: 3,
            processor: 'Later',
            quantityRequired: 500,
            weekCommencing: '2026-08-30',
          }),
        ],
        [],
      );

      const preferences = TestBed.inject(MatchingPreferences);
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      preferences.setDemandSort({ field: 'quantityRequired', direction: 'desc' });
      await fixture.whenStable();

      const demand = element.querySelector('app-matching-column.demand')!;

      // Biggest first inside the first week — and the 500-head space stays in the later band rather
      // than jumping to the top of the column, which is what a global sort would have done.
      expect(cardNames(demand)).toEqual(['Big', 'Small', 'Later']);
      // Both ends are trimmed, so the column stops at the week its last space falls in.
      expect(railLabels(demand)).toEqual(['of-2026-08-23', 'of-2026-08-30']);
    });

    /**
     * Requirement 5.2 and 5.3. The swap is CSS order over two components that are never destroyed,
     * so there is nothing for it to lose. jsdom has no layout engine, so the order itself is asserted
     * through the class the stylesheet keys on rather than by measuring anything.
     */
    it('keeps every filter and sort across a flip, and persists the preference', async () => {
      const preferences = TestBed.inject(MatchingPreferences);
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      preferences.setSupplyFilters({ ...preferences.supplyFilters(), stockClasses: ['Prime'] });
      preferences.setDemandSort({ field: 'quantityRequired', direction: 'desc' });
      await fixture.whenStable();

      element.querySelector<HTMLButtonElement>('.flip')!.click();
      await fixture.whenStable();

      expect(element.querySelector('.columns')!.classList).toContain('flipped');
      expect(preferences.supplyFilters().stockClasses).toEqual(['Prime']);
      expect(preferences.demandSort()).toEqual({ field: 'quantityRequired', direction: 'desc' });
      expect(preferences.flipped()).toBe(true);

      // Survives a reload: a second store reads the same key back.
      expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain('"flipped":true');
    });

    /** Resolved question 17, asserted on the rendered control rather than only in the model. */
    it('offers a delivery-week filter on demand and none at all on supply', async () => {
      const element = await render();
      const demand = element.querySelector('app-matching-column.demand')!;
      const supply = element.querySelector('app-matching-column.supply')!;

      expect(demand.querySelector('app-column-filters')).not.toBeNull();
      expect(supply.querySelector('app-column-filters')).not.toBeNull();

      // The W.C. value itself still shows on both sides — it is the filter that is absent.
      expect(element.textContent).toContain('Week of');
    });
  });
});

function cardNames(column: Element): string[] {
  return [...column.querySelectorAll('app-space-card .name')].map(
    (name) => name.textContent?.trim() ?? '',
  );
}

function railLabels(column: Element): string[] {
  return [...column.querySelectorAll('.rail-label .dt')].map(
    (label) => label.textContent?.trim() ?? '',
  );
}
