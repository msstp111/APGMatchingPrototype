import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * LMS v7's top bar: full width, petrol blue, hamburger and wordmark on the left, the dev-environment
 * flag on the right.
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  /** Raised by the hamburger; the shell owns whether the sidebar is open. */
  readonly toggleSidebar = output<void>();
}
