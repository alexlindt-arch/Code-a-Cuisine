/**
 * @file button.ts
 * @description Primary call-to-action button of the landing page.
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrls: ['./button.scss'],
})
/**
 * Call-to-action button with the label "Get started"; navigation comes from the routerLink on the host element.
 */
export class Button {
  label = 'Get started';
}
