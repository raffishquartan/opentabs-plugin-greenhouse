// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
  ToolError: {
    validation: (msg: string) => new Error(msg),
  },
}));

import { runListJobs } from './list-jobs.js';

const physicsxBoardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'),
  'utf8',
);

describe('runListJobs', () => {
  it('returns all jobs from the physicsx fixture (single page) with new shape', async () => {
    const result = await runListJobs(
      { board: 'physicsx' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.total).toBe(39);
    expect(result.jobs).toHaveLength(39);
    const first = result.jobs[0];
    expect(first?.id).toEqual(expect.any(Number));
    expect(first?.title.length).toBeGreaterThan(0);
    expect(first?.absolute_url.startsWith('http')).toBe(true);
    expect(first?.updated_at.length).toBeGreaterThan(0);
    expect(first?.published_at.length).toBeGreaterThan(0);
  });

  it('filters by title_contains case-insensitively', async () => {
    const result = await runListJobs(
      { board: 'physicsx', title_contains: 'engineer' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.jobs.length).toBeGreaterThan(0);
    for (const j of result.jobs) {
      expect(j.title.toLowerCase()).toContain('engineer');
    }
    expect(result.total).toBe(result.jobs.length);
  });

  it('filters by department name', async () => {
    const result = await runListJobs(
      { board: 'physicsx', department: 'Delivery' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.jobs.length).toBeGreaterThan(0);
    for (const j of result.jobs) {
      expect(j.department?.name).toBe('Delivery');
    }
  });

  it('throws a clear validation error for an unknown department', async () => {
    await expect(
      runListJobs(
        { board: 'physicsx', department: 'DefinitelyNotADept' },
        { fetchText: async () => physicsxBoardHtml },
      ),
    ).rejects.toThrow(/Unknown department.*Delivery, Operations, Product, Research/);
  });
});
