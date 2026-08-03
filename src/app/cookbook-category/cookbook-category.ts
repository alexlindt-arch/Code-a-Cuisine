import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterlinkComponente } from '../components/routerlink-componente/routerlink-componente';
import { cookbookCategories, type CookbookCategory } from '../cookbook/cookbook-data';
import { RecipeLibraryService, type CookbookRecipeRecord } from '../recipe-library.service';

@Component({
  selector: 'app-cookbook-category',
  imports: [RouterLink, RouterlinkComponente],
  templateUrl: './cookbook-category.html',
  styleUrls: ['./cookbook-category.scss'],
})
export class CookbookCategoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly recipeLibraryService = inject(RecipeLibraryService);
  private readonly pageSize = 15;
  readonly heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  readonly arrowClass = 'arrow-icon';

  readonly selectedCategory = signal<CookbookCategory | null>(null);
  readonly recipes = signal<CookbookRecipeRecord[]>([]);
  readonly loadingState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly currentPage = signal(1);

  readonly filteredRecipes = computed<CookbookRecipeRecord[]>(() => {
    const category = this.selectedCategory();
    if (!category) {
      return [];
    }

    return this.recipes().filter((recipe) => recipe.categorySlug === category.slug);
  });

  readonly isUsingFallbackRecipes = computed(() => {
    if (!this.selectedCategory()) {
      return false;
    }

    return this.loadingState() === 'idle' && this.filteredRecipes().length === 0 && this.recipes().length > 0;
  });

  readonly displayedRecipes = computed<CookbookRecipeRecord[]>(() =>
    this.isUsingFallbackRecipes() ? this.recipes() : this.filteredRecipes()
  );

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.displayedRecipes().length / this.pageSize)));

  readonly visibleRecipes = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return this.displayedRecipes().slice(startIndex, startIndex + this.pageSize);
  });

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  readonly hasPreviousPage = computed(() => this.currentPage() > 1);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());

  constructor() {
    void this.loadRecipes();

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const categorySlug = params.get('category');
      const nextCategory = cookbookCategories.find((category) => category.slug === categorySlug) ?? null;
      this.selectedCategory.set(nextCategory);
      this.currentPage.set(1);
    });
  }

  private async loadRecipes() {
    this.loadingState.set('loading');

    try {
      const recipes = await this.recipeLibraryService.getAllRecipes();
      this.recipes.set(recipes);
      this.loadingState.set('idle');
    } catch (error) {
      console.error('Failed to load category recipes from Firebase:', error);
      this.loadingState.set('error');
    }
  }

  selectPage(pageNumber: number) {
    this.currentPage.set(pageNumber);
  }

  goToPreviousPage() {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.currentPage.update((page) => page - 1);
  }

  goToNextPage() {
    if (!this.hasNextPage()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
  }
}
