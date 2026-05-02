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

import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import { runListDepartments } from './list-departments.js';

describe('runListDepartments', () => {
  it('returns flattened department summaries with jobs_count and child_ids', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(departmentsFixture), { status: 200 }));
    const result = await runListDepartments({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    expect(result.departments).toHaveLength(5);
    const first = result.departments[0];
    expect(first?.name).toBe('1. Technical');
    expect(first?.parent_id).toBeNull();
    expect(Array.isArray(first?.child_ids)).toBe(true);
    expect(typeof first?.jobs_count).toBe('number');
  });

  it('does not include the embedded jobs array in the response', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(departmentsFixture), { status: 200 }));
    const result = await runListDepartments({ board: 'airbnb' }, { fetchImpl });
    expect(result.departments[0]).not.toHaveProperty('jobs');
  });
});
