import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LivestockAvailabilityRecord, ProcessorSpaceRecord } from './models';

/**
 * Calls the API on a same-origin `/api` path. In development the Angular dev server proxies that to
 * the ASP.NET Core host (see proxy.conf.json), so there is no base URL to configure and no CORS
 * round trip in the browser.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  processorSpaces(): Observable<ProcessorSpaceRecord[]> {
    return this.http.get<ProcessorSpaceRecord[]>('/api/processor-spaces');
  }

  livestockAvailability(): Observable<LivestockAvailabilityRecord[]> {
    return this.http.get<LivestockAvailabilityRecord[]>('/api/livestock-availability');
  }
}
