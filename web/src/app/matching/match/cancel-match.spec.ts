import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { aMatch } from '../testing/dto-fixtures';
import { CancelMatch } from './cancel-match';

describe('Cancel match', () => {
  const closed = vi.fn();

  async function mount(): Promise<ComponentFixture<CancelMatch>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CancelMatch],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: { match: aMatch({ id: 12, quantityMatched: 40 }) } },
        { provide: MatDialogRef, useValue: { close: closed } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CancelMatch);
    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  beforeEach(() => closed.mockReset());

  /** Exactly three, in the spec's words and the spec's order (design-system.md 15). */
  it('offers exactly the three cancellation reasons', async () => {
    const fixture = await mount();
    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('mat-radio-button'),
    ].map((option) => option.textContent?.trim());

    expect(labels).toEqual([
      'Change from Agent/Farmer',
      'Change from Processor',
      'Internal decision by APG',
    ]);
  });

  it('preselects nothing, because a default reason is a reason nobody chose', async () => {
    const fixture = await mount();

    expect(fixture.componentInstance.reason()).toBeNull();
  });

  /**
   * The title is the instruction. With a reason required, nothing preselected and the action disabled
   * until one is chosen, it leaves nothing for a separate prompt beside the button to add.
   */
  it('asks for the reason in its title', async () => {
    const fixture = await mount();
    const title = (fixture.nativeElement as HTMLElement).querySelector('[mat-dialog-title]');

    expect(title?.textContent?.trim()).toBe('Select reason for cancellation');
  });

  it('will not proceed without a reason', async () => {
    const fixture = await mount();

    fixture.componentInstance.cancelMatch();

    expect(closed).not.toHaveBeenCalled();
  });

  it('closes with the chosen reason', async () => {
    const fixture = await mount();

    fixture.componentInstance.reason.set('InternalDecisionByApg');
    fixture.componentInstance.cancelMatch();

    expect(closed).toHaveBeenCalledWith('InternalDecisionByApg');
  });
});
