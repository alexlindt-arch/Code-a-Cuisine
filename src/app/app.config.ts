/**
 * @file app.config.ts
 * @description TypeScript module for app.config.
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