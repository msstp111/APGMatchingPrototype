import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { QuantityState } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { FillMeter } from '../card/fill-meter';

/** One row of the status table: the edge itself, its icon, its word, and what it means. */
interface StatusRow {
  /** The spine class from `card-chrome.ts`'s `spineClass`, drawn by the `spines` mixin. */
  readonly spine: string;
  readonly icon: string;
  /** Confirmed's tick is the filled variant, as it is on the card. */
  readonly filled: boolean;
  readonly label: string;
  readonly what: string;
}

/** One sample meter, fed to the real `app-fill-meter` rather than drawn again here. */
interface MeterRow {
  readonly side: MatchSide;
  readonly state: QuantityState;
  /** The DTO's `quantityStateLabel` for this state and side — quoted, not composed. */
  readonly stateLabel: string;
  readonly original: number;
  readonly matchedInclDraft: number;
  readonly matchedExclDraft: number;
  readonly unmatched: number;
  readonly what: string;
}

/**
 * The key to the board: what the card's left edge says, what the meter's colours say, and what the
 * red `space cancelled` badge says.
 *
 * ## Why this exists
 *
 * design-system.md 3 commits **hue exclusively to quantity** and **pattern exclusively to status**,
 * which is what lets an operator scan thirty cards for a colour without status noise competing for the
 * same channel. The cost of that rule is that status is said in a 6px hatch, and a hatch is not
 * self-explanatory the way a coloured chip would be — the first question anyone new to the screen asks
 * is whether the striped edge is a warning. It is not; on a working board it is the commonest edge
 * there is. Nothing on the screen was answering that, so this does.
 *
 * ## Why it draws itself from the real components
 *
 * The spines come from the `spines` mixin in `_card-geometry.scss` and the meters are real
 * `app-fill-meter` instances with real DTO-shaped figures. A legend redrawn by hand is a legend that
 * comes to disagree with the thing it explains — which is the same argument as the `quantity-ink`
 * mixin's, and Phase 8 found what happens when a colour is defined in more than one place.
 *
 * Like every other dialog in the application it decides nothing and writes nothing. It has no result.
 */
@Component({
  selector: 'app-status-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, FillMeter],
  templateUrl: './status-legend.html',
  styleUrl: './status-legend.scss',
})
export class StatusLegend {
  /**
   * The four record statuses, in the order design-system.md 3.1 tabulates them — which is also the
   * order a record travels through, so the table reads as a life cycle rather than as a list.
   */
  readonly statuses: readonly StatusRow[] = [
    {
      spine: 'sp-booked',
      icon: 'radio_button_unchecked',
      filled: false,
      label: 'Booked',
      what:
        'On the board, nothing settled against it yet. The thin edge is the point: at a glance you ' +
        'can tell "nothing has happened here" before the pattern on the others even resolves.',
    },
    {
      spine: 'sp-pending',
      icon: 'schedule',
      filled: false,
      label: 'Pending',
      what:
        'Matching is under way — the record has live matches but is not finished. The diagonal hatch ' +
        'is ordinary, not a warning: on a working board this is the commonest edge in the ' +
        'Livestock Availability column.',
    },
    {
      spine: 'sp-confirmed',
      icon: 'check_circle',
      filled: true,
      label: 'Confirmed',
      what:
        'Nothing left unmatched and every match confirmed. The solid petrol edge is the brand blue ' +
        'reading as "locked" — it is not a member of the quantity ramp below.',
    },
    {
      spine: 'sp-cancelled',
      icon: 'block',
      filled: false,
      label: 'Cancelled',
      what:
        'Withdrawn. The whole card drains of colour and its name is struck through. Its matches are ' +
        'still live, which is the next section.',
    },
  ];

  /**
   * Four sample meters. Under and Exact are shown once because they mean the same thing on both
   * sides; Over is shown twice because it does not.
   *
   * The figures are ordinary head counts, chosen to give each bar a visibly different length.
   */
  readonly meters: readonly MeterRow[] = [
    {
      side: 'demand',
      state: 'Under',
      stateLabel: 'Under-filled',
      original: 120,
      matchedInclDraft: 45,
      matchedExclDraft: 30,
      unmatched: 75,
      what:
        'Orange — still short. The solid bar is quantity matched; the paler extension is what drafts ' +
        'have already spoken for. The figure beside it is what is left.',
    },
    {
      side: 'demand',
      state: 'Exact',
      stateLabel: 'Filled',
      original: 120,
      matchedInclDraft: 120,
      matchedExclDraft: 120,
      unmatched: 0,
      what: 'Green — exactly filled, nothing over and nothing left. This is what you are aiming at.',
    },
    {
      side: 'demand',
      state: 'Over',
      stateLabel: 'Over-filled',
      original: 120,
      matchedInclDraft: 148,
      matchedExclDraft: 148,
      unmatched: -28,
      what:
        'Blue, and only on a Processor Space. More head matched than the space asked for — permitted ' +
        'and expected. The bar cannot grow past its track, so it takes an outline and a cap ticking ' +
        'past the right-hand end instead.',
    },
    {
      side: 'supply',
      state: 'Over',
      stateLabel: 'Over-committed',
      original: 120,
      matchedInclDraft: 144,
      matchedExclDraft: 144,
      unmatched: -24,
      what:
        'Pink, and only on a Livestock Availability record. It means more stock is matched than the ' +
        'farmer has, and it should never appear: the only route to it is editing the record ' +
        'quantity down below what is already matched. If you see it, something needs attention.',
    },
  ];
}
