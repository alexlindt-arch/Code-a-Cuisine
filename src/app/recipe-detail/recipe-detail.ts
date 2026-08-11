/**
 * @file recipe-detail.ts
 * @description TypeScript module for recipe detail.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';
import { RecipeLibraryService, type CookbookRecipeRecord } from '../recipe-library.service';

/**
 * @description Interface Recipe.
 */
interface Recipe {
  title: string;
  description: string;
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
}

/**
 * @description Interface RecipeRequestPayload.
 */
interface RecipeRequestPayload {
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  preferences: {
    portions: number;
    cooks: number;
    cookingTime: string;
    cuisine: string;
    diets: string[];
  };
}

interface RecipeStepView {
  title: string;
  description: string;
}

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, RouterlinkComponente],
  templateUrl: './recipe-detail.html',
  styleUrls: ['./recipe-detail.scss'],
})
/**
 * @description Component or service class RecipeDetail.
 */
export class RecipeDetail {
  private readonly responseKey = 'cac-recipe-results';
  private readonly requestKey = 'cac-recipe-request';
  private readonly savedRecipeIdsKey = 'cac-saved-recipe-ids';
  private readonly likedRecipeIdsKey = 'cac-liked-recipe-ids';
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly recipeLibraryService = inject(RecipeLibraryService);

  readonly recipes = signal<Recipe[]>([]);
  readonly requestPayload = signal<RecipeRequestPayload | null>(null);
  readonly selectedRecipe = signal<Recipe | null>(null);
  readonly selectedRecipeId = signal<string | null>(null);
  readonly savedRecipeIds = signal<string[]>([]);
  readonly likedRecipeIds = signal<string[]>([]);
  readonly likeCount = signal<number | null>(null);
  readonly likeState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly backLink = signal('/results');
  readonly heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  readonly sectionBannerMobIngredients = 'assets/img/Ingredients-Mob.png';
  readonly sectionBannerMobDirections = 'assets/img/Directions-Mob.png';
  readonly arrowClass = 'arrow-icon';

  readonly cookIconCount = computed(() => {
    const cooks = this.requestPayload()?.preferences.cooks;
    if (typeof cooks !== 'number' || !Number.isFinite(cooks)) {
      return 1;
    }

    return Math.min(2, Math.max(1, Math.floor(cooks)));
  });

  readonly cookIconIndexes = computed(() =>
    Array.from({ length: this.cookIconCount() }, (_, index) => index + 1)
  );

  readonly hasSecondChef = computed(() => this.cookIconCount() > 1);

  readonly isLikedByUser = computed(() => {
    const selectedRecipeId = this.selectedRecipeId();
    if (!selectedRecipeId) {
      return false;
    }

    return this.likedRecipeIds().includes(selectedRecipeId);
  });

  readonly ingredientColumns = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return { left: [] as string[], right: [] as string[] };
    }

    const midpoint = Math.ceil(recipe.ingredients.length / 2);
    return {
      left: recipe.ingredients.slice(0, midpoint),
      right: recipe.ingredients.slice(midpoint),
    };
  });

  readonly stepColumns = computed(() => {
    const steps = this.stepViews();
    if (!steps.length) {
      return { left: [] as RecipeStepView[], right: [] as RecipeStepView[] };
    }

    const midpoint = Math.ceil(steps.length / 2);
    return {
      left: steps.slice(0, midpoint),
      right: steps.slice(midpoint),
    };
  });

  readonly stepViews = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return [] as RecipeStepView[];
    }

    return recipe.steps.map((rawStep, index) => this.toStepView(rawStep, index));
  });

  readonly estimatedNutrition = computed(() => {
    const recipe = this.selectedRecipe();
    const ingredientCount = recipe?.ingredients.length ?? 0;
    const minuteCount = recipe?.estimatedMinutes ?? 0;

    return {
      energy: Math.max(380, ingredientCount * 70 + minuteCount * 3),
      protein: Math.max(16, Math.round(ingredientCount * 2.4)),
      fat: Math.max(14, Math.round(ingredientCount * 2.1)),
      carbs: Math.max(34, Math.round(ingredientCount * 5.5)),
    };
  });

  /**
   * @description Creates an instance of RecipeDetail.
   */
  constructor() {
    this.loadRequestPayload();
    this.loadRecipes();
    this.loadSavedRecipeIds();
    this.loadLikedRecipeIds();

    this.activatedRoute.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const recipeId = params.get('recipeId');
      if (recipeId) {
        void this.selectCookbookRecipeFromRoute(recipeId);
        return;
      }

      this.selectResultRecipeFromRoute(params.get('index'));
    });
  }

  /**
   * @description Method selectResultRecipeFromRoute.
   */
  private selectResultRecipeFromRoute(indexParam: string | null) {
    this.backLink.set('/results');
    const index = Number(indexParam);

    if (!Number.isInteger(index) || index < 0 || index >= this.recipes().length) {
      this.selectedRecipe.set(null);
      this.selectedRecipeId.set(null);
      this.likeCount.set(null);
      this.likeState.set('idle');
      return;
    }

    this.selectedRecipe.set(this.recipes()[index]);
    this.selectedRecipeId.set(this.savedRecipeIds()[index] ?? null);
    this.likeCount.set(null);
    this.likeState.set('idle');
  }

  /**
   * @description Method selectCookbookRecipeFromRoute.
   */
  private async selectCookbookRecipeFromRoute(recipeId: string) {
    this.backLink.set('/cookbook');
    this.selectedRecipeId.set(recipeId);
    this.likeCount.set(null);
    this.likeState.set('idle');

    try {
      const recipe = await this.recipeLibraryService.getRecipeById(recipeId);
      if (!recipe) {
        this.selectedRecipe.set(null);
        return;
      }

      this.selectedRecipe.set(this.toRecipe(recipe));
      this.requestPayload.set(this.toRequestPayload(recipe));
    } catch (error) {
      console.error('Failed to load cookbook recipe details:', error);
      this.selectedRecipe.set(null);
    }
  }

  /**
   * @description Method toRecipe.
   */
  private toRecipe(recipe: CookbookRecipeRecord): Recipe {
    return {
      title: recipe.title,
      description: recipe.description,
      estimatedMinutes: recipe.estimatedMinutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    };
  }

  /**
   * @description Method toRequestPayload.
   */
  private toRequestPayload(recipe: CookbookRecipeRecord): RecipeRequestPayload {
    return {
      ingredients: recipe.sourceIngredients,
      preferences: {
        portions: recipe.portions,
        cooks: recipe.cooks,
        cookingTime: recipe.cookingTime,
        cuisine: recipe.cuisine,
        diets: recipe.diets.length > 0 ? recipe.diets : ['none'],
      },
    };
  }

  /**
   * @description Method toStepView.
   */
  private toStepView(raw: string, index: number): RecipeStepView {
    const trimmed = raw.trim();

    const colonMatch = trimmed.match(/^([^:]{3,80}):\s+([\s\S]+)$/);
    if (colonMatch) {
      const title = colonMatch[1].trim();
      const description = colonMatch[2].trim();
      return {
        title: this.isGenericStepTitle(title)
          ? this.buildStepTitleFromDescription(description, index)
          : title,
        description,
      };
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 1 && lines[0].length <= 80) {
      const title = lines[0];
      const description = lines.slice(1).join(' ');
      return {
        title: this.isGenericStepTitle(title)
          ? this.buildStepTitleFromDescription(description, index)
          : title,
        description,
      };
    }

    const cleanedSingleLine = this.stripGenericStepPrefix(trimmed);
    if (cleanedSingleLine && cleanedSingleLine !== trimmed) {
      return {
        title: this.buildStepTitleFromDescription(cleanedSingleLine, index),
        description: cleanedSingleLine,
      };
    }

    if (this.isGenericStepTitle(trimmed)) {
      return {
        title: this.buildStepTitleFromDescription(trimmed, index),
        description: trimmed,
      };
    }

    return {
      title: `Step ${index + 1}`,
      description: trimmed,
    };
  }

  /**
   * @description Method isGenericStepTitle.
   */
  private isGenericStepTitle(value: string): boolean {
    const compact = value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return /^step\d*$/.test(compact)
      || /^schritt\d*$/.test(compact);
  }

  /**
   * @description Method stripGenericStepPrefix.
   */
  private stripGenericStepPrefix(value: string): string {
    return value
      .replace(/^step\s*\d*\s*[:.)\-–—]*\s*/i, '')
      .replace(/^schritt\s*\d*\s*[:.)\-–—]*\s*/i, '')
      .replace(/^\d+\s*[:.)\-–—]+\s*/, '')
      .trim();
  }

  /**
   * @description Method buildStepTitleFromDescription.
   */
  private buildStepTitleFromDescription(description: string, index: number): string {
    const cleaned = this.stripGenericStepPrefix(description);

    if (!cleaned) {
      return `Step ${index + 1}`;
    }

    const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() ?? '';
    const titleWords = firstSentence
      .replace(/[^A-Za-z0-9' -]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .slice(0, 5);

    if (titleWords.length < 2) {
      return `Step ${index + 1}`;
    }

    const title = titleWords
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return title;
  }

  /**
   * @description Method likeRecipe.
   */
  async likeRecipe() {
    const recipeId = this.selectedRecipeId();
    if (!recipeId || this.isLikedByUser() || this.likeState() === 'saving') {
      return;
    }

    this.likeState.set('saving');

    try {
      const updatedLikes = await this.recipeLibraryService.incrementRecipeLike(recipeId);
      this.likeCount.set(updatedLikes);
      this.likedRecipeIds.update((ids) => [...ids, recipeId]);
      this.persistLikedRecipeIds();
      this.likeState.set('saved');
    } catch (error) {
      console.error('Unable to like recipe:', error);
      this.likeState.set('error');
    }
  }

  /**
   * @description Method loadRequestPayload.
   */
  private loadRequestPayload() {
    const raw = localStorage.getItem(this.requestKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as RecipeRequestPayload;
      if (parsed && parsed.preferences && Array.isArray(parsed.ingredients)) {
        this.requestPayload.set(parsed);
      }
    } catch (error) {
      console.error('Failed to parse request payload:', error);
    }
  }

  /**
   * @description Method loadRecipes.
   */
  private loadRecipes() {
    const raw = localStorage.getItem(this.responseKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidate = this.extractResult(parsed);
      const recipes = this.parseRecipeArray(candidate);
      this.recipes.set(recipes);
    } catch (error) {
      console.error('Failed to parse recipe response:', error);
    }
  }

  /**
   * @description Method loadSavedRecipeIds.
   */
  private loadSavedRecipeIds() {
    const raw = localStorage.getItem(this.savedRecipeIdsKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        this.savedRecipeIds.set(parsed);
      }
    } catch (error) {
      console.error('Failed to parse saved recipe ids:', error);
    }
  }

  /**
   * @description Method loadLikedRecipeIds.
   */
  private loadLikedRecipeIds() {
    const raw = localStorage.getItem(this.likedRecipeIdsKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        this.likedRecipeIds.set(parsed);
      }
    } catch (error) {
      console.error('Failed to parse liked recipe ids:', error);
    }
  }

  /**
   * @description Method persistLikedRecipeIds.
   */
  private persistLikedRecipeIds() {
    try {
      localStorage.setItem(this.likedRecipeIdsKey, JSON.stringify(this.likedRecipeIds()));
    } catch (error) {
      console.error('Failed to store liked recipe ids:', error);
    }
  }

  /**
   * @description Method extractResult.
   */
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

  /**
   * @description Method parseRecipeArray.
   */
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

  /**
   * @description Method tryParseFromText.
   */
  private tryParseFromText(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      console.warn('Failed to parse JSON from text, attempting to extract JSON object...');
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

  /**
   * @description Method isRecipe.
   */
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

  /**
   * @description Method showIngredients toggle class.
   */
 showIngredients() {
    const ingredientsPanel = document.querySelector('.ingredient-columns') as HTMLElement | null;
    ingredientsPanel?.classList.toggle('show-ingredients');
    ingredientsPanel?.scrollIntoView({ behavior: 'smooth' });
    ingredientsPanel?.style.setProperty('transition', 'all 0.5s ease-in-out');
    const ingredientsButton = document.querySelector('.ingredients-intro-btn') as HTMLElement | null;
    ingredientsButton?.classList.toggle('active');
  }

  /**
   * @description Method showDirections toggle class.
   */
  showDirections() {
    const stepsPanel = document.querySelector('.steps-columns') as HTMLElement | null;
    stepsPanel?.classList.toggle('show-directions');
    stepsPanel?.scrollIntoView({ behavior: 'smooth' });
    stepsPanel?.style.setProperty('transition', 'all 0.5s ease-in-out');
    const stepsButton = document.querySelector('.directions-intro-btn') as HTMLElement | null;
    stepsButton?.classList.toggle('active');
  }
}
