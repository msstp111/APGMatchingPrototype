import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProcessorSpaceDto, ReferenceDataDto, WeekOptionDto } from '../../api/models';
import { aSpace } from '../testing/dto-fixtures';
import { SpaceForm, SpaceFormData, SpaceFormResult } from './space-form';

/**
 * Three real weeks, shaped the way the server ships them: a Sunday, and its seven days each carrying
 * the ISO date the form submits. aSpace's default record is 27 August 2026 - a Thursday, index 4 - in
 * the week commencing the 23rd, which is why that week is the middle one here.
 *
 * Written out in full rather than generated, because a helper that added days to a date would be the
 * very arithmetic the two-control design exists to keep out of web/. If these dates are wrong the
 * tests fail; a wrong generator would agree with the bug.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKS: readonly WeekOptionDto[] = [
  aWeek('2026-08-16', ['16-08', '17-08', '18-08', '19-08', '20-08', '21-08', '22-08']),
  aWeek('2026-08-23', ['23-08', '24-08', '25-08', '26-08', '27-08', '28-08', '29-08']),
  aWeek('2026-08-30', ['30-08', '31-08', '01-09', '02-09', '03-09', '04-09', '05-09']),
];

/** Each day is written 'dd-MM'; the two forms of it on the wire are both derived from that string. */
function aWeek(commencing: string, days: readonly string[]): WeekOptionDto {
  return {
    weekCommencing: commencing,
    weekCommencingLabel: days[0] + '-26',
    isCurrentWeek: commencing === '2026-08-23',
    days: days.map((day, index) => ({
      date: '2026-' + day.slice(3) + '-' + day.slice(0, 2),
      weekdayLabel: WEEKDAYS[index],
      dateLabel: day + '-26',
    })),
  };
}

const REFERENCE: ReferenceDataDto = {
  processors: [
    { name: 'ANZCO', plants: ['Kokiri', 'Rangitikei'], stockClasses: ['Cows', 'Nat Beef - Ultra'] },
    { name: 'Alliance Group', plants: ['Lorneville'], stockClasses: ['Deer', 'Lamb'] },
  ],
  availabilityStockClasses: ['Prime', 'Sire Bull'],
  transactionTypes: ['FinanceStock', 'GrazingStock', 'Other'],
  weeks: WEEKS,
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
    form.controls.weekCommencing.setValue('2026-08-30');
    form.controls.weekday.setValue(4);
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
      // That week's Thursday, read straight off the server's own list. Nothing composed it.
      deliveryDate: '2026-09-03',
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
    // The earliest week the server offered, which is behind the current one. Nothing in the form
    // ranks the options: how far back the list reaches is the server's decision and the whole of it.
    form.controls.weekCommencing.setValue('2026-08-16');
    form.controls.weekday.setValue(0);
    await fixture.whenStable();

    fixture.componentInstance.save();

    expect((closed.mock.calls[0][0] as SpaceFormResult).request).toMatchObject({
      deliveryDate: '2026-08-16',
    });
  });

  /**
   * The pair's whole reason for being: the date is an index into a list the server sent. If this ever
   * needs a new Date to pass, the design has been lost.
   */
  it('composes the delivery date by looking the weekday up in the chosen week', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.weekCommencing.setValue('2026-08-23');
    form.controls.weekday.setValue(0);
    await fixture.whenStable();

    expect(fixture.componentInstance.deliveryDate()).toBe('2026-08-23');

    form.controls.weekday.setValue(6);
    await fixture.whenStable();

    expect(fixture.componentInstance.deliveryDate()).toBe('2026-08-29');
  });

  /**
   * Changing the week keeps the weekday, which is what makes "the same slot, a week later" one click.
   * It is also why the control holds an index rather than a date: a date would have to be recomputed
   * against the new week, and recomputing it is the one thing this form may not do.
   */
  it('carries the weekday across a change of week', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.weekCommencing.setValue('2026-08-23');
    form.controls.weekday.setValue(4);
    await fixture.whenStable();

    expect(fixture.componentInstance.deliveryDate()).toBe('2026-08-27');

    form.controls.weekCommencing.setValue('2026-08-30');
    await fixture.whenStable();

    expect(form.controls.weekday.value).toBe(4);
    expect(fixture.componentInstance.deliveryDate()).toBe('2026-09-03');
  });

  /** No week, no days - the same empty menu and hint the plant picker uses. */
  it('offers no weekday until a week is chosen', async () => {
    const fixture = await mount(null);

    expect(fixture.componentInstance.days()).toEqual([]);
    expect(fixture.componentInstance.deliveryDate()).toBeNull();

    fixture.componentInstance.form.controls.weekCommencing.setValue('2026-08-23');
    await fixture.whenStable();

    expect(fixture.componentInstance.days().length).toBe(7);
    expect(fixture.componentInstance.days()[0].weekdayLabel).toBe('Sun');
  });

  /** Half a date is no date, whatever the rest of the form says. */
  it('refuses to submit a week with no weekday', async () => {
    const fixture = await mount(null);
    const form = fixture.componentInstance.form;

    form.controls.processor.setValue('ANZCO');
    fixture.componentInstance.onProcessorChange();
    form.controls.plant.setValue('Kokiri');
    form.controls.stockClass.setValue('Cows');
    form.controls.quantityRequired.setValue(40);
    form.controls.weekCommencing.setValue('2026-08-23');
    await fixture.whenStable();

    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();
  });

  /**
   * An edit opens on the record's own date, decomposed the same way it is composed - by lookup. This
   * is the case the server's week list has to be wide enough for: a record whose week was left out of
   * it would open with an empty pair and could not be saved without moving the delivery date.
   */
  it('opens an edit on the week and weekday the record already holds', async () => {
    const fixture = await mount(aSpace({ id: 5 }));
    const form = fixture.componentInstance.form;

    // 27 August 2026 is the Thursday of the week commencing the 23rd.
    expect(form.controls.weekCommencing.value).toBe('2026-08-23');
    expect(form.controls.weekday.value).toBe(4);

    fixture.componentInstance.save();

    expect((closed.mock.calls[0][0] as SpaceFormResult).request).toMatchObject({
      deliveryDate: '2026-08-27',
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
