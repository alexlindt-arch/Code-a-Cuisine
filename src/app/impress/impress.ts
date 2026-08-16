import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';

@Component({
  selector: 'app-impress',
  imports: [RouterLink, RouterlinkComponente],
  templateUrl: './impress.html',
  styleUrls: ['./impress.scss'],
})
export class Impress {
  homeLinkText = '';
  homeTargetPath = '';
  homeTargetClass = 'home-link';
  homeImageArrow = 'assets/icons/Arrow-left-dark.png';
}
