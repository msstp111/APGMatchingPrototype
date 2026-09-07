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
  ProcessorSpaceDto,
  ReferenceDataDto,
  UpdateProcessorSpaceRequest,
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
 * Dates are a native `<input type="date">`, whose value *is* the ISO `yyyy-MM-dd` string the API
 * wants. A Material datepicker would hand the form a JavaScript `Date`, which is the one thing no file
 * under `matching/` may construct.
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
    deliveryDate: new FormControl<string>(this.space?.deliveryDate ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    deliveryTime: new FormControl<string>(this.space?.deliveryTime ?? '', { nonNullable: true }),
    notes: new FormControl<string>(this.space?.notes ?? '', { nonNullable: true }),
  });

  private readonly processor = toSignal(this.form.controls.processor.valueChanges, {
    initialValue: this.form.controls.processor.value,
  });

  private readonly quantity = toSignal(this.form.controls.quantityRequired.valueChanges, {
    initialValue: this.form.controls.quantityRequired.value,
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
    if (this.form.invalid) {
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
          deliveryDate: value.deliveryDate,
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
        deliveryDate: value.deliveryDate,
        deliveryTime: trimmedOrNull(value.deliveryTime),
        notes: trimmedOrNull(value.notes),
      },
    });
  }
}
