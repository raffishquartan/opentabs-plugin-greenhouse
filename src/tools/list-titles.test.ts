// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runListTitles } from './list-titles.js';

const physicsxBoardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'),
  'utf8',
);

describe('runListTitles', () => {
  it('aggregates distinct titles across the page-1 jobs with counts', async () => {
    const result = await runListTitles(
      { board: 'physicsx' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.titles.length).toBeGreaterThan(0);
    const totalInstances = result.titles.reduce((s, t) => s + t.count, 0);
    expect(totalInstances).toBe(39);
  });
});
