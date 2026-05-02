// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

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
import { runListTitles } from './list-titles.js';

describe('runListTitles', () => {
  it('returns distinct titles with counts', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));
    const result = await runListTitles({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    for (const t of result.titles) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.count).toBeGreaterThanOrEqual(1);
    }
    const names = result.titles.map(t => t.title);
    expect(new Set(names).size).toBe(names.length);
  });
});
