import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchingPreferences } from '../../matching/filters/matching-preferences';
import { DemoReset } from '../demo-reset/demo-reset';
import { TopBar } from './top-bar';

/**
 * The top bar's two chrome controls, and specifically the one that has a state.
 *
 * "Filter on drag" is a toggle in a row of buttons, so the thing worth testing is that it reads as
 * one: pressed state exposed to assistive tech, filled while on, and the switch itself living in the
 * preference store rather than in this component — the matching screen is what acts on it, and a copy
 * of the state here is how the two would come to disagree.
 */
describe('Top bar', () => {
  async function mount() {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TopBar],
      providers: [
        provideZonelessChangeDetection(),
        // The reset opens a dialog and reloads the page. Neither belongs in this test, and the button
        // itself is one line either way.
        { provide: DemoReset, useValue: { confirmAndReset: () => undefined } },
      ],
    });

    const fixture = TestBed.createComponent(TopBar);
    await fixture.whenStable();

    return fixture;
  }

  function toggle(fixture: Awaited<ReturnType<typeof mount>>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.drag-filter')!;
  }

  it('offers the filter as a toggle, off to begin with', async () => {
    const fixture = await mount();
    const button = toggle(fixture);

    expect(button.textContent).toContain('Filter on drag');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList.contains('on')).toBe(false);
  });

  it('turns the aid on and shows that it is on', async () => {
    const fixture = await mount();

    toggle(fixture).click();
    await fixture.whenStable();

    expect(toggle(fixture).getAttribute('aria-pressed')).toBe('true');
    expect(toggle(fixture).classList.contains('on')).toBe(true);
    expect(TestBed.inject(MatchingPreferences).filterOnDrag()).toBe(true);
  });

  it('turns it off again', async () => {
    const fixture = await mount();

    toggle(fixture).click();
    toggle(fixture).click();
    await fixture.whenStable();

    expect(TestBed.inject(MatchingPreferences).filterOnDrag()).toBe(false);
  });

  /**
   * The hover text says what the state means and, in the on state, that nothing is being blocked.
   * A control that hides records has to be able to say it is only hiding them.
   */
  it('explains the state it is in, and that it never blocks a match', async () => {
    const fixture = await mount();

    expect(toggle(fixture).title).toContain('Off');

    toggle(fixture).click();
    await fixture.whenStable();

    expect(toggle(fixture).title).toContain('On');
    expect(toggle(fixture).title).toContain('Nothing is blocked');
  });

  it('still carries the demo reset and the dev flag', async () => {
    const element = (await mount()).nativeElement as HTMLElement;

    expect(element.querySelector('.demo-reset')?.textContent).toContain('Reset demo data');
    expect(element.querySelector('.dev-flag')?.textContent).toContain('DEV ENVIRONMENT');
  });
});
