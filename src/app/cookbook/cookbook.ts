import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { cookbookCategories } from './cookbook-data';
import { RecipeLibraryService, type CookbookRecipeRecord } from '../recipe-library.service';

@Component({
  selector: 'app-cookbook',
  imports: [RouterLink],
  templateUrl: './cookbook.html',
  styleUrls: ['./cookbook.scss'],
})
export class Cookbook {
  private readonly recipeLibraryService = inject(RecipeLibraryService);

  readonly categories = cookbookCategories;
  readonly recipes = signal<CookbookRecipeRecord[]>([]);
  readonly loadingState = signal<'idle' | 'loading' | 'error'>('idle');

  readonly featuredRecipes = computed(() =>
    [...this.recipes()]
      .sort((firstRecipe, secondRecipe) => secondRecipe.likes - firstRecipe.likes)
      .slice(0, 3)
  );

  constructor() {
    void this.loadRecipes();
  }

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
