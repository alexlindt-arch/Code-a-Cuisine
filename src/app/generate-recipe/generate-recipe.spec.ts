/**
 * @file generate-recipe.spec.ts
 * @description Unit tests for generate recipe.spec.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateRecipe } from './generate-recipe';

describe('GenerateRecipe', () => {
  let component: GenerateRecipe;
  let fixture: ComponentFixture<GenerateRecipe>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [GenerateRecipe],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerateRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add ingredient with valid input', () => {
    component.ingredientsSignal.set({
      name: 'Tomato',
      quantity: 2,
      unit: 'piece'
    });

    component.onSubmit();

    const ingredients = component.ingredients();
    expect(ingredients.length).toBe(2);
    expect(ingredients[1]).toEqual({
      name: 'Tomato',
      quantity: 2,
      unit: 'piece'
    });
  });

  it('should persist ingredients to localStorage after add', () => {
    component.ingredientsSignal.set({
      name: 'Milk',
      quantity: 250,
      unit: 'ml'
    });

    component.onSubmit();

    const saved = localStorage.getItem('cac-ingredients');
    expect(saved).toBeTruthy();

    const parsed = JSON.parse(saved ?? '[]') as Array<{ name: string; quantity: number; unit: string }>;
    expect(parsed.some((item) => item.name === 'Milk' && item.quantity === 250 && item.unit === 'ml')).toBeTruthy();
  });

  it('should not add invalid ingredient', () => {
    component.ingredientsSignal.set({
      name: '   ',
      quantity: 0,
      unit: 'gram'
    });

    component.onSubmit();

    expect(component.ingredients().length).toBe(1);
  });

  it('should show a dedicated empty-field hint for blank input', () => {
    const event = { target: { value: '   ' } } as unknown as Event;

    component.setIngredientName(event);

    expect(component.ingredientValidationMessage()).toBe(component.emptyIngredientHintMessage);
  });

  it('should show the empty-field hint when submitting a blank ingredient', () => {
    component.ingredientsSignal.set({
      name: '   ',
      quantity: 1,
      unit: 'gram'
    });

    component.addIngredient();

    expect(component.ingredientValidationMessage()).toBe(component.emptyIngredientHintMessage);
  });

  it('should load ingredients from localStorage on init', async () => {
    localStorage.setItem('cac-ingredients', JSON.stringify([
      {
        name: 'Garlic',
        quantity: 3,
        unit: 'piece'
      }
    ]));

    const localFixture = TestBed.createComponent(GenerateRecipe);
    const localComponent = localFixture.componentInstance;
    await localFixture.whenStable();

    expect(localComponent.ingredients()).toEqual([
      {
        name: 'Garlic',
        quantity: 3,
        unit: 'piece'
      }
    ]);
  });
});