import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CreateProcessorSpaceRequest,
  DayOptionDto,
  ProcessorSpaceDto,
  ReferenceDataDto,
  UpdateProcessorSpaceRequest,
  WeekOptionDto,
} from '../../api/models';
import { DebugRibbon } from './debug-ribbon';
import { integerHeads, trimmedOrNull } from './record-form';

/** Add when `space` is null, edit when it is not. One dialog, because it is one set of fields. */
export interface SpaceFormData {
  readonly space: ProcessorSpaceDto | null;
  readonly reference: ReferenceDataDto;
}

/** The dialog closes with an intent; `RecordActions` performs the write. */
export type SpaceFormResult =
  | { readonly action: 'create'; readonly request: CreateProcessorSpaceRequest }
  | { readonly action: 'update'; readonly request: UpdateProcessorSpaceRequest };

/**
 * The debug form for a Processor Space (Phase 7, sections 2 and 4.2).
 *
 * Two things here are rules rather than conveniences:
 *
 * **The plant and stock class pickers hold the chosen processor's own lists, and changing the
 * processor clears a selection that is no longer in them.** The three vocabularies are
 * processor-specific and do not overlap; leaving `Lorneville` selected under ANZCO would be a form
 * that submits something the server then refuses, or worse, does not.
 *
 * **On an edit, the processor and the stock class are read-only** (requirement 4.2 lists neither).
 * They are what the meatworks booked: re-pointing an existing slot at another processor would re-key
 * its default price and invalidate its plant in the same stroke.
 *
 * **The delivery date is asked for in two parts** (2026-09-11): the week commencing, then the weekday
 * within it. That is the shape the screen itself has — a space is booked into a week band and sits on
 * a day inside it, and the card's date cell now names only the weekday — so the form asks the two
 * questions the operator is actually answering rather than one date that has to be decomposed by eye.
 *
 * The date it submits is `week.days[index].date`: **a lookup into a list the server sent, never a
 * sum**. That is the whole reason `WeekOptionDto` carries its seven days. Composing the date here
 * would mean advancing an ISO string by a weekday's offset, which is the date arithmetic
 * `no-domain-arithmetic.spec.ts` forbids, and the native `<input type="date">` this pair replaces was
 * on the card for the same rule — its value *was* the ISO string, so nothing had to be worked out.
 *
 * The two controls are independent: changing the week keeps the weekday, which is what makes "the same
 * slot, a week later" one click. The API contract is unchanged — it still receives one
 * `deliveryDate`.
 */
@Component({
  selector: 'app-space-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    DebugRibbon,
  ],
  templateUrl: './space-form.html',
  styleUrl: './space-form.scss',
})
export class SpaceForm {
  private readonly dialogRef = inject<MatDialogRef<SpaceForm, SpaceFormResult>>(MatDialogRef);

  readonly data = inject<SpaceFormData>(MAT_DIALOG_DATA);

  readonly space = this.data.space;
  readonly isEdit = this.space !== null;

  readonly title = this.isEdit ? `Edit processor space #${this.space!.id}` : 'Add processor space';

  /**
   * Editing a cancelled record is permitted — the phase restricts editing by field, never by status,
   * and refusing it here would sit oddly beside Phase 6, which lets a *Confirmed* match be edited with
   * a prompt. But the form has to say so: a cancelled record is off both columns' default filters, so
   * whoever opened this may not have registered that the card was struck through, and saving it will
   * not reinstate it.
   */
  readonly cancelledNote =
    this.space?.status === 'Cancelled'
      ? 'This space is cancelled. Saving changes it; it does not reinstate it, and its matches are ' +
        'unaffected either way.'
      : null;

  readonly form = new FormGroup({
    processor: new FormControl<string>(this.space?.processor ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    plant: new FormControl<string>(this.space?.plant ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    stockClass: new FormControl<string>(this.space?.stockClass ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantityRequired: new FormControl<number | null>(this.space?.quantityRequired ?? null, [
      Validators.required,
      Validators.min(1),
      integerHeads,
    ]),
    // The Sunday, as its ISO string — the same identity `WeekOptionDto.weekCommencing` has, so the
    // option is found by string equality and no date is ever parsed.
    weekCommencing: new FormControl<string>(this.space?.weekCommencing ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // The index into that week's seven days, 0 = Sunday. An index rather than the date itself so that
    // changing the week carries the chosen weekday across instead of emptying the control.
    //
    // `Validators.required` is correct on a 0: Angular treats only null, undefined and an empty
    // string or array as missing, so Sunday is a value like any other.
    weekday: new FormControl<number | null>(SpaceForm.weekdayOf(this.space, this.data.reference), [
      Validators.required,
    ]),
    deliveryTime: new FormControl<string>(this.space?.deliveryTime ?? '', { nonNullable: true }),
    notes: new FormControl<string>(this.space?.notes ?? '', { nonNullable: true }),
  });

  private readonly processor = toSignal(this.form.controls.processor.valueChanges, {
    initialValue: this.form.controls.processor.value,
  });

  private readonly quantity = toSignal(this.form.controls.quantityRequired.valueChanges, {
    initialValue: this.form.controls.quantityRequired.value,
  });

  private readonly weekCommencing = toSignal(this.form.controls.weekCommencing.valueChanges, {
    initialValue: this.form.controls.weekCommencing.value,
  });

  private readonly weekday = toSignal(this.form.controls.weekday.valueChanges, {
    initialValue: this.form.controls.weekday.value,
  });

  /** Every week the space may be booked into — a calendar the server built, not a range composed here. */
  readonly weeks: readonly WeekOptionDto[] = this.data.reference.weeks;

  /** The chosen week's own seven days. Empty until a week is chosen, exactly like the plant list. */
  readonly days = computed<readonly DayOptionDto[]>(
    () => this.weeks.find((week) => week.weekCommencing === this.weekCommencing())?.days ?? [],
  );

  /**
   * The delivery date the two controls name, or null while either is unanswered.
   *
   * An index into the server's list. Nothing here adds a day to anything, which is the point of
   * shipping the days at all.
   */
  readonly deliveryDate = computed<string | null>(() => {
    const index = this.weekday();

    return index === null ? null : (this.days()[index]?.date ?? null);
  });

  /** The chosen processor's own entry, and with it both of its lists. */
  private readonly chosen = computed(
    () => this.data.reference.processors.find((option) => option.name === this.processor()) ?? null,
  );

  readonly plants = computed(() => this.chosen()?.plants ?? []);

  readonly stockClasses = computed(() => this.chosen()?.stockClasses ?? []);

  /**
   * Whether saving this quantity would leave the space over-filled — a comparison against a figure the
   * server computed, never a sum worked out here.
   *
   * Over-filling a space is permitted and expected (resolved question 1), so this is a caption rather
   * than an error: the field stays valid and the button stays enabled.
   */
  readonly overFillCaption = computed(() => {
    const entered = this.quantity();
    const matched = this.space?.matchedInclDraft ?? 0;

    return entered !== null && matched > 0 && entered < matched
      ? `Already ${matched} head matched. Saving this leaves the space over-filled.`
      : null;
  });

  /**
   * Clears a plant or stock class the new processor does not have.
   *
   * Leaving a stale one is the failure this exists to prevent: the control would still show
   * `Lorneville` while the menu behind it no longer contains it, and the form would submit a pairing
   * that belongs to nobody. Reachable only when adding — an edit cannot change the processor.
   */
  onProcessorChange(): void {
    const plants = this.plants();
    const stockClasses = this.stockClasses();
    const { plant, stockClass } = this.form.controls;

    if (!plants.includes(plant.value)) {
      plant.setValue('');
    }

    if (!stockClasses.includes(stockClass.value)) {
      stockClass.setValue('');
    }
  }

  save(): void {
    const deliveryDate = this.deliveryDate();

    // The date is the one value the form does not hold directly, so it is checked beside the form's
    // own validity rather than trusted from it: a week the server no longer offers would leave both
    // controls filled and the pair naming nothing.
    if (this.form.invalid || deliveryDate === null) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const quantityRequired = Number(value.quantityRequired);

    if (this.isEdit) {
      this.dialogRef.close({
        action: 'update',
        request: {
          plant: value.plant,
          quantityRequired,
          deliveryDate,
          deliveryTime: trimmedOrNull(value.deliveryTime),
          notes: trimmedOrNull(value.notes),
        },
      });

      return;
    }

    this.dialogRef.close({
      action: 'create',
      request: {
        processor: value.processor,
        plant: value.plant,
        stockClass: value.stockClass,
        quantityRequired,
        deliveryDate,
        deliveryTime: trimmedOrNull(value.deliveryTime),
        notes: trimmedOrNull(value.notes),
      },
    });
  }

  /**
   * Which weekday an existing space falls on: the position of its delivery date in its own week's
   * seven days.
   *
   * A search rather than a calculation, for the same reason the form composes its date by lookup — and
   * it is the reason the server's week list has to cover every record. A week missing from it leaves
   * this null and the form opens with the weekday unanswered, which is visible and recoverable; a
   * date derived here would be neither.
   */
  private static weekdayOf(space: ProcessorSpaceDto | null, reference: ReferenceDataDto): number | null {
    if (space === null) {
      return null;
    }

    const week = reference.weeks.find((option) => option.weekCommencing === space.weekCommencing);
    const index = week?.days.findIndex((day) => day.date === space.deliveryDate) ?? -1;

    return index === -1 ? null : index;
  }
}
