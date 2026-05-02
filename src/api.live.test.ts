// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Live-API smoke test. Disabled by default to keep the unit-test run offline
// and deterministic. Enable with: LIVE_API=1 npm test
// Hits the public Greenhouse Job Board API for the well-known `airbnb` board
// and confirms each endpoint parses end-to-end.

import { describe, it, expect } from 'vitest';
import { fetchDepartments, fetchJobs, fetchOffices } from './api.js';

const LIVE_BOARD = process.env.LIVE_API_BOARD || 'airbnb';
const enabled = process.env.LIVE_API === '1';

describe.runIf(enabled)('live Greenhouse API smoke test', () => {
  it('fetches and parses /jobs with required fields populated', { timeout: 30_000 }, async () => {
    const result = await fetchJobs(LIVE_BOARD);
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(typeof result.meta.total).toBe('number');
    const first = result.jobs[0];
    // Field-level smoke-checks beyond the Zod schema: catch the case where
    // Greenhouse changes a field to always-empty without changing its type.
    expect(first?.title.length).toBeGreaterThan(0);
    expect(first?.location.name.length).toBeGreaterThan(0);
    expect(first?.absolute_url.startsWith('http')).toBe(true);
    expect(first?.first_published.length).toBeGreaterThan(0);
  });

  it('fetches and parses /departments with hierarchy populated', { timeout: 30_000 }, async () => {
    const result = await fetchDepartments(LIVE_BOARD);
    expect(result.departments.length).toBeGreaterThan(0);
    expect(result.departments[0]?.name.length).toBeGreaterThan(0);
    // Some department somewhere has a parent or a child - confirms the
    // hierarchy fields are still present and meaningful.
    const hasHierarchy = result.departments.some(d => d.parent_id !== null || d.child_ids.length > 0);
    expect(hasHierarchy).toBe(true);
  });

  it('fetches and parses /offices with hierarchy populated', { timeout: 30_000 }, async () => {
    const result = await fetchOffices(LIVE_BOARD);
    expect(result.offices.length).toBeGreaterThan(0);
    expect(result.offices[0]?.name.length).toBeGreaterThan(0);
    const hasHierarchy = result.offices.some(o => o.parent_id !== null || o.child_ids.length > 0);
    expect(hasHierarchy).toBe(true);
  });
});
