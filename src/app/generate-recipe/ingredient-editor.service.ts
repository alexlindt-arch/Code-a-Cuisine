import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { isValidIngredientName, readStoredIngredients, readStoredRecipeContext, sanitizeIngredientName, toIngredientSlug, type RecipeIngredient } from './generate-recipe.utils';

@Injectable({ providedIn: 'root' })
export class IngredientEditorService {
  protected readonly http = inject(HttpClient);
  protected readonly databaseUrl = environment.firebaseDatabaseUrl;
  protected readonly storageKey = 'cac-ingredients';
  protected readonly recipePayloadKey = 'cac-recipe-request';
  protected readonly recipesResponseKey = 'cac-recipe-results';
  protected readonly ingredientNamePattern = /^[A-Za-zÄÖÜäöüß0-9\s'()-]+$/;
  protected readonly maxIngredientNameLength = 40;
  protected readonly ingredientHintMessage = 'no special characters, max 40 characters';
  readonly emptyIngredientHintMessage = 'Please enter an ingredient.';
  readonly requiredFieldsMessage = 'Please fill in all required fields.';
  readonly minIngredientsRequired = 3;
  readonly minIngredientsMessage = 'Please add at least 3 ingredients.';
  readonly firebaseIngredientNames = signal<string[]>([]);
  readonly ingredientValidationMessage = signal('');
  readonly formValidationMessage = signal('');
  readonly ingredientsSignal = signal<RecipeIngredient>({ name: '', quantity: 0, unit: 'gram' });
  readonly editingIndex = signal<number | null>(null);
  readonly isIngredientSuggestionsOpen = signal(false);
  readonly isCreateUnitMenuOpen = signal(false);
  readonly isEditUnitMenuOpen = signal(false);
  readonly editingIngredient = signal({ quantity: 100, unit: 'gram' });
  readonly ingredients = signal<RecipeIngredient[]>([]);
  readonly unitOptions = ['gram', 'ml', 'piece'];
  readonly hasIngredients = computed(() => this.ingredients().length > 0);
  readonly ingredientCatalog = ['Apple', 'Apfel', 'Basil', 'Basilikum', 'Bell Pepper', 'Paprika', 'Bread', 'Brot', 'Broccoli', 'Brokkoli', 'Butter', 'Carrot', 'Karotte', 'Moehre', 'Cheese', 'Käse', 'Chicken Breast', 'Huehnchenbrust', 'Cucumber', 'Gurke', 'Egg', 'Ei', 'Flour', 'Mehl', 'Garlic', 'Knoblauch', 'Milk', 'Milch', 'Mozzarella', 'Mushroom', 'Pilze', 'Champignon', 'Onion', 'Zwiebel', 'Olive Oil', 'Olivenoel', 'Oregano', 'Parmesan', 'Pasta', 'Nudeln', 'Potato', 'Kartoffel', 'Potatoes', 'Kartoffeln', 'Rice', 'Reis', 'Spaghetti', 'Tomato', 'Tomate', 'Tomato Sauce', 'Tomatensauce', 'Zucchini'];
  readonly ingredientSuggestions = computed(() => {
    const query = this.ingredientsSignal().name.trim().toLowerCase();
    return query.length < 3 ? [] : Array.from(new Set([...this.firebaseIngredientNames(), ...this.ingredientCatalog])).filter((name) => name.toLowerCase().startsWith(query)).slice(0, 8);
  });

  constructor() { this.resetIngredientState(); void this.loadIngredientsFromFirebase(); }

  resetIngredientState() {
    this.ingredients.set([]); this.ingredientsSignal.set({ name: '', quantity: 0, unit: 'gram' });
    this.editingIndex.set(null); this.isIngredientSuggestionsOpen.set(false); this.isCreateUnitMenuOpen.set(false); this.isEditUnitMenuOpen.set(false);
    this.formValidationMessage.set(''); this.ingredientValidationMessage.set('');
    localStorage.removeItem(this.storageKey); localStorage.removeItem(this.recipePayloadKey); localStorage.removeItem(this.recipesResponseKey);
  }

  setIngredientName(event: Event) {
    const name = sanitizeIngredientName((event.target as HTMLInputElement).value);
    this.ingredientsSignal.update((item) => ({ ...item, name }));
    const valid = isValidIngredientName(name, this.ingredientNamePattern, this.maxIngredientNameLength);
    this.ingredientValidationMessage.set(!name ? this.emptyIngredientHintMessage : valid ? '' : this.ingredientHintMessage);
    this.isIngredientSuggestionsOpen.set(name.length >= 3 && valid);
    if (name.length >= 3 && valid) void this.loadIngredientsFromFirebase();
  }
  onIngredientFieldBlur() { setTimeout(() => this.isIngredientSuggestionsOpen.set(false), 120); }
  selectIngredientSuggestion(name: string) { this.ingredientsSignal.update((item) => ({ ...item, name })); this.isIngredientSuggestionsOpen.set(false); }
  setIngredientQuantity(event: Event) { const value = Number((event.target as HTMLInputElement).value); this.ingredientsSignal.update((item) => ({ ...item, quantity: Number.isFinite(value) ? value : 0 })); }
  incrementIngredientQuantity() { this.ingredientsSignal.update((item) => ({ ...item, quantity: Math.max(0, item.quantity) + 1 })); }
  decrementIngredientQuantity() { this.ingredientsSignal.update((item) => ({ ...item, quantity: Math.max(1, item.quantity - 1) })); }
  setIngredientUnit(event: Event) { this.selectCreateUnit((event.target as HTMLSelectElement).value); }
  toggleCreateUnitMenu() { this.isCreateUnitMenuOpen.update((open) => !open); }
  selectCreateUnit(unit: string) { this.ingredientsSignal.update((item) => ({ ...item, unit })); this.isCreateUnitMenuOpen.set(false); }
  formatUnit(unit: string) { return unit === 'piece' ? '' : unit === 'gram' ? 'g' : unit === 'ml' ? 'ml' : unit; }

  addIngredient() {
    const item = this.ingredientsSignal(); const name = sanitizeIngredientName(item.name); const quantity = Number(item.quantity);
    if (!name) { this.ingredientValidationMessage.set(this.emptyIngredientHintMessage); return; }
    if (!isValidIngredientName(name, this.ingredientNamePattern, this.maxIngredientNameLength)) { this.ingredientValidationMessage.set(this.ingredientHintMessage); return; }
    if (!Number.isFinite(quantity) || quantity <= 0 || !item.unit) { this.formValidationMessage.set(this.requiredFieldsMessage); return; }
    const next = { name, quantity, unit: item.unit }; const index = this.editingIndex();
    this.ingredients.update((items) => index === null ? [...items, next] : items.map((old, i) => i === index ? next : old));
    this.editingIndex.set(null); this.persistIngredients(); void this.persistIngredientToFirebase(name);
    this.ingredientsSignal.set({ name: '', quantity: 0, unit: 'gram' }); this.ingredientValidationMessage.set(''); this.formValidationMessage.set(''); this.isIngredientSuggestionsOpen.set(false); this.isCreateUnitMenuOpen.set(false);
  }
  editIngredient(index: number) { const item = this.ingredients()[index]; if (!item) return; this.editingIndex.set(index); this.isEditUnitMenuOpen.set(false); this.editingIngredient.set({ quantity: item.quantity, unit: item.unit }); }
  setEditingIngredientQuantity(event: Event) { const value = Number((event.target as HTMLInputElement).value); this.editingIngredient.update((item) => ({ ...item, quantity: Number.isFinite(value) ? value : 0 })); }
  incrementEditingIngredientQuantity() { this.editingIngredient.update((item) => ({ ...item, quantity: Math.max(0, item.quantity) + 1 })); }
  decrementEditingIngredientQuantity() { this.editingIngredient.update((item) => ({ ...item, quantity: Math.max(1, item.quantity - 1) })); }
  setEditingIngredientUnit(event: Event) { this.selectEditUnit((event.target as HTMLSelectElement).value); }
  toggleEditUnitMenu() { this.isEditUnitMenuOpen.update((open) => !open); }
  selectEditUnit(unit: string) { this.editingIngredient.update((item) => ({ ...item, unit })); this.isEditUnitMenuOpen.set(false); }
  saveIngredientEdit(index: number) { const edit = this.editingIngredient(); if (!this.ingredients()[index] || edit.quantity <= 0 || !edit.unit) return; this.ingredients.update((items) => items.map((item, i) => i === index ? { ...item, quantity: edit.quantity, unit: edit.unit } : item)); this.persistIngredients(); this.cancelEdit(); }
  deleteIngredient(index: number) { const current = this.editingIndex(); this.ingredients.update((items) => items.filter((_, i) => i !== index)); if (current === index) this.cancelEdit(); else if (current !== null && current > index) this.editingIndex.set(current - 1); this.persistIngredients(); }
  cancelEdit() { this.ingredients.set(readStoredIngredients(this.storageKey)); void this.loadIngredientsFromFirebase(); this.editingIndex.set(null); this.isEditUnitMenuOpen.set(false); this.editingIngredient.set({ quantity: 0, unit: 'gram' }); }
  protected loadIngredientsFromStorage() { this.ingredients.set(readStoredIngredients(this.storageKey)); }

  protected persistIngredients() { const context = readStoredRecipeContext(this.storageKey); localStorage.setItem(this.storageKey, JSON.stringify({ ...context, ingredients: this.ingredients() })); this.clearRecipeGenerationCache(); }
  protected clearRecipeGenerationCache() { localStorage.removeItem(this.recipePayloadKey); localStorage.removeItem(this.recipesResponseKey); }
  protected async loadIngredientsFromFirebase() { try { const response = await firstValueFrom(this.http.get<Record<string, { name?: string }> | null>(`${this.databaseUrl}/ingredients.json`)); const names = Object.values(response ?? {}).map((item) => item?.name?.trim() ?? '').filter(Boolean); this.firebaseIngredientNames.set(Array.from(new Set([...this.ingredientCatalog, ...names]))); } catch (error) { console.error('Unable to load ingredients from Firebase:', error); } }
  protected async persistIngredientToFirebase(name: string) { const normalized = name.trim(); if (!normalized || this.firebaseIngredientNames().some((item) => item.toLowerCase() === normalized.toLowerCase())) return; try { await firstValueFrom(this.http.put(`${this.databaseUrl}/ingredients/${toIngredientSlug(normalized)}.json`, { name: normalized, createdAt: new Date().toISOString() })); this.firebaseIngredientNames.update((items) => Array.from(new Set([...items, normalized]))); } catch (error) { console.error('Unable to persist ingredient to Firebase:', error); } }
}
