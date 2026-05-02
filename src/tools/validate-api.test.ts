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
import departmentsFixture from '../fixtures/departments.json' with { type: 'json' };
import officesFixture from '../fixtures/offices.json' with { type: 'json' };
import { runValidateApi } from './validate-api.js';

describe('runValidateApi', () => {
  it('reports ok when all three endpoints parse cleanly', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/departments')) return new Response(JSON.stringify(departmentsFixture), { status: 200 });
      if (url.endsWith('/offices')) return new Response(JSON.stringify(officesFixture), { status: 200 });
      return new Response(JSON.stringify(jobsFixture), { status: 200 });
    });
    const result = await runValidateApi({ board: 'airbnb' }, { fetchImpl });
    expect(result.board).toBe('airbnb');
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(3);
    for (const check of result.checks) {
      expect(check.ok).toBe(true);
      expect(check.error).toBeNull();
    }
  });

  it('reports a per-endpoint failure when one endpoint returns bad shape', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/departments')) return new Response(JSON.stringify(departmentsFixture), { status: 200 });
      if (url.endsWith('/offices')) {
        // wrong shape
        return new Response(JSON.stringify({ unexpected: true }), { status: 200 });
      }
      return new Response(JSON.stringify(jobsFixture), { status: 200 });
    });
    const result = await runValidateApi({ board: 'airbnb' }, { fetchImpl });
    expect(result.ok).toBe(false);
    const officesCheck = result.checks.find(c => c.endpoint === '/offices');
    expect(officesCheck?.ok).toBe(false);
    expect(officesCheck?.error).toMatch(/contract drift/i);
  });

  it('reports failure when API returns 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));
    const result = await runValidateApi({ board: 'does-not-exist' }, { fetchImpl });
    expect(result.ok).toBe(false);
    for (const check of result.checks) {
      expect(check.ok).toBe(false);
    }
  });
});
