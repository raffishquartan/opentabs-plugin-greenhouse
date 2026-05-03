// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  ToolError: {
    validation: (msg: string) => new Error(msg),
  },
}));

import { applyJobFilters } from './filters.js';
import type { ScrapedDepartment, ScrapedJob } from './scrape.js';

const departments: ScrapedDepartment[] = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Sales' },
  { id: 3, name: 'Marketing' },
];

function job(overrides: Partial<ScrapedJob>): ScrapedJob {
  return {
    id: 1,
    title: 'Software Engineer',
    location: 'London, UK',
    absolute_url: 'https://example.com/jobs/1',
    updated_at: '2026-04-01T00:00:00Z',
    published_at: '2026-03-01T00:00:00Z',
    requisition_id: null,
    internal_job_id: null,
    is_featured: false,
    department: { id: 1, name: 'Engineering' },
    ...overrides,
  };
}

describe('applyJobFilters', () => {
  const baseJobs: ScrapedJob[] = [
    job({ id: 1, title: 'Software Engineer', department: { id: 1, name: 'Engineering' } }),
    job({ id: 2, title: 'Account Executive', department: { id: 2, name: 'Sales' } }),
    job({ id: 3, title: 'Designer', department: null }),
    job({ id: 4, title: 'Senior Engineer', location: 'Remote - EU', department: { id: 1, name: 'Engineering' } }),
  ];

  it('returns input unchanged when no filters set', () => {
    expect(applyJobFilters(baseJobs, {}, departments)).toEqual(baseJobs);
  });

  it('filters by department name (case-insensitive)', () => {
    const out = applyJobFilters(baseJobs, { department: 'engineering' }, departments);
    expect(out.map(j => j.id)).toEqual([1, 4]);
  });

  it('filters by department id', () => {
    const out = applyJobFilters(baseJobs, { department: 2 }, departments);
    expect(out.map(j => j.id)).toEqual([2]);
  });

  it('throws a clear error for unknown department name listing all available', () => {
    expect(() => applyJobFilters(baseJobs, { department: 'NotAReal' }, departments)).toThrow(
      /Unknown department 'NotAReal'.*Engineering, Sales, Marketing/,
    );
  });

  it('throws a clear error for unknown department id listing all available', () => {
    expect(() => applyJobFilters(baseJobs, { department: 999 }, departments)).toThrow(/Unknown department id 999/);
  });

  it('filters by title_contains case-insensitively', () => {
    const out = applyJobFilters(baseJobs, { title_contains: 'engineer' }, departments);
    expect(out.map(j => j.id)).toEqual([1, 4]);
  });

  it('filters by location_contains case-insensitively', () => {
    const out = applyJobFilters(baseJobs, { location_contains: 'remote' }, departments);
    expect(out.map(j => j.id)).toEqual([4]);
  });

  it('filters by updated_after using lexicographic ISO ordering', () => {
    const jobs: ScrapedJob[] = [
      job({ id: 1, updated_at: '2026-01-01T00:00:00Z' }),
      job({ id: 2, updated_at: '2026-06-01T00:00:00Z' }),
    ];
    const out = applyJobFilters(jobs, { updated_after: '2026-03-01T00:00:00Z' }, departments);
    expect(out.map(j => j.id)).toEqual([2]);
  });

  it('combines multiple filters (AND semantics)', () => {
    const out = applyJobFilters(
      baseJobs,
      { department: 'Engineering', title_contains: 'senior' },
      departments,
    );
    expect(out.map(j => j.id)).toEqual([4]);
  });

  it('returns no jobs when filtering on a department that no current job has', () => {
    const out = applyJobFilters(baseJobs, { department: 3 }, departments);
    expect(out).toEqual([]);
  });
});
