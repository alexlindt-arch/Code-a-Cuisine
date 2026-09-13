/**
 * @file local-quota.service.ts
 * @description Browser-side mirror of the server quota: 3 recipe generations per IP per calendar day.
 */
import { Injectable } from '@angular/core';
import type { LocalIpQuotaWindowRecord, LocalQuotaWindowStore } from './preferences.models';

/**
 * Counts successful generations per IP and local calendar day in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class LocalQuotaService {
  private readonly quotaKey = 'cac-local-per-ip-quota';
  private readonly configKey = 'cac-local-per-ip-quota-config';
  private readonly limit = 3;
  private readonly quotaMode = 'calendar-day';

  /**
   * Returns the number of generations allowed per IP per calendar day.
   * @returns The per-IP daily limit.
   */
  getLimit(): number {
    return this.limit;
  }

  /**
   * Stores the current quota configuration and drops stored usage when the limit or mode changed.
   */
  ensureConfig(): void {
    const config = { perIpLimit: this.limit, mode: this.quotaMode, updatedAt: Date.now() };
    try {
      const raw = localStorage.getItem(this.configKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { perIpLimit?: number; mode?: string };
        if (parsed.perIpLimit !== this.limit || parsed.mode !== this.quotaMode) {
          localStorage.removeItem(this.quotaKey);
        }
      }
      localStorage.setItem(this.configKey, JSON.stringify(config));
    } catch (error) {
      console.error('Unable to synchronize local quota config:', error);
      localStorage.removeItem(this.quotaKey);
    }
  }

  /**
   * Counts the generations of an IP on the calendar day of the reference time (local date).
   * @param ipAddress - Client IP address.
   * @param referenceMs - Reference time in milliseconds (defaults to now).
   * @returns Number of generations used today.
   */
  getUsage(ipAddress: string, referenceMs = Date.now()): number {
    return this.getCurrentRecord(ipAddress, referenceMs).timestamps.length;
  }

  /**
   * Records one successful generation for an IP.
   * @param ipAddress - Client IP address.
   * @param referenceMs - Time of the generation in milliseconds (defaults to now).
   */
  increment(ipAddress: string, referenceMs = Date.now()): void {
    const current = this.getCurrentRecord(ipAddress, referenceMs);
    const timestamps = [...current.timestamps, Math.floor(referenceMs)].slice(-this.limit);
    this.saveRecord({ ...current, timestamps });
  }

  /**
   * Returns how long an IP that reached the limit has to wait until the next local midnight.
   * @param ipAddress - Client IP address.
   * @param referenceMs - Reference time in milliseconds (defaults to now).
   * @returns Milliseconds until the quota resets, or 0 when the limit is not reached.
   */
  getTimeUntilReset(ipAddress: string, referenceMs = Date.now()): number {
    if (this.getUsage(ipAddress, referenceMs) < this.limit) {
      return 0;
    }
    return Math.max(0, this.startOfNextLocalDay(referenceMs) - referenceMs);
  }

  /**
   * Removes usage entries of previous days for an IP.
   * @param ipAddress - Client IP address.
   * @param referenceMs - Reference time in milliseconds (defaults to now).
   */
  clearExpiredLock(ipAddress: string, referenceMs = Date.now()): void {
    this.getCurrentRecord(ipAddress, referenceMs);
  }

  /**
   * Detects whether an address is IPv4 or IPv6.
   * @param ip - IP address.
   * @returns 'ipv4', 'ipv6' or 'unknown'.
   */
  detectIpVersion(ip: string): 'ipv4' | 'ipv6' | 'unknown' {
    const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    if (ipv4.test(ip)) {
      return 'ipv4';
    }
    return ip.includes(':') ? 'ipv6' : 'unknown';
  }

  /**
   * Returns the record of an IP limited to today's entries and persists the pruned record.
   * @param ipAddress - Client IP address.
   * @param referenceMs - Reference time in milliseconds.
   * @returns The record with today's timestamps only.
   */
  private getCurrentRecord(ipAddress: string, referenceMs: number): LocalIpQuotaWindowRecord {
    const ipVersion = this.detectIpVersion(ipAddress);
    const key = this.recordKey(ipAddress, ipVersion);
    const existing = this.readStore().records.find((record) => this.recordKey(record.ipAddress, record.ipVersion) === key);
    const timestamps = this.filterToday(existing?.timestamps ?? [], referenceMs);
    const record = { ipAddress, ipVersion, timestamps };

    if (!existing || timestamps.length !== existing.timestamps.length) {
      this.saveRecord(record);
    }
    return record;
  }

  /**
   * Replaces the stored record of an IP.
   * @param record - Record to store.
   */
  private saveRecord(record: LocalIpQuotaWindowRecord): void {
    const key = this.recordKey(record.ipAddress, record.ipVersion);
    const others = this.readStore().records.filter((item) => this.recordKey(item.ipAddress, item.ipVersion) !== key);
    this.writeStore({ records: [...others, record] });
  }

  /**
   * Keeps only timestamps on the same local calendar day as the reference time.
   * @param timestamps - Stored generation timestamps.
   * @param referenceMs - Reference time in milliseconds.
   * @returns Sorted timestamps of today.
   */
  private filterToday(timestamps: number[], referenceMs: number): number[] {
    const dayStart = this.startOfLocalDay(referenceMs);
    const nextDayStart = this.startOfNextLocalDay(referenceMs);
    return timestamps
      .filter((value) => Number.isFinite(value) && value >= dayStart && value < nextDayStart && value <= referenceMs)
      .map(Math.floor)
      .sort((first, second) => first - second);
  }

  /**
   * Returns local midnight of the day containing the reference time.
   * @param referenceMs - Reference time in milliseconds.
   * @returns Local midnight in milliseconds.
   */
  private startOfLocalDay(referenceMs: number): number {
    const date = new Date(referenceMs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  /**
   * Returns local midnight of the day after the reference time.
   * @param referenceMs - Reference time in milliseconds.
   * @returns Next local midnight in milliseconds.
   */
  private startOfNextLocalDay(referenceMs: number): number {
    const date = new Date(referenceMs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  }

  /**
   * Builds the lookup key of a stored record.
   * @param ipAddress - Client IP address.
   * @param ipVersion - Detected IP version.
   * @returns The key in the form 'version:address'.
   */
  private recordKey(ipAddress: string, ipVersion: LocalIpQuotaWindowRecord['ipVersion']): string {
    return `${ipVersion}:${ipAddress}`;
  }

  /**
   * Reads and validates the stored quota records.
   * @returns The stored records, or an empty store when the data is missing or invalid.
   */
  private readStore(): LocalQuotaWindowStore {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.quotaKey) ?? '{}') as Partial<LocalQuotaWindowStore>;
      const records = Array.isArray(parsed.records) ? parsed.records.filter((record) => this.isRecord(record)) : [];
      return {
        records: records.map((record) => ({
          ...record,
          timestamps: record.timestamps.filter((value) => typeof value === 'number' && Number.isFinite(value)).map(Math.floor),
        })),
      };
    } catch (error) {
      console.error('Unable to read local per-IP quota:', error);
      return { records: [] };
    }
  }

  /**
   * Type guard for a stored quota record.
   * @param record - Parsed value.
   * @returns True when the value has the record shape.
   */
  private isRecord(record: unknown): record is LocalIpQuotaWindowRecord {
    const candidate = record as Partial<LocalIpQuotaWindowRecord> | null;
    return !!candidate
      && typeof candidate.ipAddress === 'string'
      && ['ipv4', 'ipv6', 'unknown'].includes(candidate.ipVersion ?? '')
      && Array.isArray(candidate.timestamps);
  }

  /**
   * Persists the quota records.
   * @param store - Records to store.
   */
  private writeStore(store: LocalQuotaWindowStore): void {
    try {
      localStorage.setItem(this.quotaKey, JSON.stringify(store));
    } catch (error) {
      console.error('Unable to persist local per-IP quota:', error);
    }
  }
}
