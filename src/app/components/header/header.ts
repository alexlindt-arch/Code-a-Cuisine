import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, startWith } from 'rxjs';
@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
})

export class Header {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly isLightHeader = signal(false);
  readonly logoSrc = computed(() =>
    this.isLightHeader() ? 'assets/img/logo-dark.png' : 'assets/img/logo-light.png'
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed()
      )
      .subscribe(() => this.syncHeaderStateFromRoute());
  }

  private syncHeaderStateFromRoute(): void {
    const deepestRoute = this.getDeepestRoute(this.activatedRoute);
    const headerStyle = deepestRoute.snapshot.data['headerStyle'];
    this.isLightHeader.set(headerStyle === 'light');
  }

  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    let currentRoute = route;

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    return currentRoute;
  }
}
