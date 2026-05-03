// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runValidateApi } from './validate-api.js';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const physicsxJobHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-job-4644845101.html'), 'utf8');

describe('runValidateApi (scrape edition)', () => {
  it('reports ok when both the board and per-job probes parse cleanly', async () => {
    const fetchText = vi.fn(async (url: string) => {
      return url.includes('/jobs/') ? physicsxJobHtml : physicsxBoardHtml;
    });
    const result = await runValidateApi({ board: 'physicsx' }, { fetchText });
    expect(result.board).toBe('physicsx');
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0]).toMatchObject({ endpoint: '/board', ok: true, error: null });
    expect(result.checks[1]).toMatchObject({ endpoint: '/job', ok: true, error: null });
  });

  it('reports the board-probe failure and skips the per-job probe when the board page is empty', async () => {
    const fetchText = vi.fn(async () => '<html><body>no remix here</body></html>');
    const result = await runValidateApi({ board: 'physicsx' }, { fetchText });
    expect(result.ok).toBe(false);
    expect(result.checks[0]?.ok).toBe(false);
    expect(result.checks[0]?.error).toMatch(/__remixContext not found/);
    expect(result.checks[1]?.ok).toBe(false);
    expect(result.checks[1]?.error).toMatch(/skipped/);
  });

  it('reports the per-job probe failure when the per-job page is invalid', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('/jobs/')) return '<html><body>missing remix</body></html>';
      return physicsxBoardHtml;
    });
    const result = await runValidateApi({ board: 'physicsx' }, { fetchText });
    expect(result.ok).toBe(false);
    expect(result.checks[0]?.ok).toBe(true);
    expect(result.checks[1]?.ok).toBe(false);
    expect(result.checks[1]?.error).toMatch(/__remixContext not found/);
  });
});
