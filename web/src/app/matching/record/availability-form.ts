import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CreateLivestockAvailabilityRequest,
  LivestockAvailabilityDto,
  LocationOptionDto,
  ReferenceDataDto,
  TransactionType,
  UpdateLivestockAvailabilityRequest,
} from '../../api/models';
import { transactionTypeLabel } from '../card/card-chrome';
import { DebugRibbon } from './debug-ribbon';
import { integerHeads, trimmedOrNull } from './record-form';

/** Add when `record` is null, edit when it is not. */
export interface AvailabilityFormData {
  readonly record: LivestockAvailabilityDto | null;
  readonly reference: ReferenceDataDto;
  readonly locations: readonly LocationOptionDto[];
}

export type AvailabilityFormResult =
  | { readonly action: 'create'; readonly request: CreateLivestockAvailabilityRequest }
  | { readonly action: 'update'; readonly request: UpdateLivestockAvailabilityRequest };

/** The menu is capped, as the location filter's is: a list of 300 is not a menu. */
const LOCATION_LIMIT = 40;

/**
 * The debug form for a Livestock Availability record (Phase 7, sections 3 and 4.3).
 *
 * **Every attribute is editable here**, unlike the demand side — including the quantity, and including
 * a quantity below what is already matched. That edit is the one intended route to the pink
 * "Over-committed" state and it is not blocked: the caption states the consequence, and
 * `RecordActions` asks once more before it writes.
 *
 * **The stock class list is the single supply-side one** and is never cross-referenced against a
 * processor's. The two vocabularies do not align — that is the domain, and the whole point of the
 * screen this record will appear on.
 *
 * **Picking a location settles the farmer** (resolved question 10), so the farmer's name and mobile
 * appear under the field the moment one is chosen. There are ~300 locations, so the control types
 * ahead rather than opening a menu of all of them.
 *
 * Selecting `Finance Stock` opens **no Purchase list**: the draw-down against `purchases.csv` is
 * deferred past pass 1, and its absence here is a decision rather than an omission.
 */
@Component({
  selector: 'app-availability-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    DebugRibbon,
  ],
  templateUrl: './availability-form.html',
  styleUrl: './availability-form.scss',
})
export class AvailabilityForm {
  private readonly dialogRef =
    inject<MatDialogRef<AvailabilityForm, AvailabilityFormResult>>(MatDialogRef);

  readonly data = inject<AvailabilityFormData>(MAT_DIALOG_DATA);

  readonly record = this.data.record;
  readonly isEdit = this.record !== null;

  readonly title = this.isEdit
    ? `Edit livestock availability #${this.record!.id}`
    : 'Add livestock availability';

  /** @see SpaceForm.cancelledNote — the same permitted edit, and the same thing that needs saying. */
  readonly cancelledNote =
    this.record?.status === 'Cancelled'
      ? 'This record is cancelled. Saving changes it; it does not reinstate it, and its matches are ' +
        'unaffected either way.'
      : null;

  readonly transactionTypeText = transactionTypeLabel;

  readonly form = new FormGroup({
    stockClass: new FormControl<string>(this.record?.stockClass ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantityAvailable: new FormControl<number | null>(this.record?.quantityAvailable ?? null, [
      Validators.required,
      Validators.min(1),
      integerHeads,
    ]),
    /** The typed text. The id below is what is submitted, and only a picked option sets it. */
    locationSearch: new FormControl<string>(this.record?.locationName ?? '', {
      nonNullable: true,
    }),
    locationId: new FormControl<number | null>(this.record?.locationId ?? null, [
      Validators.required,
    ]),
    availableFrom: new FormControl<string>(this.record?.availableFrom ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    availabilityDetails: new FormControl<string>(this.record?.availabilityDetails ?? '', {
      nonNullable: true,
    }),
    transactionType: new FormControl<TransactionType | null>(this.record?.transactionType ?? null, [
      Validators.required,
    ]),
    notes: new FormControl<string>(this.record?.notes ?? '', { nonNullable: true }),
  });

  private readonly typedLocation = toSignal(this.form.controls.locationSearch.valueChanges, {
    initialValue: this.form.controls.locationSearch.value,
  });

  private readonly chosenLocationId = toSignal(this.form.controls.locationId.valueChanges, {
    initialValue: this.form.controls.locationId.value,
  });

  private readonly quantity = toSignal(this.form.controls.quantityAvailable.valueChanges, {
    initialValue: this.form.controls.quantityAvailable.value,
  });

  private readonly matching = computed(() => {
    const typed = this.typedLocation().trim().toLowerCase();

    return typed === ''
      ? this.data.locations
      : this.data.locations.filter((location) => location.name.toLowerCase().includes(typed));
  });

  readonly locationOptions = computed(() => this.matching().slice(0, LOCATION_LIMIT));

  /** A capped list must say it is capped, or it reads as the whole list (the Phase 4 rule). */
  readonly hiddenLocationCount = computed(() =>
    Math.max(this.matching().length - LOCATION_LIMIT, 0),
  );

  /**
   * Who the chosen location belongs to. Shown back so the operator can confirm the pick — one farmer
   * per location, so choosing the location is choosing the farmer (requirement 3.3).
   */
  readonly farmer = computed(() => {
    const id = this.chosenLocationId();

    return id === null ? null : (this.data.locations.find((option) => option.id === id) ?? null);
  });

  /**
   * Whether saving this quantity would leave the record over-committed.
   *
   * A comparison against the DTO's own matched-incl-draft figure, and nothing more: the size of the
   * over-run is not composed here. It arrives on the card, computed, the moment the edit lands.
   */
  readonly overCommitCaption = computed(() => {
    const entered = this.quantity();
    const matched = this.record?.matchedInclDraft ?? 0;

    return entered !== null && matched > 0 && entered < matched
      ? `Already ${matched} head matched. Saving this leaves the record over-committed, and its ` +
          `matches are not changed by it.`
      : null;
  });

  /** Only a picked option sets the id, so a half-typed name cannot submit the last one chosen. */
  onLocationPicked(location: LocationOptionDto): void {
    this.form.controls.locationId.setValue(location.id);
    this.form.controls.locationSearch.setValue(location.name);
  }

  onLocationTyped(): void {
    const chosen = this.farmer();

    if (chosen && chosen.name !== this.form.controls.locationSearch.value) {
      this.form.controls.locationId.setValue(null);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();

    const request = {
      stockClass: value.stockClass,
      quantityAvailable: Number(value.quantityAvailable),
      locationId: Number(value.locationId),
      availableFrom: value.availableFrom,
      availabilityDetails: trimmedOrNull(value.availabilityDetails),
      transactionType: value.transactionType!,
      notes: trimmedOrNull(value.notes),
    };

    // The two requests are the same fields today, and separate types on purpose: requirement 4.3's
    // "every attribute" is a decision, not a coincidence of the create form.
    this.dialogRef.close(
      this.isEdit ? { action: 'update', request } : { action: 'create', request },
    );
  }
}
