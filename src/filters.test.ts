// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
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

import type { Job, Department, Office } from './api.js';
import { applyJobFilters, descendantIds } from './filters.js';

function makeJob(overrides: Partial<Job>): Job {
  const base: Job = {
    id: 1,
    title: 'Engineer',
    location: { name: 'London, UK' },
    offices: [{ id: 100, name: 'London', parent_id: 10, child_ids: [], location: 'London, UK' }],
    departments: [{ id: 200, name: 'Engineering', parent_id: 20, child_ids: [] }],
    absolute_url: 'https://example.com/1',
    updated_at: '2026-04-01T00:00:00Z',
    first_published: '2026-04-01T00:00:00Z',
    requisition_id: 'R1',
  } as Job;
  return { ...base, ...overrides } as Job;
}

const DEPTS: Department[] = [
  { id: 20, name: 'Tech', parent_id: null, child_ids: [200, 201] } as Department,
  { id: 200, name: 'Engineering', parent_id: 20, child_ids: [] } as Department,
  { id: 201, name: 'Data', parent_id: 20, child_ids: [] } as Department,
  { id: 30, name: 'Sales', parent_id: null, child_ids: [] } as Department,
];

const OFFICES: Office[] = [
  { id: 10, name: 'EMEA', parent_id: null, child_ids: [100, 101] } as Office,
  { id: 100, name: 'London', parent_id: 10, child_ids: [], location: 'London, UK' } as Office,
  { id: 101, name: 'Paris', parent_id: 10, child_ids: [], location: 'Paris, France' } as Office,
  { id: 11, name: 'AMER', parent_id: null, child_ids: [] } as Office,
];

describe('applyJobFilters', () => {
  it('returns all jobs when no filters are given', () => {
    const jobs = [makeJob({ id: 1 }), makeJob({ id: 2 })];
    expect(applyJobFilters(jobs, {}, DEPTS, OFFICES)).toHaveLength(2);
  });

  it('filters by department name (case-insensitive)', () => {
    const eng = makeJob({
      id: 1,
      departments: [{ id: 200, name: 'Engineering', parent_id: 20, child_ids: [] }],
    });
    const sales = makeJob({
      id: 2,
      departments: [{ id: 30, name: 'Sales', parent_id: null, child_ids: [] }],
    });
    const result = applyJobFilters([eng, sales], { department: 'engineering' }, DEPTS, OFFICES);
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('filters by department id', () => {
    const eng = makeJob({
      id: 1,
      departments: [{ id: 200, name: 'Engineering', parent_id: 20, child_ids: [] }],
    });
    const sales = makeJob({
      id: 2,
      departments: [{ id: 30, name: 'Sales', parent_id: null, child_ids: [] }],
    });
    const result = applyJobFilters([eng, sales], { department: 200 }, DEPTS, OFFICES);
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('filters by parent department, including descendant departments', () => {
    const data = makeJob({ id: 1, departments: [{ id: 201, name: 'Data', parent_id: 20, child_ids: [] }] });
    const sales = makeJob({ id: 2, departments: [{ id: 30, name: 'Sales', parent_id: null, child_ids: [] }] });
    const result = applyJobFilters([data, sales], { department: 'Tech' }, DEPTS, OFFICES);
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('filters by office name', () => {
    const london = makeJob({ id: 1 });
    const paris = makeJob({
      id: 2,
      offices: [{ id: 101, name: 'Paris', parent_id: 10, child_ids: [], location: 'Paris, France' }],
    });
    const result = applyJobFilters([london, paris], { office: 'London' }, DEPTS, OFFICES);
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('filters by parent office, matching descendant offices', () => {
    const london = makeJob({ id: 1 });
    const amer = makeJob({
      id: 2,
      offices: [{ id: 11, name: 'AMER', parent_id: null, child_ids: [], location: null }],
    });
    const result = applyJobFilters([london, amer], { office: 'EMEA' }, DEPTS, OFFICES);
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('filters by location_contains (case-insensitive substring)', () => {
    const a = makeJob({ id: 1, location: { name: 'London, UK' } });
    const b = makeJob({ id: 2, location: { name: 'Paris, France' } });
    expect(applyJobFilters([a, b], { location_contains: 'paris' }, DEPTS, OFFICES).map(j => j.id)).toEqual([2]);
  });

  it('filters by title_contains (case-insensitive substring)', () => {
    const a = makeJob({ id: 1, title: 'Senior Software Engineer' });
    const b = makeJob({ id: 2, title: 'Product Manager' });
    expect(applyJobFilters([a, b], { title_contains: 'engineer' }, DEPTS, OFFICES).map(j => j.id)).toEqual([1]);
  });

  it('filters by updated_after', () => {
    const old = makeJob({ id: 1, updated_at: '2026-01-01T00:00:00Z' });
    const fresh = makeJob({ id: 2, updated_at: '2026-04-01T00:00:00Z' });
    expect(
      applyJobFilters([old, fresh], { updated_after: '2026-02-01T00:00:00Z' }, DEPTS, OFFICES).map(j => j.id),
    ).toEqual([2]);
  });

  it('combines filters with AND', () => {
    const a = makeJob({
      id: 1,
      title: 'Senior Engineer',
      location: { name: 'London' },
      departments: [{ id: 200, name: 'Engineering', parent_id: 20, child_ids: [] }],
    });
    const b = makeJob({
      id: 2,
      title: 'Senior Engineer',
      location: { name: 'Paris' },
      departments: [{ id: 200, name: 'Engineering', parent_id: 20, child_ids: [] }],
    });
    const result = applyJobFilters(
      [a, b],
      { department: 'Engineering', location_contains: 'london' },
      DEPTS,
      OFFICES,
    );
    expect(result.map(j => j.id)).toEqual([1]);
  });

  it('throws validation error on unknown department name', () => {
    expect(() => applyJobFilters([makeJob({})], { department: 'NoSuch' }, DEPTS, OFFICES)).toThrow(/unknown department/i);
  });

  it('throws validation error on unknown office name', () => {
    expect(() => applyJobFilters([makeJob({})], { office: 'NoSuch' }, DEPTS, OFFICES)).toThrow(/unknown office/i);
  });
});

describe('descendantIds', () => {
  it('returns the root and all descendants', () => {
    const nodes = [
      { id: 1, child_ids: [2, 3] },
      { id: 2, child_ids: [4] },
      { id: 3, child_ids: [] },
      { id: 4, child_ids: [] },
    ];
    expect([...descendantIds(nodes, 1)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('returns only the root if it has no children', () => {
    expect([...descendantIds([{ id: 5, child_ids: [] }], 5)]).toEqual([5]);
  });
});
