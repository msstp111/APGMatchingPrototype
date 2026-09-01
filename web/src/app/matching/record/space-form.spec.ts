import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProcessorSpaceDto, ReferenceDataDto } from '../../api/models';
import { aSpace } from '../testing/dto-fixtures';
import { SpaceForm, SpaceFormData, SpaceFormResult } from './space-form';

const REFERENCE: ReferenceDataDto = {
  processors: [
    { name: 'ANZCO', plants: ['Kokiri', 'Rangitikei'], stockClasses: ['Cows', 'Nat Beef - Ultra'] },
    { name: 'Alliance Group', plants: ['Lorneville'], stockClasses: ['Deer', 'Lamb'] },
  ],
  availabilityStockClasses: ['Prime', 'Sire Bull'],
  transactionTypes: ['FinanceStock', 'GrazingStock', 'Other'],
};

describe('Add and edit a processor space (debug form)', () => {
  const closed = vi.fn();

  async function mount(space: ProcessorSpaceDto | null): Promise<ComponentFixture<SpaceForm>> {
    TestBed.resetTestingModule();
    const data: SpaceFormData = { space, reference: REFERENCE };

    await TestBed.configureTestingModule({
      imports: [SpaceForm],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closed } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SpaceForm);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  beforeEach(() => closed.mockReset());

  it('marks itself as debug tooling rather than a real create form', async () => {
    const fixture = await mount(null);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('# DEMO DATA TOOL #');
    expect(text).toContain('not the farmer or agent submission form');
  });

  it('offers only the chosen processor own plants and stock classes', async () => {
    const fixture = await mount(null);

    fixture.componentInstance.form.controls.processor.setValue('ANZCO');
    fixture.componentInstance.onProcessorChange();
    await fixture.whenStable();

    expect(fixture.componentInstance.plants()).toEqual(['Kokiri', 'Rangitikei']);
    expect(fixture.componentInstance.stockClasses()).toEqual(['Cows', 'Nat Beef - Ultra']);
  });

  /**
   * The acceptance criterion this phase names by itself. A stale selection would not merely look
   * wrong: the control would still show `Lorneville` while the menu behind it no longer holds it, and
   * the form would submit a pairing that belongs to no processor.
   */
  it('clears a plant and a stock class the new processor does not have', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.processor.setValue('Alliance Group');
    fixture.componentInstance.onProcessorChange();
    form.controls.plant.setValue('Lorneville');
    form.controls.stockClass.setValue('Deer');
    await fixture.whenStable();

    form.controls.processor.setValue('ANZCO');
    fixture.componentInstance.onProcessorChange();
    await fixture.whenStable();

    expect(form.controls.plant.value).toBe('');
    expect(form.controls.stockClass.value).toBe('');
  });

  it('keeps a selection the new processor does still have', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    // Both lists hold `Lamb`; the two vocabularies overlap by coincidence, not by mapping.
    form.controls.processor.setValue('Alliance Group');
    fixture.componentInstance.onProcessorChange();
    form.controls.stockClass.setValue('Lamb');
    form.controls.processor.setValue('Alliance Group');
    fixture.componentInstance.onProcessorChange();
    await fixture.whenStable();

    expect(form.controls.stockClass.value).toBe('Lamb');
  });

  it('refuses to submit an incomplete or fractional record', async () => {
    const fixture = await mount(null);

    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();

    const form = fixture.componentInstance.form;

    form.controls.processor.setValue('ANZCO');
    fixture.componentInstance.onProcessorChange();
    form.controls.plant.setValue('Kokiri');
    form.controls.stockClass.setValue('Cows');
    form.controls.deliveryDate.setValue('2026-09-10');
    form.controls.quantityRequired.setValue(0.5);
    await fixture.whenStable();

    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();

    form.controls.quantityRequired.setValue(0);
    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();

    form.controls.quantityRequired.setValue(60);
    fixture.componentInstance.save();

    const result = closed.mock.calls[0][0] as SpaceFormResult;

    expect(result.action).toBe('create');
    expect(result.request).toMatchObject({
      processor: 'ANZCO',
      plant: 'Kokiri',
      stockClass: 'Cows',
      quantityRequired: 60,
      deliveryDate: '2026-09-10',
      // An empty box is no value, not "".
      deliveryTime: null,
      notes: null,
    });
  });

  it('accepts a date in the past, because APG enter records after the fact', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.processor.setValue('ANZCO');
    fixture.componentInstance.onProcessorChange();
    form.controls.plant.setValue('Kokiri');
    form.controls.stockClass.setValue('Cows');
    form.controls.quantityRequired.setValue(40);
    form.controls.deliveryDate.setValue('2020-01-05');
    await fixture.whenStable();

    fixture.componentInstance.save();

    expect((closed.mock.calls[0][0] as SpaceFormResult).request).toMatchObject({
      deliveryDate: '2020-01-05',
    });
  });

  /**
   * Requirement 4.2 lists five editable fields and neither the processor nor the stock class is among
   * them: they are what the meatworks booked. Rendering them read-only is what makes the
   * change-the-processor rule above unreachable on an edit, which is why it is asserted here too.
   */
  it('renders the processor and stock class read-only when editing', async () => {
    const fixture = await mount(aSpace({ id: 5, processor: 'ANZCO', stockClass: 'Cows' }));
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.fixed').length).toBe(2);
    expect(host.querySelector('.fixed')?.textContent).toContain('ANZCO');
    expect(host.textContent).toContain('Edit processor space #5');

    fixture.componentInstance.save();

    const result = closed.mock.calls[0][0] as SpaceFormResult;

    expect(result.action).toBe('update');
    expect(Object.keys(result.request)).not.toContain('processor');
    expect(Object.keys(result.request)).not.toContain('stockClass');
  });

  /**
   * Editing a cancelled record is permitted — the phase restricts editing by field, never by status —
   * but a cancelled record is off both default filters, so whoever opened this form may not have
   * registered that the card was struck through. Saying so is the whole of the guard.
   */
  it('says so when the space being edited is cancelled, and still lets it be edited', async () => {
    const fixture = await mount(aSpace({ id: 5, status: 'Cancelled' }));
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('This space is cancelled');
    expect(host.textContent).toContain('does not reinstate it');

    fixture.componentInstance.save();
    expect(closed).toHaveBeenCalled();
  });

  it('says nothing of the sort about a live space', async () => {
    const fixture = await mount(aSpace({ id: 5, status: 'Booked' }));

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('is cancelled');
  });

  it('says when a smaller quantity would leave the space over-filled, and still allows it', async () => {
    const fixture = await mount(aSpace({ id: 5, quantityRequired: 100, matchedInclDraft: 80 }));

    fixture.componentInstance.form.controls.quantityRequired.setValue(60);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.overFillCaption()).toContain('80 head matched');
    expect((fixture.nativeElement as HTMLElement).querySelector('.warn')).not.toBeNull();

    // A caption, not a validation failure: the form still submits.
    fixture.componentInstance.save();
    expect(closed).toHaveBeenCalled();
  });
});
