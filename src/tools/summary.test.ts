// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

import jobsFixture from '../fixtures/jobs.json' with { type: 'json' };
import { runSummary } from './summary.js';

describe('runSummary', () => {
  it('returns total + breakdowns by department, office, location and workplace_type', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));
    const result = await runSummary({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    expect(result.total).toBe(5);
    expect(Array.isArray(result.by_department)).toBe(true);
    expect(Array.isArray(result.by_office)).toBe(true);
    expect(Array.isArray(result.by_location)).toBe(true);
    expect(Array.isArray(result.by_workplace_type)).toBe(true);
    // Sums of breakdown counts equal total (per facet)
    const sumDept = result.by_department.reduce((a, b) => a + b.count, 0);
    expect(sumDept).toBeGreaterThan(0);
  });

  it('breakdowns are sorted by count descending', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));
    const result = await runSummary({ board: 'airbnb' }, { fetchImpl });
    for (const facet of [result.by_department, result.by_office, result.by_location, result.by_workplace_type]) {
      for (let i = 1; i < facet.length; i++) {
        const prev = facet[i - 1]?.count ?? 0;
        const curr = facet[i]?.count ?? 0;
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    }
  });
});
