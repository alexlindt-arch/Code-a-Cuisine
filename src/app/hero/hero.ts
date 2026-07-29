import { Component, inject } from '@angular/core';
import { Button } from '../components/button/button';
import { ImagesComponent } from '../components/images-component/images-component';
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-hero',
  imports: [Button, ImagesComponent, RouterLink],
  templateUrl: './hero.html',
  styleUrls: ['./hero.scss'],
})
export class Hero {
  heroImageOne = 'assets/img/menu-3.png';
  heroImageTwo = 'assets/img/menu-2.png';
  heroImageThree = 'assets/img/menu-1.png';
  heroImageFour = 'assets/img/menu-4.png';
  heroImageFive = 'assets/img/menu-5.png';


  heroImageClass = 'hero-image';
  arrowClass = 'arrow-icon';
  heroImageArrow = 'assets/icons/Arrow-right.png';
  recipeRouterLink: string = '/generate-recipe';
constructor() {

}
}

