import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatchingPreferences } from '../../matching/filters/matching-preferences';
import { DemoReset } from '../demo-reset/demo-reset';
import { TopBar } from './top-bar';

/**
 * The top bar's chrome controls, and specifically the two that have a state.
 *
 * "Filter on drag" and "Drag anywhere" are toggles in a row of buttons, so what is worth testing is
 * that they read as toggles: pressed state exposed to assistive tech, filled while on, and the switch
 * itself living in the preference store rather than in this component — the matching screen is what
 * acts on both, and a copy of the state here is how the two would come to disagree.
 *
 * They are independent, which is easy to break by wiring the second to the first's signal, so that is
 * asserted outright rather than left to be noticed.
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

  function dragAnywhere(fixture: Awaited<ReturnType<typeof mount>>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.drag-anywhere')!;
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

  it('offers “Drag anywhere” as a second toggle, also off to begin with', async () => {
    const fixture = await mount();
    const button = dragAnywhere(fixture);

    expect(button.textContent).toContain('Drag anywhere');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList.contains('on')).toBe(false);
    expect(button.title).toContain('Off');
  });

  it('turns “Drag anywhere” on, and says what it changes', async () => {
    const fixture = await mount();

    dragAnywhere(fixture).click();
    await fixture.whenStable();

    expect(dragAnywhere(fixture).getAttribute('aria-pressed')).toBe('true');
    expect(dragAnywhere(fixture).classList.contains('on')).toBe(true);
    expect(dragAnywhere(fixture).title).toContain('On');
    expect(TestBed.inject(MatchingPreferences).dragAnywhere()).toBe(true);
  });

  it('keeps the two toggles independent', async () => {
    const fixture = await mount();
    const preferences = TestBed.inject(MatchingPreferences);

    dragAnywhere(fixture).click();
    await fixture.whenStable();

    expect(preferences.dragAnywhere()).toBe(true);
    expect(preferences.filterOnDrag()).toBe(false);
    expect(toggle(fixture).classList.contains('on')).toBe(false);
  });

  /**
   * Both borrow the reset's shape through one shared class rather than a copy each: three chrome
   * controls side by side, and one of them a pixel out from its neighbours looks like a mistake.
   */
  it('gives both toggles the shared control shape', async () => {
    const fixture = await mount();

    expect(toggle(fixture).classList.contains('pref-toggle')).toBe(true);
    expect(dragAnywhere(fixture).classList.contains('pref-toggle')).toBe(true);
  });

  it('still carries the demo reset and the dev flag', async () => {
    const element = (await mount()).nativeElement as HTMLElement;

    expect(element.querySelector('.demo-reset')?.textContent).toContain('Reset demo data');
    expect(element.querySelector('.dev-flag')?.textContent).toContain('DEV ENVIRONMENT');
  });
});
