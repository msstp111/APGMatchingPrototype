import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusLegend } from './status-legend';

/**
 * The legend's failure mode is not a crash, it is going quietly out of date — a fifth status, or a
 * fifth ramp colour, arriving on the screen and not here. So these tests assert coverage and the two
 * colour systems' separation, not markup.
 */
describe('Status legend', () => {
  let fixture: ComponentFixture<StatusLegend>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [StatusLegend],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusLegend);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function classesOf(selector: string): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector),
    ].flatMap((element) => [...element.classList]);
  }

  it('draws every status spine the cards can draw', () => {
    // The same four class names `spineClass` answers. A fifth status arriving on the cards without
    // arriving here is exactly the drift this test exists to catch.
    const spines = classesOf('.spine');

    for (const spine of ['sp-booked', 'sp-pending', 'sp-confirmed', 'sp-cancelled']) {
      expect(spines, spine).toContain(spine);
    }
  });

  it('names all four statuses in words as well as in pattern', () => {
    for (const status of ['Booked', 'Pending', 'Confirmed', 'Cancelled']) {
      expect(text(), status).toContain(status);
    }
  });

  it('says the hatch is ordinary, which is the question it exists to answer', () => {
    expect(text()).toContain('not a warning');
  });

  it('draws all four ramp colours, both over states included', () => {
    // Real app-fill-meter instances, so the classes here are the meter's own ramp classes: if the
    // ramp is ever re-keyed, this fails rather than the legend showing four stale bars.
    const ramps = classesOf('app-fill-meter .meter');

    for (const ramp of ['q-under', 'q-exact', 'q-over', 'q-pink']) {
      expect(ramps, ramp).toContain(ramp);
    }
  });

  it('separates the two over states by side, in the words the DTO uses', () => {
    expect(text()).toContain('Over-filled');
    expect(text()).toContain('Over-committed');
  });

  it('explains the cancelled-partner badge and states the non-cascade', () => {
    expect(fixture.nativeElement.querySelector('.orphan')).not.toBeNull();
    expect(text()).toContain('never cancels its matches');
  });
});
