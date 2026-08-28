import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../api/models';
import { MatchingScreen } from './matching-screen';

/**
 * The client's half of the architectural rule: it renders what the DTO gives it.
 *
 * These fixtures carry figures that are deliberately *inconsistent* with each other — a space
 * requiring 100 with 70 matched reports an unmatched of 999, and a date labelled nothing like its ISO
 * value. Nothing in the app should be able to notice, because nothing in the app is entitled to work
 * either of them out. If a later phase starts recomputing in TypeScript, these tests fail.
 */
describe('Matching screen', () => {
  const space: ProcessorSpaceDto = {
    id: 1,
    processor: 'ANZCO',
    plant: 'Rangitikei',
    stockClass: 'Nat Beef - Premium',
    quantityRequired: 100,
    deliveryDate: '2026-08-27',
    deliveryDateLabel: 'THE-LABEL',
    deliveryTime: 'Morning',
    notes: null,
    status: 'Booked',
    matchedInclDraft: 70,
    matchedExclDraft: 40,
    unmatched: 999,
    quantityState: 'Under',
    quantityStateLabel: 'THE-STATE',
    weekCommencing: '2026-08-23',
    weekCommencingLabel: 'THE-WEEK',
    canConfirm: true,
    matches: [],
  };

  const availability: LivestockAvailabilityDto = {
    id: 1,
    stockClass: 'Prime',
    quantityAvailable: 90,
    locationId: 7,
    locationName: 'Alford Farms HQ',
    farmerId: 42,
    farmerName: 'Mark Dale',
    farmerMobile: '021 555 0100',
    availableFrom: '2026-08-24',
    availableFromLabel: 'THE-FROM-LABEL',
    availabilityDetails: null,
    transactionType: 'FinanceStock',
    notes: null,
    status: 'Pending',
    matchedInclDraft: 70,
    matchedExclDraft: 40,
    unmatched: -777,
    quantityState: 'Over',
    quantityStateLabel: 'THE-SUPPLY-STATE',
    weekCommencing: '2026-08-23',
    weekCommencingLabel: 'THE-SUPPLY-WEEK',
    matches: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchingScreen],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ApiClient,
          useValue: {
            processorSpaces: () => of([space]),
            livestockAvailability: () => of([availability]),
          },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<string> {
    const fixture = TestBed.createComponent(MatchingScreen);
    await fixture.whenStable();

    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders the space figures exactly as the DTO supplies them', async () => {
    const text = await render();

    expect(text).toContain('999');
    expect(text).toContain('THE-STATE');
    expect(text).toContain('70');
    expect(text).toContain('40');
  });

  it('renders the availability figures exactly as the DTO supplies them', async () => {
    const text = await render();

    expect(text).toContain('-777');
    expect(text).toContain('THE-SUPPLY-STATE');
    expect(text).toContain('Pending');
  });

  it('renders the supplied date labels and never the raw ISO values', async () => {
    const text = await render();

    expect(text).toContain('THE-LABEL');
    expect(text).toContain('THE-WEEK');
    expect(text).toContain('THE-FROM-LABEL');
    expect(text).not.toContain('2026-08-27');
    expect(text).not.toContain('2026-08-23');
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
          },
        },
      ],
    }).compileComponents();

    expect(await render()).toContain('Could not reach the API');
  });
});
