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

import singleJobFixture from '../fixtures/job-single.json' with { type: 'json' };
import { runGetJob } from './get-job.js';

describe('runGetJob', () => {
  it('fetches a single job by id and returns markdown content', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/jobs/7649441')) {
        return new Response(JSON.stringify(singleJobFixture), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    const result = await runGetJob({ board: 'airbnb', id: 7649441 }, { fetchImpl });
    expect(result.id).toBe(7649441);
    expect(result.title).toBe('Account Executive (12 Month FTC)');
    expect(typeof result.content_markdown).toBe('string');
    expect(result.content_markdown.length).toBeGreaterThan(0);
    // Markdown, not raw HTML
    expect(result.content_markdown).not.toContain('<p>');
  });

  it('exposes structured offices, departments and metadata', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(singleJobFixture), { status: 200 }));
    const result = await runGetJob({ board: 'airbnb', id: 7649441 }, { fetchImpl });
    expect(result.offices[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
    expect(result.departments[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
    expect(Array.isArray(result.metadata)).toBe(true);
  });

  it('infers board from currentUrl', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(singleJobFixture), { status: 200 }));
    await runGetJob(
      { id: 7649441 },
      { fetchImpl, currentUrl: 'https://job-boards.eu.greenhouse.io/airbnb/jobs/7649441' },
    );
    expect(fetchImpl).toHaveBeenCalledWith('https://boards-api.greenhouse.io/v1/boards/airbnb/jobs/7649441');
  });
});
