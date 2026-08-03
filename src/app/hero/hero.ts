import { Component } from '@angular/core';
import { Button } from '../components/button/button';
import { ImagesComponent } from '../components/images-component/images-component';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';
import { RouterLink } from "@angular/router";


@Component({
  selector: 'app-hero',
  imports: [Button, ImagesComponent, RouterLink, RouterlinkComponente],
  templateUrl: './hero.html',
  styleUrls: ['./hero.scss'],
})

/**
 * The Hero class represents the hero section of the application.
 * It contains properties for hero images, CSS classes, and routing information.
 */
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
  cookbookRouterLink: string = '/cookbook';


}

