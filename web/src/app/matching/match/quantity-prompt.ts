import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { catchError, of } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { CreateMatchRequest, MatchProposalDto } from '../../api/models';
import { quantityClass, spaceName, spineClass, transactionTypeLabel } from '../card/card-chrome';
import { MatchPair } from '../drag/card-drag';

/** What the drop hands the prompt: the two records in full, and the server's terms for matching them. */
export interface QuantityPromptData {
  readonly pair: MatchPair;
  readonly proposal: MatchProposalDto;
}

/**
 * The one prompt in the drag: how many head, at what price, on whose truck (design-system.md 11.1).
 *
 * **It proposes nothing of its own.** The opening quantity, the ceiling and the default price all
 * arrive on {@link MatchProposalDto}, computed by `Apg.Domain`, and the dialog's job is to show them,
 * let them be overridden within the rules, and hand back what the operator settled on.
 *
 * Two rules here are asymmetric on purpose (requirement 2.4, resolved question 1):
 *
 * - the maximum is the **availability** record's unmatched quantity, because a farmer cannot supply
 *   animals they do not have;
 * - there is **no maximum on the space side**. Over-filling demand is legitimate — a meatworks' slot
 *   deliberately over-committed reads as blue "Over-filled" and is a normal state of the screen.
 *
 * And when the cap is reached the field says so in words rather than silently clamping the number: an
 * input that quietly rewrites what was typed leaves an operator believing they entered something else.
 */
@Component({
  selector: 'app-quantity-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
  ],
  templateUrl: './quantity-prompt.html',
  styleUrl: './quantity-prompt.scss',
})
export class QuantityPrompt {
  private readonly api = inject(ApiClient);
  private readonly dialogRef = inject<MatDialogRef<QuantityPrompt, CreateMatchRequest>>(MatDialogRef);

  readonly data = inject<QuantityPromptData>(MAT_DIALOG_DATA);

  readonly space = this.data.pair.space;
  readonly availability = this.data.pair.availability;
  readonly proposal = this.data.proposal;

  readonly quantity = new FormControl<number | null>(this.proposal.quantity, [
    Validators.required,
    Validators.min(1),
    Validators.max(this.proposal.maximum),
    integerHeads,
  ]);

  /** Optional, and left empty when the price table had no entry — a blank is honest, a zero is not. */
  readonly price = new FormControl<number | null>(this.proposal.defaultPricePerKg);

  readonly transport = new FormControl<string>('', { nonNullable: true });

  private readonly quantityValue = toSignal(this.quantity.valueChanges, {
    initialValue: this.quantity.value,
  });

  private readonly typedTransport = toSignal(this.transport.valueChanges, {
    initialValue: this.transport.value,
  });

  /**
   * A failure here costs the operator a picklist, not the match — transport is optional at draft time
   * and can be typed in full — so it degrades to an empty list rather than to an error.
   */
  private readonly companies = toSignal(
    this.api.transportCompanies().pipe(catchError(() => of<string[]>([]))),
    { initialValue: [] as string[] },
  );

  readonly spaceSpine = spineClass(this.space.status);
  readonly availabilitySpine = spineClass(this.availability.status);
  readonly spaceUnmatchedInk = quantityClass(this.space.quantityState, 'demand');
  readonly availabilityUnmatchedInk = quantityClass(this.availability.quantityState, 'supply');
  readonly transactionType = transactionTypeLabel(this.availability.transactionType);

  /**
   * `Draft match — ANZCO Kokiri`: the act, then the space the animals are going to.
   *
   * The word in front is `Draft` because that is what pressing `Create match` produces — a `Drafted`
   * match, not a commitment — and because the dialog that comes next says `Confirm match`. Two
   * dialogs that both said only `Match` left the operator to work out which of the two acts they were
   * being asked for.
   *
   * **The number that used to be here is gone.** It read `Draft match — 132 head` and followed the
   * quantity field as it was edited, which is where the figure already is, 200px below. Naming the
   * processor and plant instead says which of a screen full of near-identical ANZCO slots this dialog
   * is about — the one thing the operator cannot otherwise recover once the dialog covers the board
   * (Mark's call, 2026-09-07).
   */
  readonly spaceName = spaceName(this.space);

  /**
   * Short enough for one line of a 148px field, and it has to be.
   *
   * Material's subscript wrapper is a fixed height — more so at `density: -2` — so a hint that wraps
   * overflows it rather than pushing what follows down, and lands under the dialog's own actions. The
   * sentence that will not fit ({@link priceNote}) sits in normal flow below the row instead. The
   * default quantity is not restated here because the field is already prefilled with it.
   */
  readonly quantityHint = `max ${this.proposal.maximum}`;

  /**
   * The availability unmatched figure, in the words the operator asked for, the moment they type
   * above it — a hint, not an error that waits for blur.
   */
  readonly quantityCaption = computed(() => {
    const entered = this.quantityValue();

    return entered != null && entered > this.availability.unmatched
      ? `Max is ${this.availability.unmatched}`
      : this.quantityHint;
  });

  /**
   * The key is the **Processor Space** stock class (resolved question 7). Naming the three parts of
   * the key in the hint is what makes a wrong-side lookup visible on screen: an operator who knows the
   * space is Prime and sees the availability record's class here has caught the bug for us.
   */
  /**
   * It lives in the price field's own subscript and wraps to four lines there, which is Mark's call
   * and the right one: **the field it sits in is what says which field it is about.** Moved out to a
   * note below the row it had to buy that association back in words, and a full-width note under three
   * fields reads as belonging to the first of them whatever it says.
   *
   * The wrap is safe because `.fields` gives the subscript a real height (see the stylesheet) — four
   * lines push the dialog's actions down rather than landing on top of them, which is what they did
   * before the first browser pass.
   *
   * Wording is design-system.md 11.1's, verbatim. Naming the three parts of the price-table key is
   * what makes a wrong-side lookup visible on screen: an operator who knows the space is Prime and
   * sees the availability record's class here has caught the bug for us (resolved question 7).
   */
  readonly priceHint =
    this.proposal.defaultPricePerKg != null
      ? `Default for ${this.space.processor} · ${this.space.stockClass} · w/c ${this.space.weekCommencingLabel}`
      : `No default price for ${this.space.processor} · ${this.space.stockClass} · w/c ${this.space.weekCommencingLabel}`;

  readonly transportOptions = computed(() => {
    const typed = this.typedTransport().trim().toLowerCase();
    const all = this.companies();

    return typed ? all.filter((company) => company.toLowerCase().includes(typed)) : all;
  });

  create(): void {
    if (this.quantity.invalid || this.quantity.value === null) {
      return;
    }

    const company = this.transport.value.trim();

    this.dialogRef.close({
      processorSpaceId: this.space.id,
      livestockAvailabilityId: this.availability.id,
      quantityMatched: Number(this.quantity.value),
      pricePerKg: this.price.value,
      transportCompany: company === '' ? null : company,
    });
  }
}

function integerHeads(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (value === null || value === '') {
    return null;
  }

  return Number.isInteger(Number(value)) ? null : { integer: true };
}
