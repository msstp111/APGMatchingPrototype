import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CancelMatchRequest,
  CreateMatchRequest,
  LivestockAvailabilityDto,
  MatchCancellationReason,
  MatchEditContextDto,
  MatchProposalDto,
  MatchWriteResultDto,
  ProcessorSpaceDto,
  UpdateMatchRequest,
  WeekBandDto,
} from './models';

/**
 * Calls the API on a same-origin `/api` path. In development the Angular dev server proxies that to
 * the ASP.NET Core host (see proxy.conf.json), so there is no base URL to configure and no CORS
 * round trip in the browser.
 *
 * Each endpoint returns the whole working set for its side, sorted soonest-first, with every computed
 * field already on it. Filtering and sorting happen client-side over the loaded set — the dataset is
 * small enough to hold in memory and filtering has to feel instantaneous — but nothing is ever
 * *computed* client-side.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  processorSpaces(): Observable<ProcessorSpaceDto[]> {
    return this.http.get<ProcessorSpaceDto[]>('/api/processor-spaces');
  }

  livestockAvailability(): Observable<LivestockAvailabilityDto[]> {
    return this.http.get<LivestockAvailabilityDto[]>('/api/livestock-availability');
  }

  /**
   * The week bands both columns are drawn on, soonest first and with no gaps. A calendar rather than a
   * record set, which is why it is its own endpoint.
   */
  weekBands(): Observable<WeekBandDto[]> {
    return this.http.get<WeekBandDto[]>('/api/week-bands');
  }

  /**
   * Whether a dropped pair may be matched, and on what terms. Asked at the moment of the drop, before
   * any dialog opens, because a pair with nothing left to match earns a refusal rather than a dialog.
   */
  matchProposal(
    processorSpaceId: number,
    livestockAvailabilityId: number,
  ): Observable<MatchProposalDto> {
    return this.http.get<MatchProposalDto>('/api/match-proposal', {
      params: { processorSpaceId, livestockAvailabilityId },
    });
  }

  /** Creates one match at status `Drafted`. Never merges into an existing one. */
  createMatch(request: CreateMatchRequest): Observable<MatchWriteResultDto> {
    return this.http.post<MatchWriteResultDto>('/api/matches', request);
  }

  /**
   * Deletes a drafted match. This is the undo behind the creation snack bar; the server refuses it for
   * anything past Drafted, which has to be cancelled with a reason instead (Phase 6).
   */
  deleteMatch(id: number): Observable<MatchWriteResultDto> {
    return this.http.delete<MatchWriteResultDto>(`/api/matches/${id}`);
  }

  /** The carriers the quantity prompt offers. Optional on a match, so this is a convenience. */
  transportCompanies(): Observable<string[]> {
    return this.http.get<string[]>('/api/transport-companies');
  }

  /**
   * Everything the match modal opens with: the match, both parents in full, and the edit ceiling.
   *
   * **By match id alone.** The same call serves a match opened from its Processor Space and the same
   * match opened from its Livestock Availability record, which is what makes those two the same thing
   * rather than two things that resemble each other.
   */
  match(id: number): Observable<MatchEditContextDto> {
    return this.http.get<MatchEditContextDto>(`/api/matches/${id}`);
  }

  /** Edits the three editable fields. The server re-checks the ceiling whatever the dialog allowed. */
  updateMatch(id: number, request: UpdateMatchRequest): Observable<MatchWriteResultDto> {
    return this.http.put<MatchWriteResultDto>(`/api/matches/${id}`, request);
  }

  /**
   * Drafted to Confirmed, carrying the form's current values so a match with unsaved edits is saved
   * and confirmed in a single write rather than in two calls that can half-fail.
   */
  confirmMatch(id: number, request: UpdateMatchRequest): Observable<MatchWriteResultDto> {
    return this.http.post<MatchWriteResultDto>(`/api/matches/${id}/confirm`, request);
  }

  /**
   * Cancels a match past Drafted, with its reason. The result carries no match: a cancelled match is
   * excluded from both parents' collections, which is what makes it leave the screen.
   */
  cancelMatch(id: number, reason: MatchCancellationReason): Observable<MatchWriteResultDto> {
    const request: CancelMatchRequest = { reason };

    return this.http.post<MatchWriteResultDto>(`/api/matches/${id}/cancel`, request);
  }

  /**
   * Confirms a Processor Space — the explicit APG action that sets its **stored** status.
   *
   * It returns the space alone, not the two-parent shape the match writes use, because confirming a
   * space touches no availability record and returning one would imply it had.
   */
  confirmSpace(id: number): Observable<ProcessorSpaceDto> {
    return this.http.post<ProcessorSpaceDto>(`/api/processor-spaces/${id}/confirm`, {});
  }
}
