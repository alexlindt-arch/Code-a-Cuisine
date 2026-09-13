/**
 * @file routerlink-componente.ts
 * @description Text link with an arrow icon used for back and forward navigation.
 */
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImagesComponent } from '../images-component/images-component';

@Component({
  selector: 'app-routerlink-componente',
  imports: [RouterLink, ImagesComponent],
  templateUrl: './routerlink-componente.html',
  styleUrls: ['./routerlink-componente.scss'],
})
/**
 * Router link with a decorative arrow; use ariaLabel when the link has no visible text.
 */
export class RouterlinkComponente {
  readonly linkText = input.required<string>();
  readonly targetPath = input.required<string>();
  readonly targetClass = input.required<string>();
  readonly imageArrow = input('assets/icons/Arrow-right.png');
  readonly ariaLabel = input<string | null>(null);
  readonly arrowClass = 'arrow-icon';
}
