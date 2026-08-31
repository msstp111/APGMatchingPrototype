import { buildBoard } from '../board/matching-board';
import { anAvailability, aSpace, weeks } from '../testing/dto-fixtures';
import {
  CLEARED_DEMAND_FILTERS,
  CLEARED_SUPPLY_FILTERS,
  DEFAULT_DEMAND_FILTERS,
  DEFAULT_DEMAND_SORT,
  DEFAULT_SUPPLY_FILTERS,
  DEFAULT_SUPPLY_SORT,
  DemandFilters,
  SupplyFilters,
} from './filter-defaults';
import {
  activeDemandFilters,
  activeSupplyFilters,
  demandMoreCount,
  filterAvailability,
  filterSpaces,
  isDemandDefault,
  isSupplyDefault,
  sortAvailability,
  sortSpaces,
  supplyMoreCount,
} from './filter-service';
import { demandFilterOptions, narrowDemandFilters, supplyFilterOptions } from './filter-options';

/**
 * Every filter in PHASE-4 sections 1 and 2, and every sort in section 4, over the pure functions the
 * screen composes.
 *
 * These are the acceptance criteria's "tests over the client-side filter service". They are pure
 * data in, pure data out: no TestBed, no DOM, no store.
 */
describe('Filtering', () => {
  const demand = (overrides: Partial<DemandFilters> = {}): DemandFilters => ({
    ...CLEARED_DEMAND_FILTERS,
    ...overrides,
  });

  const supply = (overrides: Partial<SupplyFilters> = {}): SupplyFilters => ({
    ...CLEARED_SUPPLY_FILTERS,
    ...overrides,
  });

  describe('Processor Spaces', () => {
    const spaces = [
      aSpace({
        id: 1,
        processor: 'ANZCO',
        plant: 'Rangitikei',
        stockClass: 'Cows',
        status: 'Booked',
      }),
      aSpace({
        id: 2,
        processor: 'Alliance Group',
        plant: 'Lorneville',
        stockClass: 'Cattle',
        status: 'Confirmed',
        weekCommencing: '2026-08-30',
        unmatched: 0,
      }),
      aSpace({ id: 3, processor: 'SFF', plant: 'Finegand', stockClass: 'Lambs', unmatched: 12 }),
    ];

    const ids = (filters: DemandFilters) => filterSpaces(spaces, filters).map((space) => space.id);

    it('filters by status (1.1)', () => {
      expect(ids(demand({ statuses: ['Confirmed'] }))).toEqual([2]);
      expect(ids(demand({ statuses: ['Booked', 'Confirmed'] }))).toEqual([1, 2, 3]);
    });

    it('filters by stock class (1.2)', () => {
      expect(ids(demand({ stockClasses: ['Cows', 'Lambs'] }))).toEqual([1, 3]);
    });

    it('filters by processor (1.3)', () => {
      expect(ids(demand({ processors: ['SFF'] }))).toEqual([3]);
    });

    it('filters by plant (1.4)', () => {
      expect(ids(demand({ plants: ['Lorneville'] }))).toEqual([2]);
    });

    it('filters by delivery week (1.5)', () => {
      expect(ids(demand({ weekCommencing: '2026-08-30' }))).toEqual([2]);
    });

    it('filters to spaces with unmatched quantity (1.6)', () => {
      expect(ids(demand({ hasUnmatched: true }))).toEqual([1, 3]);
    });

    it('treats an empty selection as no restriction rather than as matching nothing', () => {
      expect(ids(demand())).toEqual([1, 2, 3]);
    });

    it('applies the filters together, not as alternatives', () => {
      expect(ids(demand({ processors: ['ANZCO'], stockClasses: ['Lambs'] }))).toEqual([]);
    });

    it('opens on Booked only, per the spec default', () => {
      expect(ids(DEFAULT_DEMAND_FILTERS)).toEqual([1, 3]);
    });

    /**
     * The narrowing requirements 1.2 and 1.4 ask for: the demand stock-class lists are
     * processor-specific, so choosing a processor must narrow both menus to that processor's own
     * vocabulary.
     */
    it('narrows the plant and stock-class options to the selected processors', () => {
      const options = demandFilterOptions(spaces, demand({ processors: ['ANZCO'] }));

      expect(options.plants).toEqual(['Rangitikei']);
      expect(options.stockClasses).toEqual(['Cows']);

      // With no processor chosen, everything either side holds is on offer.
      expect(demandFilterOptions(spaces, demand()).processors).toEqual([
        'Alliance Group',
        'ANZCO',
        'SFF',
      ]);
    });

    /**
     * Choosing a processor drops the plants and classes it has just taken off the menu. Leaving them
     * would apply a filter no visible control still offers, and the column would empty for a reason
     * nothing on screen explains — a misleading view rather than an obviously empty one.
     */
    it('drops selections the processor filter has just taken off the menu', () => {
      const before = demand({
        processors: ['ANZCO'],
        plants: ['Lorneville'],
        stockClasses: ['Cattle'],
      });
      const after = narrowDemandFilters(before, spaces);

      expect(after.plants).toEqual([]);
      expect(after.stockClasses).toEqual([]);
      expect(after.processors).toEqual(['ANZCO']);
    });
  });

  describe('Livestock Availability', () => {
    const records = [
      anAvailability({
        id: 1,
        stockClass: 'Prime',
        locationId: 7,
        transactionType: 'FinanceStock',
      }),
      anAvailability({
        id: 2,
        stockClass: 'Lamb',
        locationId: 8,
        locationName: 'Bracken Downs',
        transactionType: 'GrazingStock',
        status: 'Pending',
        unmatched: 5,
      }),
      anAvailability({
        id: 3,
        stockClass: 'Cow',
        locationId: 9,
        transactionType: 'Other',
        status: 'Confirmed',
        unmatched: 0,
      }),
    ];

    const ids = (filters: SupplyFilters) =>
      filterAvailability(records, filters).map((record) => record.id);

    it('filters by status (2.1)', () => {
      expect(ids(supply({ statuses: ['Pending'] }))).toEqual([2]);
    });

    it('filters by stock class (2.2)', () => {
      expect(ids(supply({ stockClasses: ['Prime', 'Cow'] }))).toEqual([1, 3]);
    });

    it('filters by location (2.3)', () => {
      expect(ids(supply({ locationIds: [8] }))).toEqual([2]);
    });

    it('filters by transaction type (2.4)', () => {
      expect(ids(supply({ transactionTypes: ['FinanceStock', 'Other'] }))).toEqual([1, 3]);
    });

    it('filters to records with unmatched quantity (2.5)', () => {
      expect(ids(supply({ hasUnmatched: true }))).toEqual([1, 2]);
    });

    it('opens on Booked and Pending with unmatched quantity, per the spec default', () => {
      expect(ids(DEFAULT_SUPPLY_FILTERS)).toEqual([1, 2]);
    });

    /**
     * Requirement 2.3's type-ahead is a selection aid for the filter: it narrows the location
     * *options* so one can be picked, and never the cards.
     */
    it('offers every location as an option, by name', () => {
      const options = supplyFilterOptions(records);

      expect(options.locations.map((option) => option.label)).toContain('Bracken Downs');
      expect(options.locationNames.get(8)).toBe('Bracken Downs');
      expect(options.transactionTypes.map((option) => option.label)).toEqual([
        'Finance Stock',
        'Grazing Stock',
        'Other',
      ]);
    });

    it('never offers the demand side a supply stock class, or the reverse', () => {
      const supplyClasses = supplyFilterOptions(records).stockClasses;

      expect(supplyClasses).toEqual(['Cow', 'Lamb', 'Prime']);
      expect(supplyClasses).not.toContain('Cows');
    });
  });

  describe('what the operator is told', () => {
    it('counts the filters behind the More chip', () => {
      expect(demandMoreCount(DEFAULT_DEMAND_FILTERS)).toBe(0);
      expect(demandMoreCount(demand({ plants: ['Rangitikei'], hasUnmatched: true }))).toBe(2);

      // Processor and Location have chips of their own on the row, so they are not counted as
      // hidden behind More — a control has exactly one home.
      expect(demandMoreCount(demand({ processors: ['SFF'] }))).toBe(0);
      expect(supplyMoreCount(supply({ locationIds: [7] }))).toBe(0);

      // The supply column opens reading More (1): `unmatched > 0` is on, and it does hide records.
      expect(supplyMoreCount(DEFAULT_SUPPLY_FILTERS)).toBe(1);
    });

    it('restates the active filters in words, with the server label for a week', () => {
      const active = activeDemandFilters(
        demand({ statuses: ['Booked'], weekCommencing: '2026-08-23', hasUnmatched: true }),
        new Map([['2026-08-23', '23-08-26']]),
      );

      expect(active).toEqual([
        { label: 'Status', value: 'Booked' },
        { label: 'Delivery week', value: '23-08-26' },
        { label: 'Quantity unmatched', value: 'more than zero' },
      ]);
    });

    it('names a location rather than its id', () => {
      const active = activeSupplyFilters(
        supply({ locationIds: [8], transactionTypes: ['FinanceStock'] }),
        new Map([[8, 'Bracken Downs']]),
      );

      expect(active).toEqual([
        { label: 'Location', value: 'Bracken Downs' },
        { label: 'Transaction type', value: 'Finance Stock' },
      ]);
    });

    it('knows when a column is away from its defaults', () => {
      expect(isDemandDefault(DEFAULT_DEMAND_FILTERS, DEFAULT_DEMAND_SORT)).toBe(true);
      expect(isSupplyDefault(DEFAULT_SUPPLY_FILTERS, DEFAULT_SUPPLY_SORT)).toBe(true);

      expect(isDemandDefault(demand({ statuses: ['Booked'] }), DEFAULT_DEMAND_SORT)).toBe(true);
      expect(isDemandDefault(DEFAULT_DEMAND_FILTERS, { field: 'plant', direction: 'asc' })).toBe(
        false,
      );
      expect(isSupplyDefault(supply({ hasUnmatched: true }), DEFAULT_SUPPLY_SORT)).toBe(false);
    });

    /**
     * Selections compare as sets. Ticking Pending and then Booked leaves the supply default in a
     * different order, and an operator who has arrived back at the defaults by hand is at the
     * defaults — the `Filtered` chip must not claim otherwise.
     */
    it('treats a differently ordered selection of the same values as the default', () => {
      expect(
        isSupplyDefault(
          supply({ statuses: ['Pending', 'Booked'], hasUnmatched: true }),
          DEFAULT_SUPPLY_SORT,
        ),
      ).toBe(true);
    });
  });
});

describe('Sorting', () => {
  const spaces = [
    aSpace({
      id: 1,
      processor: 'Beta',
      quantityRequired: 50,
      deliveryDate: '2026-08-27',
      unmatched: 5,
    }),
    aSpace({
      id: 2,
      processor: 'alpha',
      quantityRequired: 900,
      deliveryDate: '2026-08-25',
      unmatched: 1,
    }),
    aSpace({
      id: 3,
      processor: 'Gamma',
      quantityRequired: 50,
      deliveryDate: '2026-08-26',
      unmatched: 9,
    }),
  ];

  const ids = (
    field: Parameters<typeof sortSpaces>[1]['field'],
    direction: 'asc' | 'desc' = 'asc',
  ) => sortSpaces(spaces, { field, direction }).map((space) => space.id);

  it('sorts by date, soonest first, by default', () => {
    expect(sortSpaces(spaces, DEFAULT_DEMAND_SORT).map((space) => space.id)).toEqual([2, 3, 1]);
  });

  it('reverses on request', () => {
    expect(ids('deliveryDate', 'desc')).toEqual([1, 3, 2]);
  });

  it('sorts by quantity, by unmatched and by name', () => {
    expect(ids('quantityRequired', 'desc')).toEqual([2, 1, 3]);
    expect(ids('unmatched')).toEqual([2, 1, 3]);

    // Case-insensitively: `alpha` belongs beside `Beta`, not before every capital letter.
    expect(ids('processor')).toEqual([2, 1, 3]);
  });

  /**
   * Ties break on id, ascending, whichever way the sort runs — so the order is the server's own for
   * records the field cannot separate, and two runs over the same data draw the same screen.
   */
  it('breaks ties on id, and does not reverse the tie-break', () => {
    expect(ids('quantityRequired')).toEqual([1, 3, 2]);
    expect(ids('quantityRequired', 'desc')).toEqual([2, 1, 3]);
  });

  it('sorts availability by its own fields', () => {
    const records = [
      anAvailability({ id: 1, locationName: 'Zenith', availableFrom: '2026-08-24' }),
      anAvailability({ id: 2, locationName: null, availableFrom: '2026-08-22' }),
      anAvailability({ id: 3, locationName: 'Alford', availableFrom: '2026-08-26' }),
    ];

    expect(sortAvailability(records, DEFAULT_SUPPLY_SORT).map((r) => r.id)).toEqual([2, 1, 3]);

    // A missing name sorts as an empty one rather than throwing or landing in the middle.
    expect(
      sortAvailability(records, { field: 'locationName', direction: 'asc' }).map((r) => r.id),
    ).toEqual([2, 3, 1]);
  });

  it('never mutates the list it was given', () => {
    const before = spaces.map((space) => space.id);
    sortSpaces(spaces, { field: 'quantityRequired', direction: 'desc' });

    expect(spaces.map((space) => space.id)).toEqual(before);
  });

  /**
   * Requirement 4.3, asserted where it actually matters: sorting happens on the flat list, and
   * `buildBoard` bands it afterwards, so a sort can only ever reorder cards **inside** a week. The
   * band sequence is the server's calendar and nothing here can touch it.
   */
  it('reorders cards inside each band and never reorders the bands', () => {
    const banded = [
      aSpace({ id: 1, quantityRequired: 10, weekCommencing: '2026-08-23' }),
      aSpace({ id: 2, quantityRequired: 900, weekCommencing: '2026-08-23' }),
      aSpace({ id: 3, quantityRequired: 500, weekCommencing: '2026-08-30' }),
    ];

    const sortedSpaces = sortSpaces(banded, { field: 'quantityRequired', direction: 'desc' });
    const board = buildBoard(weeks(3), sortedSpaces, []);

    expect(board.demand.map((band) => band.week.weekCommencing)).toEqual([
      '2026-08-23',
      '2026-08-30',
    ]);
    expect(board.demand[0].spaces.map((space) => space.id)).toEqual([2, 1]);
    expect(board.demand[1].spaces.map((space) => space.id)).toEqual([3]);
  });
});
