import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from '../api/models';
import { MatchingScreen } from './matching-screen';
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
    matchedExclDraft: 40,
    unmatched: -777,
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

    expect(rendered).toContain('-777');
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
   * Requirement 1.6. The band scaffold is six weeks and only one has records in it, so five headers
   * have to render anyway — a missing band would make two weeks look adjacent when they are not.
   */
  it('renders a band for every week, including the empty ones', async () => {
    const element = await render();

    // Six bands per column, two columns.
    expect(element.querySelectorAll('app-week-band')).toHaveLength(12);
    expect(element.textContent).toContain('- no processor spaces this week');
    expect(element.textContent).toContain('- no livestock availability this week');
  });

  it('reserves the search strip and the filter rows without putting controls in them', async () => {
    const element = await render();

    expect(element.querySelector('.search-strip')?.children).toHaveLength(0);
    expect(element.querySelectorAll('.filters')).toHaveLength(2);
    expect(element.querySelectorAll('.filters button')).toHaveLength(0);
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
  // Carry-over cards — the same record, drawn twice
  // -------------------------------------------------------------------------------------------

  describe('carry-over cards', () => {
    const match = aMatch({ id: 77, quantityMatched: 33, transportCompany: 'THE-CARRIER' });

    const carried = anAvailability({
      id: 5,
      weekCommencing: '2026-08-16',
      availableFromShortLabel: 'THE-ORIGIN',
      unmatched: 40,
      matches: [match],
    });

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await configure([], [carried]);
    });

    it('draws the full card in its home band and a 40px repeat in the later ones', async () => {
      const element = await render();

      // One full card. Four repeats: the current week and three more, capped by the horizon.
      expect(element.querySelectorAll('app-availability-card')).toHaveLength(1);
      expect(element.querySelectorAll('app-carry-over-card')).toHaveLength(3);
    });

    it('labels the repeat with where it came from', async () => {
      expect(await text()).toContain('since THE-ORIGIN');
    });

    /**
     * The point of the identity guarantee: expanding a repeat shows the same match rows as the home
     * card, because there is one object and one expansion component, not two of each.
     */
    it('shows the same match rows on a repeat as on the home card', async () => {
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLButtonElement>('app-carry-over-card .chev')!.click();
      await fixture.whenStable();

      const repeat = element.querySelector('app-carry-over-card app-card-expansion');

      expect(repeat).not.toBeNull();
      expect(repeat!.textContent).toContain('THE-CARRIER');
      expect(repeat!.textContent).toContain('33');
    });

    /**
     * Expansion is keyed per card, not per record. Expanding the repeat must not also expand the home
     * card: that would grow the list above the pointer and shift the very row being clicked
     * (Phase 3, 5.2).
     */
    it('expands only the card that was clicked, not every drawing of the record', async () => {
      const fixture = await mount();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLButtonElement>('app-carry-over-card .chev')!.click();
      await fixture.whenStable();

      expect(element.querySelectorAll('app-card-expansion')).toHaveLength(1);
      expect(element.querySelector('app-availability-card app-card-expansion')).toBeNull();
    });
  });
});
