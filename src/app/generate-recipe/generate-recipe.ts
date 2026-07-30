import { Component, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import {  ImagesComponent } from "../components/images-component/images-component";

interface Ingredients {
  name: string;
  quantity: number;
  unit: string;
}

@Component({
  selector: 'app-generate-recipe',
  imports: [ImagesComponent],
  templateUrl: './generate-recipe.html',
  styleUrls: ['./generate-recipe.scss'],
})

export class GenerateRecipe {
  private readonly storageKey = 'cac-ingredients';
  readonly unitOptions = ['gram', 'ml', 'piece'];
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

  return this.ingredientCatalog
    .filter((ingredientName) => ingredientName.toLowerCase().startsWith(query))
    .slice(0, 8);
});

addIcon = 'assets/icons/add-icon.png';
  private activatedRoute = inject(ActivatedRoute);
  title = this.activatedRoute.data.pipe(
    map((data) => data['title'] || 'recipe-generator')
  );

  constructor() {
    this.loadIngredientsFromStorage();
  }

 onSubmit(event?: Event) {
   event?.preventDefault();
    this.addIngredient();
  }

  setIngredientName(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name: value
    }));

    this.isIngredientSuggestionsOpen.set(value.trim().length >= 3);
  }

  onIngredientFieldFocus() {
    this.isIngredientSuggestionsOpen.set(this.ingredientsSignal().name.trim().length >= 3);
  }

  onIngredientFieldBlur() {
    setTimeout(() => {
      this.isIngredientSuggestionsOpen.set(false);
    }, 120);
  }

  selectIngredientSuggestion(name: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name
    }));
    this.isIngredientSuggestionsOpen.set(false);
  }

  setIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  incrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  decrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  setIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  toggleCreateUnitMenu() {
    this.isCreateUnitMenuOpen.update((isOpen) => !isOpen);
  }

  selectCreateUnit(unit: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isCreateUnitMenuOpen.set(false);
  }

  formatUnit(unit: string) {
    return unit === 'piece' ? '' : unit === 'gram' ? 'g' : unit === 'ml' ? 'ml' : unit;
  }

  addIngredient() {
    const ingredient = this.ingredientsSignal();
    const normalizedName = ingredient.name.trim();
    const validQuantity = Number(ingredient.quantity);

    if (!normalizedName || !Number.isFinite(validQuantity) || validQuantity <= 0 || !ingredient.unit) {
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

    this.ingredientsSignal.set({
      name: '',
      quantity: 0,
      unit: 'gram'
    });
    this.isIngredientSuggestionsOpen.set(false);
    this.isCreateUnitMenuOpen.set(false);
  }

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

  setEditingIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  incrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  decrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  setEditingIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  toggleEditUnitMenu() {
    this.isEditUnitMenuOpen.update((isOpen) => !isOpen);
  }

  selectEditUnit(unit: string) {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isEditUnitMenuOpen.set(false);
  }

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

  cancelEdit() {
    this.editingIndex.set(null);
    this.isEditUnitMenuOpen.set(false);
    this.editingIngredient.set({
      quantity: 0,
      unit: 'gram'
    });
  }

  private persistIngredients() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.ingredients()));
    } catch (error) {
      console.error('Unable to persist ingredients:', error);
    }
  }

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
      }
    } catch (error) {
      console.error('Unable to load ingredients:', error);
      this.ingredients.set([]);
    }
  }

  private isValidIngredient(value: unknown): value is Ingredients {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const ingredient = value as Ingredients;
    return typeof ingredient.name === 'string'
      && typeof ingredient.quantity === 'number'
      && typeof ingredient.unit === 'string';
  }

generateRecipe(){


}

}
