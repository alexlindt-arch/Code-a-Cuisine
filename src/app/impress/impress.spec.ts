import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Impress } from './impress';

describe('Impress', () => {
  let component: Impress;
  let fixture: ComponentFixture<Impress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Impress],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Impress);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
