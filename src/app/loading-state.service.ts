/**
 * @file loading-state.service.ts
 * @description TypeScript module for loading state.service.
 */
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
/**
 * @description Component or service class LoadingStateService.
 */
export class LoadingStateService {
  readonly isLoading = signal(false);

  /**
   * @description Method setLoading.
   */
  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }
}