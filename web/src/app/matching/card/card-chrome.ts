import {
  LivestockAvailabilityStatus,
  MatchDto,
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
 * `Drafted` borrows Pending's clock, `Notified` the outbound `send`, `Confirmed` the filled tick —
 * all in plain grey. **No hue** — a match-status cell is one of the surfaces design-system.md 3
 * names explicitly.
 *
 * `Notified` earned its own glyph when it became reachable (2026-09-11). Sharing Drafted's clock
 * would have left the one row that has moved looking identical to the ones that have not, which is
 * the whole of what the status is for.
 */
export function matchStatusIcon(status: MatchStatus): string {
  switch (status) {
    case 'Confirmed':
      return 'check_circle';
    case 'Notified':
      return 'send';
    default:
      return 'schedule';
  }
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
/**
 * `ANZCO Kokiri` — the processor and its plant, which is how APG names a slot in conversation.
 *
 * Both match dialogs put it in their title, and it is here rather than interpolated in two templates
 * because the plant can be blank on a hand-built or partially filled record and `ANZCO ` with a
 * trailing space in a dialog title is the kind of thing nobody notices until a demo.
 */
export function spaceName(space: { readonly processor: string; readonly plant: string }): string {
  return [space.processor, space.plant].filter((part) => part?.trim()).join(' ');
}

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

/**
 * The count plus what state those matches are in — `2 matches · 1 draft` (requirement 5.1).
 *
 * The count alone was not enough once Phase 5 could create matches: every match this phase makes is a
 * draft, so a card that said only "2 matches" would look identically settled whether nothing had been
 * committed or everything had. Drafts are called out because they are the ones still to be actioned;
 * "confirmed" is stated only when it is true of all of them, so the word cannot be read as applying to
 * a subset. Cancelled matches are neither shown nor counted (resolved question 4) — they never arrive.
 *
 * This drops from line 2 first when the card runs out of room (design-system.md 6.1), which is why it
 * is one short phrase rather than a breakdown. The breakdown is {@link matchBreakdown}, on the title.
 */
export function matchSummaryLabel(matches: readonly MatchDto[]): string {
  const count = matchCountLabel(matches.length);

  if (matches.length === 0) {
    return count;
  }

  const drafts = matches.filter((match) => match.status === 'Drafted').length;

  if (drafts > 0) {
    return `${count} · ${drafts} draft${drafts === 1 ? '' : 's'}`;
  }

  // Drafts first, then notified: both are outstanding, and a draft is the one still entirely in
  // APG's hands. Only one of the two is ever named, because this phrase drops from line 2 first when
  // the card runs out of room (design-system.md 6.1) and a breakdown is what the hover title is for.
  const notified = matches.filter((match) => match.status === 'Notified').length;

  if (notified > 0) {
    return `${count} · ${notified} notified`;
  }

  return matches.every((match) => match.status === 'Confirmed') ? `${count} · confirmed` : count;
}

/**
 * Every state present, in order — `2 drafted · 1 confirmed`. Shown on hover; Phase 6 opens them.
 */
export function matchBreakdown(matches: readonly MatchDto[]): string {
  if (matches.length === 0) {
    return 'No matches on this record';
  }

  const order: readonly MatchStatus[] = ['Drafted', 'Notified', 'Confirmed'];

  return order
    .map((status) => ({ status, count: matches.filter((match) => match.status === status).length }))
    .filter((group) => group.count > 0)
    .map((group) => `${group.count} ${group.status.toLowerCase()}`)
    .join(' · ');
}

/**
 * How many of a record's matches hang off a **cancelled** partner record — nearly always zero.
 *
 * Cancelling a record never cascades to its matches (Phase 7, 5.2), so a live match under a cancelled
 * parent is a normal state and not an error. It is also invisible from this side unless it is said:
 * this card's own status is untouched, its meters are untouched, and only the counterparty is gone.
 * The card shows a `block` glyph beside the match count when this is non-zero, and the expanded match
 * table names the row.
 *
 * It counts a list, which is not a quantity: no head, no sums, nothing derived. The statuses it reads
 * are both the server's own — the space's stored one and the availability record's derived one.
 */
export function cancelledPartnerCount(matches: readonly MatchDto[], side: MatchSide): number {
  return matches.filter(
    (match) => (side === 'demand' ? match.availabilityStatus : match.spaceStatus) === 'Cancelled',
  ).length;
}

/** The hover text for that glyph, naming what is cancelled and what is emphatically not. */
export function cancelledPartnerTitle(count: number, side: MatchSide): string {
  const partner = side === 'demand' ? 'livestock availability record' : 'processor space';
  const plural = count === 1 ? `${partner} has` : `${partner}s have`;

  return (
    `${count} matched ${plural} been cancelled. The ${count === 1 ? 'match' : 'matches'} ` +
    `themselves have not. Cancelling a record never cascades.`
  );
}
