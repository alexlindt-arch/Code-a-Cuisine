import { Component } from '@angular/core';
import { input } from '@angular/core';

@Component({
  selector: 'app-images-component',
  imports: [],
  templateUrl: './images-component.html',
  styleUrls: ['./images-component.scss'],
})

export class ImagesComponent {
  src = input.required<string>();
  label = input<string>('Hero Image Set');
  class = input.required<string>();

}
