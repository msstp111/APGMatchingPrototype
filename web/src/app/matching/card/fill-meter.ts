import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QuantityState } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { quantityClass } from './card-chrome';

/**
 * The fill meter: the one place on this screen hue lives.
 *
 * It answers "what is the operator scanning for" and carries that meaning in three redundant channels
 * — colour, bar length, and the numeral beside it. Two segments: the solid one is `matchedExclDraft`,
 * an alpha extension runs on to `matchedInclDraft`. **Alpha, not hatching** — hatching belongs to the
 * Pending spine, and neither colour system may borrow the other's channel (design-system.md 3, 4).
 *
 * ## The one calculation in this component, and why it is here
 *
 * Segment widths are ratios of two DTO figures. That is the *only* arithmetic in `web/` besides the
 * band-meta roll-up, and `no-domain-arithmetic.spec.ts` allow-lists this file by name for it.
 *
 * It belongs here rather than on the wire because a bar width is not a displayed figure and the clamp
 * to [0, 100] is a design rule, not a domain rule: putting `meterExclPercent` on the DTO would move a
 * decision about pixels into the contract. Everything actually *read* on this component — the numeral,
 * the state, the label — arrives already computed. In particular the numeral is `unmatched`
 * untouched, and `unmatched` comes off the incl-draft sum, never the excl-draft one: a draft has
 * already spoken for the stock.
 */
@Component({
  selector: 'app-fill-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fill-meter.html',
  styleUrl: './fill-meter.scss',
})
export class FillMeter {
  /** `quantityRequired` on a space, `quantityAvailable` on an availability record. */
  readonly original = input.required<number>();
  readonly matchedInclDraft = input.required<number>();
  readonly matchedExclDraft = input.required<number>();
  readonly unmatched = input.required<number>();
  readonly quantityState = input.required<QuantityState>();
  /** The DTO's `quantityStateLabel`. Never composed here. */
  readonly quantityStateLabel = input.required<string>();
  readonly side = input.required<MatchSide>();

  readonly rampClass = computed(() => quantityClass(this.quantityState(), this.side()));

  /**
   * Over 100% the meter is drawn rather than measured: both segments sit full, the track takes an
   * inset outline in the bar colour and an over-run cap ticks past its right end
   * (design-system.md 4.2).
   */
  readonly isOver = computed(() => this.quantityState() === 'Over');

  readonly exactWidth = computed(() => this.percent(this.matchedExclDraft()));

  readonly inclWidth = computed(() => this.percent(this.matchedInclDraft()));

  /**
   * The whole meter in one hover string, so a value the eye had to estimate off an 8px bar is always
   * recoverable exactly (design-system.md 16.2).
   */
  readonly hoverTitle = computed(
    () =>
      `${this.matchedExclDraft()} matched / ${this.matchedInclDraft()} incl. draft ` +
      `of ${this.original()} — ${this.unmatched()} unmatched (${this.quantityStateLabel()})`,
  );

  private percent(matched: number): string {
    const original = this.original();

    // A zero original would be a division by zero and a record with nothing to fill. Neither the seed
    // nor Phase 7's form can produce one, but a full bar is the honest answer if it ever happens: the
    // record is as filled as it can be.
    if (original <= 0) {
      return '100%';
    }

    const ratio = (matched / original) * 100;

    return `${Math.min(100, Math.max(0, ratio))}%`;
  }
}
