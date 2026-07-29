import { Routes } from '@angular/router';
import { Hero } from './hero/hero';
import { GenerateRecipe } from './generate-recipe/generate-recipe';

export const routes: Routes = [
  { path: '',
    component: Hero,
    data: { headerStyle: 'dark' },
    title: 'Code-a-Cuisine'
  },
  { path: 'generate-recipe',
    component: GenerateRecipe,
    data: { headerStyle: 'light' },
    title: 'Generate a Recipe'
  }
];
