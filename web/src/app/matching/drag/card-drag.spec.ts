import { CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
import { aSpace, anAvailability } from '../testing/dto-fixtures';
import { acceptsFrom, pairFromDrop } from './card-drag';
import { DragCard } from './drag-state';

describe('Card drag', () => {
  const space = aSpace({ id: 3, processor: 'Alliance Group' });
  const availability = anAvailability({ id: 9, locationName: 'Totara Kauri Trust' });
  const demand: DragCard = { side: 'demand', space };
  const supply: DragCard = { side: 'supply', availability };

  it('rejects a drop from the same column in both directions', () => {
    expect(acceptsFrom('demand')(drag(demand))).toBe(false);
    expect(acceptsFrom('supply')(drag(supply))).toBe(false);
  });

  it('accepts a drop from the other column in both directions', () => {
    expect(acceptsFrom('demand')(drag(supply))).toBe(true);
    expect(acceptsFrom('supply')(drag(demand))).toBe(true);
  });

  it('resolves both directions to the same pair', () => {
    const spaceOntoAvailability = pairFromDrop(drop(demand, supply));
    const availabilityOntoSpace = pairFromDrop(drop(supply, demand));

    expect(spaceOntoAvailability).toEqual({ space, availability });
    expect(availabilityOntoSpace).toEqual({ space, availability });
  });

  it('returns null for a same-column drop rather than inventing a pair', () => {
    expect(pairFromDrop(drop(demand, demand))).toBeNull();
    expect(pairFromDrop(drop(supply, supply))).toBeNull();
  });

  it('returns null when the pointer is no longer over the last target', () => {
    expect(pairFromDrop(drop(demand, supply, false))).toBeNull();
    expect(pairFromDrop(drop(supply, demand, false))).toBeNull();
  });
});

function drag(data: DragCard): CdkDrag<DragCard> {
  return { data } as CdkDrag<DragCard>;
}

function drop(
  source: DragCard,
  target: DragCard,
  isPointerOverContainer = true,
): CdkDragDrop<DragCard, DragCard> {
  return {
    item: { data: source },
    container: { data: target },
    isPointerOverContainer,
  } as CdkDragDrop<DragCard, DragCard>;
}
