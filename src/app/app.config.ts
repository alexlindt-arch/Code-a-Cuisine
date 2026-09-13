/**
 * @file app.config.ts
 * @description Application providers: global error listeners, hash-based router and HttpClient.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs keep deep links working on hosts that ignore .htaccess rewrites.
    provideRouter(routes, withHashLocation()),
    provideHttpClient()
  ]
};