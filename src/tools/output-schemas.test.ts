// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Round-trip test: every tool's runX helper produces output that satisfies
// its declared OutputSchema. Catches drift between the handler return shape
// and the schema declared on defineTool({ output: ... }).

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
import singleJobFixture from '../fixtures/job-single.json' with { type: 'json' };
import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import officesFixture from '../fixtures/offices.json' with { type: 'json' };

function fetchAll() {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/departments')) return new Response(JSON.stringify(departmentsFixture), { status: 200 });
    if (url.endsWith('/offices')) return new Response(JSON.stringify(officesFixture), { status: 200 });
    if (/\/jobs\/\d+$/.test(url)) return new Response(JSON.stringify(singleJobFixture), { status: 200 });
    if (url.includes('/jobs')) return new Response(JSON.stringify(jobsFixture), { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

describe('tool output round-trips its declared OutputSchema', () => {
  it('list_jobs', async () => {
    const { listJobs, runListJobs } = await import('./list-jobs.js');
    const out = await runListJobs({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => listJobs.output.parse(out)).not.toThrow();
  });

  it('get_job', async () => {
    const { getJob, runGetJob } = await import('./get-job.js');
    const out = await runGetJob({ board: 'airbnb', id: 7649441 }, { fetchImpl: fetchAll() });
    expect(() => getJob.output.parse(out)).not.toThrow();
  });

  it('search_jobs', async () => {
    const { searchJobs, runSearchJobs } = await import('./search-jobs.js');
    const out = await runSearchJobs({ board: 'airbnb', query: 'a' }, { fetchImpl: fetchAll() });
    expect(() => searchJobs.output.parse(out)).not.toThrow();
  });

  it('recent_jobs', async () => {
    const { recentJobs, runRecentJobs } = await import('./recent-jobs.js');
    const out = await runRecentJobs({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => recentJobs.output.parse(out)).not.toThrow();
  });

  it('summary', async () => {
    const { summary, runSummary } = await import('./summary.js');
    const out = await runSummary({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => summary.output.parse(out)).not.toThrow();
  });

  it('compare_boards', async () => {
    const { compareBoards, runCompareBoards } = await import('./compare-boards.js');
    const out = await runCompareBoards({ boards: ['airbnb'] }, { fetchImpl: fetchAll() });
    expect(() => compareBoards.output.parse(out)).not.toThrow();
  });

  it('list_departments', async () => {
    const { listDepartments, runListDepartments } = await import('./list-departments.js');
    const out = await runListDepartments({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => listDepartments.output.parse(out)).not.toThrow();
  });

  it('list_offices', async () => {
    const { listOffices, runListOffices } = await import('./list-offices.js');
    const out = await runListOffices({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => listOffices.output.parse(out)).not.toThrow();
  });

  it('list_locations', async () => {
    const { listLocations, runListLocations } = await import('./list-locations.js');
    const out = await runListLocations({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => listLocations.output.parse(out)).not.toThrow();
  });

  it('list_titles', async () => {
    const { listTitles, runListTitles } = await import('./list-titles.js');
    const out = await runListTitles({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => listTitles.output.parse(out)).not.toThrow();
  });

  it('validate_api', async () => {
    const { validateApi, runValidateApi } = await import('./validate-api.js');
    const out = await runValidateApi({ board: 'airbnb' }, { fetchImpl: fetchAll() });
    expect(() => validateApi.output.parse(out)).not.toThrow();
  });
});
