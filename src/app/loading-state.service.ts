/**
 * @file loading-state.service.ts
 * @description Global flag for a running recipe request (used e.g. by the header to switch its style).
 */
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
/**
 * Shares whether a recipe request is currently running.
 */
export class LoadingStateService {
  readonly isLoading = signal(false);

  /**
   * Sets the global loading flag.
   * @param isLoading - True while a request is running.
   */
  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }
}
