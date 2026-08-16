export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface StoredRecipeContext {
  ingredients: RecipeIngredient[];
  preferences?: {
    portions: number;
    cooks: number;
    cookingTime: 'quick' | 'medium' | 'complex';
    cuisine: string;
    diets: string[];
  };
}

export function sanitizeIngredientName(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ');
}

export function isValidIngredientName(
  value: string,
  pattern: RegExp,
  maxLength: number
): boolean {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0
    && trimmedValue.length <= maxLength
    && pattern.test(trimmedValue);
}

export function isValidIngredient(value: unknown): value is RecipeIngredient {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const ingredient = value as Partial<RecipeIngredient>;
  return typeof ingredient.name === 'string'
    && typeof ingredient.quantity === 'number'
    && typeof ingredient.unit === 'string';
}

export function isStoredRecipeContext(value: unknown): value is StoredRecipeContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const context = value as Partial<StoredRecipeContext>;
  return Array.isArray(context.ingredients)
    && context.ingredients.every(isValidIngredient);
}

export function readStoredRecipeContext(storageKey: string): StoredRecipeContext {
  const storedValue = localStorage.getItem(storageKey);
  if (!storedValue) {
    return { ingredients: [] };
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    if (Array.isArray(parsed) && parsed.every(isValidIngredient)) {
      return { ingredients: parsed };
    }

    return isStoredRecipeContext(parsed) ? parsed : { ingredients: [] };
  } catch (error) {
    console.error('Unable to parse stored recipe context:', error);
    return { ingredients: [] };
  }
}

export function readStoredIngredients(storageKey: string): RecipeIngredient[] {
  return readStoredRecipeContext(storageKey).ingredients;
}

export function toIngredientSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ingredient';
}
