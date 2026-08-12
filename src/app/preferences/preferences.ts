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
import { environment } from '../../environments/environment';

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

interface LocalIpQuotaWindowRecord {
  ipAddress: string;
  ipVersion: 'ipv4' | 'ipv6' | 'unknown';
  timestamps: number[];
}

interface LocalQuotaWindowStore {
  records: LocalIpQuotaWindowRecord[];
}

interface QuotaCardSummary {
  show: boolean;
  kind: 'none' | 'local' | 'remote';
  localUsage: number;
  perIpRemaining: number | null;
  globalRemaining: number | null;
  message: string | null;
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
  private readonly recipeWebhookPath = environment.recipeWebhookUrl;
  private readonly localPerIpQuotaKey = 'cac-local-per-ip-quota';
  private readonly localPerIpLimit = 3;
  private readonly localQuotaWindowMs = 24 * 60 * 60 * 1000;
  private readonly minGenerateLoadingMs = 1200;
  private readonly previewLoadingMs = 500000;
  private readonly dailyLimitDialogTitle = 'Tageslimit erreicht';
  private readonly connectionDialogTitle = 'Verbindung fehlgeschlagen';
  private readonly connectionDialogMessage = 'Die Rezept-API ist aktuell nicht erreichbar. Bitte versuche es in wenigen Minuten erneut.';
  private readonly noticeDialogTitle = 'Hinweis';

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
  readonly quotaDialogKind = signal<'notice' | 'limit' | 'connection'>('notice');
  readonly isQuotaStatusLoading = signal(true);
  private readonly cachedIp = signal<string | null>(null);
  private readonly resetHintClock = signal(Date.now());
  private resetHintTimerId: ReturnType<typeof setInterval> | null = null;
  private previewLoadingTimerId: ReturnType<typeof setTimeout> | null = null;

 /**
   * @description Creates an instance of Preferences.
   */
  constructor() {
    this.startResetHintTimer();
    void this.initClientIp();
    this.previewLoadingScreen();
  }

  readonly canSubmitRecipe = computed(() => {
    const _resetClock = this.resetHintClock();

    if (this.submitState() === 'loading' || this.isQuotaStatusLoading()) {
      return false;
    }

    return !this.hasReachedQuota(this.quotaStatus(), this.getLocalPerIpUsageLast24Hours());
  });
  readonly showQuotaCard = computed(() => {
    const quota = this.quotaStatus();

    if (!quota) {
      return false;
    }

    const hasUsageToday = quota.perIpUsed > 0 || quota.globalUsed > 0;
    const hasQuotaMessage = typeof this.quotaMessage() === 'string' && this.quotaMessage()!.trim().length > 0;

    return hasUsageToday || hasQuotaMessage;
  });
  readonly generateButtonLabel = computed(() => {
    if (this.submitState() === 'loading') {
      return 'Generating...';
    }

    if (this.isQuotaStatusLoading()) {
      return 'Checking daily limit...';
    }

    if (!this.quotaStatus()) {
      return 'Quota check unavailable';
    }

    if (!this.canSubmitRecipe()) {
      const remainingMs = this.getTimeUntilQuotaReset();
      if (remainingMs > 0) {
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.ceil((remainingMs % 3600000) / 60000);
        return `Ups! Not quite enough... ${hours}h ${minutes}m`;
      }

      return 'Ups! Not quite enough...';
    }

    return 'Generate a recipe';
  });
  readonly quotaDialogMessage = computed(() => {
    if (this.quotaDialogKind() === 'limit') {
      return this.buildDailyLimitDialogMessage();
    }

    if (this.quotaDialogKind() === 'connection') {
      return this.connectionDialogMessage;
    }

    const message = this.quotaMessage();
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    const quota = this.quotaStatus();
    if (quota) {
      return this.buildQuotaExceededMessage(quota);
    }

    const localPerIpUsed = this.getLocalPerIpUsageLast24Hours();
    if (localPerIpUsed >= this.localPerIpLimit) {
      return `24h generation limit reached on this device/IP. You have used ${localPerIpUsed} of ${this.localPerIpLimit} generations in the last 24 hours.`;
    }

    return this.buildDailyLimitDialogMessage();
  });
  readonly quotaDialogTitle = computed(() => {
    if (this.quotaDialogKind() === 'connection') {
      return this.connectionDialogTitle;
    }

    if (this.quotaDialogKind() === 'limit') {
      return this.dailyLimitDialogTitle;
    }

    return this.noticeDialogTitle;
  });
  readonly quotaResetHint = computed(() => {
    // Depend on the clock signal so the hint updates every minute.
    const now = this.resetHintClock();
    if (!this.showQuotaDialog()) {
      return null;
    }

    if (!this.isCurrentStateRateLimited(now)) {
      return null;
    }

    const remainingMs = this.getTimeUntilQuotaReset(now);
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



  ngOnDestroy(): void {
    if (this.resetHintTimerId !== null) {
      clearInterval(this.resetHintTimerId);
      this.resetHintTimerId = null;
    }

    if (this.previewLoadingTimerId !== null) {
      clearTimeout(this.previewLoadingTimerId);
      this.previewLoadingTimerId = null;
    }
  }

  /**
   * @description Method previewLoadingScreen.
   */
  previewLoadingScreen() {
    if (this.submitState() === 'loading') {
      return;
    }

    this.submitState.set('loading');
    this.loadingStateService.setLoading(true);

    if (this.previewLoadingTimerId !== null) {
      clearTimeout(this.previewLoadingTimerId);
    }

    this.previewLoadingTimerId = setTimeout(() => {
      this.loadingStateService.setLoading(false);
      this.submitState.set('idle');
      this.previewLoadingTimerId = null;
    }, this.previewLoadingMs);
  }

  /**
   * @description Method initClientIp.
   */
  private async initClientIp() {
    const ip = await this.getMyIP();
    this.cachedIp.set(ip);
    this.clearExpiredQuotaLock();
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
   * @description Method hasReachedQuota.
   */
  hasReachedQuota(quota: QuotaStatus | null = this.quotaStatus(), localPerIpUsed: number = this.getLocalPerIpUsageLast24Hours()): boolean {
    if (localPerIpUsed >= this.localPerIpLimit) {
      return true;
    }

    if (!quota) {
      return false;
    }

    return quota.perIpRemaining <= 0;
  }

  /**
   * @description Method quotaCardSummary.
   */
  quotaCardSummary(): QuotaCardSummary {
    const quota = this.quotaStatus();
    const localUsage = this.getLocalPerIpUsageLast24Hours();
    const localExceeded = localUsage >= this.localPerIpLimit;
    const message = this.quotaMessage();

    if (quota) {
      return {
        show: true,
        kind: localExceeded ? 'local' : 'remote',
        localUsage,
        perIpRemaining: quota.perIpRemaining,
        globalRemaining: quota.globalRemaining,
        message,
      };
    }

    if (localExceeded) {
      return {
        show: true,
        kind: 'local',
        localUsage,
        perIpRemaining: null,
        globalRemaining: null,
        message,
      };
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      return {
        show: true,
        kind: 'remote',
        localUsage,
        perIpRemaining: null,
        globalRemaining: null,
        message,
      };
    }

    return {
      show: false,
      kind: 'none',
      localUsage,
      perIpRemaining: null,
      globalRemaining: null,
      message,
    };
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
    const localPerIpUsed = this.getLocalPerIpUsageLast24Hours();
    const currentQuota = this.quotaStatus();

    if (this.hasReachedQuota(currentQuota, localPerIpUsed)) {
      this.submitState.set('idle');
      this.quotaDialogKind.set('limit');
      this.quotaMessage.set(this.buildDailyLimitDialogMessage(localPerIpUsed, currentQuota));
      this.showQuotaDialog.set(true);
      return;
    }

    this.submitState.set('loading');
    this.loadingStateService.setLoading(true);
    this.clearRecipeResponseCache();
    this.clearRecipeErrorCache();
    this.quotaMessage.set(null);
    const loadingStart = Date.now();

    const ensureMinLoadingTime = async () => {
      const elapsed = Date.now() - loadingStart;
      const remaining = this.minGenerateLoadingMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    };

    const webhookUrls = this.getWebhookCandidateUrls();
    if (!webhookUrls.every((url) => this.isValidWebhookUrl(url))) {
      await ensureMinLoadingTime();
      this.submitState.set('error');
      this.loadingStateService.setLoading(false);
      console.error('Invalid URL: use n8n Webhook URL (/webhook/...), not workflow editor URL (/workflow/...).');
      return;
    }

    const context = this.getStoredRecipeContext();
    if (context.ingredients.length === 0) {
      await ensureMinLoadingTime();
      this.loadingStateService.setLoading(false);
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
      const response = await this.sendRecipeRequest(payload, webhookUrls);
      this.incrementLocalPerIpUsageForLast24Hours();
      const refreshedUsage = this.getLocalPerIpUsageLast24Hours();
      this.syncQuotaState(this.buildLocalQuotaState(refreshedUsage));
      this.persistJson(this.recipesResponseKey, response);
      await ensureMinLoadingTime();
      this.submitState.set('success');
      this.loadingStateService.setLoading(false);
      await this.router.navigate(['/results']);
    } catch (error) {
      await ensureMinLoadingTime();
      this.clearRecipeResponseCache();
      this.submitState.set('error');
      this.loadingStateService.setLoading(false);
      const errorMessage = this.toRequestErrorMessage(error);
      this.persistJson(this.recipeErrorKey, errorMessage);

      if (this.isQuotaDialogError(error, errorMessage, localPerIpUsed)) {
        this.submitState.set('idle');
        const errorQuota = error instanceof HttpErrorResponse ? this.readQuotaStatus(error.error) : null;
        if (errorQuota) {
          this.syncQuotaState(errorQuota);
        }

        const effectiveLocalUsage = this.getLocalPerIpUsageLast24Hours();
        const effectiveQuota = errorQuota ?? this.quotaStatus();
        const isLimitCase = this.hasReachedQuota(effectiveQuota, effectiveLocalUsage)
          || this.isLimitDialogError(error, errorMessage, effectiveLocalUsage);
        const dialogKind = this.getQuotaDialogKind(error, errorMessage, isLimitCase);
        this.quotaExceeded.set(isLimitCase);
        this.quotaDialogKind.set(dialogKind);
        this.quotaMessage.set(dialogKind === 'limit'
          ? this.buildDailyLimitDialogMessage(effectiveLocalUsage, effectiveQuota)
          : this.toDialogErrorMessage(error, errorMessage));
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
      this.cachedIp.set(ip);
      const localUsage = this.getLocalPerIpUsageLast24Hours();
      const quota = this.buildLocalQuotaState(localUsage);
      this.syncQuotaState(quota);

      const localExceeded = localUsage >= this.localPerIpLimit;
      this.quotaMessage.set(localExceeded
        ? this.buildDailyLimitDialogMessage(localUsage, quota)
        : null);
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
  private async sendRecipeRequest(payload: RecipeRequestPayload, webhookUrls: string[]): Promise<unknown> {
    let lastError: unknown = null;

    for (const webhookUrl of webhookUrls) {
      try {
        return await firstValueFrom(this.http.post(webhookUrl, payload));
      } catch (error) {
        lastError = error;
        console.warn(`Webhook request failed for ${webhookUrl}:`, error);
      }
    }

    throw lastError ?? new Error('All webhook endpoints failed.');
  }

  /**
   * @description Method getWebhookUrl.
   */
  private getWebhookCandidateUrls(): string[] {
    const path = this.recipeWebhookPath;
    const candidates = [
      `${path}code-a-cuisine-recipe`,
      `${path}code-a-cuisine-recipe`,
    ];
    console.log(candidates);
    return Array.from(new Set(candidates));
  }

  /**
   * @description Method isValidWebhookUrl.
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname.toLowerCase();
      const isHttp = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      const isWebhookPath = pathname === '/webhook' || pathname.startsWith('/webhook/');
      const isWorkflowPath = pathname === '/workflow' || pathname.startsWith('/workflow/');

      return isHttp && isWebhookPath && !isWorkflowPath;
    } catch {
      return false;
    }
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
        return 'Network/TLS/CORS error. Verify that the webhook URL is reachable, uses a valid HTTPS certificate, and allows CORS.';
      }

      if (error.status === 404) {
        return 'Webhook not found (404). Verify the configured recipe webhook URL in preferences.ts and that the n8n workflow is active.';
      }

      return `n8n request failed (${error.status} ${error.statusText || 'Error'}).`;
    }

    const rawMessage = this.extractErrorText(error).trim();
    if (rawMessage.length > 0) {
      return rawMessage;
    }

    return 'n8n request failed. Check webhook URL and n8n runtime.';
  }

  private isQuotaDialogError(error: unknown, message: string, localPerIpUsed: number): boolean {
    if (localPerIpUsed >= this.localPerIpLimit) {
      return true;
    }

    if (error instanceof HttpErrorResponse && (error.status === 429 || error.status === 503)) {
      return true;
    }

    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return normalized.includes('quota')
      || normalized.includes('limit reached')
      || normalized.includes('daily limit')
      || normalized.includes('too many requests')
      || normalized.includes('try again in a few seconds')
      || normalized.includes('failed to fetch')
      || normalized.includes('fetch failed')
      || normalized.includes('http failure response')
      || normalized.includes('unknown error')
      || normalized.includes('temporarily unavailable');
  }

  private isConnectionError(error: unknown, message: string): boolean {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return true;
    }

    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return normalized.includes('failed to fetch')
      || normalized.includes('fetch failed')
      || normalized.includes('http failure response')
      || normalized.includes('unknown error')
      || normalized.includes('network')
      || normalized.includes('cors')
      || normalized.includes('ssl')
      || normalized.includes('tls')
      || normalized.includes('certificate')
      || normalized.includes('protocol error');
  }

  private isLimitDialogError(error: unknown, message: string, localPerIpUsed: number): boolean {
    if (localPerIpUsed >= this.localPerIpLimit) {
      return true;
    }

    if (error instanceof HttpErrorResponse && error.status === 429) {
      return true;
    }

    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return normalized.includes('quota')
      || normalized.includes('limit reached')
      || normalized.includes('daily limit')
      || normalized.includes('too many requests')
      || normalized.includes('24h')
      || normalized.includes('generation limit');
  }

  private isCurrentStateRateLimited(referenceMs: number = Date.now()): boolean {
    const localUsage = this.getLocalPerIpUsageLast24Hours(referenceMs);
    return localUsage >= this.localPerIpLimit;
  }

  private extractErrorText(error: unknown): string {
    const segments: string[] = [];

    if (typeof error === 'string') {
      segments.push(error);
    }

    if (error instanceof Error && typeof error.message === 'string') {
      segments.push(error.message);
    }

    if (!(error instanceof HttpErrorResponse)) {
      if (typeof error === 'object' && error !== null) {
        const obj = error as { message?: unknown; error?: unknown; detail?: unknown };
        if (typeof obj.message === 'string') {
          segments.push(obj.message);
        }
        if (typeof obj.error === 'string') {
          segments.push(obj.error);
        }
        if (typeof obj.detail === 'string') {
          segments.push(obj.detail);
        }
      }

      return segments.join(' ').trim();
    }

    if (typeof error.message === 'string') {
      segments.push(error.message);
    }

    if (typeof error.statusText === 'string') {
      segments.push(error.statusText);
    }

    const payload = error.error;
    if (typeof payload === 'string') {
      segments.push(payload);
    } else if (typeof payload === 'object' && payload !== null) {
      const obj = payload as { message?: unknown; error?: unknown; detail?: unknown };
      if (typeof obj.message === 'string') {
        segments.push(obj.message);
      }
      if (typeof obj.error === 'string') {
        segments.push(obj.error);
      }
      if (typeof obj.detail === 'string') {
        segments.push(obj.detail);
      }
    }

    return segments.join(' ').trim();
  }

  private toDialogErrorMessage(error: unknown, fallback: string): string {
    if (this.isLimitDialogError(error, fallback, this.getLocalPerIpUsageLast24Hours())) {
      return this.buildDailyLimitDialogMessage();
    }

    if (this.isConnectionError(error, fallback)) {
      return this.connectionDialogMessage;
    }

    const rawMessage = this.extractErrorText(error).trim();
    if (rawMessage.length === 0) {
      return fallback;
    }

    const normalized = rawMessage.toLowerCase();
    if (normalized.includes('failed to fetch')
      || normalized.includes('fetch failed')
      || normalized.includes('http failure response')
      || normalized.includes('unknown error')) {
      return this.connectionDialogMessage;
    }

    return rawMessage;
  }

  private buildDailyLimitDialogMessage(localPerIpUsed: number = this.getLocalPerIpUsageLast24Hours(), quota: QuotaStatus | null = this.quotaStatus()): string {
    const used = Math.max(localPerIpUsed, quota?.perIpUsed ?? 0);
    const limit = quota?.perIpLimit ?? this.localPerIpLimit;
    return `Tageslimit erreicht: ${used} von ${limit} Anfragen wurden bereits genutzt. Bitte versuche es spaeter erneut.`;
  }

  private getQuotaDialogKind(error: unknown, message: string, isLimitCase: boolean): 'notice' | 'limit' | 'connection' {
    if (isLimitCase) {
      return 'limit';
    }

    if (this.isConnectionError(error, message)) {
      return 'connection';
    }

    return 'notice';
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

  private buildLocalQuotaState(localPerIpUsed: number): QuotaStatus {
    const ip = this.cachedIp() ?? '127.0.0.1';
    const ipVersion = this.detectIpVersion(ip);
    const usage = Math.max(0, localPerIpUsed);

    return {
      date: this.getTodayQuotaKey(),
      ipAddress: ip,
      ipVersion,
      perIpLimit: this.localPerIpLimit,
      perIpUsed: usage,
      perIpRemaining: Math.max(0, this.localPerIpLimit - usage),
      globalLimit: this.localPerIpLimit,
      globalUsed: usage,
      globalRemaining: Math.max(0, this.localPerIpLimit - usage),
    };
  }

  /**
   * @description Method syncQuotaState.
   */
  private syncQuotaState(quota: QuotaStatus) {
    this.quotaStatus.set(quota);
    this.quotaExceeded.set(quota.perIpRemaining <= 0);
  }

  private detectIpVersion(ip: string): 'ipv4' | 'ipv6' | 'unknown' {
    const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    if (ipv4Pattern.test(ip)) {
      return 'ipv4';
    }

    if (ip.includes(':')) {
      return 'ipv6';
    }

    return 'unknown';
  }

  private getLocalPerIpUsageLast24Hours(referenceMs: number = Date.now()): number {
    const record = this.getCurrentIpQuotaRecord(referenceMs);
    return record.timestamps.length;
  }

  private incrementLocalPerIpUsageForLast24Hours(referenceMs: number = Date.now()): void {
    const store = this.readLocalQuotaWindowStore();
    const ip = this.cachedIp() ?? '127.0.0.1';
    const ipVersion = this.detectIpVersion(ip);
    const key = this.getQuotaRecordKey(ip, ipVersion);

    const map = new Map(store.records.map((record) => [this.getQuotaRecordKey(record.ipAddress, record.ipVersion), record]));
    const existingRecord = map.get(key);
    const currentTimestamps = existingRecord ? existingRecord.timestamps : [];
    const nextTimestamps = this.filterRecentQuotaTimestamps([...currentTimestamps, referenceMs], referenceMs)
      .slice(-this.localPerIpLimit);

    map.set(key, {
      ipAddress: ip,
      ipVersion,
      timestamps: nextTimestamps,
    });

    this.writeLocalQuotaWindowStore({ records: Array.from(map.values()) });
  }

  /**
   * @description Method getTodayQuotaKey.
   */
  private getTodayQuotaKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getTimeUntilQuotaReset(referenceMs: number = Date.now()): number {
    const record = this.getCurrentIpQuotaRecord(referenceMs);
    if (record.timestamps.length < this.localPerIpLimit) {
      return 0;
    }

    const oldestTimestamp = Math.min(...record.timestamps);
    const resetAt = oldestTimestamp + this.localQuotaWindowMs;
    return Math.max(0, resetAt - referenceMs);
  }

  private clearExpiredQuotaLock(referenceMs: number = Date.now()): void {
    const usage = this.getLocalPerIpUsageLast24Hours(referenceMs);
    if (usage < this.localPerIpLimit) {
      this.quotaExceeded.set(false);
      if (this.quotaMessage() && this.getTimeUntilQuotaReset(referenceMs) <= 0) {
        this.quotaMessage.set(null);
      }
    }
  }

  private getCurrentIpQuotaRecord(referenceMs: number): LocalIpQuotaWindowRecord {
    const store = this.readLocalQuotaWindowStore();
    const ip = this.cachedIp() ?? '127.0.0.1';
    const ipVersion = this.detectIpVersion(ip);
    const key = this.getQuotaRecordKey(ip, ipVersion);

    const existingRecord = store.records.find((record) => this.getQuotaRecordKey(record.ipAddress, record.ipVersion) === key);
    const timestamps = this.filterRecentQuotaTimestamps(existingRecord?.timestamps ?? [], referenceMs);

    if (!existingRecord || timestamps.length !== existingRecord.timestamps.length) {
      const map = new Map(store.records.map((record) => [this.getQuotaRecordKey(record.ipAddress, record.ipVersion), record]));
      map.set(key, {
        ipAddress: ip,
        ipVersion,
        timestamps,
      });
      this.writeLocalQuotaWindowStore({ records: Array.from(map.values()) });
    }

    return {
      ipAddress: ip,
      ipVersion,
      timestamps,
    };
  }

  private getQuotaRecordKey(ipAddress: string, ipVersion: 'ipv4' | 'ipv6' | 'unknown'): string {
    return `${ipVersion}:${ipAddress}`;
  }

  private filterRecentQuotaTimestamps(timestamps: number[], referenceMs: number): number[] {
    const windowStart = referenceMs - this.localQuotaWindowMs;
    return timestamps
      .filter((value) => Number.isFinite(value) && value > windowStart && value <= referenceMs)
      .map((value) => Math.floor(value))
      .sort((a, b) => a - b);
  }

  private readLocalQuotaWindowStore(): LocalQuotaWindowStore {
    try {
      const rawValue = localStorage.getItem(this.localPerIpQuotaKey);
      if (!rawValue) {
        return { records: [] };
      }

      const parsed = JSON.parse(rawValue) as Partial<LocalQuotaWindowStore>;
      if (!parsed || !Array.isArray(parsed.records)) {
        return { records: [] };
      }

      const records = parsed.records
        .filter((record): record is LocalIpQuotaWindowRecord => !!record
          && typeof record.ipAddress === 'string'
          && (record.ipVersion === 'ipv4' || record.ipVersion === 'ipv6' || record.ipVersion === 'unknown')
          && Array.isArray(record.timestamps))
        .map((record) => ({
          ipAddress: record.ipAddress,
          ipVersion: record.ipVersion,
          timestamps: record.timestamps
            .filter((value) => typeof value === 'number' && Number.isFinite(value))
            .map((value) => Math.floor(value)),
        }));

      return { records };
    } catch (error) {
      console.error('Unable to read local per-IP rolling quota:', error);
      return { records: [] };
    }
  }

  private writeLocalQuotaWindowStore(store: LocalQuotaWindowStore): void {
    try {
      localStorage.setItem(this.localPerIpQuotaKey, JSON.stringify(store));
    } catch (error) {
      console.error('Unable to persist local per-IP rolling quota:', error);
    }
  }

  private startResetHintTimer(): void {
    if (this.resetHintTimerId !== null) {
      return;
    }

    this.resetHintTimerId = setInterval(() => {
      this.clearExpiredQuotaLock(Date.now());
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
    const ipVersionLabel = quota.ipVersion === 'ipv4' ? 'IPv4' : quota.ipVersion === 'ipv6' ? 'IPv6' : 'IP';

    if (quota.perIpRemaining <= 0) {
      return `24h quota reached for this ${ipVersionLabel} address. You have used ${quota.perIpUsed} of ${quota.perIpLimit} recipe generations in the last 24 hours.`;
    }

    return `24h quota reached. ${quota.globalUsed} of ${quota.globalLimit} generations have already been used in the last 24 hours.`;
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
