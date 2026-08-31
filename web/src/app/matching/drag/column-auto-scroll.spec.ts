import { AUTO_SCROLL_ZONE, scrollStep } from './column-auto-scroll';

describe('Column auto-scroll', () => {
  const rect = { top: 100, bottom: 400, left: 50, right: 250 };

  it('does not scroll when the pointer is in the middle of the list', () => {
    expect(scrollStep(rect, { x: 150, y: 250 })).toBe(0);
  });

  it('scrolls up near the top edge and down near the bottom', () => {
    expect(scrollStep(rect, { x: 150, y: 110 })).toBeLessThan(0);
    expect(scrollStep(rect, { x: 150, y: 390 })).toBeGreaterThan(0);
  });

  it('ramps up toward the outer edge', () => {
    const inner = Math.abs(scrollStep(rect, { x: 150, y: 100 + AUTO_SCROLL_ZONE - 4 }));
    const outer = Math.abs(scrollStep(rect, { x: 150, y: 102 }));

    expect(outer).toBeGreaterThan(inner);
  });

  it('ignores a pointer that is over the other column', () => {
    expect(scrollStep(rect, { x: 10, y: 110 })).toBe(0);
    expect(scrollStep(rect, { x: 400, y: 390 })).toBe(0);
  });

  it('keeps scrolling a short way past the last card, but not into the column header', () => {
    expect(scrollStep(rect, { x: 150, y: 400 + 20 })).toBeGreaterThan(0);
    expect(scrollStep(rect, { x: 150, y: 400 + AUTO_SCROLL_ZONE + 1 })).toBe(0);
    expect(scrollStep(rect, { x: 150, y: 100 - AUTO_SCROLL_ZONE - 1 })).toBe(0);
  });
});
