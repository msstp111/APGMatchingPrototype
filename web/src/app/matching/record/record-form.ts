import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * The two rules both debug forms share.
 *
 * Here rather than duplicated in each so the demand and supply forms cannot come to validate the same
 * thing differently — the same reasoning `_card-geometry.scss` applies to the two columns' dimensions.
 */

/** Head are whole animals (requirement 6.2). `Validators.min(1)` covers the rest. */
export function integerHeads(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (value === null || value === '') {
    return null;
  }

  return Number.isInteger(Number(value)) ? null : { integer: true };
}

/** An empty box is no value, not `""` — the same rule the server applies on the way in. */
export function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();

  return trimmed === '' ? null : trimmed;
}
