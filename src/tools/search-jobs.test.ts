// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runSearchJobs } from './search-jobs.js';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const physicsxJobHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-job-4644845101.html'), 'utf8');

describe('runSearchJobs', () => {
  it('matches title across all jobs and reports matched_in', async () => {
    const result = await runSearchJobs(
      { board: 'physicsx', query: 'engineer' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.query).toBe('engineer');
    expect(result.jobs.length).toBeGreaterThan(0);
    for (const j of result.jobs) {
      expect(j.matched_in.length).toBeGreaterThan(0);
      expect(['title', 'location', 'department', 'office', 'content']).toEqual(expect.arrayContaining(j.matched_in));
    }
  });

  it('matches against department names', async () => {
    const result = await runSearchJobs(
      { board: 'physicsx', query: 'delivery' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(
      result.jobs.every(
        j => j.matched_in.includes('department') || j.matched_in.includes('title') || j.matched_in.includes('location'),
      ),
    ).toBe(true);
  });

  it('matches against office names from the office taxonomy', async () => {
    const result = await runSearchJobs(
      { board: 'physicsx', query: 'singapore' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.jobs.length).toBeGreaterThan(0);
    for (const j of result.jobs) {
      const acceptable = j.matched_in.includes('office') || j.matched_in.includes('location');
      expect(acceptable).toBe(true);
    }
  });

  it('returns no hits when nothing matches', async () => {
    const result = await runSearchJobs(
      { board: 'physicsx', query: 'definitely-nothing-zzzz' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.total).toBe(0);
    expect(result.jobs).toEqual([]);
  });

  it('also searches content body when include_content is true', async () => {
    let boardCalls = 0;
    let jobCalls = 0;
    const fetchText = async (url: string): Promise<string> => {
      if (url.includes('/jobs/')) {
        jobCalls++;
        return physicsxJobHtml;
      }
      boardCalls++;
      return physicsxBoardHtml;
    };
    // The content body for the per-job fixture mentions "CFD" — pick a query
    // that should NOT match shallow fields but should match content.
    const result = await runSearchJobs(
      { board: 'physicsx', query: 'turbomachinery', include_content: true },
      { fetchText },
    );
    expect(boardCalls).toBeGreaterThan(0);
    expect(jobCalls).toBeGreaterThan(0);
    expect(result.jobs.some(j => j.matched_in.includes('content'))).toBe(true);
  });
});
