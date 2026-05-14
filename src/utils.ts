import { MedicineEntry } from './types';

export function parseExpiryToDate(expiry: string): Date | null {
  const parts = expiry.split('/').map(part => part.trim());
  if (parts.length !== 2) return null;
  const month = Number(parts[0]);
  const year = Number(parts[1]);
  if (!month || !year || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function getExpiryStatus(expiry: string): 'expired' | 'warning' | 'ok' {
  const expiryDate = parseExpiryToDate(expiry);
  if (!expiryDate) return 'ok';
  const lastDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth() + 1, 0);
  const today = new Date();
  const diff = Math.floor((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'warning';
  return 'ok';
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const primaryColor = '#0F6E56';

export function cleanString(value: string): string {
  return value.trim();
}

export function formatCurrency(value: number): string {
  return `₹${value.toFixed(2)}`;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function getStatusBadgeText(status: 'expired' | 'warning' | 'ok'): string {
  if (status === 'expired') return 'Expired';
  if (status === 'warning') return 'Warning';
  return 'OK';
}

export function buildExpiryQuery(key: string): string {
  return `date(substr(${key},4,4) || '-' || substr(${key},1,2) || '-01', '+1 month', '-1 day')`;
}

export function getExpiryDateString(expiry: string): string {
  return expiry || '--';
}

export function isLowStock(qty: number): boolean {
  return qty < 20;
}

export function todayISODate(): string {
  return new Date().toISOString();
}

export function parseIntSafe(value: string): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseFloatSafe(value: string): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
