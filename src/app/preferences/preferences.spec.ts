/**
 * @file preferences.spec.ts
 * @description Unit tests for the preferences page.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Preferences } from './preferences';

describe('Preferences', () => {
  let component: Preferences;
  let fixture: ComponentFixture<Preferences>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    localStorage.clear();
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;

    await TestBed.configureTestingModule({
      imports: [Preferences],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Preferences);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the cooking time hints', () => {
    expect(component.cookingTimeOptions.map((option) => option.hint)).toEqual(['up to 20 min', '20–45 min', 'over 45 min']);
  });

  it('should reset other diets when "No preferences" is selected', () => {
    component.toggleDiet('vegan');
    component.toggleDiet('keto');
    expect(component.selectedDiets()).toEqual(['vegan', 'keto']);

    component.toggleDiet('none');
    expect(component.selectedDiets()).toEqual(['none']);
  });

  it('should show the remaining generations once the local quota is known', async () => {
    await new Promise((resolve) => setTimeout(resolve));

    expect(component.quotaSummaryText()).toBe('3 of 3 left today for your IP');
  });
});
