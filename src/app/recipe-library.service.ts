import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface StoredRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface StoredRecipeRequestPayload {
  ingredients: StoredRecipeIngredient[];
  preferences: {
    portions: number;
    cooks: number;
    cookingTime: string;
    cuisine: string;
    diets: string[];
  };
  requestedAt: string;
}

export interface StoredRecipeResult {
  title: string;
  description: string;
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
}

export interface FirebaseRecipeRecord {
  title: string;
  description: string;
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
  cuisine: string;
  categorySlug: string;
  cookingTime: string;
  difficulty: 'Quick' | 'Medium' | 'Complex';
  dietLabel: string | null;
  diets: string[];
  cooks: number;
  portions: number;
  likes: number;
  createdAt: string;
  requestedAt: string;
  sourceIngredients: StoredRecipeIngredient[];
}

export interface CookbookRecipeRecord {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
  cuisine: string;
  categorySlug: string;
  cookingTime: string;
  difficulty: 'Quick' | 'Medium' | 'Complex';
  dietLabel: string | null;
  diets: string[];
  cooks: number;
  portions: number;
  likes: number;
  createdAt: string;
  requestedAt: string;
  sourceIngredients: StoredRecipeIngredient[];
}

type FirebaseRecipesResponse = Record<string, Partial<FirebaseRecipeRecord>>;

@Injectable({ providedIn: 'root' })
export class RecipeLibraryService {
  private readonly http = inject(HttpClient);
  private readonly databaseUrl = 'https://code-a-cuisine-ccf1f-default-rtdb.firebaseio.com';

  async saveGeneratedRecipes(recipes: StoredRecipeResult[], requestPayload: StoredRecipeRequestPayload): Promise<string[]> {
    const records = recipes.map((recipe) => this.toFirebaseRecord(recipe, requestPayload));
    const ids: string[] = [];

    for (const record of records) {
      const response = await firstValueFrom(this.http.post<{ name: string }>(`${this.databaseUrl}/recipes.json`, record));
      if (response?.name) {
        ids.push(response.name);
      }
    }

    return ids;
  }

  async incrementRecipeLike(recipeId: string): Promise<number> {
    const likesUrl = `${this.databaseUrl}/recipes/${recipeId}/likes.json`;
    const currentLikes = await firstValueFrom(this.http.get<number | null>(likesUrl));
    const nextLikes = (typeof currentLikes === 'number' ? currentLikes : 0) + 1;
    await firstValueFrom(this.http.put<number>(likesUrl, nextLikes));
    return nextLikes;
  }

  async getAllRecipes(): Promise<CookbookRecipeRecord[]> {
    const response = await firstValueFrom(this.http.get<FirebaseRecipesResponse | null>(`${this.databaseUrl}/recipes.json`));
    if (!response) {
      return [];
    }

    return Object.entries(response)
      .map(([id, recipe]) => this.toCookbookRecipeRecord(id, recipe))
      .filter((recipe): recipe is CookbookRecipeRecord => recipe !== null)
      .sort((firstRecipe, secondRecipe) => {
        const firstDate = Date.parse(firstRecipe.createdAt);
        const secondDate = Date.parse(secondRecipe.createdAt);
        return secondDate - firstDate;
      });
  }

  async getRecipeById(recipeId: string): Promise<CookbookRecipeRecord | null> {
    const response = await firstValueFrom(this.http.get<Partial<FirebaseRecipeRecord> | null>(`${this.databaseUrl}/recipes/${recipeId}.json`));
    if (!response) {
      return null;
    }

    return this.toCookbookRecipeRecord(recipeId, response);
  }

  private toFirebaseRecord(recipe: StoredRecipeResult, requestPayload: StoredRecipeRequestPayload): FirebaseRecipeRecord {
    const cuisine = requestPayload.preferences.cuisine;
    const diets = requestPayload.preferences.diets.filter((diet) => diet !== 'none');

    return {
      title: recipe.title,
      description: recipe.description,
      estimatedMinutes: recipe.estimatedMinutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      cuisine,
      categorySlug: this.toCategorySlug(cuisine),
      cookingTime: requestPayload.preferences.cookingTime,
      difficulty: this.toDifficulty(recipe.estimatedMinutes, requestPayload.preferences.cookingTime),
      dietLabel: diets[0] ?? null,
      diets,
      cooks: requestPayload.preferences.cooks,
      portions: requestPayload.preferences.portions,
      likes: 0,
      createdAt: new Date().toISOString(),
      requestedAt: requestPayload.requestedAt,
      sourceIngredients: requestPayload.ingredients,
    };
  }

  private toCategorySlug(cuisine: string): string {
    const normalizedCuisine = cuisine.trim();
    if (normalizedCuisine.includes('German')) {
      return 'German';
    }

    if (normalizedCuisine.includes('Italian')) {
      return 'Italian';
    }

    if (normalizedCuisine.includes('Indian')) {
      return 'Indian';
    }

    if (normalizedCuisine.includes('Japanese')) {
      return 'Japanese';
    }

    if (normalizedCuisine.includes('Gourmet')) {
      return 'Gourmet';
    }

    if (normalizedCuisine.includes('Fusion')) {
      return 'Fusion';
    }

    return 'Fusion';
  }

  private toDifficulty(minutes: number, fallback: string): 'Quick' | 'Medium' | 'Complex' {
    if (minutes <= 20) {
      return 'Quick';
    }

    if (minutes <= 40) {
      return 'Medium';
    }

    const normalizedFallback = fallback.trim();
    if (normalizedFallback === 'quick') {
      return 'Quick';
    }

    if (normalizedFallback === 'complex') {
      return 'Complex';
    }

    return 'Medium';
  }

  private toCookbookRecipeRecord(id: string, recipe: Partial<FirebaseRecipeRecord>): CookbookRecipeRecord | null {
    const estimatedMinutes = this.toNumber(recipe.estimatedMinutes);
    const cooks = this.toNumber(recipe.cooks);
    const portions = this.toNumber(recipe.portions);
    const likes = this.toNumber(recipe.likes) ?? 0;

    const cuisine = typeof recipe.cuisine === 'string' ? recipe.cuisine : '';
    const categorySlug = typeof recipe.categorySlug === 'string' && recipe.categorySlug.trim()
      ? recipe.categorySlug
      : this.toCategorySlug(cuisine);

    const requestedAt = typeof recipe.requestedAt === 'string' && recipe.requestedAt.trim()
      ? recipe.requestedAt
      : (typeof recipe.createdAt === 'string' && recipe.createdAt.trim() ? recipe.createdAt : new Date().toISOString());

    const createdAt = typeof recipe.createdAt === 'string' && recipe.createdAt.trim()
      ? recipe.createdAt
      : requestedAt;

    const diets = Array.isArray(recipe.diets)
      ? recipe.diets.filter((diet): diet is string => typeof diet === 'string')
      : [];

    const sourceIngredients = Array.isArray(recipe.sourceIngredients)
      ? recipe.sourceIngredients.filter((ingredient): ingredient is StoredRecipeIngredient => (
        typeof ingredient === 'object'
        && ingredient !== null
        && typeof ingredient.name === 'string'
        && typeof ingredient.quantity === 'number'
        && Number.isFinite(ingredient.quantity)
        && typeof ingredient.unit === 'string'
      ))
      : [];

    const cookingTime = typeof recipe.cookingTime === 'string' && recipe.cookingTime.trim()
      ? recipe.cookingTime
      : this.toCookingTimeFallback(estimatedMinutes);

    const resolvedCooks = typeof cooks === 'number' ? cooks : 1;
    const resolvedPortions = typeof portions === 'number' ? portions : 1;

    if (typeof recipe.title !== 'string'
      || typeof recipe.description !== 'string'
      || typeof estimatedMinutes !== 'number'
      || !Array.isArray(recipe.ingredients)
      || !Array.isArray(recipe.steps)
      || !cuisine
      || !categorySlug
      || !cookingTime) {
      return null;
    }

    return {
      id,
      title: recipe.title,
      description: recipe.description,
      estimatedMinutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      cuisine,
      categorySlug,
      cookingTime,
      difficulty: recipe.difficulty === 'Quick' || recipe.difficulty === 'Medium' || recipe.difficulty === 'Complex'
        ? recipe.difficulty
        : this.toDifficulty(estimatedMinutes, cookingTime),
      dietLabel: typeof recipe.dietLabel === 'string' ? recipe.dietLabel : null,
      diets,
      cooks: resolvedCooks,
      portions: resolvedPortions,
      likes,
      createdAt,
      requestedAt,
      sourceIngredients,
    };
  }

  private toCookingTimeFallback(estimatedMinutes: number | null): string {
    if (typeof estimatedMinutes !== 'number') {
      return 'Medium';
    }

    if (estimatedMinutes <= 20) {
      return 'Quick';
    }

    if (estimatedMinutes <= 40) {
      return 'Medium';
    }

    return 'Complex';
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
