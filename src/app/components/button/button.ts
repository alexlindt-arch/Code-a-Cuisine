import { Component } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrls: ['./button.scss'],
})
export class Button {
  label: string = '';
  homeScreenButton: string = this.label = 'Get started';
  constructor(){
   this.homeScreenButton;
  }
}
