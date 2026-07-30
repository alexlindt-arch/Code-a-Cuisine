import { Routes } from '@angular/router';
import { Hero } from './hero/hero';
import { GenerateRecipe } from './generate-recipe/generate-recipe';
/**
 * The routes array defines the routing configuration for the application.
 * It specifies the paths, components, and additional data for each route.
 */
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
