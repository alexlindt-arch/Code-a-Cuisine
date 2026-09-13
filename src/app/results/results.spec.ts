/**
 * @file results.spec.ts
 * @description Unit tests for the results page: empty state, cuisine label and the temporary saved notice.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Results } from './results';
import { RecipeLibraryService } from '../recipe-library.service';

describe('Results', () => {
  let saveGeneratedRecipes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.clear();
    saveGeneratedRecipes = vi.fn().mockResolvedValue(['recipe-1']);

    await TestBed.configureTestingModule({
      imports: [Results],
      providers: [provideRouter([]), { provide: RecipeLibraryService, useValue: { saveGeneratedRecipes } }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no results and saves nothing without a stored response', () => {
    const component = TestBed.createComponent(Results).componentInstance;

    expect(component.hasStoredResponse()).toBe(false);
    expect(component.hasResults()).toBe(false);
    expect(saveGeneratedRecipes).not.toHaveBeenCalled();
  });

  it('capitalizes the cuisine of the stored request', () => {
    localStorage.setItem('cac-recipe-request', JSON.stringify({
      ingredients: [{ name: 'tomato', quantity: 2, unit: 'piece' }],
      preferences: { portions: 2, cooks: 1, cookingTime: 'quick', cuisine: 'italian', diets: ['none'] },
      requestedAt: '2026-09-13T10:00:00.000Z',
    }));

    const component = TestBed.createComponent(Results).componentInstance;

    expect(component.cuisineLabel()).toBe('Italian');
  });

  it('hides the saved notice after 4 seconds', () => {
    vi.useFakeTimers();
    const component = TestBed.createComponent(Results).componentInstance;

    (component as unknown as { showSavedStateTemporarily(): void }).showSavedStateTemporarily();
    expect(component.persistenceState()).toBe('saved');

    vi.advanceTimersByTime(4000);
    expect(component.persistenceState()).toBe('idle');
  });
});
