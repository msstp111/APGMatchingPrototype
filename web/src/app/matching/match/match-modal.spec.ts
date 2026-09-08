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
   * Supply above, demand below, with the arrow between them — the same order the drop prompt uses, so
   * the dialog that confirms a match reads the way the one that drafted it read. Asserted on DOM
   * order rather than on CSS, because nothing here reorders visually.
   */
  it('puts the availability record above the space, with an arrow between them', async () => {
    const fixture = await mount(context());
    const host = fixture.nativeElement as HTMLElement;

    const kickers = [...host.querySelectorAll('.rec .kicker .words')].map((element) =>
      element.textContent?.trim(),
    );

    expect(kickers).toEqual(['Livestock Availability', 'Processor Space']);
    expect(host.querySelector('.rec + .flow + .rec')).not.toBeNull();
  });

  /**
   * The stock-class commentary is gone (Mark's call, 2026-09-07). The classes themselves stay — in
   * each block's sub-line — because the operator still has to read them; it is the paragraph
   * explaining that the two lists do not map that no longer earns its place, the judgement having
   * been made at the prompt.
   */
  it('shows both stock classes but no longer comments on them', async () => {
    const fixture = await mount(context());
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';

    expect(text).toContain('Nat Beef - Premium');
    expect(text).toContain('Prime');
    expect(text).not.toContain('different stock-class lists');
    expect(host.querySelector('.note')).toBeNull();
  });

  // --- the title ------------------------------------------------------------------------------------

  /**
   * The title names the act and the slot: a draft is here to be confirmed, and past Drafted there is
   * nothing left to confirm. It is what tells this dialog from the drop prompt, which says
   * `Draft match — …`.
   *
   * The match id is deliberately not in it. It named a table row no operator sees, where the
   * processor and plant name the slot in front of them; both parent blocks still carry their own
   * record ids.
   */
  it('asks to confirm a draft, to edit anything past it, and names the space', async () => {
    const drafted = await mount(context('Drafted'));
    const draftedTitle =
      (drafted.nativeElement as HTMLElement).querySelector('[mat-dialog-title]')?.textContent ?? '';

    expect(draftedTitle).toContain('Confirm match: ANZCO Rangitikei');
    expect(draftedTitle).not.toContain('#12');

    const confirmed = await mount(context('Confirmed'));

    expect(
      (confirmed.nativeElement as HTMLElement).querySelector('[mat-dialog-title]')?.textContent,
    ).toContain('Edit match: ANZCO Rangitikei');
  });

  /**
   * The monogram badge came off the card rows as match noise, then off the dialogs, and in 2026-09-08
   * off the drag chip and out of the application. The blocks' sub-lines are now the only place either
   * class is stated, which is why this asserts they are both in the text.
   */
  it('names both stock classes, the only place either one is now stated', async () => {
    const fixture = await mount(context());
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Nat Beef - Premium');
    expect(host.textContent).toContain('Prime');
  });

  // --- the ceiling ----------------------------------------------------------------------------------

  /**
   * The requirements document says the availability record's *original* quantity, which would permit
   * the over-commit the pink state exists to flag. The note spells the real rule out on screen so the
   * question does not have to be asked.
   */
  /**
   * The ceiling sentence lives in the quantity field's own hint, not in a note under the row: the
   * field a sentence sits in is what says which field it is about, and this one constrains exactly
   * one. It replaced a bare `max 472`, which invited the very question the requirements document
   * answers wrongly — why not the record's *original* quantity?
   */
  it('spells the ceiling out in the quantity field own hint', async () => {
    const fixture = await mount(context());
    const host = fixture.nativeElement as HTMLElement;
    const hint = host.querySelector('.f-quantity mat-hint')?.textContent ?? '';

    expect(hint).toContain('Ceiling 472');
    expect(hint).toContain('177 unmatched');
    expect(hint).toContain('own 295');

    // And nowhere else: the note it used to sit in is gone, so the sentence cannot appear twice.
    expect(host.querySelector('.ceiling')).toBeNull();
  });

  /**
   * A wrapped hint has to push the dialog down rather than paint over it. That takes two things, and
   * only one of them is CSS: Material's hint wrapper is `position: absolute` inside a fixed-height
   * subscript unless the field is told otherwise, and `height: auto` cannot size to an absolutely
   * positioned child. jsdom has no layout, but it can see whether the attribute that switches it is
   * there — which is the half a stylesheet edit would silently drop.
   */
  it('lets every field subscript take real space, so a wrapped hint pushes rather than overlaps', async () => {
    const fixture = await mount(context());
    const host = fixture.nativeElement as HTMLElement;
    const fields = host.querySelectorAll('.fields mat-form-field');
    const dynamic = host.querySelectorAll('.fields .mat-mdc-form-field-subscript-dynamic-size');

    expect(fields.length).toBe(3);
    expect(dynamic.length).toBe(3);
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
   * Truncating the kicker as one string put the ellipsis on the number, leaving a block that named no
   * record at all — so the id is its own unshrinkable span. The blocks are full-width now that they
   * stack, but "Livestock Availability #8" still has to survive a narrow viewport.
   */
  it('keeps each record id out of the truncating part of its kicker', async () => {
    const fixture = await mount(context());
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.kicker .rid')].map(
      (span) => span.textContent?.trim(),
    );

    // Supply first, demand second — the order the blocks now stack in.
    expect(ids).toEqual(['#8', '#4']);
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
  /**
   * Both say `Cancel match`; the ellipsis is the only difference, and it is the whole difference —
   * the drafted one acts on the press, the other asks for a reason first.
   */
  it('offers Cancel match and Confirm match on a drafted match, and no reason-asking cancel', async () => {
    const labels = buttons(await mount(context('Drafted')));

    expect(labels).toContain('Cancel match');
    expect(labels).toContain('Confirm match');
    expect(labels).not.toContain('Cancel match…');
  });

  it('offers Cancel match… on a confirmed match, and neither delete nor confirm', async () => {
    const labels = buttons(await mount(context('Confirmed')));

    expect(labels).toContain('Cancel match…');
    expect(labels).not.toContain('Cancel match');
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
