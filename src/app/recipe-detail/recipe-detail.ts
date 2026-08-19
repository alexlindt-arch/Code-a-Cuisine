/**
 * @file recipe-detail.ts
 * @description TypeScript module for recipe detail.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';
import { RecipeLibraryService, type CookbookRecipeRecord } from '../recipe-library.service';
import { extractResult, ingredientsMatch, normalizeIngredientName, parseRecipeArray, toStepView, type RecipeStepView } from './recipe-detail.utils';

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
  readonly backLinkLabel = computed(() => this.backLink().startsWith('/results') ? 'Results' : 'Cookbook');
  readonly heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  readonly sectionBannerMobIngredients = 'assets/img/Ingredients-Mob.png';
  readonly sectionBannerMobDirections = 'assets/img/Directions-Mob.png';
  readonly arrowClass = 'arrow-icon';

  readonly path = computed(() => this.activatedRoute.snapshot.routeConfig?.path ?? '');

  readonly cookIconCount = computed(() => {
    const cooks = this.requestPayload()?.preferences.cooks;
    if (typeof cooks !== 'number' || !Number.isFinite(cooks)) {
      return 1;
    }

    return Math.min(3, Math.max(1, Math.floor(cooks)));
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
    const request = this.requestPayload();
    if (!recipe) {
      return { left: [] as string[], right: [] as string[] };
    }

    const requestedIngredientNames = (request?.ingredients ?? [])
      .map((ingredient) => normalizeIngredientName(ingredient.name));
    const yourIngredients = recipe.ingredients.filter((ingredient) =>
      requestedIngredientNames.some((requestedName) => ingredientsMatch(ingredient, requestedName))
    );
    const extraIngredients = recipe.ingredients.filter((ingredient) =>
      !requestedIngredientNames.some((requestedName) => ingredientsMatch(ingredient, requestedName))
    );

    return {
      left: yourIngredients,
      right: extraIngredients,
    };
  });

  readonly stepColumns = computed(() => {
    const steps = this.stepViews();
    const columnsCount = this.cookIconCount();
    const columns = Array.from({ length: columnsCount }, () => [] as RecipeStepView[]);

    if (!steps.length) {
      return { columns };
    }

    let offset = 0;
    for (let columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
      const baseSize = Math.floor(steps.length / columnsCount);
      const remainder = steps.length % columnsCount;
      const size = baseSize + (columnIndex < remainder ? 1 : 0);
      columns[columnIndex] = steps.slice(offset, offset + size);
      offset += size;
    }

    return { columns };
  });

  readonly stepViews = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return [] as RecipeStepView[];
    }

    return recipe.steps.map((rawStep, index) => toStepView(rawStep, index));
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

  getStepNumber(columnIndex: number, stepIndex: number): number {
    const columns = this.stepColumns().columns;
    let previousColumnSize = 0;

    for (let index = 0; index < columnIndex; index += 1) {
      previousColumnSize += columns[index]?.length ?? 0;
    }

    return previousColumnSize + stepIndex + 1;
  }

  /**
   * @description Creates an instance of RecipeDetail.
   */
  constructor() {
    this.loadRequestPayload();
    this.loadRecipes();
    this.loadSavedRecipeIds();
    this.loadLikedRecipeIds();

    combineLatest([
      this.activatedRoute.paramMap,
      this.activatedRoute.queryParamMap,
    ]).pipe(takeUntilDestroyed()).subscribe(([params, queryParams]) => {
      const recipeId = params.get('recipeId');
      if (recipeId) {
        this.setBackLinkFromQueryParam(queryParams.get('from'), '/cookbook');
        void this.selectCookbookRecipeFromRoute(recipeId);
        return;
      }

      this.setBackLinkFromQueryParam(queryParams.get('from'), '/results');
      this.selectResultRecipeFromRoute(params.get('index'));
    });
  }

  /**
   * @description Method setBackLinkFromQueryParam.
   */
  private setBackLinkFromQueryParam(fromParam: string | null, fallbackPath: '/results' | '/cookbook') {
    if (!fromParam) {
      this.backLink.set(fallbackPath);
      return;
    }

    const normalizedPath = fromParam.trim();
    const isAllowedPath = normalizedPath.startsWith('/results') || normalizedPath.startsWith('/cookbook');
    this.backLink.set(isAllowedPath ? normalizedPath : fallbackPath);
  }

  /**
   * @description Method selectResultRecipeFromRoute.
   */
  private selectResultRecipeFromRoute(indexParam: string | null) {
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
      const candidate = extractResult(parsed);
      const recipes = parseRecipeArray(candidate);
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
    localStorage.setItem(this.likedRecipeIdsKey, JSON.stringify(this.likedRecipeIds()));
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
