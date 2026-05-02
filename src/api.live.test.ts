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
  it('fetches and parses /jobs', { timeout: 30_000 }, async () => {
    const result = await fetchJobs(LIVE_BOARD);
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(typeof result.meta.total).toBe('number');
  });

  it('fetches and parses /departments', { timeout: 30_000 }, async () => {
    const result = await fetchDepartments(LIVE_BOARD);
    expect(result.departments.length).toBeGreaterThan(0);
  });

  it('fetches and parses /offices', { timeout: 30_000 }, async () => {
    const result = await fetchOffices(LIVE_BOARD);
    expect(result.offices.length).toBeGreaterThan(0);
  });
});
