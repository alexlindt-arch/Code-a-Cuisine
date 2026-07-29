import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { Header } from './components/header/header';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly title = signal('Code-a-Cuisine');
   private activatedRoute = inject(ActivatedRoute);
  constructor() {
    this.activatedRoute.data.subscribe((data) => {
      if (data['title']) {
        this.title.set(data['title']);
      }
    });
     }
}
