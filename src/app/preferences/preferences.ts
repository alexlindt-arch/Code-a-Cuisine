/**
 * @file preferences.ts
 * @description TypeScript module for preferences.
 */
import { Component, computed, signal, inject, OnDestroy } from '@angular/core';
import { ImagesComponent } from '../components/images-component/images-component';
import { Router, RouterLink } from "@angular/router";
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LoadingStateService } from '../loading-state.service';

type CookingTimeId = 'quick' | 'medium' | 'complex';
type CuisineId = 'german' | 'italian' | 'indian' | 'japanese' | 'gourmet' | 'fusion';
type DietId = 'vegetarian' | 'vegan' | 'keto' | 'none';


/**
 * @description Interface CookingTimeOption.
 */
interface CookingTimeOption {
  id: CookingTimeId;
  label: string;
  hint: string;
}

/**
 * @description Interface Option.
 */
interface Option<T extends string> {
  id: T;
  label: string;
}

/**
 * @description Interface StoredIngredient.
 */
interface StoredIngredient {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * @description Interface StoredRecipeContext.
 */
interface StoredRecipeContext {
  ingredients: StoredIngredient[];
  preferences?: {
    portions: number;
    cooks: number;
    cookingTime: CookingTimeId;
    cuisine: CuisineId;
    diets: DietId[];
  };
}

/**
 * @description Interface RecipeRequestPayload.
 */
interface RecipeRequestPayload {
  ingredients: StoredIngredient[];
  preferences: {
    portions: number;
    cooks: number;
    cookingTime: CookingTimeId;
    cuisine: CuisineId;
    diets: DietId[];
  };
  clientIp: string;
  requestedAt: string;
}

/**
 * @description Interface QuotaStatus.
 */
interface QuotaStatus {
  date: string;
  ipAddress: string;
  ipVersion: 'ipv4' | 'ipv6' | 'unknown';
  perIpLimit: number;
  perIpUsed: number;
  perIpRemaining: number;
  globalLimit: number;
  globalUsed: number;
  globalRemaining: number;
}

/**
 * @description Interface RecipeResponsePayload.
 */
interface RecipeResponsePayload {
  result?: unknown;
  quota?: QuotaStatus;
}

/**
 * @description Interface QuotaResponsePayload.
 */
interface QuotaResponsePayload {
  message?: string;
  quota?: QuotaStatus;
}

interface LocalPerIpQuota {
  date: string;
  ipAddress: string;
  used: number;
}


@Component({
  selector: 'app-preferences',
  imports: [ImagesComponent, RouterLink],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.scss'],
})
/**
 * @description Component or service class Preferences.
 */
export class Preferences implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly loadingStateService = inject(LoadingStateService);
  private readonly storageKey = 'cac-ingredients';
  private readonly recipePayloadKey = 'cac-recipe-request';
  private readonly recipesResponseKey = 'cac-recipe-results';
  private readonly recipeErrorKey = 'cac-recipe-error';
  private readonly stratoWebhookUrl = '/n8n-strato/webhook/code-a-cuisine-recipe';
  private readonly quotaWebhookUrl = '/n8n-strato/webhook/code-a-cuisine-quota';
  private readonly localPerIpQuotaKey = 'cac-local-per-ip-quota';
  private readonly localPerIpLimit = 3;

  readonly cooks = signal(1);
  readonly portions = signal(2);
  readonly selectedCookingTime = signal<CookingTimeId>('medium');
  readonly selectedCuisine = signal<CuisineId>('italian');
  readonly selectedDiets = signal<DietId[]>(['none']);
  readonly submitState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly quotaStatus = signal<QuotaStatus | null>(null);
  readonly quotaMessage = signal<string | null>(null);
  readonly showQuotaDialog = signal(false);
  readonly quotaExceeded = signal(false);
  readonly isQuotaStatusLoading = signal(true);
  private readonly cachedIp = signal<string | null>(null);
  private readonly quotaExceededKey = 'cac-quota-exceeded';
  private readonly resetHintClock = signal(Date.now());
  private resetHintTimerId: ReturnType<typeof setInterval> | null = null;
  readonly canSubmitRecipe = computed(() => {
    const quota = this.quotaStatus();
    const localPerIpUsed = this.getLocalPerIpUsageForToday();

    if (this.submitState() === 'loading' || this.isQuotaStatusLoading()) {
      return false;
    }

    if (this.quotaExceeded()) {
      return false;
    }

    if (!quota) {
      return localPerIpUsed < this.localPerIpLimit;
    }

    if (!this.isQuotaForToday(quota)) {
      return true;
    }

    return quota.perIpRemaining > 0 && quota.globalRemaining > 0 && localPerIpUsed < this.localPerIpLimit;
  });
  readonly showQuotaCard = computed(() => {
    const quota = this.quotaStatus();

    if (!quota || !this.isQuotaForToday(quota)) {
      return false;
    }

    const hasUsageToday = quota.perIpUsed > 0 || quota.globalUsed > 0;
    const hasQuotaMessage = typeof this.quotaMessage() === 'string' && this.quotaMessage()!.trim().length > 0;

    return hasUsageToday || hasQuotaMessage;
  });
  readonly quotaDialogMessage = computed(() => {
    const message = this.quotaMessage();
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    const quota = this.quotaStatus();
    if (quota && this.isQuotaForToday(quota)) {
      return this.buildQuotaExceededMessage(quota);
    }

    const localPerIpUsed = this.getLocalPerIpUsageForToday();
    if (localPerIpUsed >= this.localPerIpLimit) {
      return `Daily generation limit reached on this device. You have used ${localPerIpUsed} of ${this.localPerIpLimit} generations today.`;
    }

    return 'Tageslimit erreicht. Bitte versuche es spaeter erneut.';
  });
  readonly quotaResetHint = computed(() => {
    // Depend on the clock signal so the hint updates every minute.
    const now = this.resetHintClock();
    if (!this.showQuotaDialog()) {
      return null;
    }

    const remainingMs = this.getMsUntilNextUtcDay(now);
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `Reset in ${hours}h ${minutes}m.`;
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

  readonly cookingTimeOptions: CookingTimeOption[] = [
    { id: 'quick', label: 'Quick', hint: 'up to 20min' },
    { id: 'medium', label: 'Medium', hint: '25-40min' },
    { id: 'complex', label: 'Complex', hint: 'over 45min' },
  ];

  readonly cuisineOptions: Option<CuisineId>[] = [
    { id: 'german', label: 'German' },
    { id: 'italian', label: 'Italian' },
    { id: 'indian', label: 'Indian' },
    { id: 'japanese', label: 'Japanese' },
    { id: 'gourmet', label: 'Gourmet' },
    { id: 'fusion', label: 'Fusion' },
  ];

  readonly dietOptions: Option<DietId>[] = [
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'keto', label: 'Keto' },
    { id: 'none', label: 'No preferences' },
  ];

  /**
   * @description Creates an instance of Preferences.
   */
  constructor() {
    this.startResetHintTimer();
    void this.initClientIp();
  }

  ngOnDestroy(): void {
    if (this.resetHintTimerId !== null) {
      clearInterval(this.resetHintTimerId);
      this.resetHintTimerId = null;
    }
  }

  /**
   * @description Method initClientIp.
   */
  private async initClientIp() {
    const ip = await this.getMyIP();
    this.cachedIp.set(ip);
    // Restore exceeded state from localStorage (persists across reloads)
    const today = this.getTodayQuotaKey();
    const stored = localStorage.getItem(this.quotaExceededKey);
    if (stored === today) {
      this.quotaExceeded.set(true);
    }
    void this.loadQuotaStatus();
  }

  /**
   * @description Method incrementCooks.
   */
  incrementCooks() {
    this.cooks.update((value) => Math.min(value + 1, 3));
  }

  /**
   * @description Method decrementCooks.
   */
  decrementCooks() {
    this.cooks.update((value) => Math.max(1, value - 1));
  }

  /**
   * @description Method incrementPortions.
   */
  incrementPortions() {
    this.portions.update((value) => Math.min(value + 1, 12));
  }

  /**
   * @description Method decrementPortions.
   */
  decrementPortions() {
    this.portions.update((value) => Math.max(1, value - 1));
  }

  /**
   * @description Method selectCookingTime.
   */
  selectCookingTime(id: CookingTimeId) {
    this.selectedCookingTime.set(id);
  }

  /**
   * @description Method selectCuisine.
   */
  selectCuisine(id: CuisineId) {
    this.selectedCuisine.set(id);
  }

  /**
   * @description Method toggleDiet.
   */
  toggleDiet(id: DietId) {
    if (id === 'none') {
      this.selectedDiets.set(['none']);
      return;
    }

    this.selectedDiets.update((current) => {
      const withoutNone = current.filter((item) => item !== 'none');
      if (withoutNone.includes(id)) {
        const next = withoutNone.filter((item) => item !== id);
        return next.length > 0 ? next : ['none'];
      }

      return [...withoutNone, id];
    });
  }

  /**
   * @description Method isDietSelected.
   */
  isDietSelected(id: DietId) {
    return this.selectedDiets().includes(id);
  }

  /**
   * @description Method closeQuotaDialog.
   */
  closeQuotaDialog(): void {
    this.showQuotaDialog.set(false);
  }

  /**
   * @description Method isQuotaForToday.
   */
  isQuotaForToday(quota: QuotaStatus | null): boolean {
    if (!quota) {
      return false;
    }

    return quota.date === this.getTodayQuotaKey();
  }

  /**
   * @description Method getMyIP.
   */
  private async getMyIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (response.ok) {
        const data = await response.json() as { ip?: string };
        return data.ip || '127.0.0.1';
      }
    } catch (error) {
      console.error('IP-Abruf fehlgeschlagen:', error);
    }
    return '127.0.0.1';
  }

  /**
   * @description Method generateRecipe.
   */
  async generateRecipe() {
    // Always refresh quota from Firebase before sending so the check is never stale
    await this.loadQuotaStatus();

    const currentQuota = this.quotaStatus();
    const localPerIpUsed = this.getLocalPerIpUsageForToday();
    const localQuotaExceeded = localPerIpUsed >= this.localPerIpLimit;
    if (this.quotaExceeded() || localQuotaExceeded || (currentQuota && (currentQuota.perIpRemaining <= 0 || currentQuota.globalRemaining <= 0))) {
      this.submitState.set('idle');
      if (localQuotaExceeded) {
        this.quotaMessage.set(`Daily generation limit reached on this device. You have used ${localPerIpUsed} of ${this.localPerIpLimit} generations today.`);
      } else {
        this.quotaMessage.set(currentQuota ? this.buildQuotaExceededMessage(currentQuota) : 'Daily generation limit reached.');
      }
      this.showQuotaDialog.set(true);
      return;
    }

    this.submitState.set('loading');
    this.loadingStateService.setLoading(true);
    this.clearRecipeResponseCache();
    this.clearRecipeErrorCache();
    this.quotaMessage.set(null);

    const webhookUrl = this.getWebhookUrl();
    if (webhookUrl.includes('/workflow/')) {
      this.submitState.set('error');
      console.error('Invalid URL: use n8n Webhook URL (/webhook/...), not workflow editor URL (/workflow/...).');
      return;
    }

    const context = this.getStoredRecipeContext();
    if (context.ingredients.length === 0) {
      this.submitState.set('idle');
      await this.router.navigate(['/generate-recipe']);
      return;
    }

    const payload: RecipeRequestPayload = {
      ingredients: context.ingredients,
      preferences: {
        portions: this.portions(),
        cooks: this.cooks(),
        cookingTime: this.selectedCookingTime(),
        cuisine: this.selectedCuisine(),
        diets: this.selectedDiets(),
      },
      clientIp: this.cachedIp() ?? '127.0.0.1',
      requestedAt: new Date().toISOString(),
    };

    const nextContext: StoredRecipeContext = {
      ...context,
      preferences: payload.preferences,
    };

    this.persistJson(this.storageKey, nextContext);
    this.persistJson(this.recipePayloadKey, payload);

    try {
      const response = await this.sendRecipeRequest(payload, webhookUrl);
      this.incrementLocalPerIpUsageForToday();
      this.updateQuotaFromPayload(response);
      await this.loadQuotaStatus();
      this.persistJson(this.recipesResponseKey, response);
      this.submitState.set('success');
      this.loadingStateService.setLoading(false);
      await this.router.navigate(['/results']);
    } catch (error) {
      const isQuota429 = error instanceof HttpErrorResponse && error.status === 429;
      if (isQuota429) {
        console.info('Quota response received (429).');
      } else {
        console.error('Recipe generation request failed:', error);
      }
      this.clearRecipeResponseCache();
      this.updateQuotaFromError(error);
      this.submitState.set('error');
      this.loadingStateService.setLoading(false);
      const errorMessage = this.toRequestErrorMessage(error);
      this.persistJson(this.recipeErrorKey, errorMessage);
      if (!isQuota429) {
        console.error(errorMessage);
      }

      if (isQuota429) {
        this.submitState.set('idle');
        this.quotaMessage.set(errorMessage);
        this.quotaExceeded.set(true);
        localStorage.setItem(this.quotaExceededKey, this.getTodayQuotaKey());
        this.showQuotaDialog.set(true);
        return;
      }

      await this.router.navigate(['/results']);
    }
  }

  /**
   * @description Method loadQuotaStatus.
   */
  private async loadQuotaStatus() {
    this.isQuotaStatusLoading.set(true);

    try {
      const ip = this.cachedIp() ?? await this.getMyIP();
      const now = Date.now();
      const response = await firstValueFrom(
        this.http.get<QuotaResponsePayload>(`${this.quotaWebhookUrl}?ip=${encodeURIComponent(ip)}&t=${now}`)
      );
      const quota = this.readQuotaStatus(response);

      if (quota) {
        const mergedQuota = this.mergeWithLocalPerIpQuota(quota);
        this.syncQuotaState(mergedQuota);
        const isExceeded = this.isQuotaForToday(mergedQuota) && (mergedQuota.perIpRemaining <= 0 || mergedQuota.globalRemaining <= 0);
        const localExceeded = this.getLocalPerIpUsageForToday() >= this.localPerIpLimit;
        this.quotaMessage.set(isExceeded
          ? (response.message ?? this.buildQuotaExceededMessage(mergedQuota))
          : localExceeded
            ? `Daily generation limit reached on this device. You can generate up to ${this.localPerIpLimit} recipes per day.`
            : null);
      } else {
        this.quotaStatus.set(null);
        const localExceeded = this.getLocalPerIpUsageForToday() >= this.localPerIpLimit;
        this.quotaMessage.set(localExceeded ? `Daily generation limit reached on this device. You can generate up to ${this.localPerIpLimit} recipes per day.` : 'Quota check failed: backend returned no quota data.');
      }
    } catch (error) {
      console.error('Unable to load quota status:', error);
      this.quotaStatus.set(null);
      this.quotaMessage.set('Quota service unavailable. Activate the n8n production webhook to enable recipe generation.');
    } finally {
      this.isQuotaStatusLoading.set(false);
    }
  }

  /**
   * @description Method clearRecipeResponseCache.
   */
  private clearRecipeResponseCache() {
    try {
      localStorage.removeItem(this.recipesResponseKey);
    } catch (error) {
      console.error('Unable to clear cached recipe response:', error);
    }
  }

  /**
   * @description Method clearRecipeErrorCache.
   */
  private clearRecipeErrorCache() {
    try {
      localStorage.removeItem(this.recipeErrorKey);
    } catch (error) {
      console.error('Unable to clear cached recipe error:', error);
    }
  }

  /**
   * @description Method sendRecipeRequest.
   */
  private async sendRecipeRequest(payload: RecipeRequestPayload, webhookUrl: string): Promise<unknown> {
    return firstValueFrom(this.http.post(webhookUrl, payload));
  }

  /**
   * @description Method getWebhookUrl.
   */
  private getWebhookUrl(): string {
    return this.stratoWebhookUrl;
  }

  /**
   * @description Method toRequestErrorMessage.
   */
  private toRequestErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const quotaAwareError = this.getQuotaErrorMessage(error.error);
      if (quotaAwareError) {
        return quotaAwareError;
      }

      if (error.status === 0) {
        return 'Network/CORS error. Start the app with ng serve (proxy enabled) and verify the webhook path.';
      }

      if (error.status === 404) {
        return 'Webhook not found (404). In n8n, activate the workflow for the production /webhook endpoint.';
      }

      return `n8n request failed (${error.status} ${error.statusText || 'Error'}).`;
    }

    return 'n8n request failed. Check webhook URL and n8n runtime.';
  }

  /**
   * @description Method getQuotaErrorMessage.
   */
  private getQuotaErrorMessage(payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const message = (payload as { message?: unknown }).message;
    const quota = this.readQuotaStatus(payload);

    if (typeof message !== 'string' || !message.trim()) {
      return null;
    }

    if (!quota) {
      return message;
    }

    const isQuotaExceeded = quota.perIpRemaining <= 0 || quota.globalRemaining <= 0;
    if (!isQuotaExceeded) {
      return message;
    }

    return `${message} Remaining today: ${quota.perIpRemaining} of ${quota.perIpLimit} for this IP, ${quota.globalRemaining} of ${quota.globalLimit} globally.`;
  }

  /**
   * @description Method updateQuotaFromError.
   */
  private updateQuotaFromError(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return;
    }

    const quota = this.readQuotaStatus(error.error);
    if (quota) {
      this.syncQuotaState(quota);
    }
  }

  /**
   * @description Method updateQuotaFromPayload.
   */
  private updateQuotaFromPayload(payload: unknown) {
    const quota = this.readQuotaStatus(payload);
    if (quota) {
      this.syncQuotaState(quota);
    }
  }

  /**
   * @description Method syncQuotaState.
   */
  private syncQuotaState(quota: QuotaStatus) {
    this.quotaStatus.set(quota);

    const today = this.getTodayQuotaKey();
    const isExceeded = quota.date === today && (quota.perIpRemaining <= 0 || quota.globalRemaining <= 0);
    this.quotaExceeded.set(isExceeded);

    if (isExceeded) {
      localStorage.setItem(this.quotaExceededKey, today);
    } else {
      localStorage.removeItem(this.quotaExceededKey);
    }
  }

  private mergeWithLocalPerIpQuota(quota: QuotaStatus): QuotaStatus {
    const localPerIpUsed = this.getLocalPerIpUsageForToday();
    if (!this.isQuotaForToday(quota) || localPerIpUsed <= quota.perIpUsed) {
      return quota;
    }

    const perIpUsed = localPerIpUsed;
    const perIpRemaining = Math.max(0, quota.perIpLimit - perIpUsed);

    return {
      ...quota,
      perIpUsed,
      perIpRemaining,
    };
  }

  private getLocalPerIpUsageForToday(): number {
    const ip = this.cachedIp() ?? '127.0.0.1';
    const today = this.getTodayQuotaKey();

    try {
      const rawValue = localStorage.getItem(this.localPerIpQuotaKey);
      if (!rawValue) {
        return 0;
      }

      const parsed = JSON.parse(rawValue) as Partial<LocalPerIpQuota>;
      if (parsed.date !== today || parsed.ipAddress !== ip) {
        return 0;
      }

      return typeof parsed.used === 'number' && Number.isFinite(parsed.used)
        ? Math.max(0, Math.floor(parsed.used))
        : 0;
    } catch (error) {
      console.error('Unable to read local per-IP quota fallback:', error);
      return 0;
    }
  }

  private incrementLocalPerIpUsageForToday(): void {
    const ip = this.cachedIp() ?? '127.0.0.1';
    const today = this.getTodayQuotaKey();
    const current = this.getLocalPerIpUsageForToday();
    const next = Math.min(this.localPerIpLimit, current + 1);

    const payload: LocalPerIpQuota = {
      date: today,
      ipAddress: ip,
      used: next,
    };

    try {
      localStorage.setItem(this.localPerIpQuotaKey, JSON.stringify(payload));
    } catch (error) {
      console.error('Unable to persist local per-IP quota fallback:', error);
    }
  }

  /**
   * @description Method getTodayQuotaKey.
   */
  private getTodayQuotaKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getMsUntilNextUtcDay(referenceMs: number): number {
    const now = new Date(referenceMs);
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    );

    return Math.max(0, nextUtcMidnight - referenceMs);
  }

  private startResetHintTimer(): void {
    if (this.resetHintTimerId !== null) {
      return;
    }

    this.resetHintTimerId = setInterval(() => {
      this.resetHintClock.set(Date.now());
    }, 60000);
  }

  /**
   * @description Method readQuotaStatus.
   */
  private readQuotaStatus(payload: unknown): QuotaStatus | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const quota = (payload as RecipeResponsePayload).quota;
    if (!quota || typeof quota !== 'object') {
      return null;
    }

    const candidate = quota as Partial<QuotaStatus>;
    if (typeof candidate.date !== 'string'
      || typeof candidate.ipAddress !== 'string'
      || typeof candidate.perIpLimit !== 'number'
      || typeof candidate.perIpUsed !== 'number'
      || typeof candidate.perIpRemaining !== 'number'
      || typeof candidate.globalLimit !== 'number'
      || typeof candidate.globalUsed !== 'number'
      || typeof candidate.globalRemaining !== 'number') {
      return null;
    }

    return {
      date: candidate.date,
      ipAddress: candidate.ipAddress,
      ipVersion: candidate.ipVersion === 'ipv4' || candidate.ipVersion === 'ipv6' ? candidate.ipVersion : 'unknown',
      perIpLimit: candidate.perIpLimit,
      perIpUsed: candidate.perIpUsed,
      perIpRemaining: candidate.perIpRemaining,
      globalLimit: candidate.globalLimit,
      globalUsed: candidate.globalUsed,
      globalRemaining: candidate.globalRemaining,
    };
  }

  /**
   * @description Method buildQuotaExceededMessage.
   */
  private buildQuotaExceededMessage(quota: QuotaStatus): string {
    if (quota.perIpRemaining <= 0) {
      return `Daily quota reached for this IP address. You have used ${quota.perIpUsed} of ${quota.perIpLimit} recipe generations today.`;
    }

    return `System-wide daily quota reached. ${quota.globalUsed} of ${quota.globalLimit} generations have already been used today.`;
  }

  /**
   * @description Method getStoredRecipeContext.
   */
  private getStoredRecipeContext(): StoredRecipeContext {
    const storedValue = localStorage.getItem(this.storageKey);

    if (!storedValue) {
      return { ingredients: [] };
    }

    try {
      const parsed = JSON.parse(storedValue);
      if (Array.isArray(parsed) && parsed.every((item) => this.isValidIngredient(item))) {
        return { ingredients: parsed };
      }

      if (this.isStoredRecipeContext(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Unable to parse stored recipe context:', error);
    }

    return { ingredients: [] };
  }

  /**
   * @description Method persistJson.
   */
  private persistJson(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Unable to persist key ${key}:`, error);
    }
  }

  /**
   * @description Method isValidIngredient.
   */
  private isValidIngredient(value: unknown): value is StoredIngredient {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const ingredient = value as StoredIngredient;
    return typeof ingredient.name === 'string'
      && typeof ingredient.quantity === 'number'
      && typeof ingredient.unit === 'string';
  }

  /**
   * @description Method isStoredRecipeContext.
   */
  private isStoredRecipeContext(value: unknown): value is StoredRecipeContext {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const maybeContext = value as Partial<StoredRecipeContext>;
    return Array.isArray(maybeContext.ingredients)
      && maybeContext.ingredients.every((item) => this.isValidIngredient(item));
  }
}
