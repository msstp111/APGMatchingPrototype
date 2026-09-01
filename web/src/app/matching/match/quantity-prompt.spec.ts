import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { CreateMatchRequest, MatchProposalDto } from '../../api/models';
import { anAvailability, aSpace } from '../testing/dto-fixtures';
import { QuantityPrompt, QuantityPromptData } from './quantity-prompt';

describe('Quantity prompt', () => {
  const space = aSpace({
    stockClass: 'Cattle',
    processor: 'Alliance Group',
    unmatched: 20,
    weekCommencingLabel: '23-08-26',
  });
  const availability = anAvailability({
    stockClass: 'Bull',
    locationName: 'Totara Kauri Trust',
    unmatched: 142,
  });
  const proposal: MatchProposalDto = {
    isAllowed: true,
    refusalMessage: null,
    quantity: 20,
    maximum: 142,
    defaultPricePerKg: 5.1,
  };
  const close = vi.fn();

  async function mount(
    overrides: Partial<MatchProposalDto> = {},
    pair: QuantityPromptData['pair'] = { space, availability },
  ): Promise<ComponentFixture<QuantityPrompt>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [QuantityPrompt],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            pair,
            proposal: { ...proposal, ...overrides },
          } satisfies QuantityPromptData,
        },
        { provide: ApiClient, useValue: { transportCompanies: () => of(['Tussock Transport']) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(QuantityPrompt);
    await fixture.whenStable();

    return fixture;
  }

  beforeEach(() => {
    close.mockReset();
  });

  it('opens at the server default and names both stock classes', async () => {
    const fixture = await mount();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Match 20 head');
    expect(text).toContain('Cattle');
    expect(text).toContain('Bull');
    // The field is prefilled with the default, so the hint carries only the ceiling — and has to,
    // since a hint that wraps overflows Material's fixed-height subscript and paints over the actions.
    expect(text).toContain('max 142');
    expect(text).toContain('Default for Alliance Group · Cattle · w/c 23-08-26');
    expect(text).toContain('There is no mapping between them');
    expect(text).toContain('Transport company - can be added later');
  });

  /**
   * The price hint lives in the price field, where the field itself says which field it describes,
   * and it wraps to four lines there. What it must never do is name the *availability* record's stock
   * class: the price table is keyed on the Processor Space's (resolved question 7), and a lookup
   * against the wrong side returns a plausible number for the wrong animal.
   */
  it('names the price-table key off the space, never the availability record', async () => {
    const fixture = await mount(
      {},
      {
        space: aSpace({ processor: 'Alliance Group', stockClass: 'Cattle' }),
        availability: anAvailability({ stockClass: 'Mixed Cattle' }),
      },
    );

    const hint = [...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-hint')]
      .map((element) => element.textContent ?? '')
      .find((text) => text.includes('Default for'));

    expect(hint).toContain('Alliance Group');
    expect(hint).toContain('Cattle');
    expect(hint).not.toContain('Mixed Cattle');
  });

  it('omits the stock-class note when both records use the same class name', async () => {
    const fixture = await mount({}, {
      space: aSpace({ stockClass: 'Prime' }),
      availability: anAvailability({ stockClass: 'Prime' }),
    });

    expect(fixture.nativeElement.textContent).not.toContain('There is no mapping between them');
  });

  it('explains the cap instead of silently clamping', async () => {
    const fixture = await mount();
    const prompt = fixture.componentInstance;

    prompt.quantity.setValue(200);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(prompt.quantity.hasError('max')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Max is 142');
    expect(prompt.quantity.value).toBe(200);
  });

  it('lets the operator over-fill the space, which is below the availability cap', async () => {
    const fixture = await mount();
    const prompt = fixture.componentInstance;

    prompt.quantity.setValue(100);
    await fixture.whenStable();

    expect(prompt.quantity.valid).toBe(true);
    prompt.create();

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({ quantityMatched: 100 } satisfies Partial<CreateMatchRequest>),
    );
  });

  it('says when there is no default price rather than showing a zero', async () => {
    const fixture = await mount({ defaultPricePerKg: null });

    expect(fixture.nativeElement.textContent).toContain(
      'No default price for Alliance Group · Cattle · w/c 23-08-26',
    );
    expect(fixture.componentInstance.price.value).toBeNull();
  });

  it('treats a zero default price as a real default, not as missing', async () => {
    const fixture = await mount({ defaultPricePerKg: 0 });

    expect(fixture.nativeElement.textContent).toContain(
      'Default for Alliance Group · Cattle · w/c 23-08-26',
    );
    expect(fixture.nativeElement.textContent).not.toContain('No default price');
    expect(fixture.componentInstance.price.value).toBe(0);
  });

  it('creates nothing while the quantity is invalid', async () => {
    const fixture = await mount();

    fixture.componentInstance.quantity.setValue(0);
    fixture.componentInstance.create();

    expect(close).not.toHaveBeenCalled();
  });
});
