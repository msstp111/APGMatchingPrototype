import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  LivestockAvailabilityDto,
  MatchWriteResultDto,
  ProcessorSpaceDto,
} from '../../api/models';

/**
 * One record, or two, as the server recomputed them after a write.
 *
 * Either half may be absent, and the two cases are meaningfully different. A match write returns
 * **both** parents, because a match changes both at once — both matched sums, both unmatched figures,
 * both quantity states, and the availability record's derived status. Confirming a Processor Space
 * returns only the space, because it touches nothing else; carrying an availability record alongside
 * it would imply otherwise on the one screen where what a write does and does not reach is the thing
 * most easily misread.
 */
export interface RecordPatch {
  readonly space?: ProcessorSpaceDto | null;
  readonly availability?: LivestockAvailabilityDto | null;
}

/**
 * The one stream every write on this screen publishes to, and the one place the screen listens.
 *
 * Phase 5 had a single writer — the drop — so it owned its own subject. Phase 6 adds five more (edit,
 * confirm, delete, cancel, and confirming a space) and one of them patches a single record rather than
 * a pair. A subject per writer would mean a subscription per writer in `matching-screen` and, sooner
 * or later, two of them applying a patch in slightly different ways.
 *
 * Nothing here computes: a patch carries the server's own recomputation of the records, and the screen
 * replaces what it holds by id. That is what makes an edit's effect on both columns immediate
 * (Phase 6, 3.4) without a refetch.
 */
@Injectable({ providedIn: 'root' })
export class RecordPatches {
  private readonly patched = new Subject<RecordPatch>();

  /** Every write, in the order it completed. */
  readonly patches: Observable<RecordPatch> = this.patched.asObservable();

  publish(patch: RecordPatch): void {
    this.patched.next(patch);
  }

  /** A match write, which always carries both parents. */
  publishWrite(result: MatchWriteResultDto): void {
    this.publish({ space: result.space, availability: result.availability });
  }
}
