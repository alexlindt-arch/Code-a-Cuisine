/**
 * @file cookbook.ts
 * @description TypeScript module for cookbook.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';
import { cookbookCategories } from './cookbook-data';
import { RecipeLibraryService, type CookbookRecipeRecord } from '../recipe-library.service';

@Component({
  selector: 'app-cookbook',
  imports: [ RouterLink, RouterlinkComponente],
  templateUrl: './cookbook.html',
  styleUrls: ['./cookbook.scss'],
})
/**
 * @description Component or service class Cookbook.
 */
export class Cookbook {
  cookbookRouterLink: string = '/results';
  private readonly recipeLibraryService = inject(RecipeLibraryService);

  readonly heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  readonly arrowClass = 'arrow-icon';

  readonly categories = cookbookCategories;
  readonly recipes = signal<CookbookRecipeRecord[]>([]);
  readonly loadingState = signal<'idle' | 'loading' | 'error'>('idle');

  readonly featuredRecipes = computed(() =>
    [...this.recipes()]
      .sort((firstRecipe, secondRecipe) => secondRecipe.likes - firstRecipe.likes)
      .slice(0, 3)
  );

  /**
   * @description Creates an instance of Cookbook.
   */
  constructor() {
    void this.loadRecipes();
  }

  /**
   * @description Method loadRecipes.
   */
  private async loadRecipes() {
    this.loadingState.set('loading');

    try {
      const recipes = await this.recipeLibraryService.getAllRecipes();
      this.recipes.set(recipes);
      this.loadingState.set('idle');
    } catch (error) {
      console.error('Failed to load cookbook recipes from Firebase:', error);
      this.loadingState.set('error');
    }
  }
}