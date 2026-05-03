/**
 * Statutory Financial Report Utilities
 * Shared formatting functions for PKR amounts, variance, and zero handling
 */

/** Format PKR amount: 1,234,567 — no currency symbol in cells */
export function formatPKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('en-US');
  return amount < 0 ? `(${formatted})` : formatted;
}

/** Format negative as (1,234,567) in red */
export function formatNegativePKR(amount: number): { text: string; isNegative: boolean } {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return { text: '—', isNegative: false };
  }
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('en-US');
  const isNegative = amount < 0;
  return {
    text: isNegative ? `(${formatted})` : formatted,
    isNegative,
  };
}

/** Format zero as — (em dash) */
export function formatZero(value: number): string {
  if (value === 0 || value === null || value === undefined || isNaN(value)) return '—';
  return formatPKR(value);
}

/** Format variance with color indicator */
export function formatVariance(
  current: number,
  prior: number
): { text: string; color: 'green' | 'red' | 'neutral' } {
  if (
    current === null || current === undefined || isNaN(current) ||
    prior === null || prior === undefined || isNaN(prior)
  ) {
    return { text: '—', color: 'neutral' };
  }

  const diff = current - prior;
  if (diff === 0) return { text: '—', color: 'neutral' };

  const abs = Math.abs(Math.round(diff));
  const formatted = abs.toLocaleString('en-US');
  const text = diff < 0 ? `(${formatted})` : formatted;

  return {
    text,
    color: diff > 0 ? 'green' : 'red',
  };
}

/** Get current financial year dates (July 1 – June 30) */
export function getCurrentFinancialYear(): { fromDate: string; toDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // If we're in Jan-June, FY started previous year
  const fyStartYear = month >= 6 ? year : year - 1;

  const fromDate = `${fyStartYear}-07-01`;
  const toDate = `${fyStartYear + 1}-06-30`;

  return { fromDate, toDate };
}

/** Format a date string for display */
export function formatPeriodString(fromDate: string, toDate: string): string {
  try {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const fromStr = from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const toStr = to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fromStr} to ${toStr}`;
  } catch {
    return `${fromDate} to ${toDate}`;
  }
}

/** Format a number as PKR with currency symbol (for callout boxes) */
export function formatPKRWithSymbol(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'PKR —';
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('en-US');
  return amount < 0 ? `PKR (${formatted})` : `PKR ${formatted}`;
}

/** Row type enum for financial report rows */
export type RowType =
  | 'section_header'
  | 'line_item'
  | 'sub_line'
  | 'sub_subtotal'
  | 'subtotal'
  | 'grand_total'
  | 'highlighted'
  | 'memo';
