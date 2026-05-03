// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runRecentJobs } from './recent-jobs.js';

const physicsxBoardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'),
  'utf8',
);

describe('runRecentJobs', () => {
  it('sorts by published_at descending and limits the result set', async () => {
    const result = await runRecentJobs(
      { board: 'physicsx', limit: 5 },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.jobs.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < result.jobs.length; i++) {
      const prev = result.jobs[i - 1];
      const cur = result.jobs[i];
      if (prev && cur) {
        expect(prev.published_at >= cur.published_at).toBe(true);
      }
    }
  });

  it('respects since cutoff', async () => {
    const cutoff = '2026-04-01T00:00:00Z';
    const result = await runRecentJobs(
      { board: 'physicsx', since: cutoff },
      { fetchText: async () => physicsxBoardHtml },
    );
    for (const j of result.jobs) {
      expect(j.published_at >= cutoff).toBe(true);
    }
  });

  it('returns all jobs when no limit/since given (single-page board)', async () => {
    const result = await runRecentJobs(
      { board: 'physicsx' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.total).toBe(39);
    expect(result.jobs).toHaveLength(39);
  });

  it('preserves the new department.{id,name} shape on each result', async () => {
    const result = await runRecentJobs(
      { board: 'physicsx', limit: 3 },
      { fetchText: async () => physicsxBoardHtml },
    );
    for (const j of result.jobs) {
      if (j.department !== null) {
        expect(j.department.id).toEqual(expect.any(Number));
        expect(j.department.name).toEqual(expect.any(String));
      }
    }
  });
});
