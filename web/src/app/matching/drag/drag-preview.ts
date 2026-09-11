import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DropOutcome } from './drop-outcome';

/**
 * What follows the pointer during a drag: a 232px chip, not a copy of the 52px card.
 *
 * Phase 5's preview was the card itself at full width, which meant the thing in your hand covered the
 * row you were aiming at — a 518px card obscuring the 518px card underneath it. The chip carries the
 * two fields a drag actually needs to stay oriented (whose, and how many) and gets out of the way of
 * the answer. "Whose" is the whole slot on the demand side — `ANZCO Kokiri`, not `ANZCO` — because
 * most of that column is ANZCO's and the plant is the part that says which slot is in hand.
 *
 * It also carries the outcome (design-system.md 10, Phase 9). The pill hangs under the chip rather
 * than sitting on the target card, at Mark's direction: the outcome belongs to the card in your hand,
 * travels with it, and cannot be mistaken for something the target row is asserting about itself.
 *
 * The figure in the pill is the **server's**, from `DropOutcome` — never `min()` of two DTO fields.
 * See that service for why that distinction is worth a network call.
 *
 * **And the pill is withheld whenever it would only repeat the chip.** Most drops move everything
 * on offer: 23 unmatched head onto a space wanting 60 transfers all 23, and a pill reading
 * `Match 23 head` under a chip reading `23 head` has told the operator nothing while costing them
 * a glance. It appears only when the two differ, which since 2026-09-10 means exactly one thing —
 * the far side could not take all of it, and some of what is in their hand will be left behind.
 */
@Component({
  selector: 'app-drag-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drag-preview.html',
  styleUrl: './drag-preview.scss',
})
export class DragPreview {
  private readonly outcome = inject(DropOutcome);

  /**
   * `ANZCO Kokiri` on a space — processor *and* plant, composed by the card through
   * `card-chrome.spaceName` — and the location on an availability record.
   */
  readonly name = input.required<string>();

  /**
   * **What is actually in the operator's hand: `unmatched`, not the record's total** (2026-09-10).
   *
   * It was `quantityRequired` / `quantityAvailable` until then, and that was wrong in two ways at
   * once. The chip overstated the drop — a record of 800 head with 305 left to allocate said
   * `800 head` while no drop from it could ever move more than 305 — and it broke the outcome pill
   * below, whose whole rule is "say the figure only when it disagrees with the one above". Judged
   * against a total, that rule fired for every partly-matched record whether or not the far side was
   * the constraint, and stayed silent for every fresh one; measured against the live seed, that is
   * 12 of 34 demand cards and 9 of 41 supply cards speaking and the rest silent, for reasons the
   * operator cannot see. Against `unmatched` the pill means what it says: the FAR side capped it.
   *
   * Rendered as given, and **not clamped**. An over-committed record's `unmatched` is negative, and
   * a chip reading `-24 head` is the honest answer — it has less than nothing left to give. Nothing
   * can be dropped from it either way: `DragStore.dropState` blocks every target when the card in
   * hand has less than one head unmatched, so no pill and no ghost ever accompany that chip. A
   * `Math.max(0, …)` here would be a client-side opinion about a domain figure, on a screen whose
   * standing rule is that it never has one.
   */
  readonly headCount = input.required<number>();

  /** The head count the drop would default to, or null while unknown, unhovered or refused. */
  readonly proposed = this.outcome.quantity;

  /**
   * Not arithmetic: two figures that are both already on screen, compared for equality to decide
   * whether to draw the second one. Nothing here works a quantity out — the chip's figure is the
   * DTO's and the pill's is the server's, and this only asks whether saying both is worth the ink.
   *
   * Since the chip carries `unmatched` this comparison finally asks the question it was written to
   * ask. The proposal is `min(unmatched, unmatched)`, so it equals the chip exactly when the card
   * in hand is the smaller side — the whole of it moves, and there is nothing to flag. A pill
   * therefore means one thing and one thing only: **the far side could not take all of it.**
   */
  readonly hasOutcome = computed(() => {
    const proposed = this.proposed();

    return proposed !== null && proposed !== this.headCount();
  });
}
