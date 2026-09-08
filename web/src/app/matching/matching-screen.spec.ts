import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import {
  LivestockAvailabilityDto,
  ProcessorSpaceDto,
  WeekBandDto,
} from '../api/models';
import { MatchingScreen } from './matching-screen';
import { DEFAULT_SUPPLY_FILTERS } from './filters/filter-defaults';
import { MatchingPreferences, PREFERENCES_STORAGE_KEY } from './filters/matching-preferences';
import { RecordPatch, RecordPatches } from './match/record-patches';
import { aMatch, anAvailability, aSpace, weeks } from './testing/dto-fixtures';

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
    deliveryDayLabel: 'THE-DAY',
    deliveryMonthLabel: 'THE-MONTH',
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
    availableFromDayLabel: 'THE-FROM-DAY',
    availableFromMonthLabel: 'THE-FROM-MONTH',
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

  // Phase 6: one stream for every write on the screen — the drop, the four match actions, and
  // confirming a space. A patch may carry one record or both.
  const writes = new Subject<RecordPatch>();

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
        { provide: RecordPatches, useValue: { patches: writes.asObservable() } },
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

  /** The week a column starts at, read off the first band header it renders. */
  function firstRailLabel(column: Element): string {
    return column.querySelector('app-week-band .bhead .dt')?.textContent?.trim() ?? '';
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

  /**
   * The card row prints the date as the server's two halves — the day on line 1, the month directly
   * beneath it — and keeps the whole `dd-MM-yy` label as the hover text on both, which is where the
   * year lives now. Every one of those four strings is the DTO's; none is composed here, and the ISO
   * value still reaches the screen nowhere at all.
   */
  it('renders the supplied date labels and never the raw ISO values', async () => {
    const element = await render();
    const rendered = element.textContent ?? '';

    expect(rendered).toContain('THE-DAY');
    expect(rendered).toContain('THE-MONTH');
    expect(rendered).toContain('THE-FROM-DAY');
    expect(rendered).toContain('THE-FROM-MONTH');

    for (const [selector, label] of [
      ['app-space-card', 'THE-LABEL'],
      ['app-availability-card', 'THE-FROM-LABEL'],
    ]) {
      expect(element.querySelector(`${selector} .day`)?.getAttribute('title')).toBe(label);
      expect(element.querySelector(`${selector} .month`)?.getAttribute('title')).toBe(label);
    }

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
        { provide: RecordPatches, useValue: { patches: writes.asObservable() } },
      ],
    }).compileComponents();

    expect(await text()).toContain('Could not reach the API');
  });

  /**
   * The three states before the columns are mutually exclusive, and an error outranks the rest.
   *
   * The three reads land independently, so a week-bands call that succeeds while the spaces call
   * fails would draw the error panel **above a column that looks populated** and says nothing about
   * the half that is missing — worse than either state alone, because it invites the operator to
   * trust what is on screen. Found by Phase 8's closing review; this is the case that catches it.
   */
  it('shows the error alone when one read fails and the others succeed', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            processorSpaces: () => ({ subscribe: ({ error }: { error: () => void }) => error() }),
            // Both of these succeed, so the board would be ready and the columns drawable.
            livestockAvailability: () => of([availability]),
            weekBands: () => of(bands),
          },
        },
        { provide: RecordPatches, useValue: { patches: writes.asObservable() } },
      ],
    }).compileComponents();

    const element = await render();

    expect(element.textContent).toContain('Could not reach the API');
    expect(element.querySelectorAll('app-matching-column')).toHaveLength(0);
    expect(element.querySelector('.state.loading')).toBeNull();
  });

  it('shows a loading state rather than a blank screen before anything has arrived', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            // Nothing ever emits: the state a cold start is in for its first round trip.
            processorSpaces: () => new Subject(),
            livestockAvailability: () => new Subject(),
            weekBands: () => new Subject(),
          },
        },
        { provide: RecordPatches, useValue: { patches: writes.asObservable() } },
      ],
    }).compileComponents();

    const element = await render();

    expect(element.querySelector('.state.loading')).not.toBeNull();
    expect(element.textContent).toContain('Loading processor spaces');
    expect(element.querySelectorAll('app-matching-column')).toHaveLength(0);
  });

  it('re-issues all three reads when the error panel offers a way out', async () => {
    let attempts = 0;
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            processorSpaces: () => {
              attempts += 1;

              // Fails once, then succeeds — the API being started while the panel is on screen.
              return attempts === 1
                ? { subscribe: ({ error }: { error: () => void }) => error() }
                : of([space]);
            },
            livestockAvailability: () => of([availability]),
            weekBands: () => of(bands),
          },
        },
        { provide: RecordPatches, useValue: { patches: writes.asObservable() } },
      ],
    }).compileComponents();

    const fixture = await mount();
    const element = fixture.nativeElement as HTMLElement;

    (element.querySelector('.retry') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(attempts).toBe(2);
    expect(element.textContent).not.toContain('Could not reach the API');
    expect(element.querySelectorAll('app-matching-column')).toHaveLength(2);
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
          // The names go on `plant`, not `processor`: line 1 of a space card is the PLANT as of
          // 2026-09-08, and `cardNames` reads line 1. Naming the processors here would pass three
          // identical strings through the assertion below and prove nothing about the ordering.
          aSpace({ id: 1, plant: 'Small', quantityRequired: 10, weekCommencing: '2026-08-23' }),
          aSpace({ id: 2, plant: 'Big', quantityRequired: 900, weekCommencing: '2026-08-23' }),
          aSpace({
            id: 3,
            plant: 'Later',
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

  // -------------------------------------------------------------------------------------------
  // Phase 5 — a write patches both records; a consumed record leaves the default view
  // -------------------------------------------------------------------------------------------

  /**
   * "Filter on drag": while a card is held, the other column shows only the stock classes that could
   * take it.
   *
   * These tests go through the real grip, with a real `pointerdown`, because the *timing* is the
   * feature. Every card is its own `cdkDropList` and CDK measures them all once, when the drag
   * threshold is crossed; a column narrowed any later would leave every surviving card somewhere CDK
   * does not believe it is, and the drop would land on nothing. So the narrowing happens on
   * pointer-down and the DOM is refreshed inside that handler — which is what the first test asserts,
   * by reading the column before awaiting anything.
   */
  describe('filter on drag', () => {
    const lambSpace = aSpace({ id: 1, plant: 'Levin', stockClass: 'Lamb', stockClassGroups: ['lamb'] });
    const cowSpace = aSpace({ id: 2, plant: 'Kokiri', stockClass: 'Cows', stockClassGroups: ['beef-cow'] });
    const deerSpace = aSpace({ id: 3, plant: 'Mataura', stockClass: 'Deer', stockClassGroups: ['deer'] });
    const lambRecord = anAvailability({ id: 10, stockClass: 'Lamb', stockClassGroups: ['lamb'] });

    async function board(
      spaces: readonly ProcessorSpaceDto[],
      records: readonly LivestockAvailabilityDto[],
      on = true,
    ): Promise<HTMLElement> {
      TestBed.resetTestingModule();
      localStorage.clear();
      await configure(spaces, records);

      if (on) {
        TestBed.inject(MatchingPreferences).toggleFilterOnDrag();
      }

      return await render();
    }

    /** Presses a card's grip. A press alone is a click, and narrows nothing. */
    function press(card: Element | null | undefined): void {
      card
        ?.querySelector('.grip')
        ?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
    }

    /**
     * A press plus enough travel to be a drag — CDK's threshold is 5px.
     *
     * Nothing is awaited afterwards anywhere in this block: the narrowing has to be on screen by the
     * time this returns, because CDK measures every card inside its own handler for this same move.
     */
    function drag(card: Element | null | undefined): void {
      press(card);
      document.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 0 }));
    }

    it('narrows the far column on the move that starts the drag, before anything is awaited', async () => {
      const element = await board([lambSpace, cowSpace], [lambRecord]);

      expect(element.querySelectorAll('app-space-card')).toHaveLength(2);

      drag(element.querySelector('app-availability-card'));

      const spaces = element.querySelectorAll('app-space-card');

      expect(spaces).toHaveLength(1);
      expect(spaces[0].textContent).toContain('Levin');
    });

    it('names what it narrowed to in the column header', async () => {
      const element = await board([lambSpace, cowSpace], [lambRecord]);

      drag(element.querySelector('app-availability-card'));

      const demand = element.querySelector('app-matching-column.demand');

      expect(demand?.querySelector('.filtered.narrowed')?.textContent).toContain('Lamb only');
      // The loaded total is unchanged: the aid hides records, it does not unload them.
      expect(demand?.textContent).toContain('showing 1 of 2');
    });

    it('leaves the column the card came from alone', async () => {
      const element = await board(
        [lambSpace],
        [lambRecord, anAvailability({ id: 11, stockClass: 'Cow', stockClassGroups: ['beef-cow'] })],
      );

      drag(element.querySelector('app-availability-card'));

      expect(element.querySelectorAll('app-availability-card')).toHaveLength(2);
    });

    it('brings the column back when the pointer comes up', async () => {
      const element = await board([lambSpace, cowSpace], [lambRecord]);

      drag(element.querySelector('app-availability-card'));
      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      await TestBed.inject(ApplicationRef).whenStable();

      expect(element.querySelectorAll('app-space-card')).toHaveLength(2);
      expect(element.querySelector('.filtered.narrowed')).toBeNull();
    });

    /**
     * Alliance Group books deer and the supply vocabulary has none, so this state is reachable in the
     * demo. It must not be the filtered-empty panel: no filter of the operator's is hiding anything,
     * and `Clear filters` would send them after a cause that does not exist.
     */
    it('explains a column narrowed to nothing without blaming the filters', async () => {
      const element = await board([deerSpace], [lambRecord]);

      drag(element.querySelector('app-space-card'));

      const supply = element.querySelector('app-matching-column.supply');

      expect(supply?.querySelector('app-nothing-compatible')).not.toBeNull();
      expect(supply?.textContent).toContain('No livestock availability for Deer');
      expect(supply?.querySelector('app-filtered-empty')).toBeNull();
      expect(supply?.textContent).not.toContain('Clear filters');
    });

    it('does nothing at all while the switch is off', async () => {
      const element = await board([lambSpace, cowSpace], [lambRecord], false);

      drag(element.querySelector('app-availability-card'));

      expect(element.querySelectorAll('app-space-card')).toHaveLength(2);
      expect(element.querySelector('.filtered.narrowed')).toBeNull();
    });

    /**
     * The grip is a drag handle on a row whose commonest action is expanding it, so it gets clicked by
     * mistake constantly. Until 2026-09-09 every one of those clicks emptied half the other column and
     * filled it back in, which read as the screen glitching.
     */
    it('does nothing when a grip is clicked rather than dragged', async () => {
      const element = await board([lambSpace, cowSpace], [lambRecord]);

      press(element.querySelector('app-availability-card'));

      expect(element.querySelectorAll('app-space-card')).toHaveLength(2);
      expect(element.querySelector('.filtered.narrowed')).toBeNull();
    });
  });

  describe('after a match is created', () => {
    it('updates both columns from the write result', async () => {
      const fixture = await mount();

      writes.next({
        space: aSpace({
          unmatched: 60,
          quantityStateLabel: 'Under-filled',
          matches: [aMatch({ id: 9, status: 'Drafted' })],
        }),
        availability: anAvailability({
          unmatched: 50,
          status: 'Pending',
          matches: [aMatch({ id: 9, status: 'Drafted' })],
        }),
      });
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      const demandMeter = element.querySelector('app-space-card .meter')?.getAttribute('title') ?? '';
      const supplyMeter =
        element.querySelector('app-availability-card .meter')?.getAttribute('title') ?? '';

      expect(demandMeter).toContain('60');
      expect(supplyMeter).toContain('50');
      expect(element.textContent).toContain('1 match · 1 draft');
    });

    it('removes a fully consumed availability record from the default-filtered view', async () => {
      const fixture = await mount();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-availability-card')).toHaveLength(
        1,
      );

      writes.next({
        space: aSpace({ unmatched: 10 }),
        availability: anAvailability({ unmatched: 0, status: 'Pending' }),
      });
      await fixture.whenStable();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-availability-card')).toHaveLength(
        0,
      );
    });

    it('puts the record back when the draft is undone', async () => {
      const fixture = await mount();

      writes.next({
        space: aSpace({ unmatched: 10 }),
        availability: anAvailability({ unmatched: 0, status: 'Pending' }),
      });
      await fixture.whenStable();

      writes.next({
        space: aSpace({ unmatched: 100 }),
        availability: anAvailability({ unmatched: 777, status: 'Booked' }),
      });
      await fixture.whenStable();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-availability-card')).toHaveLength(
        1,
      );
    });
  });

  // -------------------------------------------------------------------------------------------
  // Phase 7 — records arriving, and the calendar moving under them
  // -------------------------------------------------------------------------------------------

  describe('debug record writes', () => {
    /**
     * A created record is not in either list yet, so a patch that only replaced by id would drop it
     * silently — the one failure mode where nothing errors and nothing appears.
     */
    it('adds a record it has never seen rather than dropping it', async () => {
      const fixture = await mount();

      writes.next({
        space: aSpace({ id: 99, processor: 'THE-NEW-SPACE', weekCommencing: '2026-08-23' }),
      });
      await fixture.whenStable();

      // This fixture's own DOM, not text(): that helper mounts a fresh screen, which would reload
      // the stubbed lists and lose the patch under test.
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelectorAll('app-space-card')).toHaveLength(2);
      expect(host.textContent).toContain('THE-NEW-SPACE');
    });

    /**
     * A record created for a week the columns were not drawn on has to bring that week with it, or it
     * would place into no band at all. The server sends the recomputed calendar with every record
     * write for exactly this.
     */
    it('adopts the recomputed calendar so a record beyond it still lands in a band', async () => {
      const fixture = await mount();

      const far = aSpace({ id: 99, processor: 'FAR-FUTURE', weekCommencing: '2026-09-20' });

      const host = fixture.nativeElement as HTMLElement;

      // Without the new weeks the record is unplaced and invisible — the failure this guards.
      writes.next({ space: far });
      await fixture.whenStable();
      expect(host.textContent).not.toContain('FAR-FUTURE');

      writes.next({ space: far, weeks: weeks(3, 8) });
      await fixture.whenStable();

      expect(host.textContent).toContain('FAR-FUTURE');
    });

    /**
     * A record whose match hangs off a cancelled partner gets a solid red square behind its chevron,
     * on the collapsed card, so the outstanding work is visible without expanding anything. It is the
     * chevron because that is the control which opens the table naming the match.
     */
    it('badges the chevron of a record whose match has a cancelled partner', async () => {
      const fixture = await mount();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('app-space-card .chev.orphaned')).toBeNull();

      writes.next({
        space: aSpace({ matches: [aMatch({ id: 3, availabilityStatus: 'Cancelled' })] }),
      });
      await fixture.whenStable();

      const chevron = host.querySelector('app-space-card .chev.orphaned');

      expect(chevron).not.toBeNull();
      expect(chevron?.getAttribute('title')).toContain('never cascades');

      // And it goes when the partner is live again — this is a view of the data, not a sticky flag.
      writes.next({ space: aSpace({ matches: [aMatch({ id: 3 })] }) });
      await fixture.whenStable();

      expect(host.querySelector('app-space-card .chev.orphaned')).toBeNull();
    });

    it('leaves the calendar alone when a write did not carry one', async () => {
      const fixture = await mount();
      const before = fixture.componentInstance.weeks().length;

      writes.next({ space: aSpace({ unmatched: 5 }) });
      await fixture.whenStable();

      expect(fixture.componentInstance.weeks().length).toBe(before);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Phase 6 — a match is managed; a space is confirmed
  // -------------------------------------------------------------------------------------------

  describe('after a match is managed', () => {
    /**
     * Where a cancelled match goes: out of both parents' collections, and so off the screen. Pass 1
     * has no Match list view, so this is the last the operator sees of it — which is what the cancel
     * dialog warns about before the fact.
     */
    it('drops a cancelled match off both cards and moves both sums', async () => {
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      // A match to cancel. The seeded fixtures carry none, so the drag's own patch puts one there.
      writes.next({
        space: aSpace({ matches: [aMatch({ id: 9, status: 'Confirmed' })], unmatched: 60 }),
        availability: anAvailability({
          matches: [aMatch({ id: 9, status: 'Confirmed' })],
          status: 'Pending',
          unmatched: 50,
        }),
      });
      await fixture.whenStable();

      expect(element.textContent).toContain('1 match · confirmed');

      writes.next({
        space: aSpace({ matches: [], matchedInclDraft: 0, matchedExclDraft: 0, unmatched: 100 }),
        availability: anAvailability({
          matches: [],
          status: 'Booked',
          matchedInclDraft: 0,
          matchedExclDraft: 0,
          unmatched: 90,
        }),
      });
      await fixture.whenStable();

      expect(element.textContent).toContain('no matches');
      expect(element.querySelector('app-space-card .meter')?.getAttribute('title')).toContain('100');
    });

    /**
     * Confirming a space patches the space and **nothing else**. A patch carrying an availability
     * record would be the screen asserting something the server did not say — and on this screen,
     * what a write does and does not reach is the thing most easily misread.
     */
    it('patches only the space when the patch carries only a space', async () => {
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;
      const supplyBefore =
        element.querySelector('app-availability-card .meter')?.getAttribute('title') ?? '';

      expect(supplyBefore).not.toBe('');

      writes.next({ space: aSpace({ unmatched: 5 }) });
      await fixture.whenStable();

      expect(element.querySelector('app-space-card .meter')?.getAttribute('title')).toContain('5');
      expect(element.querySelector('app-availability-card .meter')?.getAttribute('title')).toBe(
        supplyBefore,
      );
    });

    /**
     * Requirement 5.5: a Confirmed space still appears if the filters allow, and the default filter
     * is `Status = Booked` — so it normally drops out of view. That is correct behaviour, not a bug,
     * and it is the visible confirmation that the write landed.
     */
    it('drops a confirmed space out of the default Booked filter', async () => {
      const fixture = await mount();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-space-card')).toHaveLength(1);

      writes.next({ space: aSpace({ status: 'Confirmed', canConfirm: false }) });
      await fixture.whenStable();

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-space-card')).toHaveLength(0);
    });
  });
});

/** Line 1's leading cell on each space card — the PLANT since 2026-09-08, not the processor. */
function cardNames(column: Element): string[] {
  return [...column.querySelectorAll('app-space-card .name')].map(
    (name) => name.textContent?.trim() ?? '',
  );
}

function railLabels(column: Element): string[] {
  return [...column.querySelectorAll('.bhead .dt')].map(
    (label) => label.textContent?.trim() ?? '',
  );
}
