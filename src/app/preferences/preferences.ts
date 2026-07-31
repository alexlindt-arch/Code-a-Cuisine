import { Component, signal } from '@angular/core';
import { ImagesComponent } from '../components/images-component/images-component';
import { Router, RouterLink } from "@angular/router";
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

type CookingTimeId = 'quick' | 'medium' | 'complex';
type CuisineId = 'german' | 'italian' | 'indian' | 'japanese' | 'gourmet' | 'fusion';
type DietId = 'vegetarian' | 'vegan' | 'keto' | 'none';

interface CookingTimeOption {
  id: CookingTimeId;
  label: string;
  hint: string;
}

interface Option<T extends string> {
  id: T;
  label: string;
}

interface StoredIngredient {
  name: string;
  quantity: number;
  unit: string;
}

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

interface RecipeRequestPayload {
  ingredients: StoredIngredient[];
  preferences: {
    portions: number;
    cooks: number;
    cookingTime: CookingTimeId;
    cuisine: CuisineId;
    diets: DietId[];
  };
  requestedAt: string;
}

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

interface RecipeResponsePayload {
  result?: unknown;
  quota?: QuotaStatus;
}

interface QuotaResponsePayload {
  message?: string;
  quota?: QuotaStatus;
}

@Component({
  selector: 'app-preferences',
  imports: [ImagesComponent, RouterLink],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.scss'],
})
export class Preferences {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storageKey = 'cac-ingredients';
  private readonly recipePayloadKey = 'cac-recipe-request';
  private readonly recipesResponseKey = 'cac-recipe-results';
  private readonly recipeErrorKey = 'cac-recipe-error';
  private readonly localWebhookUrl = '/n8n-local/webhook/code-a-cuisine-recipe';
  private readonly localWebhookTestUrl = '/n8n-local/webhook-test/code-a-cuisine-recipe';
  private readonly localQuotaUrl = '/n8n-local/webhook/code-a-cuisine-quota';
  private readonly localQuotaTestUrl = '/n8n-local/webhook-test/code-a-cuisine-quota';

  readonly cooks = signal(1);
  readonly portions = signal(2);
  readonly selectedCookingTime = signal<CookingTimeId>('medium');
  readonly selectedCuisine = signal<CuisineId>('italian');
  readonly selectedDiets = signal<DietId[]>(['none']);
  readonly submitState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly quotaStatus = signal<QuotaStatus | null>(null);
  readonly quotaMessage = signal<string | null>(null);

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

  heroImageArrow = 'assets/icons/Arrow-left-dark.png';

  arrowClass = 'arrow-icon';

  constructor() {
    void this.loadQuotaStatus();
  }

  incrementCooks() {
    this.cooks.update((value) => value + 1);
  }

  decrementCooks() {
    this.cooks.update((value) => Math.max(1, value - 1));
  }

  incrementPortions() {
    this.portions.update((value) => value + 1);
  }

  decrementPortions() {
    this.portions.update((value) => Math.max(1, value - 1));
  }

  selectCookingTime(id: CookingTimeId) {
    this.selectedCookingTime.set(id);
  }

  selectCuisine(id: CuisineId) {
    this.selectedCuisine.set(id);
  }

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

  isDietSelected(id: DietId) {
    return this.selectedDiets().includes(id);
  }

  async generateRecipe() {
    const currentQuota = this.quotaStatus();
    if (currentQuota && (currentQuota.perIpRemaining <= 0 || currentQuota.globalRemaining <= 0)) {
      this.submitState.set('idle');
      this.quotaMessage.set(this.buildQuotaExceededMessage(currentQuota));
      return;
    }

    this.submitState.set('loading');
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
      this.updateQuotaFromPayload(response);
      this.persistJson(this.recipesResponseKey, response);
      this.submitState.set('success');
      await this.router.navigate(['/results']);
    } catch (error) {
      console.error('Recipe generation request failed:', error);
      this.clearRecipeResponseCache();
      this.updateQuotaFromError(error);
      this.submitState.set('error');
      const errorMessage = this.toRequestErrorMessage(error);
      this.persistJson(this.recipeErrorKey, errorMessage);
      console.error(errorMessage);

      if (error instanceof HttpErrorResponse && error.status === 429) {
        this.submitState.set('idle');
        this.quotaMessage.set(errorMessage);
        return;
      }

      await this.router.navigate(['/results']);
    }
  }

  private async loadQuotaStatus() {
    try {
      const response = await this.getQuotaStatusRequest(this.localQuotaUrl);
      this.updateQuotaFromPayload(response);
    } catch (error) {
      console.error('Unable to load quota status:', error);
    }
  }

  private clearRecipeResponseCache() {
    try {
      localStorage.removeItem(this.recipesResponseKey);
    } catch (error) {
      console.error('Unable to clear cached recipe response:', error);
    }
  }

  private clearRecipeErrorCache() {
    try {
      localStorage.removeItem(this.recipeErrorKey);
    } catch (error) {
      console.error('Unable to clear cached recipe error:', error);
    }
  }

  private async sendRecipeRequest(payload: RecipeRequestPayload, webhookUrl: string): Promise<unknown> {
    try {
      return await firstValueFrom(this.http.post(webhookUrl, payload));
    } catch (error) {
      const shouldTryWebhookTest = webhookUrl === this.localWebhookUrl
        && error instanceof HttpErrorResponse
        && error.status === 404;

      if (!shouldTryWebhookTest) {
        throw error;
      }

      // Local n8n often uses webhook-test while workflow is open in editor.
      return firstValueFrom(this.http.post(this.localWebhookTestUrl, payload));
    }
  }

  private async getQuotaStatusRequest(webhookUrl: string): Promise<QuotaResponsePayload> {
    try {
      return await firstValueFrom(this.http.get<QuotaResponsePayload>(webhookUrl));
    } catch (error) {
      const shouldTryWebhookTest = webhookUrl === this.localQuotaUrl
        && error instanceof HttpErrorResponse
        && error.status === 404;

      if (!shouldTryWebhookTest) {
        throw error;
      }

      return firstValueFrom(this.http.get<QuotaResponsePayload>(this.localQuotaTestUrl));
    }
  }

  private getWebhookUrl(): string {
    return this.localWebhookUrl;
  }

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
        return 'Webhook not found (404). In n8n, activate the workflow or keep the editor test workflow open so /webhook-test can answer.';
      }

      return `n8n request failed (${error.status} ${error.statusText || 'Error'}).`;
    }

    return 'n8n request failed. Check webhook URL and n8n runtime.';
  }

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

    return `${message} Remaining today: ${quota.perIpRemaining} of ${quota.perIpLimit} for this IP, ${quota.globalRemaining} of ${quota.globalLimit} globally.`;
  }

  private updateQuotaFromError(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return;
    }

    const quota = this.readQuotaStatus(error.error);
    if (quota) {
      this.quotaStatus.set(quota);
    }
  }

  private updateQuotaFromPayload(payload: unknown) {
    const quota = this.readQuotaStatus(payload);
    if (quota) {
      this.quotaStatus.set(quota);
    }
  }

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

  private buildQuotaExceededMessage(quota: QuotaStatus): string {
    if (quota.perIpRemaining <= 0) {
      return `Daily quota reached for this IP address. You have used ${quota.perIpUsed} of ${quota.perIpLimit} recipe generations today.`;
    }

    return `System-wide daily quota reached. ${quota.globalUsed} of ${quota.globalLimit} generations have already been used today.`;
  }

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

  private persistJson(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Unable to persist key ${key}:`, error);
    }
  }

  private isValidIngredient(value: unknown): value is StoredIngredient {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const ingredient = value as StoredIngredient;
    return typeof ingredient.name === 'string'
      && typeof ingredient.quantity === 'number'
      && typeof ingredient.unit === 'string';
  }

  private isStoredRecipeContext(value: unknown): value is StoredRecipeContext {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const maybeContext = value as Partial<StoredRecipeContext>;
    return Array.isArray(maybeContext.ingredients)
      && maybeContext.ingredients.every((item) => this.isValidIngredient(item));
  }
}

