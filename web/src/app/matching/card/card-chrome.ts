import {
  LivestockAvailabilityStatus,
  MatchStatus,
  ProcessorSpaceStatus,
  QuantityState,
  TransactionType,
} from '../../api/models';
import { MatchSide } from '../board/matching-board';

/**
 * The lookups that turn a DTO's enum into a class name or a glyph.
 *
 * Every one of these is a *presentation* mapping over a value the server decided — never a re-decision
 * of the value. Nothing here computes a status, a quantity or a state: it only chooses what a given
 * one looks like, which is the client's job and the client's only job on this screen.
 */

type RecordStatus = ProcessorSpaceStatus | LivestockAvailabilityStatus;

/**
 * Status is carried on the card's left edge, plus an icon, plus the word — three redundant channels
 * and not one of them hue (design-system.md 3.1).
 */
export function spineClass(status: RecordStatus): string {
  switch (status) {
    case 'Pending':
      return 'sp-pending';
    case 'Confirmed':
      return 'sp-confirmed';
    case 'Cancelled':
      return 'sp-cancelled';
    default:
      return 'sp-booked';
  }
}

export function statusIcon(status: RecordStatus): string {
  switch (status) {
    case 'Pending':
      return 'schedule';
    case 'Confirmed':
      return 'check_circle';
    case 'Cancelled':
      return 'block';
    default:
      return 'radio_button_unchecked';
  }
}

/**
 * `Drafted` borrows Pending's clock and `Confirmed` the filled tick, both in plain grey. **No hue** —
 * a match-status cell is one of the surfaces design-system.md 3 names explicitly.
 */
export function matchStatusIcon(status: MatchStatus): string {
  return status === 'Confirmed' ? 'check_circle' : 'schedule';
}

/**
 * The quantity ramp, keyed on the state **and the side**, because `Over` means opposite things on the
 * two sides: permitted and expected on a space (blue, "Over-filled"), a bug indicator on an
 * availability record (pink, "Over-committed") that should be unreachable in pass 1.
 */
export function quantityClass(state: QuantityState, side: MatchSide): string {
  switch (state) {
    case 'Exact':
      return 'q-exact';
    case 'Over':
      return side === 'demand' ? 'q-over' : 'q-pink';
    default:
      return 'q-under';
  }
}

/** `Finance Stock` / `Grazing Stock` / `Other` — never the enum spelling (design-system.md 6.1). */
export function transactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'FinanceStock':
      return 'Finance Stock';
    case 'GrazingStock':
      return 'Grazing Stock';
    default:
      return 'Other';
  }
}

/** `no matches` / `1 match` / `n matches`. Live matches only: cancelled ones never reach the client. */
export function matchCountLabel(count: number): string {
  if (count === 0) {
    return 'no matches';
  }

  return count === 1 ? '1 match' : `${count} matches`;
}
