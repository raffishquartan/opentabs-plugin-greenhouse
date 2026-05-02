// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, expect, it } from 'vitest';
import singleJobFixture from './fixtures/job-single.json' with { type: 'json' };
import type { Job } from './api.js';
import { extractSalaryRange, extractWorkplaceType } from './metadata.js';

describe('extractWorkplaceType', () => {
  it('returns the metadata value for the "Workplace Type" entry', () => {
    expect(extractWorkplaceType(singleJobFixture as unknown as Job)).toBe('Hybrid');
  });

  it('returns null when there is no Workplace Type entry', () => {
    const job = { metadata: [{ name: 'Other', value: 'x' }] } as unknown as Job;
    expect(extractWorkplaceType(job)).toBeNull();
  });

  it('returns null when metadata is missing or empty', () => {
    expect(extractWorkplaceType({} as unknown as Job)).toBeNull();
    expect(extractWorkplaceType({ metadata: [] } as unknown as Job)).toBeNull();
  });

  it('matches case-insensitively on the metadata name', () => {
    const job = { metadata: [{ name: 'workplace type', value: 'Remote' }] } as unknown as Job;
    expect(extractWorkplaceType(job)).toBe('Remote');
  });

  it('returns null when the value is not a string', () => {
    const job = { metadata: [{ name: 'Workplace Type', value: 42 }] } as unknown as Job;
    expect(extractWorkplaceType(job)).toBeNull();
  });
});

describe('extractSalaryRange', () => {
  it('parses the pay-range markup from the fixture content', () => {
    const result = extractSalaryRange((singleJobFixture as { content: string }).content);
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
    const html = '&lt;div class=&quot;pay-range&quot;&gt;&lt;span&gt;$100,000&lt;/span&gt;&lt;span class=&quot;divider&quot;&gt;&amp;mdash;&lt;/span&gt;&lt;span&gt;$120,000&lt;/span&gt;&lt;/div&gt;';
    const result = extractSalaryRange(html);
    expect(result?.min).toBe('$100,000');
    expect(result?.max).toBe('$120,000');
  });
});
