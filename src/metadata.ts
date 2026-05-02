// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import type { Job } from './api.js';

interface MetadataEntry {
  name?: unknown;
  value?: unknown;
}

/**
 * Pull the "Workplace Type" value (Remote / Hybrid / Onsite, etc.) from a
 * Greenhouse job's `metadata[]` array. Returns null when the field is missing,
 * empty, or non-string.
 */
export function extractWorkplaceType(job: Job): string | null {
  const entries = (job.metadata ?? []) as MetadataEntry[];
  for (const entry of entries) {
    if (typeof entry?.name === 'string' && entry.name.toLowerCase() === 'workplace type') {
      return typeof entry.value === 'string' ? entry.value : null;
    }
  }
  return null;
}

export interface SalaryRange {
  min: string;
  max: string;
  currency: string | null;
  period: string | null;
  raw: string;
}

function decode(html: string): string {
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea');
    ta.innerHTML = html;
    return ta.value;
  }
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&');
}

const PAY_RANGE_RE = /<div\s+class="pay-range">\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*class="divider"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i;
const PAY_TITLE_RE = /<div\s+class="title">([^<]+)<\/div>\s*<div\s+class="pay-range">/i;

/**
 * Best-effort salary range parser. Greenhouse boards optionally include a
 * `<div class="pay-range">` block in `content`, but the format is not
 * standardised across companies. Returns null when no recognisable markup
 * exists.
 */
export function extractSalaryRange(content: string | null | undefined): SalaryRange | null {
  if (!content) return null;
  const text = decode(content);
  const match = PAY_RANGE_RE.exec(text);
  if (!match || !match[1] || !match[2]) return null;
  const min = match[1].trim();
  const max = match[2].trim();
  const titleMatch = PAY_TITLE_RE.exec(text);
  const titleText = titleMatch?.[1]?.trim() ?? null;
  const period = titleText && /annual|yearly|per\s+year/i.test(titleText)
    ? 'annual'
    : titleText && /hour/i.test(titleText)
      ? 'hourly'
      : titleText && /month/i.test(titleText)
        ? 'monthly'
        : null;
  const currencyMatch = /([A-Z]{3})\b/.exec(`${min} ${max}`);
  const currency = currencyMatch?.[1] ?? null;
  return {
    min,
    max,
    currency,
    period,
    raw: titleText ? `${titleText}: ${min} – ${max}` : `${min} – ${max}`,
  };
}
