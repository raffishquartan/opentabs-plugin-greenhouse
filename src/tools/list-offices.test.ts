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

import officesFixture from '../fixtures/offices.json' with { type: 'json' };
import { runListOffices } from './list-offices.js';

describe('runListOffices', () => {
  it('returns office summaries with hierarchy info', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(officesFixture), { status: 200 }));
    const result = await runListOffices({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    expect(result.offices).toHaveLength(5);
    const first = result.offices[0];
    expect(first?.name).toBe('AMER');
    expect(first?.parent_id).toBeNull();
    expect(Array.isArray(first?.child_ids)).toBe(true);
  });

  it('does not include the embedded departments array', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(officesFixture), { status: 200 }));
    const result = await runListOffices({ board: 'airbnb' }, { fetchImpl });
    expect(result.offices[0]).not.toHaveProperty('departments');
  });
});
