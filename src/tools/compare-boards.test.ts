// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

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
import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import officesFixture from '../fixtures/offices.json' with { type: 'json' };
import { runCompareBoards } from './compare-boards.js';

function makeFetch(opts: { failBoard?: string } = {}) {
  return vi.fn(async (url: string) => {
    if (opts.failBoard && url.includes(`/boards/${opts.failBoard}/`)) {
      return new Response('not found', { status: 404 });
    }
    if (url.endsWith('/departments')) return new Response(JSON.stringify(departmentsFixture), { status: 200 });
    if (url.endsWith('/offices')) return new Response(JSON.stringify(officesFixture), { status: 200 });
    if (url.includes('/jobs')) return new Response(JSON.stringify(jobsFixture), { status: 200 });
    return new Response('unknown', { status: 500 });
  });
}

describe('runCompareBoards', () => {
  it('sweeps multiple boards and returns per-board results', async () => {
    const result = await runCompareBoards(
      { boards: ['airbnb', 'stripe'] },
      { fetchImpl: makeFetch() },
    );
    expect(result.boards).toHaveLength(2);
    expect(result.boards.every(b => b.ok)).toBe(true);
    expect(result.total_across_boards).toBe(10); // 5 from each fixture
  });

  it('reports per-board failure without failing the whole call', async () => {
    const result = await runCompareBoards(
      { boards: ['airbnb', 'broken'] },
      { fetchImpl: makeFetch({ failBoard: 'broken' }) },
    );
    const ok = result.boards.find(b => b.board === 'airbnb');
    const fail = result.boards.find(b => b.board === 'broken');
    expect(ok?.ok).toBe(true);
    expect(fail?.ok).toBe(false);
    expect(fail?.error).toMatch(/not found/i);
    expect(result.total_across_boards).toBe(5);
  });

  it('applies the same filter to each board', async () => {
    const result = await runCompareBoards(
      { boards: ['airbnb', 'stripe'], title_contains: 'manager' },
      { fetchImpl: makeFetch() },
    );
    for (const b of result.boards) {
      if (!b.ok) continue;
      for (const j of b.jobs ?? []) {
        expect(j.title.toLowerCase()).toContain('manager');
      }
    }
  });

  it('rejects an empty boards array', async () => {
    await expect(runCompareBoards({ boards: [] }, { fetchImpl: makeFetch() })).rejects.toThrow(/at least one/i);
  });
});
