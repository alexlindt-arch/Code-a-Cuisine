/**
 * @file routerlink-componente.ts
 * @description TypeScript module for routerlink componente.
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
 * @description Component or service class RouterlinkComponente.
 */
export class RouterlinkComponente {
  readonly linkText = input.required<string>();
  readonly targetPath = input.required<string>();
  readonly targetClass = input.required<string>();
  readonly imageArrow = input('assets/icons/Arrow-right.png');
  readonly arrowClass = 'arrow-icon';
}
