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
import { runRecentJobs } from './recent-jobs.js';

const fetchOk = () => vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));

describe('runRecentJobs', () => {
  it('returns jobs sorted by first_published descending', async () => {
    const result = await runRecentJobs({ board: 'airbnb' }, { fetchImpl: fetchOk() });
    expect(result.board).toBe('airbnb');
    for (let i = 1; i < result.jobs.length; i++) {
      const prev = result.jobs[i - 1]?.first_published;
      const curr = result.jobs[i]?.first_published;
      if (prev && curr) {
        expect(prev >= curr).toBe(true);
      }
    }
  });

  it('honours limit', async () => {
    const result = await runRecentJobs({ board: 'airbnb', limit: 2 }, { fetchImpl: fetchOk() });
    expect(result.jobs.length).toBeLessThanOrEqual(2);
  });

  it('filters by since (ISO timestamp)', async () => {
    const result = await runRecentJobs(
      { board: 'airbnb', since: '2099-01-01T00:00:00Z' },
      { fetchImpl: fetchOk() },
    );
    expect(result.jobs).toHaveLength(0);
  });

  it('returns workplace_type and other summary fields', async () => {
    const result = await runRecentJobs({ board: 'airbnb' }, { fetchImpl: fetchOk() });
    expect(result.jobs[0]).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      first_published: expect.any(String),
      workplace_type: expect.anything(),
    });
  });
});
