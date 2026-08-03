// import { fakeAsync, TestBed, tick } from '@angular/core/testing';
// import { RouterTestingModule } from '@angular/router/testing';

// import { Results } from './results';
// import { RecipeLibraryService } from '../recipe-library.service';

// describe('Results', () => {
//   let component: Results;
//   let recipeLibraryService: jasmine.SpyObj<RecipeLibraryService>;

//   beforeEach(async () => {
//     const recipeLibraryServiceSpy = jasmine.createSpyObj('RecipeLibraryService', ['saveGeneratedRecipes']);

//     await TestBed.configureTestingModule({
//       imports: [Results, RouterTestingModule],
//       providers: [{ provide: RecipeLibraryService, useValue: recipeLibraryServiceSpy }],
//     }).compileComponents();

//     recipeLibraryService = TestBed.inject(RecipeLibraryService) as jasmine.SpyObj<RecipeLibraryService>;
//     const fixture = TestBed.createComponent(Results);
//     component = fixture.componentInstance;
//   });

//   it('hides the saved notification after 4 seconds', fakeAsync(() => {
//     component['showSavedStateTemporarily']();

//     expect(component.persistenceState()).toBe('saved');

//     tick(4000);

//     expect(component.persistenceState()).toBe('idle');
//   }));
// });
