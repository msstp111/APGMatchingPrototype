import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatchSide } from '../board/matching-board';
import { RecordActions } from '../record/record-actions';
import { SideGlyph } from './side-glyph';

/**
 * What a column shows when **nothing at all** is loaded for its side (design-system.md 13).
 *
 * This is not the filtered-empty state and must not be confused with it. There is nothing to clear
 * and nothing to reset — no filter is hiding anything, because there is nothing to hide — so offering
 * `Clear filters` here would send an operator hunting for a cause that does not exist. What it offers
 * instead is the only thing that would change the answer: a record.
 *
 * Phase 4's log parked this state with "Phase 7 or 8"; Phase 7 declined it because its own
 * requirements did not ask for it, and left the `+ Add` button in the column header for this state to
 * reuse. Phase 8, requirement 4.1, is where it lands.
 *
 * Against the seeded database it is unreachable — 40 spaces and 50 records always load. It is reached
 * by cancelling or emptying a side, or by an API that returns an empty list, and it exists so that a
 * column can never be blank (design-system.md 13's first line).
 */
@Component({
  selector: 'app-empty-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SideGlyph],
  template: `
    <div class="empty">
      <!-- The column header's own pair, at the state's size. -->
      <app-side-glyph class="glyph" [side]="side()" />

      <p class="headline">{{ headline() }}</p>
      <p class="prose">{{ prose() }}</p>

      <!--
        design-system.md 14's debug treatment, and the same control the column header carries: this
        state is the one place the scaffolding is genuinely the only way forward, so it is offered
        rather than merely available.
      -->
      <button type="button" class="add" (click)="add()" [title]="addTitle()">
        <span class="material-symbols-outlined" aria-hidden="true">construction</span>
        + Add {{ isDemand() ? 'a processor space' : 'a record' }}
      </button>
    </div>
  `,
  styleUrl: './empty-column.scss',
})
export class EmptyColumn {
  private readonly records = inject(RecordActions);

  readonly side = input.required<MatchSide>();

  readonly isDemand = computed(() => this.side() === 'demand');

  readonly headline = computed(() =>
    this.isDemand() ? 'No processor spaces yet' : 'No livestock availability yet',
  );

  readonly prose = computed(() =>
    this.isDemand()
      ? 'Spaces appear here as processors commit to kill slots.'
      : 'Records appear here as farmers and agents submit them.',
  );

  readonly addTitle = computed(() =>
    this.isDemand()
      ? 'Demo tool: add a Processor Space. Not the real create flow.'
      : 'Demo tool: add a Livestock Availability record. Not the farmer or agent submission form.',
  );

  add(): void {
    if (this.isDemand()) {
      this.records.addSpace();

      return;
    }

    this.records.addAvailability();
  }
}
