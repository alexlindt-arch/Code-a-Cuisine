/**
 * @file generate-recipe.ts
 * @description TypeScript module for generate recipe.
 */
import { Component, OnDestroy } from '@angular/core';
import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import {  ImagesComponent } from "../components/images-component/images-component";
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { IngredientEditorService } from './ingredient-editor.service';
import { isValidIngredientName, sanitizeIngredientName } from './generate-recipe.utils';

@Component({
  selector: 'app-generate-recipe',
  imports: [ImagesComponent],
  templateUrl: './generate-recipe.html',
  styleUrls: ['./generate-recipe.scss'],
})

/**
 * @description Component or service class GenerateRecipe.
 */
export class GenerateRecipe extends IngredientEditorService implements OnDestroy {
  private readonly router = inject(Router);

  label = 'recipe add icon';
  class = 'recipe-image';
  addIcon = 'assets/icons/add-icon.png';
  editIcon = 'assets/icons/edit-icon.png';
  checkIcon = 'assets/icons/check.png';
  deleteIcon = 'assets/icons/delete.png';
  arrowDropDownIcon = 'assets/icons/arrow_drop_down.png';
  index: number = 0;

  private activatedRoute = inject(ActivatedRoute);
  title = this.activatedRoute.data.pipe(
    map((data) => data['title'] || 'recipe-generator')
  );

  /**
   * @description Creates an instance of GenerateRecipe.
   */
  constructor() {
    super();
  }

  /**
   * @description Method ngOnDestroy.
   */
  ngOnDestroy(): void {
    // Intentionally left blank.
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
  override setIngredientName(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const sanitizedValue = sanitizeIngredientName(value);

    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name: sanitizedValue
    }));

    const trimmedValue = sanitizedValue.trim();
    const isValid = isValidIngredientName(sanitizedValue, this.ingredientNamePattern, this.maxIngredientNameLength);
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
  override onIngredientFieldBlur() {
    setTimeout(() => {
      this.isIngredientSuggestionsOpen.set(false);
    }, 120);
  }

  /**
   * @description Method selectIngredientSuggestion.
   */
  override selectIngredientSuggestion(name: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      name
    }));
    this.isIngredientSuggestionsOpen.set(false);
  }

  /**
   * @description Method setIngredientQuantity.
   */
  override setIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  /**
   * @description Method incrementIngredientQuantity.
   */
  override incrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  /**
   * @description Method decrementIngredientQuantity.
   */
  override decrementIngredientQuantity() {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  /**
   * @description Method setIngredientUnit.
   */
  override setIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  /**
   * @description Method toggleCreateUnitMenu.
   */
  override toggleCreateUnitMenu() {
    this.isCreateUnitMenuOpen.update((isOpen) => !isOpen);
  }

  /**
   * @description Method selectCreateUnit.
   */
  override selectCreateUnit(unit: string) {
    this.ingredientsSignal.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isCreateUnitMenuOpen.set(false);
  }

  /**
   * @description Method formatUnit.
   */
  override formatUnit(unit: string) {
    return unit === 'piece' ? '' : unit === 'gram' ? 'g' : unit === 'ml' ? 'ml' : unit;
  }

  /**
   * @description Method addIngredient.
   */
  override addIngredient() {
    const ingredient = this.ingredientsSignal();
    const normalizedName = sanitizeIngredientName(ingredient.name);
    const validQuantity = Number(ingredient.quantity);

    if (!normalizedName.trim()) {
      this.ingredientValidationMessage.set(this.emptyIngredientHintMessage);
      return;
    }

    if (!isValidIngredientName(normalizedName, this.ingredientNamePattern, this.maxIngredientNameLength)) {
      this.ingredientValidationMessage.set(this.ingredientHintMessage);
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
    this.formValidationMessage.set('');
    this.isIngredientSuggestionsOpen.set(false);
    this.isCreateUnitMenuOpen.set(false);
  }

  /**
   * @description Method goToPreferences.
   */
  goToPreferences() {
    const ingredientsCount = this.ingredients().length;

    if (ingredientsCount < this.minIngredientsRequired) {
      this.formValidationMessage.set(this.minIngredientsMessage);
      return;
    }

    this.formValidationMessage.set('');
    void this.router.navigate(['/preferences']);
  }

  /**
   * @description Method editIngredient.
   */
  override editIngredient(index: number) {
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
  override setEditingIngredientQuantity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Number.isFinite(value) ? value : 0
    }));
  }

  /**
   * @description Method incrementEditingIngredientQuantity.
   */
  override incrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(0, ingredient.quantity) + 1
    }));
  }

  /**
   * @description Method decrementEditingIngredientQuantity.
   */
  override decrementEditingIngredientQuantity() {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      quantity: Math.max(1, ingredient.quantity - 1)
    }));
  }

  /**
   * @description Method setEditingIngredientUnit.
   */
  override setEditingIngredientUnit(event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit: value
    }));
  }

  /**
   * @description Method toggleEditUnitMenu.
   */
  override toggleEditUnitMenu() {
    this.isEditUnitMenuOpen.update((isOpen) => !isOpen);
  }

  /**
   * @description Method selectEditUnit.
   */
  override selectEditUnit(unit: string) {
    this.editingIngredient.update((ingredient) => ({
      ...ingredient,
      unit
    }));
    this.isEditUnitMenuOpen.set(false);
  }

  /**
   * @description Method saveIngredientEdit.
   */
  override saveIngredientEdit(index: number) {
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
  override deleteIngredient(index: number) {
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
  override cancelEdit() {
    this.loadIngredientsFromStorage();
    void this.loadIngredientsFromFirebase();
    this.editingIndex.set(null);
    this.isEditUnitMenuOpen.set(false);
    this.editingIngredient.set({
      quantity: 0,
      unit: 'gram'
    });
  }

}
