import { Injectable, Signal, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import {
  clausesHidingAvailability,
  clausesHidingSpace,
  widenForAvailability,
  widenForSpace,
} from '../filters/filter-service';
import { MatchingPreferences } from '../filters/matching-preferences';

/** How long the revealed card stays lit. One number, shared with the CSS animation. */
export const REVEAL_MS = 1500;

/** The class the flash hangs off, set on the card's own host element. */
export const REVEAL_CLASS = 'apg-revealed';

const SNACK_MS = 6000;
const SNACK_PANEL = 'apg-snack';

/**
 * Take me to the other side of this match.
 *
 * Clicking a match's counterparty name in an expanded card scrolls the OTHER column to that record
 * and flashes it. The two columns are the screen's whole subject and a match is the join between
 * them, so "which record is this?" used to be answered by reading a name and then hunting for it in
 * a list of forty.
 *
 * ## Why a service, and why it holds element references
 *
 * The card that owns the match is in one column; the record being revealed is in the other. Neither
 * component can reach the other, and the expansion that raised the click knows only an id. So each
 * column registers its own scrolling `.list` here, exactly as it already registers its host with
 * `DragStore` for the drag's gutter test: the two columns are known, permanent and exactly two, and
 * the flip is CSS `order`, so neither is ever destroyed.
 *
 * ## This is not the scroll synchronisation design-system.md 9.3 forbids
 *
 * That rule is about LOCKING two lists of different lengths together, continuously, so that one of
 * them ends up lying about which week the operator is in. This moves one column once, on an explicit
 * click, and never couples the two again afterwards.
 *
 * ## The record is very often not on screen
 *
 * The default filters are demand `Status = Booked` and supply `Status in (Booked, Pending)` with
 * `unmatched > 0`. A confirmed match's space and a fully allocated availability record both fall
 * outside them — which is to say the records a FINISHED match points at are precisely the ones the
 * far column is hiding. So the reveal offers to widen the filter rather than failing, and OFFERS
 * rather than acts: design-system.md 12.3 forbids changing a filter the operator did not touch, and
 * Phase 7's `SHOW IT` is the sanctioned shape for asking.
 */
@Injectable({ providedIn: 'root' })
export class RevealRecord {
  private readonly preferences = inject(MatchingPreferences);
  private readonly snackBar = inject(MatSnackBar);

  private readonly lists = new Map<MatchSide, HTMLElement>();

  /**
   * Where to look a record id up.
   *
   * Registered by `matching-screen`, which owns the two loaded sets and is the only thing on the
   * screen that holds both. Signals rather than copies: a reveal must decide against the same
   * records the columns are rendering, and a second copy of the working set would be a second thing
   * for every write to patch.
   */
  private spaces: Signal<readonly ProcessorSpaceDto[]> = signal([]);

  private availabilityRecords: Signal<readonly LivestockAvailabilityDto[]> = signal([]);

  registerRecords(
    spaces: Signal<readonly ProcessorSpaceDto[]>,
    availability: Signal<readonly LivestockAvailabilityDto[]>,
  ): void {
    this.spaces = spaces;
    this.availabilityRecords = availability;
  }

  /**
   * A column's scrolling element, registered on init and never removed.
   *
   * The `.list`, not the column host: it is the scroll container, and it is what the sticky header
   * strip and the sticky band headers are positioned against.
   */
  registerList(side: MatchSide, element: HTMLElement): void {
    this.lists.set(side, element);
  }

  /**
   * Reveal a Processor Space in the demand column, by id.
   *
   * An id, because that is all a match row carries — the whole point of `MatchDto.processorSpaceId`
   * is that a match is rendered inside the OTHER record's card and holds none of its counterparty's
   * fields. The DTO is resolved from the screen's own loaded set, which is the set the columns
   * render, so the filter decision below cannot disagree with what is on screen.
   */
  space(spaceId: number): void {
    const space = this.spaces().find((it) => it.id === spaceId);

    if (!space) {
      this.notLoaded();

      return;
    }

    if (clausesHidingSpace(space, this.preferences.demandFilters()).length > 0) {
      this.offer(space.plant || `Space #${space.id}`, () => {
        this.preferences.setDemandFilters(widenForSpace(space, this.preferences.demandFilters()));
        this.scrollTo('demand', space.id);
      });

      return;
    }

    this.scrollTo('demand', space.id);
  }

  /** @see space */
  availability(recordId: number): void {
    const record = this.availabilityRecords().find((it) => it.id === recordId);

    if (!record) {
      this.notLoaded();

      return;
    }

    if (clausesHidingAvailability(record, this.preferences.supplyFilters()).length > 0) {
      this.offer(record.locationName || `Record #${record.id}`, () => {
        this.preferences.setSupplyFilters(
          widenForAvailability(record, this.preferences.supplyFilters()),
        );
        this.scrollTo('supply', record.id);
      });

      return;
    }

    this.scrollTo('supply', record.id);
  }

  /**
   * Scrolls the column and lights the card, on the frame after the one that rendered it.
   *
   * Deferred with a `requestAnimationFrame` because the callers that need it most have just changed
   * a filter: the card does not exist in the DOM until Angular has re-rendered the column, and a
   * `querySelector` in the same task finds nothing. The already-visible path pays one frame for the
   * same code, which is cheaper than having two.
   */
  private scrollTo(side: MatchSide, recordId: number): void {
    requestAnimationFrame(() => {
      const list = this.lists.get(side);
      const card = list?.querySelector<HTMLElement>(`[data-record-id="${recordId}"]`);

      if (!card) {
        this.notLoaded();

        return;
      }

      // `center`, not `start`: the sticky header strip and the sticky band header together own 58px
      // of the top of this container, and a card scrolled to the top parks behind them. The card
      // carries a `scroll-margin-top` for the same reason, which covers the case where the list is
      // too short for centring to move anything.
      card.scrollIntoView({
        behavior: this.reducedMotion() ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });

      // Re-applied from scratch, so revealing the same card twice flashes it twice — the second
      // click is a question too, and a class that is already present animates nothing. The read of
      // `offsetWidth` is what forces the style flush between the two.
      card.classList.remove(REVEAL_CLASS);
      void card.offsetWidth;
      card.classList.add(REVEAL_CLASS);
      setTimeout(() => card.classList.remove(REVEAL_CLASS), REVEAL_MS);
    });
  }

  /**
   * Offered, never applied. The snack names the record; the action widens the filter.
   *
   * It says which column is hiding it rather than which clause: the operator is looking at a card in
   * one column and the answer is in the other, and that is the fact they can act on. `SHOW IT` is
   * Phase 7's word for the same act, and it is deliberately the same word.
   */
  private offer(name: string, reveal: () => void): void {
    this.snackBar
      .open(`${name} is hidden by that column's filters`, 'SHOW IT', {
        duration: SNACK_MS,
        panelClass: SNACK_PANEL,
      })
      .onAction()
      .subscribe(reveal);
  }

  /**
   * The record is not in the screen's loaded set at all.
   *
   * Reachable, and not a defect: both columns are fetched once, and a match can name a record
   * created since. Saying so beats a click that does nothing.
   */
  private notLoaded(): void {
    this.snackBar.open('That record is not loaded — try Reset demo data', '', {
      duration: SNACK_MS,
      panelClass: SNACK_PANEL,
    });
  }

  private reducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
