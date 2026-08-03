import { Component, computed, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';

import { RecipeLibraryService, type StoredRecipeRequestPayload, type StoredRecipeResult } from '../recipe-library.service';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';

interface Recipe extends StoredRecipeResult {}

@Component({
  selector: 'app-results',
  imports: [ RouterLink, RouterlinkComponente],
  templateUrl: './results.html',
  styleUrls: ['./results.scss'],
})
export class Results implements OnDestroy {
  private readonly responseKey = 'cac-recipe-results';
  private readonly requestKey = 'cac-recipe-request';
  private readonly ingredientsKey = 'cac-ingredients';
  private readonly errorKey = 'cac-recipe-error';
  private readonly persistedMarkerKey = 'cac-recipe-results-persisted';
  private readonly savedRecipeIdsKey = 'cac-saved-recipe-ids';
  private readonly router = inject(Router);
  private readonly recipeLibraryService = inject(RecipeLibraryService);
  private savedNoticeTimeoutId: ReturnType<typeof window.setTimeout> | null = null;

  readonly recipes = signal<Recipe[]>([]);
  readonly requestPayload = signal<StoredRecipeRequestPayload | null>(null);
  readonly hasStoredResponse = signal(false);
  readonly generationError = signal<string | null>(null);
  readonly persistenceState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  readonly arrowClass = 'arrow-icon';

  readonly hasResults = computed(() => this.recipes().length > 0);

  constructor() {
    this.loadRequestPayload();
    this.loadGenerationError();
    this.loadRecipes();
  }

  private loadGenerationError() {
    const raw = localStorage.getItem(this.errorKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'string' && parsed.trim()) {
        this.generationError.set(parsed);
      }
    } catch {
      this.generationError.set(raw);
    }
  }

  private loadRequestPayload() {
    const raw = localStorage.getItem(this.requestKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredRecipeRequestPayload;
      if (parsed && parsed.preferences && Array.isArray(parsed.ingredients) && typeof parsed.requestedAt === 'string') {
        this.requestPayload.set(parsed);
      }
    } catch (error) {
      console.error('Failed to parse request payload:', error);
    }
  }

  private loadRecipes() {
    const raw = localStorage.getItem(this.responseKey);
    if (!raw) {
      return;
    }

    this.hasStoredResponse.set(true);

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidate = this.extractResult(parsed);
      const recipes = this.parseRecipeArray(candidate);
      this.recipes.set(recipes);
      void this.persistRecipesIfNeeded(recipes);
    } catch (error) {
      console.error('Failed to parse recipe response:', error);
    }
  }

  private async persistRecipesIfNeeded(recipes: Recipe[]) {
    const requestPayload = this.requestPayload();
    if (!requestPayload || recipes.length === 0) {
      return;
    }

    const persistedMarker = localStorage.getItem(this.persistedMarkerKey);
    if (persistedMarker === requestPayload.requestedAt) {
      this.showSavedStateTemporarily();
      return;
    }

    this.persistenceState.set('saving');

    try {
      const savedRecipeIds = await this.recipeLibraryService.saveGeneratedRecipes(recipes, requestPayload);
      localStorage.setItem(this.persistedMarkerKey, requestPayload.requestedAt);
      localStorage.setItem(this.savedRecipeIdsKey, JSON.stringify(savedRecipeIds));
      this.showSavedStateTemporarily();
    } catch (error) {
      console.error('Failed to persist generated recipes to Firebase:', error);
      this.clearSavedNoticeTimer();
      this.persistenceState.set('error');
    }
  }

  private showSavedStateTemporarily(): void {
    this.clearSavedNoticeTimer();
    this.persistenceState.set('saved');
    this.savedNoticeTimeoutId = window.setTimeout(() => {
      this.persistenceState.set('idle');
      this.savedNoticeTimeoutId = null;
    }, 4000);
  }

  private clearSavedNoticeTimer(): void {
    if (this.savedNoticeTimeoutId !== null) {
      clearTimeout(this.savedNoticeTimeoutId);
      this.savedNoticeTimeoutId = null;
    }
  }

  private extractResult(payload: unknown): unknown {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }

    const obj = payload as {
      result?: unknown;
      output?: unknown;
      data?: unknown;
      response?: unknown;
    };

    if (typeof obj.result !== 'undefined') {
      return obj.result;
    }

    if (typeof obj.output !== 'undefined') {
      return obj.output;
    }

    if (typeof obj.data !== 'undefined') {
      return obj.data;
    }

    if (typeof obj.response !== 'undefined') {
      return obj.response;
    }

    return payload;
  }

  private parseRecipeArray(input: unknown): Recipe[] {
    if (Array.isArray(input)) {
      return input
        .filter((item) => this.isRecipe(item))
        .map((item) => ({
          title: item.title,
          description: item.description,
          estimatedMinutes: item.estimatedMinutes,
          ingredients: item.ingredients,
          steps: item.steps,
        }));
    }

    if (typeof input === 'string') {
      const parsedFromText = this.tryParseFromText(input);
      return parsedFromText ? this.parseRecipeArray(parsedFromText) : [];
    }

    if (typeof input !== 'object' || input === null) {
      return [];
    }

    const maybeRecipes = (input as { recipes?: unknown; data?: { recipes?: unknown }; output?: { recipes?: unknown }; response?: { recipes?: unknown } }).recipes
      ?? (input as { data?: { recipes?: unknown } }).data?.recipes
      ?? (input as { output?: { recipes?: unknown } }).output?.recipes
      ?? (input as { response?: { recipes?: unknown } }).response?.recipes;
    if (!Array.isArray(maybeRecipes)) {
      return [];
    }

    return maybeRecipes
      .filter((item) => this.isRecipe(item))
      .map((item) => ({
        title: item.title,
        description: item.description,
        estimatedMinutes: item.estimatedMinutes,
        ingredients: item.ingredients,
        steps: item.steps,
      }));
  }

  private tryParseFromText(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      console.warn('Failed to parse JSON from text, attempting to extract JSON from fenced code block or object literal.');
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        return null;
      }
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      const candidate = trimmed.slice(objectStart, objectEnd + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    return null;
  }

  private isRecipe(value: unknown): value is Recipe {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const recipe = value as Recipe;
    return typeof recipe.title === 'string'
      && typeof recipe.description === 'string'
      && typeof recipe.estimatedMinutes === 'number'
      && Array.isArray(recipe.ingredients)
      && Array.isArray(recipe.steps)
      && recipe.ingredients.every((item) => typeof item === 'string')
      && recipe.steps.every((item) => typeof item === 'string');
  }

  getHeroImage(): string {
    return 'assets/img/ChatGPT-Image.png';
  }

  getRecipeCardIcon(): string {
    return 'assets/icons/deckel-ickon.png';
  }

  getDurationLabel(minutes: number): string {
    if (minutes <= 20) {
      return 'Quick';
    }

    if (minutes <= 40) {
      return 'Medium';
    }

    return 'Complex';
  }

  ngOnDestroy(): void {
    this.clearSavedNoticeTimer();
  }

  async startNewRecipeSession(event: Event): Promise<void> {
    event.preventDefault();

    try {
      localStorage.removeItem(this.ingredientsKey);
      localStorage.removeItem(this.requestKey);
      localStorage.removeItem(this.responseKey);
      localStorage.removeItem(this.errorKey);
      localStorage.removeItem(this.persistedMarkerKey);
      localStorage.removeItem(this.savedRecipeIdsKey);
    } catch (error) {
      console.error('Failed to reset recipe session storage:', error);
    }

    await this.router.navigate(['/generate-recipe']);
  }
}
