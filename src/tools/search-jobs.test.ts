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
import { runSearchJobs } from './search-jobs.js';

const fetchOk = () => vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));

describe('runSearchJobs', () => {
  it('matches against the title', async () => {
    const result = await runSearchJobs({ board: 'airbnb', query: 'account' }, { fetchImpl: fetchOk() });
    for (const j of result.jobs) {
      const haystack = `${j.title} ${j.location} ${j.offices.join(' ')} ${j.departments.join(' ')}`.toLowerCase();
      expect(haystack.includes('account') || j.matched_in.includes('content')).toBe(true);
    }
  });

  it('matches against the description body when no other field matches', async () => {
    const fetchImpl = fetchOk();
    // pick a phrase that appears in the airbnb sample content body but not in titles/depts/offices/locations
    const result = await runSearchJobs({ board: 'airbnb', query: 'San Francisco' }, { fetchImpl });
    expect(result.total).toBeGreaterThan(0);
    expect(result.jobs[0]?.matched_in).toContain('content');
  });

  it('reports matched_in field set per match', async () => {
    const result = await runSearchJobs({ board: 'airbnb', query: 'sales' }, { fetchImpl: fetchOk() });
    for (const j of result.jobs) {
      expect(Array.isArray(j.matched_in)).toBe(true);
      expect(j.matched_in.length).toBeGreaterThan(0);
    }
  });

  it('returns no jobs when query matches nothing', async () => {
    const result = await runSearchJobs(
      { board: 'airbnb', query: 'zzzzzznothingmatcheszzzzzz' },
      { fetchImpl: fetchOk() },
    );
    expect(result.total).toBe(0);
    expect(result.jobs).toEqual([]);
  });

  it('is case-insensitive', async () => {
    const a = await runSearchJobs({ board: 'airbnb', query: 'ACCOUNT' }, { fetchImpl: fetchOk() });
    const b = await runSearchJobs({ board: 'airbnb', query: 'account' }, { fetchImpl: fetchOk() });
    expect(a.total).toBe(b.total);
  });
});
