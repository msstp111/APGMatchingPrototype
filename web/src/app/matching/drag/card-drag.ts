import { CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../../api/models';
import { MatchSide } from '../board/matching-board';
import { DragCard } from './drag-state';

/** The two records a drop names. Both in full, because the prompt has to summarise both. */
export interface MatchPair {
  readonly space: ProcessorSpaceDto;
  readonly availability: LivestockAvailabilityDto;
}

/**
 * Whether a card on `side` will take the item being dragged: only if it came from the other column.
 *
 * Returning false is what makes a same-column drop a **silent** no-op (requirement 1.3): CDK never
 * marks the list as receiving, so no outline appears, no drop event fires, and there is nothing to
 * report. An error message for a gesture that simply does not apply teaches an operator to fear the
 * screen.
 *
 * A target with no unmatched quantity deliberately still accepts the drop. The refusal is the server's
 * to give, in the exact words requirement 3.2 specifies, and a target that silently swallowed the
 * gesture would leave the operator with no idea why nothing happened.
 */
export function acceptsFrom(side: MatchSide): (drag: CdkDrag<DragCard>) => boolean {
  return (drag) => drag.data !== undefined && drag.data.side !== side;
}

/**
 * The pair a drop names, or null if it was not a valid cross-column drop.
 *
 * **This function is requirement 1.2.** Both directions run through it, and each record is placed by
 * its own side rather than by which one happened to be picked up — so space-onto-availability and
 * availability-onto-space produce an identical pair. There is deliberately no second code path for
 * the other direction; that is how the two directions would come to differ.
 */
export function pairFromDrop(event: CdkDragDrop<DragCard, DragCard>): MatchPair | null {
  // CDK fires `dropped` on the last list that *accepted* the item, even after the pointer has
  // left it. Dragging back onto the source column (or releasing over a band header) must cancel,
  // not match the card that was hovered last.
  if (!event.isPointerOverContainer) {
    return null;
  }

  return pairOf(event.item.data, event.container.data);
}

/**
 * The pair two cards name, whichever way round they were picked up, or null if they are not a pair.
 *
 * Split out of {@link pairFromDrop} in Phase 9 so the hover can ask the same question the drop asks.
 * It is still **one** implementation of requirement 1.2 — the drop path did not grow a second one, it
 * delegates here — which matters because the pill that appears on hover and the dialog that opens on
 * release must be talking about the same two records or the screen has lied.
 */
export function pairOf(
  source: DragCard | undefined | null,
  target: DragCard | undefined | null,
): MatchPair | null {
  if (!source || !target) {
    return null;
  }

  if (source.side === 'demand' && target.side === 'supply') {
    return { space: source.space, availability: target.availability };
  }

  if (source.side === 'supply' && target.side === 'demand') {
    return { space: target.space, availability: source.availability };
  }

  return null;
}
