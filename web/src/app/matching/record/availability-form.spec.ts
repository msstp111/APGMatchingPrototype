import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LivestockAvailabilityDto, LocationOptionDto, ReferenceDataDto } from '../../api/models';
import { anAvailability } from '../testing/dto-fixtures';
import {
  AvailabilityForm,
  AvailabilityFormData,
  AvailabilityFormResult,
} from './availability-form';

const REFERENCE: ReferenceDataDto = {
  processors: [{ name: 'ANZCO', plants: ['Kokiri'], stockClasses: ['Cows', 'Nat Beef - Ultra'] }],
  availabilityStockClasses: ['GFNB ultra', 'Prime', 'Sire Bull'],
  transactionTypes: ['FinanceStock', 'GrazingStock', 'Other'],
};

const LOCATIONS: LocationOptionDto[] = [
  { id: 11, name: 'Alford Farms HQ', farmerName: 'Bruce McKenzie', farmerMobile: '021 555 0100' },
  { id: 12, name: 'Totara Kauri Trust', farmerName: 'Aroha Ngata', farmerMobile: '027 555 0111' },
];

describe('Add and edit a livestock availability record (debug form)', () => {
  const closed = vi.fn();

  async function mount(
    record: LivestockAvailabilityDto | null,
  ): Promise<ComponentFixture<AvailabilityForm>> {
    TestBed.resetTestingModule();
    const data: AvailabilityFormData = { record, reference: REFERENCE, locations: LOCATIONS };

    await TestBed.configureTestingModule({
      imports: [AvailabilityForm],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closed } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AvailabilityForm);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  beforeEach(() => closed.mockReset());

  it('marks itself as debug tooling, not the farmer or agent submission form', async () => {
    const fixture = await mount(null);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('# DEMO DATA TOOL #');
  });

  it('offers the single supply-side stock class list and no processor own classes', async () => {
    const fixture = await mount(null);
    const options = [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-select')];

    expect(fixture.componentInstance.data.reference.availabilityStockClasses).toContain(
      'Sire Bull',
    );
    // The two vocabularies do not map onto each other, so a demand class must never appear here.
    expect(fixture.componentInstance.data.reference.availabilityStockClasses).not.toContain(
      'Nat Beef - Ultra',
    );
    expect(options.length).toBeGreaterThan(0);
  });

  /** Requirement 3.3: one farmer per location, so choosing the location has chosen them. */
  it('resolves the farmer from the chosen location and shows them back', async () => {
    const fixture = await mount(null);

    fixture.componentInstance.onLocationPicked(LOCATIONS[1]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.farmer()?.farmerName).toBe('Aroha Ngata');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aroha Ngata');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('027 555 0111');
  });

  it('types ahead over the locations and drops the id when the text stops matching', async () => {
    const fixture = await mount(null);

    fixture.componentInstance.onLocationPicked(LOCATIONS[0]);
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.locationId.value).toBe(11);

    fixture.componentInstance.form.controls.locationSearch.setValue('Totara');
    fixture.componentInstance.onLocationTyped();
    await fixture.whenStable();

    // A half-typed name must not submit the last id that was picked.
    expect(fixture.componentInstance.form.controls.locationId.value).toBeNull();
    expect(fixture.componentInstance.locationOptions()).toEqual([LOCATIONS[1]]);
  });

  it('will not submit without a location picked from the list', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.stockClass.setValue('Prime');
    form.controls.quantityAvailable.setValue(200);
    form.controls.availableFrom.setValue('2026-09-06');
    form.controls.transactionType.setValue('GrazingStock');
    form.controls.locationSearch.setValue('Alford');
    await fixture.whenStable();

    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();

    fixture.componentInstance.onLocationPicked(LOCATIONS[0]);
    fixture.componentInstance.save();

    const result = closed.mock.calls[0][0] as AvailabilityFormResult;

    expect(result.action).toBe('create');
    expect(result.request).toMatchObject({
      stockClass: 'Prime',
      quantityAvailable: 200,
      locationId: 11,
      availableFrom: '2026-09-06',
      transactionType: 'GrazingStock',
    });
  });

  /**
   * The Purchase draw-down against `purchases.csv` is deferred past pass 1, so choosing Finance Stock
   * opens nothing. Asserted rather than assumed, because its absence is a requirement (3.6) and would
   * otherwise look like something half-built.
   */
  it('opens no purchase list when Finance Stock is chosen', async () => {
    const fixture = await mount(null);

    fixture.componentInstance.form.controls.transactionType.setValue('FinanceStock');
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent?.toLowerCase()).not.toContain('purchase');
    expect(host.querySelectorAll('mat-form-field').length).toBe(
      // Stock class, quantity, location, available from, transaction type, details, notes.
      7,
    );
  });

  /**
   * The one intended route to the pink Over-committed state (requirements 4.4 and 4.5). It warns and
   * it does not block: a farmer really can sell stock elsewhere after offering it.
   */
  it('warns when the new quantity is under what is matched, and still submits', async () => {
    const fixture = await mount(
      anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 124 }),
    );

    fixture.componentInstance.form.controls.quantityAvailable.setValue(100);
    await fixture.whenStable();
    fixture.detectChanges();

    const caption = fixture.componentInstance.overCommitCaption();

    expect(caption).toContain('124 head matched');
    expect(caption).toContain('over-committed');
    expect(caption).toContain('matches are not changed');
    expect((fixture.nativeElement as HTMLElement).querySelector('.warn')).not.toBeNull();

    fixture.componentInstance.save();

    expect((closed.mock.calls[0][0] as AvailabilityFormResult).request).toMatchObject({
      quantityAvailable: 100,
    });
  });

  it('says nothing when the quantity stays above what is matched', async () => {
    const fixture = await mount(
      anAvailability({ id: 6, quantityAvailable: 144, matchedInclDraft: 124 }),
    );

    fixture.componentInstance.form.controls.quantityAvailable.setValue(130);
    await fixture.whenStable();

    expect(fixture.componentInstance.overCommitCaption()).toBeNull();
  });

  it('says so when the record being edited is cancelled', async () => {
    const fixture = await mount(anAvailability({ id: 6, status: 'Cancelled' }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This record is cancelled',
    );
  });

  it('edits every attribute, unlike the demand side', async () => {
    const fixture = await mount(anAvailability({ id: 6 }));

    fixture.componentInstance.save();

    const result = closed.mock.calls[0][0] as AvailabilityFormResult;

    expect(result.action).toBe('update');
    expect(Object.keys(result.request).sort()).toEqual(
      [
        'availabilityDetails',
        'availableFrom',
        'locationId',
        'notes',
        'quantityAvailable',
        'stockClass',
        'transactionType',
      ].sort(),
    );
  });
});
