// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runSummary } from './summary.js';

const physicsxBoardHtml = readFileSync(join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'), 'utf8');

describe('runSummary', () => {
  it('returns total + by_department + by_location facets sorted by count desc', async () => {
    const result = await runSummary({ board: 'physicsx' }, { fetchText: async () => physicsxBoardHtml });
    expect(result.board).toBe('physicsx');
    expect(result.total).toBe(39);
    expect(result.by_department.length).toBeGreaterThan(0);
    expect(result.by_location.length).toBeGreaterThan(0);
    const totalDeptCount = result.by_department.reduce((s, e) => s + e.count, 0);
    expect(totalDeptCount).toBeLessThanOrEqual(39);
    const totalLocCount = result.by_location.reduce((s, e) => s + e.count, 0);
    expect(totalLocCount).toBe(39);
  });
});
