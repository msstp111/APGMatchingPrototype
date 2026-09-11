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
import { MatchEditContextDto, MatchStatus, UpdateMatchRequest } from '../../api/models';
import { quantityClass, spaceName, spineClass, transactionTypeLabel } from '../card/card-chrome';
import { SideGlyph } from '../column/side-glyph';

/**
 * What the modal was closed with. The dialog decides nothing and writes nothing: it collects an
 * intent and the field values, and {@link MatchActions} performs the write, publishes the patch and
 * reports what happened.
 */
export type MatchModalResult =
  | { readonly action: 'save'; readonly request: UpdateMatchRequest }
  | { readonly action: 'notify'; readonly request: UpdateMatchRequest }
  | { readonly action: 'confirm'; readonly request: UpdateMatchRequest }
  | { readonly action: 'delete' }
  | { readonly action: 'cancel' };

/**
 * A match, open (design-system.md 11.4).
 *
 * **It is passed a {@link MatchEditContextDto} and nothing else** — the match, both parents in full,
 * and the ceiling — which is fetched by match id. That is why the same match opened from its Processor
 * Space and from its Livestock Availability record is the same modal showing the same figures: there
 * is one fetch, one shape, and no notion of which card it came from.
 *
 * Three rules the footer encodes and must not blur:
 *
 * - **Delete is offered only at `Drafted`** and needs no reason (resolved question 3). It is the
 *   remedy for a mis-drag: the match is gone, and it is not a cancellation.
 * - **Cancel is offered only past `Drafted`**, and goes through its own dialog for the reason and the
 *   warning. The two are never both available.
 * - **Notify is offered only on an ANZCO match at `Drafted`**, and **Confirm at `Drafted` and
 *   `Notified`** — notifying is a step APG may take, not one it must, so the direct draft-to-confirmed
 *   move survives it, and for Alliance Group and SFF it is the only move there has ever been.
 *   `Notify processor` **sends nothing**: it writes the status, and the caption under the fields says
 *   so, because a button with that word on it in front of a processor's own staff must not be allowed
 *   to imply a message went out.
 *
 * Both parent blocks are read-only and fixed at creation (spec p.23), and they are **stacked, supply
 * above demand with an arrow between**, the same way the drop prompt stacks them — the dialog that
 * confirms a match reads the way the one that drafted it read.
 *
 * The two stock classes are shown plainly, in each block's sub-line, and will often look unrelated —
 * `Cows` against `Cow`, `Cattle` against `Mixed Cattle`. That is the domain rather than an error: the
 * vocabularies do not map and neither side is validated against the other. The bordered note that
 * used to say so in words is gone (Mark's call, 2026-09-07): by the time a match exists the operator
 * has already made that judgement at the prompt, and repeating it here only crowded the dialog.
 */
@Component({
  selector: 'app-match-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    SideGlyph,
  ],
  templateUrl: './match-modal.html',
  styleUrl: './match-modal.scss',
})
export class MatchModal {
  private readonly api = inject(ApiClient);
  private readonly dialogRef = inject<MatDialogRef<MatchModal, MatchModalResult>>(MatDialogRef);

  readonly data = inject<MatchEditContextDto>(MAT_DIALOG_DATA);

  readonly match = this.data.match;
  readonly space = this.data.space;
  readonly availability = this.data.availability;

  /** `ANZCO Rangitikei`, in the title and on the space block's name line, from one field. */
  readonly spaceName = spaceName(this.space);

  /**
   * The title says what this dialog is asking to be done, and which slot it is about.
   *
   * It names whatever the footer's filled button does, which since 2026-09-11 is one of three
   * things: a `Drafted` match is here to be **notified** (`Notify match: ANZCO Rangitikei`), a
   * `Notified` one to be **confirmed**, and past that there is nothing left to move and the dialog is
   * an editor (`Edit match: …`). Naming the act is what tells the two match dialogs apart: the drop
   * prompt drafts a match, and this one moves it along.
   *
   * **The match id used to be here and is not any more** (Mark's call, 2026-09-07). `Confirm match
   * #3` named the row in the `Matches` table, which no operator has ever seen and no other screen
   * shows; the processor and plant name the slot they are looking at, on a board where a dozen ANZCO
   * spaces differ only by plant and date. The two parent blocks below still carry their own record
   * ids, so nothing identifying has left the dialog.
   */
  readonly title = `${titleVerb(this.match.status, this.data.canNotify)} match: ${this.spaceName}`;

  /**
   * The availability's unmatched quantity **plus this match's own current quantity** (resolved
   * question 13), computed by the server. There is no maximum on the space side: over-filling demand
   * is legitimate and reads as blue "Over-filled".
   */
  readonly maximum = this.data.maximumQuantity;

  readonly quantity = new FormControl<number | null>(this.match.quantityMatched, [
    Validators.required,
    Validators.min(1),
    Validators.max(this.maximum),
    integerHeads,
  ]);

  readonly price = new FormControl<number | null>(this.match.pricePerKg);

  readonly transport = new FormControl<string>(this.match.transportCompany ?? '', {
    nonNullable: true,
  });

  private readonly quantityValue = toSignal(this.quantity.valueChanges, {
    initialValue: this.quantity.value,
  });

  private readonly priceValue = toSignal(this.price.valueChanges, {
    initialValue: this.price.value,
  });

  private readonly transportValue = toSignal(this.transport.valueChanges, {
    initialValue: this.transport.value,
  });

  /** A failure here costs the operator a picklist, not the match: the carrier can be typed in full. */
  private readonly companies = toSignal(
    this.api.transportCompanies().pipe(catchError(() => of<string[]>([]))),
    { initialValue: [] as string[] },
  );

  // --- the two read-only parent blocks -----------------------------------------------------------

  readonly spaceSpine = spineClass(this.space.status);
  readonly availabilitySpine = spineClass(this.availability.status);
  readonly spaceUnmatchedInk = quantityClass(this.space.quantityState, 'demand');
  readonly availabilityUnmatchedInk = quantityClass(this.availability.quantityState, 'supply');
  readonly transactionType = transactionTypeLabel(this.availability.transactionType);

  readonly spaceSubLine = `${this.space.stockClass} · delivery ${this.space.deliveryDateLabel} · ${
    this.space.deliveryTime || 'no time set'
  }`;

  readonly availabilitySubLine = `${this.availability.stockClass} · available from ${
    this.availability.availableFromLabel
  } · ${this.availability.farmerName || 'no farmer on file'}`;

  // --- the editable fields -------------------------------------------------------------------------

  /**
   * The ceiling spelled out, from three figures the server supplied.
   *
   * The sentence exists because "max 472" invites the question the requirements document got wrong:
   * why is it not the record's original quantity? Naming both halves answers it on the spot.
   *
   * **It is the quantity field's own hint, and its error when the entry goes past it.** It sat in a
   * note under the row until Mark asked for it in the field (design-system.md 11.4.4 said "under the
   * fields"; §11.4 now records the change). The field a sentence sits in is what says which field it
   * is about, and the ceiling constrains exactly one.
   */
  readonly ceilingNote = `Ceiling ${this.maximum} = the availability's ${this.availability.unmatched} unmatched, plus this match's own ${this.match.quantityMatched}.`;

  /**
   * Where the price on this match came from.
   *
   * In the price field's own subscript, wrapping there rather than sitting in a note below the row:
   * the field a hint sits in is what says which field it is about, and a full-width note under three
   * fields reads as belonging to the first of them. The wrap is safe because `.fields` gives the
   * subscript a real height (see the stylesheet).
   *
   * Naming the three parts of the price-table key — processor, **Processor Space** stock class, week
   * commencing — is what makes a wrong-side lookup visible on screen: an operator who knows the space
   * is Cows and sees the availability record's class here has caught the bug for us (resolved
   * question 7).
   */
  readonly priceHint = `Defaulted from ${this.space.processor} · ${this.space.stockClass} · w/c ${this.space.weekCommencingLabel}`;

  readonly transportOptions = computed(() => {
    const typed = this.transportValue().trim().toLowerCase();
    const all = this.companies();

    return typed ? all.filter((company) => company.toLowerCase().includes(typed)) : all;
  });

  // --- what the footer offers ----------------------------------------------------------------------

  /** Resolved question 3: a mis-drag is removed outright, and only a draft is one. */
  readonly canDelete = this.match.status === 'Drafted';

  /** Past Drafted, and with a reason. Never available at the same time as delete. */
  readonly canCancel = this.match.status !== 'Drafted';

  /**
   * **The server's answer, not a status test.** An ANZCO match, still Drafted.
   *
   * Two clauses, and only one of them is about this match: notifying twice is not a second act, and
   * notification is not part of Alliance Group's or SFF's process at all. The second is why this
   * cannot be `status === 'Drafted'` any more — the list of processors APG notifies is a domain rule
   * (`ProcessorNotifications`), and a copy of it in TypeScript would be the first thing to drift when
   * a second processor signs up.
   */
  readonly canNotify = this.data.canNotify;

  /** Both live statuses, because notifying is optional (2026-09-11, amending resolved question 2). */
  readonly canConfirm = this.match.status === 'Drafted' || this.match.status === 'Notified';

  /**
   * The caption under the fields, on a draft only.
   *
   * The word `Notify` on a button is a promise, and this prototype cannot keep it: the mediums are
   * deferred, so the write moves a status and stops. Saying so where the button is is the difference
   * between a demo that shows a lifecycle and one that misleads the room about what the system does.
   */
  readonly notifyNote =
    'Notifying records that this match has been put to the processor. No message is sent — ' +
    'in-app, SMS and email notifications are not part of this prototype.';

  /** Nothing to save is not an error, so Save is simply inert until something differs. */
  readonly changed = computed(
    () =>
      this.quantityValue() !== this.match.quantityMatched ||
      this.priceValue() !== this.match.pricePerKg ||
      this.trimmedTransport() !== (this.match.transportCompany ?? null),
  );

  save(): void {
    if (this.quantity.invalid) {
      return;
    }

    this.dialogRef.close({ action: 'save', request: this.request() });
  }

  /** Carries the form's values for the same reason {@link confirm} does. It sends nothing. */
  notify(): void {
    if (this.quantity.invalid) {
      return;
    }

    this.dialogRef.close({ action: 'notify', request: this.request() });
  }

  /**
   * Confirm carries the form's values, so a match with unsaved edits is saved and confirmed in one
   * write. Two chained calls would leave a half-applied state if the second failed, and the operator
   * with a saved-but-unconfirmed match and a message to interpret.
   */
  confirm(): void {
    if (this.quantity.invalid) {
      return;
    }

    this.dialogRef.close({ action: 'confirm', request: this.request() });
  }

  delete(): void {
    this.dialogRef.close({ action: 'delete' });
  }

  cancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  private request(): UpdateMatchRequest {
    return {
      quantityMatched: Number(this.quantity.value),
      pricePerKg: this.price.value,
      transportCompany: this.trimmedTransport(),
    };
  }

  /** An empty box is no carrier, not an empty string — the same rule the create path applies. */
  private trimmedTransport(): string | null {
    const typed = this.transportValue().trim();

    return typed === '' ? null : typed;
  }
}

/**
 * The verb in the title: whatever the footer's filled button does.
 *
 * It reads `canNotify` rather than testing for `Drafted`, so an Alliance Group or SFF draft — which
 * has no notify step and whose filled button is `Confirm match` — is titled `Confirm match: …`. A
 * title naming an act the footer does not offer is worse than a generic one.
 */
function titleVerb(status: MatchStatus, canNotify: boolean): string {
  if (canNotify) {
    return 'Notify';
  }

  return status === 'Drafted' || status === 'Notified' ? 'Confirm' : 'Edit';
}

function integerHeads(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (value === null || value === '') {
    return null;
  }

  return Number.isInteger(Number(value)) ? null : { integer: true };
}
