import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { RecipeDetail } from './recipe-detail';
import { RecipeLibraryService } from '../recipe-library.service';
import { buildCookTodoLists, parseRecipeArray, splitIngredients, toRoundedPercentages } from './recipe-detail.utils';

describe('RecipeDetail', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RecipeDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { routeConfig: null },
          },
        },
        {
          provide: RecipeLibraryService,
          useValue: {
            getRecipeById: () => Promise.resolve(null),
            incrementRecipeLike: () => Promise.resolve(1),
          },
        },
      ],
    }).compileComponents();
  });

  /**
   * Creates the component with a request for the given number of cooks.
   * @param cooks Number of cooks in the request.
   * @returns The component instance.
   */
  function createComponent(cooks: number) {
    const fixture = TestBed.createComponent(RecipeDetail);
    const component = fixture.componentInstance;
    component.requestPayload.set({
      ingredients: [{ name: 'Pasta', quantity: 200, unit: 'g' }],
      preferences: { portions: 2, cooks, cookingTime: 'medium', cuisine: 'italian', diets: ['none'] },
    });
    return component;
  }

  it('splits legacy steps across three columns when three cooks are selected', () => {
    const component = createComponent(3);

    component.selectedRecipe.set({
      title: 'Test recipe',
      description: 'A nice recipe',
      estimatedMinutes: 30,
      ingredients: ['ingredient 1', 'ingredient 2'],
      steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'],
    });

    const columns = component.stepColumns().columns;

    expect(component.hasStepDetails()).toBe(false);
    expect(columns.length).toBe(3);
    expect(columns[0].length).toBe(2);
    expect(columns[1].length).toBe(2);
    expect(columns[2].length).toBe(1);
    expect(columns[0][0].title).toBe('Step 1');
  });

  it('builds one chronological to-do list per cook from step details', () => {
    const component = createComponent(2);

    component.selectedRecipe.set({
      title: 'Pasta',
      description: 'Quick pasta',
      estimatedMinutes: 20,
      ingredients: ['200 g pasta', '1 tbsp olive oil'],
      steps: ['Boil: Boil water', 'Chop: Chop garlic', 'Mix: Mix all'],
      stepDetails: [
        { title: 'Boil', instruction: 'Boil water', cook: 1, parallel: true, durationMinutes: 10 },
        { title: 'Chop', instruction: 'Chop garlic', cook: 2, parallel: true, durationMinutes: 5 },
        { title: 'Mix', instruction: 'Mix all', cook: 1, parallel: false, durationMinutes: 0 },
      ],
    });

    const lists = component.cookTodoLists();

    expect(lists.length).toBe(2);
    expect(lists[0].steps.map((step) => step.number)).toEqual([1, 3]);
    expect(lists[1].steps.map((step) => step.number)).toEqual([2]);
    expect(lists[1].iconSrc).toBe('assets/icons/Cook-icon-2.svg');
  });

  it('shows no nutrition numbers for recipes without nutrition data', () => {
    const component = createComponent(1);

    component.selectedRecipe.set({
      title: 'Old recipe',
      description: 'Stored before nutrition existed',
      estimatedMinutes: 30,
      ingredients: ['a', 'b', 'c'],
      steps: ['Do it'],
    });

    expect(component.nutritionFacts()).toBeNull();
  });

  it('computes macro energy percentages for the selected nutrition view', () => {
    const component = createComponent(1);

    component.selectedRecipe.set({
      title: 'Pasta',
      description: 'Quick pasta',
      estimatedMinutes: 20,
      ingredients: ['200 g pasta'],
      steps: ['Cook pasta'],
      nutrition: {
        perPortion: { calories: 400, protein: 25, carbs: 50, fat: 10 },
        total: { calories: 800, protein: 50, carbs: 100, fat: 20 },
      },
    });

    const perPortion = component.nutritionFacts();
    expect(perPortion?.calories).toBe(400);
    expect(perPortion?.rows.map((row) => row.percent)).toEqual([26, 51, 23]);

    component.setNutritionView('total');
    expect(component.nutritionFacts()?.rows[0].grams).toBe(50);
  });
});

describe('recipe-detail utils', () => {
  it('uses extraIngredients when present', () => {
    const result = splitIngredients(
      { ingredients: ['200 g pasta', '1 tbsp olive oil'], extraIngredients: ['1 tbsp olive oil'] },
      [],
    );

    expect(result.yours).toEqual(['200 g pasta']);
    expect(result.extras).toEqual(['1 tbsp olive oil']);
  });

  it('keeps old recipes parseable and drops invalid optional fields', () => {
    const [recipe] = parseRecipeArray({
      recipes: [{
        title: 'Old',
        description: 'Old recipe',
        estimatedMinutes: 10,
        ingredients: ['a'],
        steps: ['b'],
        nutrition: { perPortion: { calories: 'x' } },
        stepDetails: 'invalid',
      }],
    });

    expect(recipe.title).toBe('Old');
    expect(recipe.nutrition).toBeUndefined();
    expect(recipe.stepDetails).toBeUndefined();
    expect(recipe.extraIngredients).toBeUndefined();
  });

  it('adds an empty list for cooks without tasks', () => {
    const lists = buildCookTodoLists([{ title: 'A', instruction: 'Do A', cook: 1, parallel: false, durationMinutes: 0 }], 3);

    expect(lists.length).toBe(3);
    expect(lists[2].steps.length).toBe(0);
  });

  it('handles zero energy when computing percentages', () => {
    expect(toRoundedPercentages([0, 0, 0])).toEqual([0, 0, 0]);
    expect(toRoundedPercentages([1, 1, 1]).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});
