// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

import jobsFixture from './fixtures/jobs.json' with { type: 'json' };
import { __clearApiCache, fetchJobs } from './api.js';

// `new Response(..., { status: 304 })` is forbidden by the spec (null-body
// status). Build a minimal Response-shaped stand-in for tests.
function notModifiedResponse(): Response {
  return {
    status: 304,
    ok: false,
    statusText: 'Not Modified',
    headers: new Headers(),
    text: async () => '',
    json: async () => null,
  } as unknown as Response;
}

beforeEach(() => {
  __clearApiCache();
});

describe('api response cache (revalidation-based)', () => {
  it('caches a 200 response with its ETag and Last-Modified', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(jobsFixture), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"abc"', 'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT' },
      }),
    );
    await fetchJobs('airbnb', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const initOnFirstCall = fetchImpl.mock.calls[0]?.[1];
    expect(initOnFirstCall?.headers).toBeUndefined();
  });

  it('sends If-None-Match on a second call and returns cached body on 304', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(jobsFixture), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            etag: '"abc"',
            'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
          },
        }),
      )
      .mockResolvedValueOnce(notModifiedResponse());

    const first = await fetchJobs('airbnb', fetchImpl);
    const second = await fetchJobs('airbnb', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondInit = fetchImpl.mock.calls[1]?.[1];
    const headers = new Headers(secondInit?.headers);
    expect(headers.get('If-None-Match')).toBe('"abc"');
    expect(headers.get('If-Modified-Since')).toBe('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(second).toEqual(first);
  });

  it('replaces cache when the body changes', async () => {
    const updated = { ...jobsFixture, meta: { total: 99 } };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(jobsFixture), { status: 200, headers: { etag: '"v1"' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(updated), { status: 200, headers: { etag: '"v2"' } }));

    const first = await fetchJobs('airbnb', fetchImpl);
    const second = await fetchJobs('airbnb', fetchImpl);
    expect(first.meta.total).toBe(5);
    expect(second.meta.total).toBe(99);
  });

  it('cacheBypass=true skips conditional headers and always re-fetches', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(jobsFixture), { status: 200, headers: { etag: '"abc"' } }),
    );
    await fetchJobs('airbnb', fetchImpl);
    await fetchJobs('airbnb', fetchImpl, true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondInit = fetchImpl.mock.calls[1]?.[1];
    const headers = new Headers(secondInit?.headers);
    expect(headers.get('If-None-Match')).toBeNull();
  });

  it('does not poison the cache on error responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(jobsFixture), { status: 200, headers: { etag: '"abc"' } }),
      );
    await expect(fetchJobs('airbnb', fetchImpl)).rejects.toThrow(/500/);
    const result = await fetchJobs('airbnb', fetchImpl);
    expect(result.meta.total).toBe(5);
    // second call sent no If-None-Match (cache was empty after the failure)
    const secondInit = fetchImpl.mock.calls[1]?.[1];
    const headers = new Headers(secondInit?.headers);
    expect(headers.get('If-None-Match')).toBeNull();
  });
});
