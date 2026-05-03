// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, expect, it } from 'vitest';
import { extractSalaryRange } from './metadata.js';

// A representative Greenhouse pay-range markup snippet, modelled on real job
// content. Inlined here so we don't need a JSON fixture for this test.
const PAY_RANGE_HTML = [
  '<div class="title">Annual Salary Range</div>',
  '<div class="pay-range">',
  '<span>€61.000</span>',
  '<span class="divider">—</span>',
  '<span>€72.000 EUR</span>',
  '</div>',
].join('');

describe('extractSalaryRange', () => {
  it('parses a representative Greenhouse pay-range block', () => {
    const result = extractSalaryRange(PAY_RANGE_HTML);
    expect(result).not.toBeNull();
    expect(result?.min).toBe('€61.000');
    expect(result?.max).toBe('€72.000 EUR');
    expect(result?.period).toMatch(/annual/i);
  });

  it('returns null when content is empty/null/undefined', () => {
    expect(extractSalaryRange('')).toBeNull();
    expect(extractSalaryRange(null)).toBeNull();
    expect(extractSalaryRange(undefined)).toBeNull();
  });

  it('returns null when content has no pay-range markup', () => {
    expect(extractSalaryRange('<p>Just a job description.</p>')).toBeNull();
  });

  it('handles entity-encoded content (Greenhouse default)', () => {
    const html =
      '&lt;div class=&quot;pay-range&quot;&gt;&lt;span&gt;$100,000&lt;/span&gt;&lt;span class=&quot;divider&quot;&gt;&amp;mdash;&lt;/span&gt;&lt;span&gt;$120,000&lt;/span&gt;&lt;/div&gt;';
    const result = extractSalaryRange(html);
    expect(result?.min).toBe('$100,000');
    expect(result?.max).toBe('$120,000');
  });
});
