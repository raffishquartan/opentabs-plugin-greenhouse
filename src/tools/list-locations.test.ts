// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  ToolError: class extends Error {
    static auth(msg: string) {
      return new this(msg);
    }
    static notFound(msg: string) {
      return new this(msg);
    }
    static validation(msg: string) {
      return new this(msg);
    }
    static internal(msg: string) {
      return new this(msg);
    }
  },
}));

import jobsFixture from '../fixtures/jobs.json' with { type: 'json' };
import { runListLocations } from './list-locations.js';

describe('runListLocations', () => {
  it('returns distinct location names with counts, sorted by count desc', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));
    const result = await runListLocations({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    // Each entry has name + count, count >= 1
    for (const loc of result.locations) {
      expect(loc.name.length).toBeGreaterThan(0);
      expect(loc.count).toBeGreaterThanOrEqual(1);
    }
    // Sorted by count desc
    for (let i = 1; i < result.locations.length; i++) {
      const prev = result.locations[i - 1];
      const curr = result.locations[i];
      expect(prev?.count).toBeGreaterThanOrEqual(curr?.count ?? 0);
    }
  });

  it('returns no duplicates', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jobsFixture), { status: 200 }));
    const result = await runListLocations({ board: 'airbnb' }, { fetchImpl });
    const names = result.locations.map(l => l.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
