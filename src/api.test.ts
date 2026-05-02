// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

import {
  JobSchema,
  JobsResponseSchema,
  DepartmentsResponseSchema,
  OfficesResponseSchema,
  fetchJobs,
  fetchJob,
  fetchDepartments,
  fetchOffices,
} from './api.js';
import singleJobFixture from './fixtures/job-single.json' with { type: 'json' };
import jobsFixture from './fixtures/jobs.json' with { type: 'json' };
import departmentsFixture from './fixtures/departments.json' with { type: 'json' };
import officesFixture from './fixtures/offices.json' with { type: 'json' };

describe('JobSchema', () => {
  it('parses a real Greenhouse job from the fixture', () => {
    const parsed = JobSchema.parse(singleJobFixture);
    expect(parsed.id).toBe(7649441);
    expect(parsed.title).toBe('Account Executive (12 Month FTC)');
  });

  it('exposes location, offices and departments after parsing', () => {
    const parsed = JobSchema.parse(singleJobFixture);
    expect(parsed.location.name).toBe('Paris, France');
    expect(parsed.offices[0]?.name).toBe('Paris, France');
    expect(parsed.departments[0]?.name).toBe('Sales');
  });

  it('rejects an object missing required fields like location', () => {
    const { location: _ignored, ...broken } = singleJobFixture as { location: unknown; [k: string]: unknown };
    expect(() => JobSchema.parse(broken)).toThrow();
  });

  it('tolerates an unknown extra field via passthrough', () => {
    const augmented = { ...singleJobFixture, future_unknown_field: 'whatever' };
    const parsed = JobSchema.parse(augmented);
    expect((parsed as { future_unknown_field?: string }).future_unknown_field).toBe('whatever');
  });

  it('rejects when a required field has the wrong type', () => {
    const broken = { ...singleJobFixture, id: 'not a number' };
    expect(() => JobSchema.parse(broken)).toThrow();
  });
});

describe('JobsResponseSchema', () => {
  it('parses the live-shape jobs listing fixture', () => {
    const parsed = JobsResponseSchema.parse(jobsFixture);
    expect(parsed.meta.total).toBe(5);
    expect(parsed.jobs.length).toBe(5);
  });
});

describe('DepartmentsResponseSchema', () => {
  it('parses the departments fixture', () => {
    const parsed = DepartmentsResponseSchema.parse(departmentsFixture);
    expect(parsed.departments.length).toBe(5);
    expect(parsed.departments[0]?.name).toBe('1. Technical');
  });
});

describe('OfficesResponseSchema', () => {
  it('parses the offices fixture', () => {
    const parsed = OfficesResponseSchema.parse(officesFixture);
    expect(parsed.offices.length).toBe(5);
    expect(parsed.offices[0]?.name).toBe('AMER');
  });
});

describe('fetchJobs', () => {
  it('hits the boards-api jobs endpoint with content=true and parses the response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(jobsFixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const result = await fetchJobs('airbnb', fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://boards-api.greenhouse.io/v1/boards/airbnb/jobs?content=true');
    expect(result.meta.total).toBe(5);
    expect(result.jobs.length).toBe(5);
  });

  it('throws notFound when API returns 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));
    await expect(fetchJobs('does-not-exist', fetchImpl)).rejects.toThrow(/not found/i);
  });

  it('throws internal on non-2xx other than 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }));
    await expect(fetchJobs('airbnb', fetchImpl)).rejects.toThrow(/500/);
  });

  it('throws contract-drift when response shape is wrong', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ jobs: 'not-an-array', meta: { total: 0 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(fetchJobs('airbnb', fetchImpl)).rejects.toThrow(/contract drift/i);
  });
});

describe('fetchJob', () => {
  it('hits the single-job endpoint and parses', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(singleJobFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const result = await fetchJob('airbnb', 7649441, fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://boards-api.greenhouse.io/v1/boards/airbnb/jobs/7649441');
    expect(result.id).toBe(7649441);
  });
});

describe('fetchDepartments', () => {
  it('hits the departments endpoint and parses', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(departmentsFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const result = await fetchDepartments('airbnb', fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://boards-api.greenhouse.io/v1/boards/airbnb/departments');
    expect(result.departments.length).toBe(5);
  });
});

describe('fetchOffices', () => {
  it('hits the offices endpoint and parses', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(officesFixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const result = await fetchOffices('airbnb', fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://boards-api.greenhouse.io/v1/boards/airbnb/offices');
    expect(result.offices.length).toBe(5);
  });
});
