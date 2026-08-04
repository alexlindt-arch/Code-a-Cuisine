/**
 * @file generate-recipe.ts
 * @description TypeScript module for generate recipe.
 */
import { Component, computed, OnDestroy, signal } from '@angular/core';
import { inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import {  ImagesComponent } from "../components/images-component/images-component";
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * @description Interface Ingredients.
 */
interface Ingredients {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * @description Interface StoredPreferences.
 */
interface StoredPreferences {
  portions: number;
  cooks: number;
  cookingTime: 'quick' | 'medium' | 'complex';
  cuisine: string;
  diets: string[];
}

/**
 * @description Interface StoredRecipeContext.
 */
interface StoredRecipeContext {
  ingredients: Ingredients[];
  preferences?: StoredPreferences;
}

@Component({
  selector: 'app-generate-recipe',
  imports: [ImagesComponent, RouterLink],
  templateUrl: './generate-recipe.html',
  styleUrls: ['./generate-recipe.scss'],
})

/**
 * @description Component or service class GenerateRecipe.
 */
export class GenerateRecipe implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly databaseUrl = 'https://code-a-cuisine-ccf1f-default-rtdb.firebaseio.com';
  private readonly ingredientHintMessage = 'Keine Sonderzeichen erlaubt. Maximal 40 Zeichen.';
  readonly emptyIngredientHintMessage = 'Bitte gib eine Zutat ein.';
  firebaseIngredientNames = signal<string[]>([]);
  ingredientValidationMessage = signal('');
  private readonly storageKey = 'cac-ingredients';
  private readonly recipePayloadKey = 'cac-recipe-request';
  private readonly recipesResponseKey = 'cac-recipe-results';
  readonly unitOptions = ['gram', 'ml', 'piece'];
  private readonly ingredientNamePattern = /[A-Za-zÄÖÜäöüß0-9\s'()-]+$/;
  private readonly maxIngredientNameLength = 40;

  /**
   * @description Method sanitizeIngredientName.
   */
  private sanitizeIngredientName(value: string): string {
    return value
      .trim()
      .replace(/[<>]/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ');
  }

  private readonly ingredientCatalog = [
    'Apple',
    'Apfel',
    'Basil',
    'Basilikum',
    'Bell Pepper',
    'Paprika',
    'Bread',
    'Brot',
    'Broccoli',
    'Brokkoli',
    'Butter',
    'Carrot',
    'Karotte',
    'Moehre',
    'Cheese',
    'Käse',
    'Chicken Breast',
    'Huehnchenbrust',
    'Cucumber',
    'Gurke',
    'Egg',
    'Ei',
    'Flour',
    'Mehl',
    'Garlic',
    'Knoblauch',
    'Milk',
    'Milch',
    'Mozzarella',
    'Mushroom',
    'Pilze',
    'Champignon',
    'Onion',
    'Zwiebel',
    'Olive Oil',
    'Olivenoel',
    'Oregano',
    'Parmesan',
    'Pasta',
    'Nudeln',
    'Potato',
    'Kartoffel',
    'Potatoes',
    'Kartoffeln',
    'Rice',
    'Reis',
    'Spaghetti',
    'Tomato',
    'Tomate',
    'Tomato Sauce',
    'Tomatensauce',
    'Zucchini',
  ];

  ingredientsSignal = signal<Ingredients>({
    name: '',
    quantity: 0,
    unit: 'gram'
  });



  editingIndex = signal<number | null>(null);
  isIngredientSuggestionsOpen = signal(false);
  isCreateUnitMenuOpen = signal(false);
  isEditUnitMenuOpen = signal(false);
  editingIngredient = signal<{ quantity: number; unit: string }>({
    quantity: 100,
    unit: 'gram'
  });

  label = 'recipe add icon';
  class = 'recipe-image';
  addIcon = 'assets/icons/add-icon.png';
  editIcon = 'assets/icons/edit-icon.png';
  checkIcon = 'assets/icons/check.png';
  deleteIcon = 'assets/icons/delete.png';
  arrowDropDownIcon = 'assets/icons/arrow_drop_down.png';
  index: number = 0;

  ingredients = signal<Ingredients[]>([]);

  hasIngredients = computed(() => this.ingredients().length > 0);

  ingredientSuggestions = computed(() => {
    const query = this.ingredientsSignal().name.trim().toLowerCase();

    if (query.length < 3) {
      return [];
    }

    const combinedCatalog = Array.from(
      new Set([...this.firebaseIngredientNames(), ...this.ingredientCatalog])
    );

    return combinedCatalog
      .filter((ingredientName) => ingredientName.toLowerCase().startsWith(query))
      .slice(0, 8);
  });
  private activatedRoute = inject(ActivatedRoute);
  title = this.activatedRoute.data.pipe(
    map((data) => data['title'] || 'recipe-generator')
  );

  /**
   * @description Creates an instance of GenerateRecipe.
   */
  constructor() {
    this.loadIngredientsFromStorage();
    void this.loadIngredientsFromFirebase();
  }

  /**
   * @description Method ngOnDestroy.
   */
  ngOnDestroy(): void {
    const target = this.router.getCurrentNavigation()?.extractedUrl.toString() ?? '';
    if (target === '/') {
      localStorage.removeItem(this.storageKey);
      this.ingredients.set([]);
    }
  }
 /**
  * @description Method onSubmit.
  */
 onSubmit(event?: Event) {
   event?.preventDefault();
    this.addIngredient();
  }

  /**
   * @description Method setIngredientName.
   */
  setIngredientName(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const sanitizedValue = this.sanitizeIngredientName(value);

    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name: sanitizedValue
    }));

    const trimmedValue = sanitizedValue.trim();
    const isValid = this.isValidIngredientName(sanitizedValue);
    const shouldOpenSuggestions = trimmedValue.length >= 3 && isValid;

    if (trimmedValue.length === 0) {
      this.ingredientValidationMessage.set(this.emptyIngredientHintMessage);
    } else {
      this.ingredientValidationMessage.set(isValid ? '' : this.ingredientHintMessage);
    }

    this.isIngredientSuggestionsOpen.set(shouldOpenSuggestions);

    if (shouldOpenSuggestions) {
      void this.loadIngredientsFromFirebase();
    }
  }

  /**
   * @description Method onIngredientFieldFocus.
   */
  onIngredientFieldFocus() {
    const trimmedValue = this.ingredientsSignal().name.trim();
    const isValid = this.isValidIngredientName(this.ingredientsSignal().name);
    const shouldOpenSuggestions = trimmedValue.length >= 3 && isValid;

    if (trimmedValue.length === 0) {
      this.ingredientValidationMessage.set(this.emptyIngredientHintMessage);
    } else {
      this.ingredientValidationMessage.set(isValid ? '' : this.ingredientHintMessage);
    }

    this.isIngredientSuggestionsOpen.set(shouldOpenSuggestions);

    if (shouldOpenSuggestions) {
      void this.loadIngredientsFromFirebase();
    }
  }

  /**
   * @description Method onIngredientFieldBlur.
   */
  onIngredientFieldBlur() {
    setTimeout(() => {
      this.isIngredientSuggestionsOpen.set(false);
    }, 120);
  }

  /**
   * @description Method selectIngredientSuggestion.
   */
  selectIngredientSuggestion(name: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name
    }));
    this.isIngredientSuggestionsOpen.set(false);
  }

  /**
   * @description Method setIngredientQuantity.
   */
  setIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  /**
   * @description Method incrementIngredientQuantity.
   */
  incrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  /**
   * @description Method decrementIngredientQuantity.
   */
  decrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  /**
   * @description Method setIngredientUnit.
   */
  setIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  /**
   * @description Method toggleCreateUnitMenu.
   */
  toggleCreateUnitMenu() {
    this.isCreateUnitMenuOpen.update((isOpen) => !isOpen);
  }

  /**
   * @description Method selectCreateUnit.
   */
  selectCreateUnit(unit: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isCreateUnitMenuOpen.set(false);
  }

  /**
   * @description Method formatUnit.
   */
  formatUnit(unit: string) {
    return unit === 'piece' ? '' : unit === 'gram' ? 'g' : unit === 'ml' ? 'ml' : unit;
  }

  /**
   * @description Method addIngredient.
   */
  addIngredient() {
    const ingredient = this.ingredientsSignal();
    const normalizedName = this.sanitizeIngredientName(ingredient.name);
    const validQuantity = Number(ingredient.quantity);

    if (!normalizedName.trim()) {
      this.ingredientValidationMessage.set(this.emptyIngredientHintMessage);
      return;
    }

    if (!this.isValidIngredientName(normalizedName)) {
      this.ingredientValidationMessage.set(this.ingredientHintMessage);
      return;
    }

    if (!Number.isFinite(validQuantity) || validQuantity <= 0 || !ingredient.unit) {
      return;
    }

    const nextIngredient = {
      name: normalizedName,
      quantity: validQuantity,
      unit: ingredient.unit
    };

    if (this.editingIndex() === null) {
      this.ingredients.update((existing) => [...existing, nextIngredient]);
    } else {
      this.ingredients.update((existing) =>
        existing.map((item, index) => index === this.editingIndex() ? nextIngredient : item)
      );
      this.editingIndex.set(null);
    }

    this.persistIngredients();
    void this.persistIngredientToFirebase(normalizedName);

    this.ingredientsSignal.set({
      name: '',
      quantity: 0,
      unit: 'gram'
    });
    this.ingredientValidationMessage.set('');
    this.isIngredientSuggestionsOpen.set(false);
    this.isCreateUnitMenuOpen.set(false);
  }

  /**
   * @description Method editIngredient.
   */
  editIngredient(index: number) {
    const ingredient = this.ingredients()[index];

    if (!ingredient) {
      return;
    }

    this.editingIndex.set(index);
    this.isEditUnitMenuOpen.set(false);
    this.editingIngredient.set({
      quantity: ingredient.quantity,
      unit: ingredient.unit
    });
  }

  /**
   * @description Method setEditingIngredientQuantity.
   */
  setEditingIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  /**
   * @description Method incrementEditingIngredientQuantity.
   */
  incrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  /**
   * @description Method decrementEditingIngredientQuantity.
   */
  decrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  /**
   * @description Method setEditingIngredientUnit.
   */
  setEditingIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  /**
   * @description Method toggleEditUnitMenu.
   */
  toggleEditUnitMenu() {
    this.isEditUnitMenuOpen.update((isOpen) => !isOpen);
  }

  /**
   * @description Method selectEditUnit.
   */
  selectEditUnit(unit: string) {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isEditUnitMenuOpen.set(false);
  }

  /**
   * @description Method saveIngredientEdit.
   */
  saveIngredientEdit(index: number) {
    const ingredient = this.ingredients()[index];

    if (!ingredient) {
      return;
    }

    const editedIngredient = this.editingIngredient();

    if (!Number.isFinite(editedIngredient.quantity) || editedIngredient.quantity <= 0 || !editedIngredient.unit) {
      return;
    }

    this.ingredients.update((existing) =>
      existing.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: editedIngredient.quantity, unit: editedIngredient.unit }
          : item
      )
    );

    this.persistIngredients();
    this.cancelEdit();
  }

  /**
   * @description Method deleteIngredient.
   */
  deleteIngredient(index: number) {
    const currentEditingIndex = this.editingIndex();

    this.ingredients.update((existing) => existing.filter((_, itemIndex) => itemIndex !== index));

    if (currentEditingIndex !== null) {
      if (currentEditingIndex === index) {
        this.cancelEdit();
      } else if (currentEditingIndex > index) {
        this.editingIndex.set(currentEditingIndex - 1);
      }
    }

    this.persistIngredients();
  }

  /**
   * @description Method cancelEdit.
   */
  cancelEdit() {
    this.loadIngredientsFromStorage();
    void this.loadIngredientsFromFirebase();
    this.editingIndex.set(null);
    this.isEditUnitMenuOpen.set(false);
    this.editingIngredient.set({
      quantity: 0,
      unit: 'gram'
    });
  }

  /**
   * @description Method persistIngredients.
   */
  private persistIngredients() {
    try {
      const currentContext = this.getStoredRecipeContext();
      const nextContext: StoredRecipeContext = {
        ...currentContext,
        ingredients: this.ingredients(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(nextContext));
      // Ingredients changed: invalidate old request/response to avoid stale recipes.
      this.clearRecipeGenerationCache();
    } catch (error) {
      console.error('Unable to persist ingredients:', error);
    }
  }

  /**
   * @description Method clearRecipeGenerationCache.
   */
  private clearRecipeGenerationCache() {
    try {
      localStorage.removeItem(this.recipePayloadKey);
      localStorage.removeItem(this.recipesResponseKey);
    } catch (error) {
      console.error('Unable to clear cached recipe data:', error);
    }
  }

  /**
   * @description Method loadIngredientsFromStorage.
   */
  private loadIngredientsFromStorage() {
    try {
      const storedIngredients = localStorage.getItem(this.storageKey);

      if (!storedIngredients) {
        this.ingredients.set([]);
        return;
      }

      const parsed = JSON.parse(storedIngredients);

      if (Array.isArray(parsed) && parsed.every((item) => this.isValidIngredient(item))) {
        this.ingredients.set(parsed);
        return;
      }

      if (this.isStoredRecipeContext(parsed)) {
        this.ingredients.set(parsed.ingredients);
        return;
      }

      this.ingredients.set([]);
    } catch (error) {
      console.error('Unable to load ingredients:', error);
      this.ingredients.set([]);
    }
  }

  /**
   * @description Method getStoredRecipeContext.
   */
  private getStoredRecipeContext(): StoredRecipeContext {
    const storedValue = localStorage.getItem(this.storageKey);

    if (!storedValue) {
      return { ingredients: [] };
    }

    try {
      const parsed = JSON.parse(storedValue);
      if (Array.isArray(parsed) && parsed.every((item) => this.isValidIngredient(item))) {
        return { ingredients: parsed };
      }

      if (this.isStoredRecipeContext(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Unable to parse stored recipe context:', error);
    }

    return { ingredients: [] };
  }

  /**
   * @description Method isValidIngredient.
   */
  private isValidIngredient(value: unknown): value is Ingredients {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const ingredient = value as Ingredients;
    return typeof ingredient.name === 'string'
      && typeof ingredient.quantity === 'number'
      && typeof ingredient.unit === 'string';
  }

  /**
   * @description Method isStoredRecipeContext.
   */
  private isStoredRecipeContext(value: unknown): value is StoredRecipeContext {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const maybeContext = value as Partial<StoredRecipeContext>;
    return Array.isArray(maybeContext.ingredients)
      && maybeContext.ingredients.every((item) => this.isValidIngredient(item));
  }

/**
 * @description Method loadIngredientsFromFirebase.
 */
private async loadIngredientsFromFirebase(): Promise<void> {
  try {
    const response = await firstValueFrom(
      this.http.get<Record<string, { name?: string; createdAt?: string }> | null>(
        `${this.databaseUrl}/ingredients.json`
      )
    );

    const firebaseNames = Object.values(response ?? {})
      .map((ingredient) => (typeof ingredient?.name === 'string' ? ingredient.name.trim() : ''))
      .filter((ingredientName): ingredientName is string => ingredientName.length > 0);

    const combinedNames = Array.from(new Set([...this.ingredientCatalog, ...firebaseNames]));
    this.firebaseIngredientNames.set(combinedNames);
  } catch (error) {
    console.error('Unable to load ingredients from Firebase:', error);
  }
}

/**
 * @description Method persistIngredientToFirebase.
 */
private async persistIngredientToFirebase(name: string): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return;
  }

  const existingNames = this.firebaseIngredientNames().map((ingredientName) => ingredientName.toLowerCase());
  if (existingNames.includes(normalizedName.toLowerCase())) {
    return;
  }

  try {
    const payload = {
      name: normalizedName,
      createdAt: new Date().toISOString(),
    };

    const slug = this.toIngredientSlug(normalizedName);
    await firstValueFrom(
      this.http.put(`${this.databaseUrl}/ingredients/${slug}.json`, payload)
    );

    this.firebaseIngredientNames.update((currentNames) =>
      Array.from(new Set([...currentNames, normalizedName]))
    );
  } catch (error) {
    console.error('Unable to persist ingredient to Firebase:', error);
  }
}

  /**
   * @description Method toIngredientSlug.
   */
  private toIngredientSlug(name: string): string {
  return name
   .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ingredient';
}


/**
 * @description Method isValidIngredientName.
 */
private isValidIngredientName(value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (trimmedValue.length > this.maxIngredientNameLength) {
    return false;
  }

  return this.ingredientNamePattern.test(trimmedValue);
}
}