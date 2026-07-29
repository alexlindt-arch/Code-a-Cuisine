import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateRecipe } from './generate-recipe';

describe('GenerateRecipe', () => {
  let component: GenerateRecipe;
  let fixture: ComponentFixture<GenerateRecipe>;

  beforeEach(async () => {
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
});
