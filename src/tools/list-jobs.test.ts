// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  ToolError: class extends Error {
    static auth(msg: string) {
      return new this(msg);
    }
    static notFound(msg: string) {
      return new this(msg);
    }
    static validation(msg: string) {
      return new this(msg);
    }
    static internal(msg: string) {
      return new this(msg);
    }
  },
}));

import jobsFixture from '../fixtures/jobs.json' with { type: 'json' };
import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import officesFixture from '../fixtures/offices.json' with { type: 'json' };
import { runListJobs } from './list-jobs.js';

function fetchFromFixtures() {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/departments')) {
      return new Response(JSON.stringify(departmentsFixture), { status: 200 });
    }
    if (url.endsWith('/offices')) {
      return new Response(JSON.stringify(officesFixture), { status: 200 });
    }
    if (url.includes('/jobs')) {
      return new Response(JSON.stringify(jobsFixture), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('runListJobs', () => {
  it('returns all jobs with summaries when no filters given', async () => {
    const result = await runListJobs({ board: 'airbnb' }, { fetchImpl: fetchFromFixtures() });
    expect(result.board).toBe('airbnb');
    expect(result.total).toBe(5);
    expect(result.jobs).toHaveLength(5);
    expect(result.jobs[0]?.id).toBeTypeOf('number');
    expect(result.jobs[0]?.title).toBeTypeOf('string');
    expect(result.jobs[0]?.location).toBeTypeOf('string');
  });

  it('includes offices and departments as name arrays', async () => {
    const result = await runListJobs({ board: 'airbnb' }, { fetchImpl: fetchFromFixtures() });
    const first = result.jobs[0];
    expect(Array.isArray(first?.offices)).toBe(true);
    expect(Array.isArray(first?.departments)).toBe(true);
  });

  it('infers board from currentUrl when board omitted', async () => {
    const result = await runListJobs(
      {},
      {
        fetchImpl: fetchFromFixtures(),
        currentUrl: 'https://job-boards.eu.greenhouse.io/airbnb/jobs/12345',
      },
    );
    expect(result.board).toBe('airbnb');
  });

  it('filters by title_contains', async () => {
    const result = await runListJobs(
      { board: 'airbnb', title_contains: 'manager' },
      { fetchImpl: fetchFromFixtures() },
    );
    for (const job of result.jobs) {
      expect(job.title.toLowerCase()).toContain('manager');
    }
  });
});
