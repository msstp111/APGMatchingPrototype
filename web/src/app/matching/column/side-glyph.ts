import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatchSide } from '../board/matching-board';

/**
 * The two sides said in glyphs: a works on demand, a cow's head on supply.
 *
 * Both are inline SVG rather than `material-symbols-outlined` spans because **Material Symbols has no
 * cow** — the family carries `agriculture` (a tractor) and `pets` (a paw print) and nothing else in
 * the neighbourhood, and neither of those says livestock. Checked against the family's codepoints,
 * not from memory.
 *
 * The pair comes from **one family**, which is the reason this is one component rather than a cow
 * beside a surviving font glyph: the two sit inches apart in the same header, and a Phosphor cow
 * against a Material factory is two draughtsmen on one row. Paths are Phosphor Icons' `cow` and
 * `factory` (regular), MIT licensed: https://github.com/phosphor-icons/core — Copyright (c) 2023
 * Phosphor Icons. Their 16/256 stroke is the same 6.25% of the box as Material's `wght 300` at 24px,
 * so they carry the same weight as the `construction`, `filter_alt` and `info` glyphs still beside
 * them.
 *
 * It dresses itself off the type it inherits, exactly as the font glyphs it replaces did: `1em`
 * square and `currentColor`, so `.glyph`'s `font-size` still sizes it and `.supply .glyph`'s `color`
 * still colours it, and none of the four call sites needs a rule of its own.
 */
@Component({
  selector: 'app-side-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    svg {
      width: 1em;
      height: 1em;
      display: block;
    }
  `,
})
export class SideGlyph {
  readonly side = input.required<MatchSide>();

  readonly path = computed(() => (this.side() === 'demand' ? FACTORY : COW));
}

const FACTORY =
  'M116,176a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h28A8,8,0,0,1,116,176Zm60-8H148a8,8,0,0,0,0,16h28a8,8,0,0,0,0-16Zm64,48a8,8,0,0,1-8,8H24a8,8,0,0,1,0-16h8V88a8,8,0,0,1,12.8-6.4L96,120V88a8,8,0,0,1,12.8-6.4l38.74,29.05L159.1,29.74A16.08,16.08,0,0,1,174.94,16h18.12A16.08,16.08,0,0,1,208.9,29.74l15,105.13s.08.78.08,1.13v72h8A8,8,0,0,1,240,216Zm-77.86-94.4,8.53,6.4h36.11L193.06,32H174.94ZM48,208H208V144H168a8,8,0,0,1-4.8-1.6l-14.4-10.8,0,0L112,104v32a8,8,0,0,1-12.8,6.4L48,104Z';

const COW =
  'M104,192a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16H96A8,8,0,0,1,104,192Zm72-8H160a8,8,0,0,0,0,16h16a8,8,0,0,0,0-16Zm-76-48a12,12,0,1,0-12-12A12,12,0,0,0,100,136Zm56,0a12,12,0,1,0-12-12A12,12,0,0,0,156,136Zm88.39-13.88A16,16,0,0,1,232,128H200v32a40,40,0,0,1-24,72H80a40,40,0,0,1-24-72V128H24A16,16,0,0,1,8.31,109,56.13,56.13,0,0,1,63.22,64h1.64A55.83,55.83,0,0,1,48,24a8,8,0,0,1,16,0,40,40,0,0,0,40,40h48a40,40,0,0,0,40-40,8,8,0,0,1,16,0,55.83,55.83,0,0,1-16.86,40h1.64a56.13,56.13,0,0,1,54.91,45A15.82,15.82,0,0,1,244.39,122.12ZM72,152.8a40.57,40.57,0,0,1,8-.8h96a40.57,40.57,0,0,1,8,.8V104a24,24,0,0,0-24-24H96a24,24,0,0,0-24,24ZM56,112v-8a39.81,39.81,0,0,1,8-24h-.8A40.09,40.09,0,0,0,24,112Zm144,80a24,24,0,0,0-24-24H80a24,24,0,0,0,0,48h96A24,24,0,0,0,200,192Zm32-80a40.08,40.08,0,0,0-39.2-32H192a39.81,39.81,0,0,1,8,24v8Z';
