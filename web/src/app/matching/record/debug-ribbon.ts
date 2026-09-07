import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The strip that says a dialog is demo scaffolding rather than the product (requirement 1.3).
 *
 * **One component, used by every debug form**, so the marking cannot come to differ between them and
 * Phase 8 has exactly one place to restyle.
 *
 * It borrows the shell's `# DEV ENVIRONMENT #` treatment — the dev-flag yellow-green `#CCD457` on the
 * supply column's `#37393C` — because that is the meaning the top bar already gives that colour in
 * this application, and a viewer who has read the top bar has already learnt it. It is not a card, so
 * it does not collide with the rule committing hue to the quantity meter: nothing on this strip is a
 * status or a quantity.
 *
 * The real farmer/agent submission journey is deferred past pass 1. Nobody watching a demo should
 * mistake one of these forms for it, which is what the second line says in as many words.
 */
@Component({
  selector: 'app-debug-ribbon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ribbon">
      <span class="flag">
        <span class="material-symbols-outlined" aria-hidden="true">construction</span>
        # DEMO DATA TOOL #
      </span>
      <span class="prose">{{ note() }}</span>
    </div>
  `,
  styleUrl: './debug-ribbon.scss',
})
export class DebugRibbon {
  /** What this particular form is scaffolding for, in one line. */
  readonly note = input<string>(
    'Debug scaffolding for demos, not the farmer or agent submission form.',
  );
}
