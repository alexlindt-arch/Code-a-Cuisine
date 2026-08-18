import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterTestingHarness } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { RecipeDetail } from './recipe-detail';
import { RecipeLibraryService } from '../recipe-library.service';

describe('RecipeDetail', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({}),
          },
        },
        {
          provide: RecipeLibraryService,
          useValue: {
            getRecipeById: jasmine.createSpy('getRecipeById'),
            incrementRecipeLike: jasmine.createSpy('incrementRecipeLike'),
          },
        },
      ],
    }).compileComponents();
  });

  it('splits steps across three columns when three cooks are selected', () => {
    const fixture = TestBed.createComponent(RecipeDetail);
    const component = fixture.componentInstance;

    component.requestPayload.set({
      ingredients: [],
      preferences: {
        portions: 2,
        cooks: 3,
        cookingTime: 'medium',
        cuisine: 'italian',
        diets: ['none'],
      },
    });

    component.selectedRecipe.set({
      title: 'Test recipe',
      description: 'A nice recipe',
      estimatedMinutes: 30,
      ingredients: ['ingredient 1', 'ingredient 2'],
      steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'],
    });

    const columns = component.stepColumns().columns;

    expect(columns).toHaveSize(3);
    expect(columns[0].length).toBe(2);
    expect(columns[1].length).toBe(2);
    expect(columns[2].length).toBe(1);
    expect(columns[0][0].title).toBe('Step 1');
  });
});
