import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, defer, map, shareReplay } from 'rxjs';
import { ApiClient } from '../../api/api-client';
import { LocationOptionDto, ReferenceDataDto } from '../../api/models';

/** Everything the two debug forms need to populate their pickers. */
export interface RecordVocabulary {
  readonly reference: ReferenceDataDto;
  readonly locations: readonly LocationOptionDto[];
}

/**
 * The vocabularies the debug record forms pick from, fetched once and kept for the session.
 *
 * **These are not the filter row's options.** `filters/filter-options.ts` derives its lists from the
 * records that happen to be loaded, which is right for a filter — no option is offered that would
 * match nothing — and wrong for a create form, which has to be able to introduce a stock class or a
 * plant that nothing uses yet. So these come from the server's `SeedConfig`, the one file the roadmap
 * designates for every invented list.
 *
 * Fetched rather than hard-coded for the same reason: a copy of ANZCO's stock classes in TypeScript is
 * a second place APG's real list would have to be swapped in.
 */
@Injectable({ providedIn: 'root' })
export class RecordVocabularies {
  private readonly api = inject(ApiClient);

  /**
   * One request each, replayed to every later opener.
   *
   * `shareReplay` rather than a signal because the forms want it *before* they open: a picker that
   * fills in a moment after the dialog appears invites a choice made against an empty list.
   *
   * `defer` so that nothing is requested until a debug control is actually used. The service is
   * injected by every column header on the screen, and a screen nobody adds a record on should not
   * fetch 300 locations to sit on.
   */
  private readonly reference = defer(() => this.api.referenceData()).pipe(
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly locations = defer(() => this.api.locations()).pipe(
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  load(): Observable<RecordVocabulary> {
    return combineLatest([this.reference, this.locations]).pipe(
      map(([reference, locations]) => ({ reference, locations })),
    );
  }
}
