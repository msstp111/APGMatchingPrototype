/**
 * The shapes returned by Phase 0's proving endpoints.
 *
 * These are the RAW stored records. They are deliberately NOT the DTO contract: Phase 1 designs
 * that, carrying every computed field — both matched sums, unmatched, derived status, the confirm
 * gate, the week-commencing Sunday — so the client never recomputes a domain value in TypeScript.
 * Do not grow these interfaces; replace them when Phase 1 lands.
 */
export interface ProcessorSpaceRecord {
  readonly id: number;
  readonly processor: string;
  readonly plant: string;
  readonly stockClass: string;
  readonly quantityRequired: number;
  /** An ISO `yyyy-MM-dd` string. Never construct a JavaScript Date from it. */
  readonly deliveryDate: string;
  readonly deliveryTime: string | null;
  readonly notes: string | null;
  readonly status: string;
}

export interface LivestockAvailabilityRecord {
  readonly id: number;
  readonly stockClass: string;
  readonly quantityAvailable: number;
  readonly locationId: number;
  /** An ISO `yyyy-MM-dd` string. Never construct a JavaScript Date from it. */
  readonly availableFrom: string;
  readonly availabilityDetails: string | null;
  readonly transactionType: string;
  readonly notes: string | null;
  readonly status: string;
}
