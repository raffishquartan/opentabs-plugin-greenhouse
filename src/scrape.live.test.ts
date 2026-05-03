// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Live-scrape smoke test. Disabled by default to keep the unit-test run offline
// and deterministic. Enable with: LIVE_API=1 npm test
// Hits two real Greenhouse-hosted boards (one EU, one US) and confirms the
// same-origin Remix scrape parses end-to-end. Note: this test runs from Node
// where the page CSP does NOT apply - it cannot detect CSP regressions in the
// browser context. The browser-side guarantee is that boards are scraped
// from the same origin as the active tab, so CSP is by definition satisfied.

import { describe, expect, it } from 'vitest';
import { fetchBoard, fetchJob } from './scrape.js';

const enabled = process.env.LIVE_API === '1';

const EU_HOST = 'https://job-boards.eu.greenhouse.io';
const US_HOST = 'https://job-boards.greenhouse.io';

const directFetchText = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
};

describe.runIf(enabled)('live Greenhouse scrape smoke test', () => {
  it('scrapes physicsx (EU host) board page', { timeout: 30_000 }, async () => {
    const result = await fetchBoard('physicsx', { fetchText: directFetchText, host: EU_HOST });
    expect(result.board).toBe('physicsx');
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.departments.length).toBeGreaterThan(0);
    expect(result.offices.length).toBeGreaterThan(0);
    const first = result.jobs[0];
    expect(first?.title.length).toBeGreaterThan(0);
    expect(first?.location.length).toBeGreaterThan(0);
    expect(first?.absolute_url.startsWith('http')).toBe(true);
  });

  it('scrapes anthropic (US host) board page and observes pagination', { timeout: 30_000 }, async () => {
    const result = await fetchBoard('anthropic', { fetchText: directFetchText, host: US_HOST });
    expect(result.board).toBe('anthropic');
    expect(result.jobs.length).toBeGreaterThan(0);
    // Anthropic has hundreds of jobs; first page is capped at 50.
    expect(result.jobs.length).toBeLessThanOrEqual(50);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('scrapes a per-job page and returns a non-empty HTML body', { timeout: 30_000 }, async () => {
    const board = await fetchBoard('physicsx', { fetchText: directFetchText, host: EU_HOST });
    const firstId = board.jobs[0]?.id;
    if (typeof firstId !== 'number') throw new Error('no jobs to test against');
    const job = await fetchJob('physicsx', firstId, { fetchText: directFetchText, host: EU_HOST });
    expect(job.id).toBe(firstId);
    expect(job.title.length).toBeGreaterThan(0);
    expect(job.company_name.length).toBeGreaterThan(0);
    expect(job.content.length).toBeGreaterThan(200);
  });
});
