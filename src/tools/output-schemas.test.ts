// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Round-trip test: every tool's runX helper produces output that satisfies
// its declared OutputSchema. Catches drift between the handler return shape
// and the schema declared on defineTool({ output: ... }).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const physicsxJobHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-job-4644845101.html'), 'utf8');

const fetchText = async (url: string): Promise<string> => {
  return url.includes('/jobs/') ? physicsxJobHtml : physicsxBoardHtml;
};

describe('tool output round-trips its declared OutputSchema', () => {
  it('list_jobs', async () => {
    const { listJobs, runListJobs } = await import('./list-jobs.js');
    const out = await runListJobs({ board: 'physicsx' }, { fetchText });
    expect(() => listJobs.output.parse(out)).not.toThrow();
  });

  it('get_job', async () => {
    const { getJob, runGetJob } = await import('./get-job.js');
    const out = await runGetJob({ board: 'physicsx', id: 4644845101 }, { fetchText });
    expect(() => getJob.output.parse(out)).not.toThrow();
  });

  it('search_jobs', async () => {
    const { searchJobs, runSearchJobs } = await import('./search-jobs.js');
    const out = await runSearchJobs({ board: 'physicsx', query: 'a' }, { fetchText });
    expect(() => searchJobs.output.parse(out)).not.toThrow();
  });

  it('recent_jobs', async () => {
    const { recentJobs, runRecentJobs } = await import('./recent-jobs.js');
    const out = await runRecentJobs({ board: 'physicsx' }, { fetchText });
    expect(() => recentJobs.output.parse(out)).not.toThrow();
  });

  it('summary', async () => {
    const { summary, runSummary } = await import('./summary.js');
    const out = await runSummary({ board: 'physicsx' }, { fetchText });
    expect(() => summary.output.parse(out)).not.toThrow();
  });

  it('compare_boards', async () => {
    const { compareBoards, runCompareBoards } = await import('./compare-boards.js');
    const out = await runCompareBoards({ boards: ['physicsx'] }, { fetchText });
    expect(() => compareBoards.output.parse(out)).not.toThrow();
  });

  it('list_departments', async () => {
    const { listDepartments, runListDepartments } = await import('./list-departments.js');
    const out = await runListDepartments({ board: 'physicsx' }, { fetchText });
    expect(() => listDepartments.output.parse(out)).not.toThrow();
  });

  it('list_offices', async () => {
    const { listOffices, runListOffices } = await import('./list-offices.js');
    const out = await runListOffices({ board: 'physicsx' }, { fetchText });
    expect(() => listOffices.output.parse(out)).not.toThrow();
  });

  it('list_locations', async () => {
    const { listLocations, runListLocations } = await import('./list-locations.js');
    const out = await runListLocations({ board: 'physicsx' }, { fetchText });
    expect(() => listLocations.output.parse(out)).not.toThrow();
  });

  it('list_titles', async () => {
    const { listTitles, runListTitles } = await import('./list-titles.js');
    const out = await runListTitles({ board: 'physicsx' }, { fetchText });
    expect(() => listTitles.output.parse(out)).not.toThrow();
  });

  it('validate_api', async () => {
    const { validateApi, runValidateApi } = await import('./validate-api.js');
    const out = await runValidateApi({ board: 'physicsx' }, { fetchText });
    expect(() => validateApi.output.parse(out)).not.toThrow();
  });
});
