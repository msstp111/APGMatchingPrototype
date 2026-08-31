import { aMatch } from '../testing/dto-fixtures';
import { matchBreakdown, matchCountLabel, matchSummaryLabel } from './card-chrome';

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
