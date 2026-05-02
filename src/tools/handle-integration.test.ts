// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Exercises the `handle()` path of the tools (not just the runX helpers),
// using vi.stubGlobal to provide a fake `location` and a fake `fetch` so
// the tool reads its current-tab URL the same way it would in the
// extension. Catches breakage in the resolveBoardToken-from-window path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import singleJobFixture from '../fixtures/job-single.json' with { type: 'json' };
import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import officesFixture from '../fixtures/offices.json' with { type: 'json' };

const ORIGINAL_LOCATION = (globalThis as { location?: Location }).location;
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal('location', { href: 'https://job-boards.eu.greenhouse.io/airbnb/jobs/12345' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.endsWith('/departments')) return new Response(JSON.stringify(departmentsFixture), { status: 200 });
      if (u.endsWith('/offices')) return new Response(JSON.stringify(officesFixture), { status: 200 });
      if (/\/jobs\/\d+$/.test(u)) return new Response(JSON.stringify(singleJobFixture), { status: 200 });
      if (u.includes('/jobs')) return new Response(JSON.stringify(jobsFixture), { status: 200 });
      return new Response('not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_LOCATION !== undefined) {
    (globalThis as { location?: Location }).location = ORIGINAL_LOCATION;
  }
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('tool handle() reads window.location for the board', () => {
  it('list_jobs.handle resolves board from active tab URL', async () => {
    const { listJobs } = await import('./list-jobs.js');
    const result = await listJobs.handle({});
    expect(result.board).toBe('airbnb');
    expect(result.total).toBe(5);
  });

  it('get_job.handle resolves board from active tab URL', async () => {
    const { getJob } = await import('./get-job.js');
    const result = await getJob.handle({ id: 7649441 });
    expect(result.id).toBe(7649441);
  });

  it('list_departments.handle resolves from URL', async () => {
    const { listDepartments } = await import('./list-departments.js');
    const result = await listDepartments.handle({});
    expect(result.board).toBe('airbnb');
    expect(result.departments.length).toBeGreaterThan(0);
  });

  it('summary.handle resolves from URL', async () => {
    const { summary } = await import('./summary.js');
    const result = await summary.handle({});
    expect(result.board).toBe('airbnb');
    expect(result.total).toBe(5);
  });

  it('search_jobs.handle resolves from URL', async () => {
    const { searchJobs } = await import('./search-jobs.js');
    const result = await searchJobs.handle({ query: 'a' });
    expect(result.board).toBe('airbnb');
  });

  it('recent_jobs.handle resolves from URL', async () => {
    const { recentJobs } = await import('./recent-jobs.js');
    const result = await recentJobs.handle({});
    expect(result.board).toBe('airbnb');
  });

  it('list_offices.handle resolves from URL', async () => {
    const { listOffices } = await import('./list-offices.js');
    const result = await listOffices.handle({});
    expect(result.board).toBe('airbnb');
    expect(result.offices.length).toBeGreaterThan(0);
  });

  it('list_locations.handle resolves from URL', async () => {
    const { listLocations } = await import('./list-locations.js');
    const result = await listLocations.handle({});
    expect(result.board).toBe('airbnb');
  });

  it('list_titles.handle resolves from URL', async () => {
    const { listTitles } = await import('./list-titles.js');
    const result = await listTitles.handle({});
    expect(result.board).toBe('airbnb');
  });

  it('validate_api.handle resolves from URL', async () => {
    const { validateApi } = await import('./validate-api.js');
    const result = await validateApi.handle({});
    expect(result.board).toBe('airbnb');
    expect(result.ok).toBe(true);
  });

  it('compare_boards.handle works (board passed explicitly)', async () => {
    const { compareBoards } = await import('./compare-boards.js');
    const result = await compareBoards.handle({ boards: ['airbnb'] });
    expect(result.boards[0]?.ok).toBe(true);
  });
});
