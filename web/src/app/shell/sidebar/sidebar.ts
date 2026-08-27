import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_ITEMS } from '../nav-items';

/**
 * LMS v7's left sidebar: a petrol-blue header block carrying the user's name and a close button,
 * over a white nav body, over a grey version footer.
 */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly close = output<void>();

  /**
   * Hard-coded, because pass 1 has no login and no role switching: every screen is the APG view.
   */
  readonly userName = 'Mark Stanton';

  readonly version = 'LMS v7.0.0.82932';

  readonly copyright = 'Alpine Pastures © 2022';

  readonly navItems = NAV_ITEMS;
}
