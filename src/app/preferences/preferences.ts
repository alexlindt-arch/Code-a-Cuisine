import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ImagesComponent } from '../components/images-component/images-component';
import { LoadingStateService } from '../loading-state.service';
import { environment } from '../../environments/environment';
import { PreferencesQuotaService } from './preferences-quota.service';
import { RecipeRequestService } from './recipe-request.service';
import type { CookingTimeId, CuisineId, DietId, Option, QuotaCardSummary, QuotaStatus, RecipeRequestPayload, StoredRecipeContext } from './preferences.models';

@Component({
  selector: 'app-preferences',
  imports: [ImagesComponent, RouterLink],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.scss'],
})
export class Preferences implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly loadingStateService = inject(LoadingStateService);
  private readonly quota = inject(PreferencesQuotaService);
  private readonly requests = inject(RecipeRequestService);
  private readonly storageKey = 'cac-ingredients';
  private readonly payloadKey = 'cac-recipe-request';
  private readonly responseKey = 'cac-recipe-results';
  private readonly errorKey = 'cac-recipe-error';
  private readonly ip = signal('127.0.0.1');
  private readonly resetClock = signal(Date.now());
  private readonly timer = setInterval(() => this.resetClock.set(Date.now()), 60000);

  readonly cooks = signal(1);
  readonly portions = signal(2);
  readonly selectedCookingTime = signal<CookingTimeId>('medium');
  readonly selectedCuisine = signal<CuisineId>('italian');
  readonly selectedDiets = signal<DietId[]>(['none']);
  readonly submitState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly quotaStatus = this.quota.status;
  readonly quotaMessage = this.quota.message;
  readonly showQuotaDialog = this.quota.dialogVisible;
  readonly quotaExceeded = this.quota.exceeded;
  readonly quotaDialogKind = this.quota.dialogKind;
  readonly isQuotaStatusLoading = this.quota.loading;

  readonly cookingTimeOptions = [
    { id: 'quick' as CookingTimeId, label: 'Quick', hint: 'up to 20min' },
    { id: 'medium' as CookingTimeId, label: 'Medium', hint: '25-40min' },
    { id: 'complex' as CookingTimeId, label: 'Complex', hint: 'over 45min' },
  ];
  readonly cuisineOptions: Option<CuisineId>[] = [
    { id: 'german', label: 'German' }, { id: 'italian', label: 'Italian' }, { id: 'indian', label: 'Indian' },
    { id: 'japanese', label: 'Japanese' }, { id: 'gourmet', label: 'Gourmet' }, { id: 'fusion', label: 'Fusion' },
  ];
  readonly dietOptions: Option<DietId>[] = [
    { id: 'vegetarian', label: 'Vegetarian' }, { id: 'vegan', label: 'Vegan' },
    { id: 'keto', label: 'Keto' }, { id: 'none', label: 'No preferences' },
  ];

  readonly canSubmitRecipe = computed(() => this.submitState() !== 'loading'
    && !this.isQuotaStatusLoading()
    && !this.quota.hasReached(this.quotaStatus(), this.localUsage()));
  readonly showQuotaCard = computed(() => this.quotaCardSummary().show);
  readonly generateButtonLabel = computed(() => {
    if (this.submitState() === 'loading') return 'Generating...';
    if (this.isQuotaStatusLoading()) return 'Checking daily limit...';
    if (!this.quotaStatus()) return 'Quota check unavailable';
    return this.canSubmitRecipe() ? 'Generate a recipe' : 'Ups! Not quite enough...';
  });
  readonly quotaDialogTitle = computed(() => this.quotaDialogKind() === 'connection' ? 'Connection failed' : this.quotaDialogKind() === 'limit' ? 'Daily limit reached' : 'Notice');
  readonly quotaDialogMessage = computed(() => this.quotaDialogKind() === 'connection'
    ? 'The recipe API is currently unavailable. Please try again in a few minutes.'
    : this.quotaDialogKind() === 'limit' ? this.quota.buildDailyMessage(this.localUsage()) : this.quotaMessage() || 'Please check your recipe request.');
  readonly quotaResetHint = computed(() => {
    this.resetClock();
    if (!this.showQuotaDialog() || !this.quotaExceeded()) return null;
    const minutes = Math.ceil(this.quota.getResetMs(this.ip()) / 60000);
    return minutes > 0 ? `Reset in ${Math.floor(minutes / 60)}h ${minutes % 60}m.` : null;
  });

  prefBlockIconClock = 'assets/icons/clock_Icon.png';
  prefBlockIconCuisine = 'assets/icons/word_Icon.png';
  prefBlockIconDiet = 'assets/icons/fork_spoon.png';
  heroImageArrow = 'assets/icons/Arrow-left-dark.png';
  heroImageArrowLight = 'assets/icons/Arrow-right.png';
  arrowClass = 'arrow-icon';
  heroImage = 'assets/img/logo-light.png';
  schusselIcon = 'assets/icons/schussel(2).png';
  loffelIcon = 'assets/icons/loffel(1).png';
  karotteIcon = 'assets/icons/karotte.png';
  kohlIcon2 = 'assets/icons/kohl.png';
  rettichIcon3 = 'assets/icons/rettich.png';

  constructor() {
    this.quota.initialize();
    void this.initializeIp();
  }

  ngOnDestroy(): void { clearInterval(this.timer); }
  incrementCooks() { this.cooks.update((value) => Math.min(3, value + 1)); }
  decrementCooks() { this.cooks.update((value) => Math.max(1, value - 1)); }
  incrementPortions() { this.portions.update((value) => Math.min(12, value + 1)); }
  decrementPortions() { this.portions.update((value) => Math.max(1, value - 1)); }
  selectCookingTime(id: CookingTimeId) { this.selectedCookingTime.set(id); }
  selectCuisine(id: CuisineId) { this.selectedCuisine.set(id); }
  isDietSelected(id: DietId) { return this.selectedDiets().includes(id); }
  toggleDiet(id: DietId) {
    if (id === 'none') { this.selectedDiets.set(['none']); return; }
    this.selectedDiets.update((items) => { const active = items.filter((item) => item !== 'none'); const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id]; return next.length ? next : ['none']; });
  }
  closeQuotaDialog() { this.showQuotaDialog.set(false); }
  isQuotaForToday(quota: QuotaStatus | null): boolean { return this.quota.isForToday(quota); }
  hasReachedQuota(quota = this.quotaStatus(), usage = this.localUsage()) { return this.quota.hasReached(quota, usage); }
  quotaCardSummary(): QuotaCardSummary { return this.quota.cardSummary(this.ip()); }

  async generateRecipe() {
    if (!this.canSubmitRecipe()) { this.showQuotaDialog.set(true); this.quotaDialogKind.set('limit'); return; }
    const context = this.readContext();
    if (!context.ingredients.length) { await this.router.navigate(['/generate-recipe']); return; }
    const payload: RecipeRequestPayload = { ingredients: context.ingredients, preferences: { portions: this.portions(), cooks: this.cooks(), cookingTime: this.selectedCookingTime(), cuisine: this.selectedCuisine(), diets: this.selectedDiets() }, clientIp: this.ip(), requestedAt: new Date().toISOString() };
    this.submitState.set('loading'); this.loadingStateService.setLoading(true); localStorage.setItem(this.payloadKey, JSON.stringify(payload));
    try {
      const response = await this.requests.send(payload, this.requests.getWebhookUrls());
      this.quota.increment(this.ip()); this.quota.sync(this.quota.buildLocal(this.ip(), this.localUsage()));
      const serverQuota = this.requests.readQuota(response);
      if (serverQuota) {
        this.quota.sync(serverQuota);
      }
      localStorage.setItem(this.responseKey, JSON.stringify(response)); await this.router.navigate(['/results']);
    } catch (error) {
      const message = this.requests.toErrorMessage(error); this.quota.message.set(message); this.quota.dialogKind.set(this.requests.isConnectionError(error, message) ? 'connection' : 'notice'); this.quota.dialogVisible.set(true); localStorage.setItem(this.errorKey, message);
      const isLimitError = this.requests.isLimitError(error, message, this.localUsage(), this.quota.getLimit());
      if (isLimitError) {
        this.quota.exceeded.set(true);
        this.quota.dialogKind.set('limit');
        const serverQuota = error instanceof HttpErrorResponse ? this.requests.readQuota(error.error) : null;
        this.quota.message.set(this.quota.buildDailyMessage(this.localUsage(), serverQuota));
      }
    } finally { this.submitState.set('idle'); this.loadingStateService.setLoading(false); }
  }

  private async initializeIp() {
    try { const response = await fetch('https://api.ipify.org?format=json'); if (response.ok) this.ip.set((await response.json() as { ip?: string }).ip || '127.0.0.1'); }
    catch { this.ip.set('127.0.0.1'); }
    this.quota.clearExpired(this.ip()); this.quota.sync(this.quota.buildLocal(this.ip(), this.localUsage())); this.quota.setLoading(false);
  }
  private localUsage() { return this.quota.getUsage(this.ip()); }
  private readContext(): StoredRecipeContext { try { const parsed = JSON.parse(localStorage.getItem(this.storageKey) ?? '{}') as StoredRecipeContext; return Array.isArray(parsed.ingredients) ? parsed : { ingredients: [] }; } catch { return { ingredients: [] }; } }
}
