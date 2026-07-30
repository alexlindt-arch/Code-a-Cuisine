import { Component } from '@angular/core';
import { input } from '@angular/core';

@Component({
  selector: 'app-images-component',
  imports: [],
  templateUrl: './images-component.html',
  styleUrls: ['./images-component.scss'],
})
/**
 * The ImagesComponent class represents a component that displays images in the application.
 * It contains properties for the image source, label, and CSS class.
 * The src and class properties are required inputs, while the label property has a default value.
 */
export class ImagesComponent {
  src = input.required<string>();
  label = input<string>('Hero Image Set');
  class = input.required<string>();

}
