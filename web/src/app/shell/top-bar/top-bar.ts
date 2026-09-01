import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DemoReset } from '../demo-reset/demo-reset';

/**
 * LMS v7's top bar: full width, petrol blue, hamburger and wordmark on the left, the dev-environment
 * flag on the right — and, from Phase 8, the "Reset demo data" control immediately left of that flag.
 *
 * The bar is where the reset lives because the flag beside it already says this build is not
 * production, so the control reads as tooling without a second explanation; because a shell control
 * costs the matching screen's 596px list nothing; and because a reset replaces the whole database
 * rather than one screen's data.
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private readonly demo = inject(DemoReset);

  /** Raised by the hamburger; the shell owns whether the sidebar is open. */
  readonly toggleSidebar = output<void>();

  /** Confirms first, then re-seeds and reloads. The service owns all of it. */
  resetDemoData(): void {
    this.demo.confirmAndReset();
  }
}
