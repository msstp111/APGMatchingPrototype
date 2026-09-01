import { aMatch } from '../testing/dto-fixtures';
import {
  cancelledPartnerCount,
  cancelledPartnerTitle,
  matchBreakdown,
  matchCountLabel,
  matchSummaryLabel,
} from './card-chrome';

describe('Match affordance', () => {
  it('says no matches when the array is empty — cancelled ones never arrive', () => {
    expect(matchSummaryLabel([])).toBe('no matches');
    expect(matchBreakdown([])).toBe('No matches on this record');
    expect(matchCountLabel(0)).toBe('no matches');
  });

  it('calls out drafts, because every match this phase creates is one', () => {
    const matches = [aMatch({ id: 1, status: 'Drafted' }), aMatch({ id: 2, status: 'Confirmed' })];

    expect(matchSummaryLabel(matches)).toBe('2 matches · 1 draft');
    expect(matchBreakdown(matches)).toBe('1 drafted · 1 confirmed');
  });

  it('says confirmed only when every live match is', () => {
    expect(matchSummaryLabel([aMatch({ status: 'Confirmed' })])).toBe('1 match · confirmed');
  });
});

/**
 * Cancelling a record never cascades, so a live match under a cancelled parent is a normal state that
 * this card has no other way of showing: its own status, its own meter and its own counts are all
 * untouched by what happened on the other side.
 */
describe('A match whose partner record has been cancelled', () => {
  const live = aMatch({ id: 1 });
  const spaceGone = aMatch({ id: 2, spaceStatus: 'Cancelled' });
  const recordGone = aMatch({ id: 3, availabilityStatus: 'Cancelled' });

  it('counts the cancelled partner on whichever side is looking', () => {
    expect(cancelledPartnerCount([live, spaceGone], 'supply')).toBe(1);
    expect(cancelledPartnerCount([live, spaceGone], 'demand')).toBe(0);
    expect(cancelledPartnerCount([live, recordGone], 'demand')).toBe(1);
    expect(cancelledPartnerCount([live, recordGone], 'supply')).toBe(0);
  });

  it('says which side went and that the matches did not', () => {
    expect(cancelledPartnerTitle(1, 'demand')).toContain('livestock availability record has been');
    expect(cancelledPartnerTitle(2, 'supply')).toContain('processor spaces have been');
    expect(cancelledPartnerTitle(1, 'supply')).toContain('never cascades');
  });
});
