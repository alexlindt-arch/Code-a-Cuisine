import { Injectable, signal } from '@angular/core';
import type { LocalQuotaWindowStore, QuotaCardSummary, QuotaStatus, RecipeResponsePayload } from './preferences.models';
import { LocalQuotaService } from './local-quota.service';

@Injectable({ providedIn: 'root' })
export class PreferencesQuotaService {
  readonly status = signal<QuotaStatus | null>(null);
  readonly message = signal<string | null>(null);
  readonly exceeded = signal(false);
  readonly dialogVisible = signal(false);
  readonly dialogKind = signal<'notice' | 'limit' | 'connection'>('notice');
  readonly loading = signal(true);

  constructor(private readonly localQuota: LocalQuotaService) {}

  initialize(): void { this.localQuota.ensureConfig(); }
  setLoading(value: boolean): void { this.loading.set(value); }
  getLimit(): number { return this.localQuota.getLimit(); }
  getUsage(ip: string, referenceMs = Date.now()): number { return this.localQuota.getUsage(ip, referenceMs); }
  increment(ip: string, referenceMs = Date.now()): void { this.localQuota.increment(ip, referenceMs); }
  getResetMs(ip: string, referenceMs = Date.now()): number { return this.localQuota.getTimeUntilReset(ip, referenceMs); }

  clearExpired(ip: string, referenceMs = Date.now()): void {
    this.localQuota.clearExpiredLock(ip, referenceMs);
    if (this.getUsage(ip, referenceMs) < this.getLimit()) {
      this.exceeded.set(false);
      if (this.message() && this.getResetMs(ip, referenceMs) <= 0) this.message.set(null);
    }
  }

  isForToday(quota: QuotaStatus | null): boolean {
    return !!quota && quota.date === new Date().toISOString().slice(0, 10);
  }

  hasReached(quota: QuotaStatus | null, localUsage: number): boolean {
    return localUsage >= this.getLimit() || (!!quota && quota.perIpRemaining <= 0);
  }

  buildLocal(ip: string, localUsage: number): QuotaStatus {
    const ipVersion = this.localQuota.detectIpVersion(ip);
    const usage = Math.max(0, localUsage);
    const limit = this.getLimit();
    return { date: new Date().toISOString().slice(0, 10), ipAddress: ip, ipVersion, perIpLimit: limit,
      perIpUsed: usage, perIpRemaining: Math.max(0, limit - usage), globalLimit: limit,
      globalUsed: usage, globalRemaining: Math.max(0, limit - usage) };
  }

  sync(quota: QuotaStatus): void {
    this.status.set(quota);
    this.exceeded.set(quota.perIpRemaining <= 0);
  }

  cardSummary(ip: string): QuotaCardSummary {
    const quota = this.status();
    const localUsage = this.getUsage(ip);
    const localExceeded = localUsage >= this.getLimit();
    const message = this.message();
    if (quota) return { show: true, kind: localExceeded ? 'local' : 'remote', localUsage,
      perIpRemaining: quota.perIpRemaining, globalRemaining: quota.globalRemaining, message };
    if (localExceeded || (typeof message === 'string' && message.trim().length > 0)) {
      return { show: true, kind: localExceeded ? 'local' : 'remote', localUsage,
        perIpRemaining: null, globalRemaining: null, message };
    }
    return { show: false, kind: 'none', localUsage, perIpRemaining: null, globalRemaining: null, message };
  }

  readFromPayload(payload: unknown): QuotaStatus | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const quota = (payload as RecipeResponsePayload).quota;
    if (!quota || typeof quota !== 'object') return null;
    const candidate = quota as Partial<QuotaStatus>;
    if (typeof candidate.date !== 'string' || typeof candidate.ipAddress !== 'string'
      || typeof candidate.perIpLimit !== 'number' || typeof candidate.perIpUsed !== 'number'
      || typeof candidate.perIpRemaining !== 'number' || typeof candidate.globalLimit !== 'number'
      || typeof candidate.globalUsed !== 'number' || typeof candidate.globalRemaining !== 'number') return null;
    return { date: candidate.date, ipAddress: candidate.ipAddress,
      ipVersion: candidate.ipVersion === 'ipv4' || candidate.ipVersion === 'ipv6' ? candidate.ipVersion : 'unknown',
      perIpLimit: candidate.perIpLimit, perIpUsed: candidate.perIpUsed, perIpRemaining: candidate.perIpRemaining,
      globalLimit: candidate.globalLimit, globalUsed: candidate.globalUsed, globalRemaining: candidate.globalRemaining };
  }

  buildDailyMessage(usage: number, quota: QuotaStatus | null = this.status()): string {
    const used = Math.max(usage, quota?.perIpUsed ?? 0);
    return `Daily limit reached: ${used} of ${quota?.perIpLimit ?? this.getLimit()} requests have already been used. Please try again later.`;
  }

  buildExceededMessage(quota: QuotaStatus): string {
    const label = quota.ipVersion === 'ipv4' ? 'IPv4' : quota.ipVersion === 'ipv6' ? 'IPv6' : 'IP';
    if (quota.perIpRemaining <= 0) return `24h quota reached for this ${label} address. You have used ${quota.perIpUsed} of ${quota.perIpLimit} recipe generations in the last 24 hours.`;
    return `24h quota reached. ${quota.globalUsed} of ${quota.globalLimit} generations have already been used in the last 24 hours.`;
  }
}
