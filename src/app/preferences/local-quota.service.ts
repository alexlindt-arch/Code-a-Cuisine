import { Injectable } from '@angular/core';
import type { LocalIpQuotaWindowRecord, LocalQuotaWindowStore } from './preferences.models';

@Injectable({ providedIn: 'root' })
export class LocalQuotaService {
  private readonly quotaKey = 'cac-local-per-ip-quota';
  private readonly configKey = 'cac-local-per-ip-quota-config';
  private readonly limit = 3;
  private readonly windowMs = 24 * 60 * 60 * 1000;

  getLimit(): number { return this.limit; }
  getWindowMs(): number { return this.windowMs; }

  ensureConfig() {
    const config = { perIpLimit: this.limit, updatedAt: Date.now() };
    try {
      const raw = localStorage.getItem(this.configKey);
      if (!raw) {
        localStorage.setItem(this.configKey, JSON.stringify(config));
        return;
      }
      const parsed = JSON.parse(raw) as { perIpLimit?: number };
      if (parsed.perIpLimit !== this.limit) localStorage.removeItem(this.quotaKey);
      localStorage.setItem(this.configKey, JSON.stringify(config));
    } catch (error) {
      console.error('Unable to synchronize local quota config:', error);
      localStorage.removeItem(this.quotaKey);
    }
  }

  getUsage(ipAddress: string, referenceMs = Date.now()): number {
    return this.getCurrentRecord(ipAddress, referenceMs).timestamps.length;
  }

  increment(ipAddress: string, referenceMs = Date.now()): void {
    const store = this.readStore();
    const ipVersion = this.detectIpVersion(ipAddress);
    const key = this.recordKey(ipAddress, ipVersion);
    const existing = store.records.find((record) => this.recordKey(record.ipAddress, record.ipVersion) === key);
    const timestamps = this.filterRecent([...(existing?.timestamps ?? []), referenceMs], referenceMs).slice(-this.limit);
    const records = store.records.filter((record) => this.recordKey(record.ipAddress, record.ipVersion) !== key);
    this.writeStore({ records: [...records, { ipAddress, ipVersion, timestamps }] });
  }

  getTimeUntilReset(ipAddress: string, referenceMs = Date.now()): number {
    const timestamps = this.getCurrentRecord(ipAddress, referenceMs).timestamps;
    if (timestamps.length < this.limit) return 0;
    return Math.max(0, Math.min(...timestamps) + this.windowMs - referenceMs);
  }

  clearExpiredLock(ipAddress: string, referenceMs = Date.now()): void {
    this.getCurrentRecord(ipAddress, referenceMs);
  }

  detectIpVersion(ip: string): 'ipv4' | 'ipv6' | 'unknown' {
    const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    return ipv4.test(ip) ? 'ipv4' : ip.includes(':') ? 'ipv6' : 'unknown';
  }

  private getCurrentRecord(ipAddress: string, referenceMs: number): LocalIpQuotaWindowRecord {
    const store = this.readStore();
    const ipVersion = this.detectIpVersion(ipAddress);
    const key = this.recordKey(ipAddress, ipVersion);
    const existing = store.records.find((record) => this.recordKey(record.ipAddress, record.ipVersion) === key);
    const timestamps = this.filterRecent(existing?.timestamps ?? [], referenceMs);
    if (!existing || timestamps.length !== existing.timestamps.length) {
      const records = store.records.filter((record) => this.recordKey(record.ipAddress, record.ipVersion) !== key);
      this.writeStore({ records: [...records, { ipAddress, ipVersion, timestamps }] });
    }
    return { ipAddress, ipVersion, timestamps };
  }

  private filterRecent(timestamps: number[], referenceMs: number): number[] {
    const start = referenceMs - this.windowMs;
    return timestamps.filter((value) => Number.isFinite(value) && value > start && value <= referenceMs).map(Math.floor).sort((a, b) => a - b);
  }

  private recordKey(ipAddress: string, ipVersion: LocalIpQuotaWindowRecord['ipVersion']): string { return `${ipVersion}:${ipAddress}`; }

  private readStore(): LocalQuotaWindowStore {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.quotaKey) ?? '{}') as Partial<LocalQuotaWindowStore>;
      const records = Array.isArray(parsed.records) ? parsed.records.filter((record): record is LocalIpQuotaWindowRecord => !!record && typeof record.ipAddress === 'string' && ['ipv4', 'ipv6', 'unknown'].includes(record.ipVersion) && Array.isArray(record.timestamps)).map((record) => ({ ...record, timestamps: record.timestamps.filter((value) => typeof value === 'number' && Number.isFinite(value)).map(Math.floor) })) : [];
      return { records };
    } catch (error) {
      console.error('Unable to read local per-IP rolling quota:', error);
      return { records: [] };
    }
  }

  private writeStore(store: LocalQuotaWindowStore): void {
    try { localStorage.setItem(this.quotaKey, JSON.stringify(store)); }
    catch (error) { console.error('Unable to persist local per-IP rolling quota:', error); }
  }
}
