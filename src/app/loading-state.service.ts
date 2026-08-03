import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingStateService {
  readonly isLoading = signal(false);

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }
}
