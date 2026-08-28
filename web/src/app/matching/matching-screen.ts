import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { LivestockAvailabilityDto, ProcessorSpaceDto } from '../api/models';

/**
 * Phase 1's matching screen: two labelled columns proving the DTO contract reaches the client intact
 * — every figure on screen is read straight off the DTO, and this component computes nothing.
 *
 * The columns are DELIBERATELY UNSTYLED. Their visual language is Phase 2's job and Phase 3's build
 * — cards on a week-banded timeline, with carry-over cards, fill meters and status patterning. Do
 * not treat this list as a starting point for that.
 */
@Component({
  selector: 'app-matching-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matching-screen.html',
  styleUrl: './matching-screen.scss',
})
export class MatchingScreen {
  private readonly api = inject(ApiClient);

  readonly spaces = signal<readonly ProcessorSpaceDto[]>([]);
  readonly availability = signal<readonly LivestockAvailabilityDto[]>([]);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.processorSpaces().subscribe({
      next: (records) => this.spaces.set(records),
      error: () => this.error.set('Could not reach the API. Is it running on http://localhost:5286?'),
    });

    this.api.livestockAvailability().subscribe({
      next: (records) => this.availability.set(records),
      error: () => this.error.set('Could not reach the API. Is it running on http://localhost:5286?'),
    });
  }
}
