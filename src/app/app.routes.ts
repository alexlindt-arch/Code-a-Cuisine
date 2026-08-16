/**
 * @file app.routes.ts
 * @description TypeScript module for app.routes.
 */
import { Routes } from '@angular/router';
import { Hero } from './hero/hero';
import { GenerateRecipe } from './generate-recipe/generate-recipe';
import { Preferences } from './preferences/preferences';
import { Results } from '../app/results/results';
import { RecipeDetail } from './recipe-detail/recipe-detail';
import { Cookbook } from './cookbook/cookbook';
import { CookbookCategoryPage } from './cookbook-category/cookbook-category';
import { Impress } from './impress/impress';
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
  },
  { path: 'preferences',
    component: Preferences,
    data: { headerStyle: 'light' },
    title: 'Preferences'
  },
  { path: 'results',
    component: Results,
    data: { headerStyle: 'dark' },
    title: 'Recipe Results'
  },
  { path: 'results/:index',
    component: RecipeDetail,
    data: { headerStyle: 'light' },
    title: 'Recipe Detail'
  },
  { path: 'cookbook',
    component: Cookbook,
    data: { headerStyle: 'light' },
    title: 'Cookbook'
  },
  { path: 'cookbook/recipe/:recipeId',
    component: RecipeDetail,
    data: { headerStyle: 'light' },
    title: 'Cookbook Recipe Detail'
  },
  { path: 'cookbook/:category',
    component: CookbookCategoryPage,
    data: { headerStyle: 'light' },
    title: 'Cookbook Category'
  },
  { path: 'impress',
    component: Impress,
    data: { headerStyle: 'light' },
    title: 'Imprint'
  }
];
