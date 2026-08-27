import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './shell/sidebar/sidebar';
import { TopBar } from './shell/top-bar/top-bar';

/**
 * The LMS shell. Every screen this prototype builds renders inside it, so it is the real thing —
 * top bar and sidebar — rather than a placeholder.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopBar, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly sidebarOpen = signal(true);

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
