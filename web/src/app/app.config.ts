import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { CARD_DRAG_CONFIG } from './matching/drag/card-press';

// CARD_DRAG_CONFIG is here, at the root, rather than on the two card components, and the reason is in
// its own doc comment: `DragNarrowing` is root-provided and reads the same token to decide when a
// press has become a drag. Provided lower down, CDK would see one threshold and the narrowing
// another.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    CARD_DRAG_CONFIG,
  ],
};
