/**
 * @file impress.ts
 * @description Imprint page with project and author information.
 */
import { Component } from '@angular/core';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';

@Component({
  selector: 'app-impress',
  imports: [RouterlinkComponente],
  templateUrl: './impress.html',
  styleUrls: ['./impress.scss'],
})
/**
 * Imprint page; the back link only shows an arrow, so it gets an accessible label.
 */
export class Impress {
  homeLinkText = '';
  homeAriaLabel = 'Back to home page';
  homeTargetPath = '';
  homeTargetClass = 'home-link';
  homeImageArrow = 'assets/icons/Arrow-left-dark.png';
}
