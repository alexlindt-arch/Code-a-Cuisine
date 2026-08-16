import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { QuotaStatus, RecipeRequestPayload } from './preferences.models';

@Injectable({ providedIn: 'root' })
export class RecipeRequestService {
  private readonly http = inject(HttpClient);
  private readonly webhookPath = environment.recipeWebhookUrl;

  getWebhookUrls(): string[] {
    return Array.from(new Set([`${this.webhookPath}code-a-cuisine-recipe`])).filter((url) => this.isValidWebhookUrl(url));
  }

  async send(payload: RecipeRequestPayload, urls: string[]): Promise<unknown> {
    let lastError: unknown = null;
    for (const url of urls) {
      try { return await firstValueFrom(this.http.post(url, payload)); }
      catch (error) { lastError = error; console.warn(`Webhook request failed for ${url}:`, error); }
    }
    throw lastError ?? new Error('All webhook endpoints failed.');
  }

  toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const quotaMessage = this.getQuotaMessage(error.error);
      if (quotaMessage) return quotaMessage;
      if (error.status === 0) return 'Network/TLS/CORS error. Verify that the webhook URL is reachable, uses a valid HTTPS certificate, and allows CORS.';
      if (error.status === 404) return 'Webhook not found (404). Verify the configured recipe webhook URL and that the n8n workflow is active.';
      return `n8n request failed (${error.status} ${error.statusText || 'Error'}).`;
    }
    return this.extractErrorText(error).trim() || 'n8n request failed. Check webhook URL and n8n runtime.';
  }

  isQuotaError(error: unknown, message: string, localUsage: number, limit: number): boolean {
    if (localUsage >= limit || (error instanceof HttpErrorResponse && (error.status === 429 || error.status === 503))) return true;
    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return ['quota', 'limit reached', 'daily limit', 'too many requests', 'try again in a few seconds',
      'failed to fetch', 'fetch failed', 'http failure response', 'unknown error', 'temporarily unavailable'].some((part) => normalized.includes(part));
  }

  isLimitError(error: unknown, message: string, localUsage: number, limit: number): boolean {
    if (localUsage >= limit || (error instanceof HttpErrorResponse && error.status === 429)) return true;
    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return ['quota', 'limit reached', 'daily limit', 'too many requests', '24h', 'generation limit'].some((part) => normalized.includes(part));
  }

  isConnectionError(error: unknown, message: string): boolean {
    if (error instanceof HttpErrorResponse && error.status === 0) return true;
    const normalized = `${message} ${this.extractErrorText(error)}`.toLowerCase();
    return ['failed to fetch', 'fetch failed', 'http failure response', 'unknown error', 'network', 'cors', 'ssl', 'tls', 'certificate', 'protocol error'].some((part) => normalized.includes(part));
  }

  toDialogMessage(error: unknown, fallback: string, localUsage: number, limit: number): string {
    if (this.isLimitError(error, fallback, localUsage, limit)) return 'Daily limit reached. Please try again later.';
    if (this.isConnectionError(error, fallback)) return 'The recipe API is currently unavailable. Please try again in a few minutes.';
    const raw = this.extractErrorText(error).trim();
    return ['failed to fetch', 'fetch failed', 'http failure response', 'unknown error'].some((part) => raw.toLowerCase().includes(part))
      ? 'The recipe API is currently unavailable. Please try again in a few minutes.' : raw || fallback;
  }

  getQuotaMessage(payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const message = (payload as { message?: unknown }).message;
    const quota = this.readQuota(payload);
    if (typeof message !== 'string' || !message.trim()) return null;
    if (!quota || (quota.perIpRemaining > 0 && quota.globalRemaining > 0)) return message;
    return `${message} Remaining today: ${quota.perIpRemaining} of ${quota.perIpLimit} for this IP, ${quota.globalRemaining} of ${quota.globalLimit} globally.`;
  }

  readQuota(payload: unknown): QuotaStatus | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const quota = (payload as { quota?: unknown }).quota;
    if (!quota || typeof quota !== 'object') return null;
    const candidate = quota as Partial<QuotaStatus>;
    return typeof candidate.date === 'string' && typeof candidate.ipAddress === 'string' && typeof candidate.perIpLimit === 'number'
      && typeof candidate.perIpUsed === 'number' && typeof candidate.perIpRemaining === 'number' && typeof candidate.globalLimit === 'number'
      && typeof candidate.globalUsed === 'number' && typeof candidate.globalRemaining === 'number'
      ? { ...candidate, ipVersion: candidate.ipVersion === 'ipv4' || candidate.ipVersion === 'ipv6' ? candidate.ipVersion : 'unknown' } as QuotaStatus : null;
  }

  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) && (/^\/webhook(?:\/|$)/i.test(parsed.pathname)) && !/^\/workflow(?:\/|$)/i.test(parsed.pathname);
    } catch { return false; }
  }

  private extractErrorText(error: unknown): string {
    const values: string[] = [];
    if (typeof error === 'string') values.push(error);
    if (error instanceof Error) values.push(error.message);
    if (typeof error === 'object' && error !== null) {
      const object = error as { message?: unknown; error?: unknown; detail?: unknown };
      for (const value of [object.message, object.error, object.detail]) if (typeof value === 'string') values.push(value);
    }
    if (error instanceof HttpErrorResponse && typeof error.statusText === 'string') values.push(error.statusText);
    return values.join(' ').trim();
  }
}
