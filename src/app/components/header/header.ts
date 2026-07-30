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
/** * The Header class represents the header component of the application.
 * It manages the header's appearance based on the current route and listens for route changes to update the header state accordingly.
 * */

export class Header {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly isLightHeader = signal(false);
  readonly logoSrc = computed(() =>
    this.isLightHeader() ? 'assets/img/logo-dark.png' : 'assets/img/logo-light.png'
  );
/**
 * The Header class represents the header component of the application.
 * It manages the header's appearance based on the current route and listens for route changes to update the header state accordingly.
 * */
  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed()
      )
      .subscribe(() => this.syncHeaderStateFromRoute());
  }
/** * Synchronizes the header state based on the current route's data.
 * It retrieves the deepest activated route and checks for the 'headerStyle' data property.
 * If the 'headerStyle' is set to 'light', it updates the isLightHeader signal accordingly.
 */
  private syncHeaderStateFromRoute(): void {
    const deepestRoute = this.getDeepestRoute(this.activatedRoute);
    const headerStyle = deepestRoute.snapshot.data['headerStyle'];
    this.isLightHeader.set(headerStyle === 'light');
  }
/** * Retrieves the deepest activated route from the provided route.
 * It traverses the route tree to find the last child route, which represents the most specific route in the hierarchy.
 * @param route - The starting activated route to traverse.
 * @returns The deepest activated route found in the route tree.
 */
  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    let currentRoute = route;

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    return currentRoute;
  }
}
