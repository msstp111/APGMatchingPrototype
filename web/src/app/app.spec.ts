import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  it('renders the LMS top bar with the dev-environment flag', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.wordmark')?.textContent).toContain('LMS');
    expect(element.querySelector('.dev-flag')?.textContent).toContain('# DEV ENVIRONMENT #');
  });

  it('renders the existing LMS nav items alongside the booking module entry', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('.nav-item .label')).map((n) => n.textContent?.trim());

    expect(labels).toEqual([
      'Killsheets',
      'Purchases',
      'Adjustments',
      'Locations',
      'Admin',
      'Matching',
      'Logout',
    ]);
  });

  it('collapses and expands the sidebar from the hamburger', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const shell = element.querySelector('.shell')!;
    const hamburger = element.querySelector('.hamburger') as HTMLButtonElement;

    expect(shell.classList.contains('sidebar-collapsed')).toBe(false);

    hamburger.click();
    await fixture.whenStable();
    expect(shell.classList.contains('sidebar-collapsed')).toBe(true);

    hamburger.click();
    await fixture.whenStable();
    expect(shell.classList.contains('sidebar-collapsed')).toBe(false);
  });
});
