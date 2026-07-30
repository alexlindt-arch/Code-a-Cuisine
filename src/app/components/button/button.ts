import { Component } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrls: ['./button.scss'],
})
/**
 * The Button class represents a button component in the application.
 * It contains properties for the button label and home screen button text.
 * The constructor initializes the home screen button with a default label.
 */
export class Button {
  label: string = '';
  homeScreenButton: string = this.label = 'Get started';
  constructor(){
   this.homeScreenButton;
  }
}
