import { stockClassTile } from './stock-classes';

/**
 * The stock-class tile has to cope with two vocabularies that do not line up, and with a class APG
 * adds after this prototype is written. Nothing may ever render bare.
 */
describe('stockClassTile', () => {
  it('gives a known class its monogram and species', () => {
    expect(stockClassTile('Lamb')).toEqual({ monogram: 'LM', species: 'sheep' });
    expect(stockClassTile('Prime')).toEqual({ monogram: 'PR', species: 'cattle' });
    expect(stockClassTile('Deer')).toEqual({ monogram: 'DE', species: 'deer' });
  });

  /**
   * `Lamb` is supply's spelling and ANZCO's, `Lambs` is SFF's. They are separate entries in separate
   * vocabularies and the screen must not present the difference as an error — but they are the same
   * animal, so they get the same tile.
   */
  it('treats the two spellings of a class as the same animal', () => {
    expect(stockClassTile('Lambs')).toEqual(stockClassTile('Lamb'));
    expect(stockClassTile('Cows')).toEqual(stockClassTile('Cow'));
    expect(stockClassTile('Bulls')).toEqual(stockClassTile('Bull'));
  });

  it('distinguishes the classes that share a first letter', () => {
    // A monogram is only worth having if it separates the classes an operator sees side by side.
    const distinct = new Set(
      ['Nat Beef - Ultra', 'Nat Beef - Premium', 'GFNB ultra', 'GFNB premium'].map(
        (c) => stockClassTile(c).monogram,
      ),
    );

    expect(distinct.size).toBe(4);
  });

  it('falls back to the first two characters for a class it has never seen', () => {
    expect(stockClassTile('Weaner Steers')).toEqual({ monogram: 'WE', species: 'cattle' });
    expect(stockClassTile('heifer')).toEqual({ monogram: 'HE', species: 'cattle' });
  });

  it('still renders something for a one-character or blank class', () => {
    // Never bare: a tile with nothing in it reads as a rendering failure.
    expect(stockClassTile('X').monogram).toBe('X');
    expect(stockClassTile('').monogram).toBe('?');
    expect(stockClassTile('   ').monogram).toBe('?');
  });
});
