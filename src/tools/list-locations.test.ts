// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runListLocations } from './list-locations.js';

const physicsxBoardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'),
  'utf8',
);

describe('runListLocations', () => {
  it('aggregates distinct posted locations across the page-1 jobs with counts', async () => {
    const result = await runListLocations(
      { board: 'physicsx' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.locations.length).toBeGreaterThan(0);
    for (const loc of result.locations) {
      expect(loc.name.length).toBeGreaterThan(0);
      expect(loc.count).toBeGreaterThan(0);
    }
    // sorted by count desc, then name asc
    for (let i = 1; i < result.locations.length; i++) {
      const prev = result.locations[i - 1];
      const cur = result.locations[i];
      if (prev && cur) {
        expect(prev.count).toBeGreaterThanOrEqual(cur.count);
      }
    }
    // total location-instances equals number of jobs
    const totalInstances = result.locations.reduce((s, l) => s + l.count, 0);
    expect(totalInstances).toBe(39);
  });
});
