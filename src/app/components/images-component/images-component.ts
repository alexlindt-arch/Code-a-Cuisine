/**
 * @file images-component.ts
 * @description Reusable image element with a CSS class and alternative text.
 */
import { Component } from '@angular/core';
import { input } from '@angular/core';

@Component({
  selector: 'app-images-component',
  imports: [],
  templateUrl: './images-component.html',
  styleUrls: ['./images-component.scss'],
})
/**
 * Renders one image; pass an empty label for decorative images.
 */
export class ImagesComponent {
  src = input.required<string>();
  label = input<string>('Hero Image Set');
  class = input.required<string>();
}
