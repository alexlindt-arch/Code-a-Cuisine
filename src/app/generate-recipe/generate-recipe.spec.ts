/**
 * @file generate-recipe.spec.ts
 * @description Unit tests for the generate recipe page and its ingredient editor logic.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { GenerateRecipe } from './generate-recipe';

describe('GenerateRecipe', () => {
  let component: GenerateRecipe;
  let fixture: ComponentFixture<GenerateRecipe>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [GenerateRecipe],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'preferences', children: [] }])],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerateRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add ingredient with valid input', () => {
    component.ingredientsSignal.set({ name: 'Tomato', quantity: 2, unit: 'piece' });

    component.onSubmit();

    const ingredients = component.ingredients();
    expect(ingredients.length).toBe(1);
    expect(ingredients[0]).toEqual({ name: 'Tomato', quantity: 2, unit: 'piece' });
  });

  it('should persist ingredients to localStorage after add', () => {
    component.ingredientsSignal.set({ name: 'Milk', quantity: 250, unit: 'ml' });

    component.onSubmit();

    const saved = localStorage.getItem('cac-ingredients');
    expect(saved).toBeTruthy();

    const parsed = JSON.parse(saved ?? '{}') as { ingredients: Array<{ name: string; quantity: number; unit: string }> };
    expect(parsed.ingredients.some((item) => item.name === 'Milk' && item.quantity === 250 && item.unit === 'ml')).toBeTruthy();
  });

  it('should not add invalid ingredient', () => {
    component.ingredientsSignal.set({ name: '   ', quantity: 0, unit: 'gram' });

    component.onSubmit();

    expect(component.ingredients().length).toBe(0);
  });

  it('should not add an ingredient with a quantity of 0', () => {
    component.ingredientsSignal.set({ name: 'Rice', quantity: 0, unit: 'gram' });

    component.addIngredient();

    expect(component.ingredients().length).toBe(0);
    expect(component.quantityValidationMessage()).toBe(component.quantityHintMessage);
  });

  it('should merge an ingredient that is added twice with the same unit', () => {
    component.ingredientsSignal.set({ name: 'Rice', quantity: 100, unit: 'gram' });
    component.addIngredient();
    component.ingredientsSignal.set({ name: 'rice', quantity: 50, unit: 'gram' });
    component.addIngredient();

    expect(component.ingredients()).toEqual([{ name: 'Rice', quantity: 150, unit: 'gram' }]);
  });

  it('should reject a duplicate ingredient with a different unit', () => {
    component.ingredientsSignal.set({ name: 'Rice', quantity: 100, unit: 'gram' });
    component.addIngredient();
    component.ingredientsSignal.set({ name: 'Rice', quantity: 1, unit: 'kg' });
    component.addIngredient();

    expect(component.ingredients().length).toBe(1);
    expect(component.ingredientValidationMessage()).toContain('already on your list');
  });

  it('should allow the next step with a single ingredient', () => {
    component.ingredientsSignal.set({ name: 'Egg', quantity: 2, unit: 'piece' });
    component.addIngredient();

    component.goToPreferences();

    expect(component.formValidationMessage()).toBe('');
  });

  it('should show a dedicated empty-field hint for blank input', () => {
    const event = { target: { value: '   ' } } as unknown as Event;

    component.setIngredientName(event);

    expect(component.ingredientValidationMessage()).toBe(component.emptyIngredientHintMessage);
  });

  it('should show the empty-field hint when submitting a blank ingredient', () => {
    component.ingredientsSignal.set({ name: '   ', quantity: 1, unit: 'gram' });

    component.addIngredient();

    expect(component.ingredientValidationMessage()).toBe(component.emptyIngredientHintMessage);
  });

  it('should load ingredients from localStorage on init', async () => {
    localStorage.setItem('cac-ingredients', JSON.stringify([{ name: 'Garlic', quantity: 3, unit: 'piece' }]));

    const localFixture = TestBed.createComponent(GenerateRecipe);
    const localComponent = localFixture.componentInstance;
    await localFixture.whenStable();

    expect(localComponent.ingredients()).toEqual([{ name: 'Garlic', quantity: 3, unit: 'piece' }]);
  });
});
