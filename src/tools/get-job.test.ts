// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runGetJob } from './get-job.js';

const physicsxJobHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-job-4644845101.html'),
  'utf8',
);

describe('runGetJob', () => {
  it('returns the job with content rendered as markdown (no raw HTML or entities)', async () => {
    const result = await runGetJob({ board: 'physicsx', id: 4644845101 }, { fetchText: async () => physicsxJobHtml });
    expect(result.id).toBe(4644845101);
    expect(result.title).toBe('Senior CFD Engineer - Turbomachinery');
    expect(result.company_name).toBe('PhysicsX');
    expect(result.location).toBe('New York, United States');
    expect(result.absolute_url).toBe('https://job-boards.eu.greenhouse.io/physicsx/jobs/4644845101');
    expect(result.published_at.length).toBeGreaterThan(0);
    expect(result.language).toBe('en');
    expect(result.content_markdown.length).toBeGreaterThan(500);
    expect(result.content_markdown).not.toMatch(/<p>/);
    expect(result.content_markdown).not.toMatch(/<div>/);
    expect(result.content_markdown).not.toMatch(/&lt;|&quot;|&nbsp;/);
  });

  it('forwards a 404-style fetch error', async () => {
    await expect(
      runGetJob(
        { board: 'physicsx', id: 1 },
        {
          fetchText: async () => {
            throw new Error('HTTP 404');
          },
        },
      ),
    ).rejects.toThrow('HTTP 404');
  });
});
