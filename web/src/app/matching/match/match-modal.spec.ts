import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchEditContextDto, MatchStatus } from '../../api/models';
import { aMatch, anAvailability, aSpace } from '../testing/dto-fixtures';
import { MatchModal, MatchModalResult } from './match-modal';

describe('Match modal', () => {
  const closed = vi.fn();

  function context(
    status: MatchStatus = 'Drafted',
    overrides: Partial<MatchEditContextDto> = {},
  ): MatchEditContextDto {
    return {
      match: aMatch({
        id: 12,
        status,
        quantityMatched: 295,
        pricePerKg: 6.1,
        transportCompany: 'Kaikoura Carriers',
      }),
      space: aSpace({ id: 4, quantityRequired: 400, unmatched: 105 }),
      availability: anAvailability({ id: 8, quantityAvailable: 472, unmatched: 177 }),
      // 177 unmatched + this match's own 295. Not the record's original 472 (resolved question 13).
      maximumQuantity: 472,
      ...overrides,
    };
  }

  async function mount(data: MatchEditContextDto): Promise<ComponentFixture<MatchModal>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MatchModal],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closed } },
        { provide: ApiClient, useValue: { transportCompanies: () => of(['Kaikoura Carriers']) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MatchModal);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  function buttons(fixture: ComponentFixture<MatchModal>): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-dialog-actions button')]
      .map((button) => button.textContent?.trim() ?? '')
      .filter((label) => label !== '');
  }

  beforeEach(() => closed.mockReset());

  // --- both parents, read-only ---------------------------------------------------------------------

  it('shows both parent records with their own quantities and unmatched figures', async () => {
    const fixture = await mount(context());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    // The id is its own span now, so textContent runs the two together. It has its own test below.
    expect(text).toContain('Processor Space');
    expect(text).toContain('Livestock Availability');
    expect(text).toContain('Originally required');
    expect(text).toContain('400');
    expect(text).toContain('Originally available');
    expect(text).toContain('472');
    expect(text).toContain('105');
    expect(text).toContain('177');
  });

  /**
   * The two vocabularies do not map, and a mismatched pair must never be presented as an error — so
   * the note is information, with no warning glyph and no amber (design-system.md 11.4.2).
   */
  it('states plainly that the two stock classes come from different lists', async () => {
    const fixture = await mount(context());
    const note = (fixture.nativeElement as HTMLElement).querySelector('.note');

    expect(note?.textContent).toContain('different stock-class lists');
    expect(note?.textContent).toContain('the judgement is yours');
  });

  it('says nothing about stock classes when the two happen to read the same', async () => {
    const fixture = await mount(
      context('Drafted', {
        space: aSpace({ id: 4, stockClass: 'Prime' }),
        availability: anAvailability({ id: 8, stockClass: 'Prime' }),
      }),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('.note')).toBeNull();
  });

  // --- the ceiling ----------------------------------------------------------------------------------

  /**
   * The requirements document says the availability record's *original* quantity, which would permit
   * the over-commit the pink state exists to flag. The note spells the real rule out on screen so the
   * question does not have to be asked.
   */
  it('spells the ceiling out as unmatched plus this match own quantity', async () => {
    const fixture = await mount(context());
    const notes = (fixture.nativeElement as HTMLElement).querySelector('.ceiling')?.textContent ?? '';

    expect(notes).toContain('Ceiling 472');
    expect(notes).toContain('177 unmatched');
    expect(notes).toContain('own 295');
  });

  /**
   * The price hint lives in the price field, where the field says which field it describes, and it is
   * allowed to wrap there. What it must never do is name the *availability* record's stock class: the
   * price table is keyed on the Processor Space's (resolved question 7), and a lookup against the
   * wrong side returns a plausible number for the wrong animal.
   */
  it('names the price-table key off the space, never the availability record', async () => {
    const fixture = await mount(
      context('Drafted', {
        space: aSpace({ id: 4, processor: 'ANZCO', stockClass: 'Nat Beef - Premium' }),
        availability: anAvailability({ id: 8, stockClass: 'GFNB premium' }),
      }),
    );

    const hint = [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-hint')]
      .map((element) => element.textContent ?? '')
      .find((text) => text.includes('Defaulted from'));

    expect(hint).toContain('ANZCO');
    expect(hint).toContain('Nat Beef - Premium');
    expect(hint).not.toContain('GFNB premium');
  });

  /**
   * "Livestock Availability #8" is a shade too long for half a 640px dialog. Truncating the kicker as
   * one string put the ellipsis on the number, leaving a block that named no record at all — so the
   * id is its own unshrinkable span.
   */
  it('keeps each record id out of the truncating part of its kicker', async () => {
    const fixture = await mount(context());
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.kicker .rid')].map(
      (span) => span.textContent?.trim(),
    );

    expect(ids).toEqual(['#4', '#8']);
  });

  it('refuses a quantity above the ceiling and below one head', async () => {
    const fixture = await mount(context());
    const modal = fixture.componentInstance;

    modal.quantity.setValue(473);
    expect(modal.quantity.invalid).toBe(true);

    modal.quantity.setValue(472);
    expect(modal.quantity.valid).toBe(true);

    modal.quantity.setValue(0);
    expect(modal.quantity.invalid).toBe(true);

    modal.quantity.setValue(1.5);
    expect(modal.quantity.invalid).toBe(true);
  });

  // --- the footer -----------------------------------------------------------------------------------

  /** Resolved question 3: delete for a mis-drag, cancel-with-reason for anything past it. Never both. */
  it('offers Delete draft and Confirm match on a drafted match, and no cancel', async () => {
    const labels = buttons(await mount(context('Drafted')));

    expect(labels).toContain('Delete draft');
    expect(labels).toContain('Confirm match');
    expect(labels).not.toContain('Cancel match…');
  });

  it('offers Cancel match on a confirmed match, and neither delete nor confirm', async () => {
    const labels = buttons(await mount(context('Confirmed')));

    expect(labels).toContain('Cancel match…');
    expect(labels).not.toContain('Delete draft');
    expect(labels).not.toContain('Confirm match');
  });

  it('closes with the action and the edited values', async () => {
    const fixture = await mount(context());
    const modal = fixture.componentInstance;

    modal.quantity.setValue(300);
    modal.price.setValue(7.25);
    modal.transport.setValue('  Rangiora Transport  ');
    modal.save();

    expect(closed).toHaveBeenCalledWith({
      action: 'save',
      request: {
        quantityMatched: 300,
        pricePerKg: 7.25,
        transportCompany: 'Rangiora Transport',
      },
    } satisfies MatchModalResult);
  });

  it('treats an emptied transport box as no carrier rather than an empty string', async () => {
    const fixture = await mount(context());

    fixture.componentInstance.transport.setValue('   ');
    fixture.componentInstance.save();

    expect(closed).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ transportCompany: null }),
      }),
    );
  });

  it('writes nothing when the quantity is invalid', async () => {
    const fixture = await mount(context());

    fixture.componentInstance.quantity.setValue(999);
    fixture.componentInstance.save();
    fixture.componentInstance.confirm();

    expect(closed).not.toHaveBeenCalled();
  });

  /** Nothing to save is not an error, so Save is inert rather than explained. */
  it('leaves Save inert until something differs', async () => {
    const fixture = await mount(context());

    expect(fixture.componentInstance.changed()).toBe(false);

    fixture.componentInstance.price.setValue(7.25);
    expect(fixture.componentInstance.changed()).toBe(true);
  });
});
