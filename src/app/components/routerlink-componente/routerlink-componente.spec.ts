/**
 * @file routerlink-componente.spec.ts
 * @description Unit tests for the arrow router link component.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RouterlinkComponente } from './routerlink-componente';

describe('RouterlinkComponente', () => {
  let component: RouterlinkComponente;
  let fixture: ComponentFixture<RouterlinkComponente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterlinkComponente],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RouterlinkComponente);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('linkText', 'Cookbook');
    fixture.componentRef.setInput('targetPath', '/cookbook');
    fixture.componentRef.setInput('targetClass', 'cookbook-link');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the link text', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cookbook');
  });
});
