import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { MatchProposalDto } from '../../api/models';
import { aSpace, anAvailability } from '../testing/dto-fixtures';
import { DragStore } from './drag-state';
import { DropOutcome } from './drop-outcome';

/**
 * The outcome pill quotes the server, and these tests are what stops it quoting itself.
 *
 * `min(space.unmatched, availability.unmatched)` is two DTO fields and one call — and it is the exact
 * shape `no-domain-arithmetic.spec.ts` forbids, because the rule it duplicates has already moved once
 * (2026-09-01, when a cancelled counterparty stopped consuming quantity). Every proposal here returns
 * a figure that is *not* the minimum of the two records' unmatched quantities, so a client-side
 * recomputation could not pass by coincidence.
 */
describe('Drop outcome', () => {
  const space = aSpace({ id: 7, unmatched: 40 });
  const availability = anAvailability({ id: 11, unmatched: 20 });

  const demand = { side: 'demand' as const, space };
  const supply = { side: 'supply' as const, availability };

  function proposal(overrides: Partial<MatchProposalDto> = {}): MatchProposalDto {
    return {
      isAllowed: true,
      refusalMessage: null,
      // Not min(40, 20). If this figure reaches the pill, it came off the wire.
      quantity: 33,
      maximum: 20,
      defaultPricePerKg: 5.5,
      ...overrides,
    };
  }

  interface Harness {
    readonly drag: DragStore;
    readonly outcome: DropOutcome;
    readonly asked: { spaceId: number; availabilityId: number }[];
  }

  function harness(responses: Observable<MatchProposalDto>[] = [of(proposal())]): Harness {
    const asked: { spaceId: number; availabilityId: number }[] = [];
    let call = 0;

    const api = {
      matchProposal(spaceId: number, availabilityId: number): Observable<MatchProposalDto> {
        asked.push({ spaceId, availabilityId });

        return responses[Math.min(call++, responses.length - 1)];
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DOCUMENT, useValue: document },
        { provide: ApiClient, useValue: api },
      ],
    });

    return { drag: TestBed.inject(DragStore), outcome: TestBed.inject(DropOutcome), asked };
  }

  /** The effect that watches the hot card runs on change detection, not on the signal write. */
  function settle(): void {
    TestBed.tick();
  }

  it('says nothing until a card is actually hovered', () => {
    const { drag, outcome, asked } = harness();

    drag.begin(demand);
    settle();

    expect(outcome.quantity()).toBeNull();
    expect(asked).toEqual([]);
  });

  it('quotes the server figure, not the smaller of the two unmatched quantities', () => {
    const { drag, outcome, asked } = harness();

    drag.begin(demand);
    drag.enter(supply);
    settle();

    expect(asked).toEqual([{ spaceId: 7, availabilityId: 11 }]);
    expect(outcome.quantity()).toBe(33);
  });

  /**
   * Requirement 1.2 again: the pair is resolved by each record's own side, so dragging the other way
   * round asks about the same two records in the same order.
   */
  it('asks the same question when the drag runs the other way', () => {
    const { drag, asked } = harness();

    drag.begin(supply);
    drag.enter(demand);
    settle();

    expect(asked).toEqual([{ spaceId: 7, availabilityId: 11 }]);
  });

  it('is silent about a pair the server refuses, rather than showing a figure it will not honour', () => {
    const { drag, outcome } = harness([
      of(proposal({ isAllowed: false, refusalMessage: 'There is no unmatched quantity', quantity: 0 })),
    ]);

    drag.begin(demand);
    drag.enter(supply);
    settle();

    expect(outcome.quantity()).toBeNull();
  });

  it('clears when the pointer leaves the card, so no figure outlives its row', () => {
    const { drag, outcome } = harness();

    drag.begin(demand);
    drag.enter(supply);
    settle();
    drag.leave('supply', availability.id);
    settle();

    expect(outcome.quantity()).toBeNull();
  });

  /**
   * The failure this guards against is the worst one available: the previous card's figure sitting on
   * this card's row while the answer for it is still in flight.
   */
  it('does not show the last card’s figure while the next card is still being asked about', () => {
    const pending = new Subject<MatchProposalDto>();
    const { drag, outcome } = harness([of(proposal({ quantity: 33 })), pending]);

    drag.begin(demand);
    drag.enter(supply);
    settle();

    expect(outcome.quantity()).toBe(33);

    drag.enter({ side: 'supply', availability: anAvailability({ id: 12 }) });
    settle();

    expect(outcome.quantity()).toBeNull();

    pending.next(proposal({ quantity: 8 }));

    expect(outcome.quantity()).toBe(8);
  });

  it('asks once per pair, however often the pointer sweeps back over it', () => {
    const { drag, outcome, asked } = harness();

    drag.begin(demand);
    drag.enter(supply);
    settle();
    drag.leave('supply', availability.id);
    settle();
    drag.enter(supply);
    settle();

    expect(asked).toHaveLength(1);
    expect(outcome.quantity()).toBe(33);
  });

  /**
   * The cache is only true of the drag it was built in. Another operator may have filled the record
   * since, and the drop asks again for exactly that reason.
   */
  it('starts the next drag with no memory of the last one', () => {
    const { drag, asked } = harness();

    drag.begin(demand);
    drag.enter(supply);
    settle();
    drag.end();
    settle();

    drag.begin(demand);
    drag.enter(supply);
    settle();

    expect(asked).toHaveLength(2);
  });

  it('stays silent when the request fails, leaving the refusal to the drop', () => {
    const failing = new Observable<MatchProposalDto>((subscriber) =>
      subscriber.error(new Error('offline')),
    );
    const { drag, outcome } = harness([failing]);

    drag.begin(demand);
    drag.enter(supply);
    settle();

    expect(outcome.quantity()).toBeNull();
  });
});
