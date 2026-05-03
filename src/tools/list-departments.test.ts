// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runListDepartments } from './list-departments.js';

const physicsxBoardHtml = readFileSync(join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'), 'utf8');

describe('runListDepartments', () => {
  it('returns the flat department taxonomy with jobs_count populated from job assignments', async () => {
    const result = await runListDepartments({ board: 'physicsx' }, { fetchText: async () => physicsxBoardHtml });
    expect(result.board).toBe('physicsx');
    expect(result.departments.length).toBe(4);
    const names = result.departments.map(d => d.name).sort();
    expect(names).toEqual(['Delivery', 'Operations', 'Product', 'Research']);
    for (const d of result.departments) {
      expect(d.id).toEqual(expect.any(Number));
      expect(d.jobs_count).toBeGreaterThanOrEqual(0);
    }
    const total = result.departments.reduce((s, d) => s + d.jobs_count, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(39);
  });

  it('propagates fetch errors', async () => {
    await expect(
      runListDepartments(
        { board: 'physicsx' },
        {
          fetchText: async () => {
            throw new Error('boom');
          },
        },
      ),
    ).rejects.toThrow('boom');
  });
});
