// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Exercises the `handle()` path of the tools (not just the runX helpers),
// using vi.stubGlobal to provide a fake `location` so resolveBoardToken can
// pick up the active tab's URL. The SDK's `fetchText` is mocked to return
// recorded HTML fixtures keyed by URL pattern. Catches breakage in the
// resolveBoardToken-from-window path.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const physicsxJobHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-job-4644845101.html'), 'utf8');

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async (url: string) => {
    return url.includes('/jobs/') ? physicsxJobHtml : physicsxBoardHtml;
  },
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

const ORIGINAL_LOCATION = (globalThis as { location?: Location }).location;

beforeEach(() => {
  vi.stubGlobal('location', { href: 'https://job-boards.eu.greenhouse.io/physicsx/jobs/4644845101' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_LOCATION !== undefined) {
    (globalThis as { location?: Location }).location = ORIGINAL_LOCATION;
  }
});

describe('tool handle() reads window.location for the board', () => {
  it('list_jobs.handle resolves board from active tab URL', async () => {
    const { listJobs } = await import('./list-jobs.js');
    const result = await listJobs.handle({});
    expect(result.board).toBe('physicsx');
    expect(result.total).toBe(39);
  });

  it('get_job.handle resolves board from active tab URL', async () => {
    const { getJob } = await import('./get-job.js');
    const result = await getJob.handle({ id: 4644845101 });
    expect(result.id).toBe(4644845101);
  });

  it('list_departments.handle resolves from URL', async () => {
    const { listDepartments } = await import('./list-departments.js');
    const result = await listDepartments.handle({});
    expect(result.board).toBe('physicsx');
    expect(result.departments.length).toBeGreaterThan(0);
  });

  it('list_offices.handle resolves from URL', async () => {
    const { listOffices } = await import('./list-offices.js');
    const result = await listOffices.handle({});
    expect(result.board).toBe('physicsx');
    expect(result.offices.length).toBeGreaterThan(0);
  });

  it('list_locations.handle resolves from URL', async () => {
    const { listLocations } = await import('./list-locations.js');
    const result = await listLocations.handle({});
    expect(result.board).toBe('physicsx');
  });

  it('list_titles.handle resolves from URL', async () => {
    const { listTitles } = await import('./list-titles.js');
    const result = await listTitles.handle({});
    expect(result.board).toBe('physicsx');
  });

  it('summary.handle resolves from URL', async () => {
    const { summary } = await import('./summary.js');
    const result = await summary.handle({});
    expect(result.board).toBe('physicsx');
    expect(result.total).toBe(39);
  });

  it('search_jobs.handle resolves from URL', async () => {
    const { searchJobs } = await import('./search-jobs.js');
    const result = await searchJobs.handle({ query: 'a' });
    expect(result.board).toBe('physicsx');
  });

  it('recent_jobs.handle resolves from URL', async () => {
    const { recentJobs } = await import('./recent-jobs.js');
    const result = await recentJobs.handle({});
    expect(result.board).toBe('physicsx');
  });

  it('validate_api.handle resolves from URL', async () => {
    const { validateApi } = await import('./validate-api.js');
    const result = await validateApi.handle({});
    expect(result.board).toBe('physicsx');
    expect(result.ok).toBe(true);
  });

  it('compare_boards.handle works (board passed explicitly)', async () => {
    const { compareBoards } = await import('./compare-boards.js');
    const result = await compareBoards.handle({ boards: ['physicsx'] });
    expect(result.boards[0]?.ok).toBe(true);
  });
});
