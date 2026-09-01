import {
  LivestockAvailabilityDto,
  MatchDto,
  ProcessorSpaceDto,
  WeekBandDto,
} from '../../api/models';

/**
 * DTO builders for the matching specs.
 *
 * Defaults plus overrides, because these interfaces carry twenty-odd fields and a spec that spells all
 * of them out obscures the two it actually cares about. Every default is deliberately *bland*: a spec
 * that depends on one has said so by overriding it.
 *
 * Nothing here is imported by application code.
 */

export function aWeek(weekCommencing: string, overrides: Partial<WeekBandDto> = {}): WeekBandDto {
  return {
    weekCommencing,
    weekCommencingLabel: `label-${weekCommencing}`,
    weekOfLabel: `of-${weekCommencing}`,
    isCurrentWeek: false,
    isPastWeek: false,
    ...overrides,
  };
}

/**
 * A contiguous run of bands with the one at `currentIndex` flagged as the current week and the ones
 * before it flagged past — the same shape `MatchingProjection.WeekBands` produces. Dates are the real
 * Sundays of August and September 2026, so a reader can check placement by eye.
 */
export function weeks(currentIndex: number, count = 6): WeekBandDto[] {
  const sundays = [
    '2026-08-02',
    '2026-08-09',
    '2026-08-16',
    '2026-08-23',
    '2026-08-30',
    '2026-09-06',
    '2026-09-13',
    '2026-09-20',
  ].slice(0, count);

  return sundays.map((sunday, index) =>
    aWeek(sunday, {
      isCurrentWeek: index === currentIndex,
      isPastWeek: index < currentIndex,
    }),
  );
}

export function aSpace(overrides: Partial<ProcessorSpaceDto> = {}): ProcessorSpaceDto {
  return {
    id: 1,
    processor: 'ANZCO',
    plant: 'Rangitikei',
    stockClass: 'Nat Beef - Premium',
    quantityRequired: 100,
    deliveryDate: '2026-08-27',
    deliveryDateLabel: '27-08-26',
    deliveryTime: 'Morning',
    notes: null,
    status: 'Booked',
    matchedInclDraft: 0,
    matchedExclDraft: 0,
    unmatched: 100,
    quantityState: 'Under',
    quantityStateLabel: 'Under-filled',
    weekCommencing: '2026-08-23',
    weekCommencingLabel: '23-08-26',
    canConfirm: false,
    // Not null: the default space has no matches, so Confirm is blocked and has to say why. A fixture
    // whose canConfirm and confirmBlockedReason disagreed would be a state the API cannot produce.
    confirmBlockedReason: 'Needs at least one confirmed match and no drafts',
    matches: [],
    ...overrides,
  };
}

export function anAvailability(
  overrides: Partial<LivestockAvailabilityDto> = {},
): LivestockAvailabilityDto {
  return {
    id: 1,
    stockClass: 'Prime',
    quantityAvailable: 90,
    locationId: 7,
    locationName: 'Alford Farms HQ',
    farmerId: 42,
    farmerName: 'Mark Dale',
    farmerMobile: '021 555 0100',
    availableFrom: '2026-08-24',
    availableFromLabel: '24-08-26',
    availableFromShortLabel: '24 Aug',
    availabilityDetails: null,
    transactionType: 'FinanceStock',
    notes: null,
    status: 'Booked',
    matchedInclDraft: 0,
    matchedExclDraft: 0,
    unmatched: 90,
    quantityState: 'Under',
    quantityStateLabel: 'Under-committed',
    weekCommencing: '2026-08-23',
    weekCommencingLabel: '23-08-26',
    matches: [],
    ...overrides,
  };
}

export function aMatch(overrides: Partial<MatchDto> = {}): MatchDto {
  return {
    id: 1,
    processorSpaceId: 1,
    livestockAvailabilityId: 1,
    quantityMatched: 40,
    pricePerKg: 6.45,
    transportCompany: 'Rangitane Transport',
    status: 'Confirmed',
    cancellationReason: null,
    createdAt: '2026-08-20T09:00:00+12:00',
    processor: 'ANZCO',
    plant: 'Rangitikei',
    spaceStockClass: 'Nat Beef - Premium',
    deliveryDate: '2026-08-27',
    deliveryDateLabel: '27-08-26',
    deliveryTime: 'Morning',
    farmerName: 'Mark Dale',
    locationName: 'Alford Farms HQ',
    availabilityStockClass: 'Prime',
    availabilityDetails: null,
    availableFrom: '2026-08-24',
    availableFromLabel: '24-08-26',
    ...overrides,
  };
}
