/**
 * @file app.ts
 * @description Root component: global header and the single main landmark around the routed pages.
 */
import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { Header } from './components/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
/**
 * Root component of the application; keeps the title in sync with the route data.
 */
export class App {
  protected readonly title = signal('Code-a-Cuisine');
  private activatedRoute = inject(ActivatedRoute);

  /**
   * Subscribes to the route data and updates the title when a route provides one.
   */
  constructor() {
    this.activatedRoute.data.subscribe((data) => {
      if (data['title']) {
        this.title.set(data['title']);
      }
    });
  }
}
