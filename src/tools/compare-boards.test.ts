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

import { runCompareBoards } from './compare-boards.js';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const anthropicBoardHtml = readFileSync(join(FIXTURE_DIR, 'anthropic-board.html'), 'utf8');

describe('runCompareBoards', () => {
  it('queries multiple boards in parallel and reports per-board success', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('/physicsx')) return physicsxBoardHtml;
      if (url.includes('/anthropic')) return anthropicBoardHtml;
      throw new Error(`unexpected url: ${url}`);
    };
    const result = await runCompareBoards(
      { boards: ['physicsx', 'anthropic'] },
      { fetchText, currentUrl: 'https://job-boards.eu.greenhouse.io/physicsx' },
    );
    expect(result.boards).toHaveLength(2);
    for (const b of result.boards) {
      expect(b.ok).toBe(true);
      expect(b.total).toBeGreaterThan(0);
    }
    const sumPerBoard = result.boards.reduce((s, b) => s + (b.total ?? 0), 0);
    expect(result.total_across_boards).toBe(sumPerBoard);
  });

  it('reports per-board failure without failing the whole call', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('/physicsx')) return physicsxBoardHtml;
      throw new Error('boom for the other board');
    };
    const result = await runCompareBoards(
      { boards: ['physicsx', 'broken'] },
      { fetchText, currentUrl: 'https://job-boards.eu.greenhouse.io/physicsx' },
    );
    expect(result.boards[0]?.ok).toBe(true);
    expect(result.boards[1]?.ok).toBe(false);
    expect(result.boards[1]?.error).toMatch(/boom/);
  });

  it('throws when boards array is empty', async () => {
    await expect(runCompareBoards({ boards: [] })).rejects.toThrow(/at least one board/);
  });

  it('applies title_contains filter to each board', async () => {
    const fetchText = async (url: string) => {
      if (url.includes('/physicsx')) return physicsxBoardHtml;
      throw new Error('only physicsx');
    };
    const result = await runCompareBoards(
      { boards: ['physicsx'], title_contains: 'engineer' },
      { fetchText, currentUrl: 'https://job-boards.eu.greenhouse.io/physicsx' },
    );
    const board = result.boards[0];
    expect(board?.ok).toBe(true);
    if (board?.jobs) {
      for (const j of board.jobs) {
        expect(j.title.toLowerCase()).toContain('engineer');
      }
    }
  });
});
