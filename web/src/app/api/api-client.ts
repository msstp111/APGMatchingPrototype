import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LivestockAvailabilityDto, ProcessorSpaceDto, WeekBandDto } from './models';

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
}
