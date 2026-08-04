/**
 * @file preferences.spec.ts
 * @description Unit tests for preferences.spec.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Preferences } from './preferences';

describe('Preferences', () => {
  let component: Preferences;
  let fixture: ComponentFixture<Preferences>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Preferences],
    }).compileComponents();

    fixture = TestBed.createComponent(Preferences);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the loading state temporarily on startup for spinner previewing', () => {
    expect(component.submitState()).toBe('loading');
  });
});