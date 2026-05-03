// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, type ScrapedJob, fetchBoard } from '../scrape.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
  since: z.string().optional().describe('ISO-8601 timestamp; only jobs with published_at >= this value are returned.'),
  limit: z.number().int().positive().max(500).optional().describe('Maximum number of jobs to return. Defaults to all.'),
});

const SummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  department: z.object({ id: z.number(), name: z.string() }).nullable(),
  absolute_url: z.string(),
  published_at: z.string(),
  updated_at: z.string(),
});

const OutputSchema = z.object({
  board: z.string(),
  total: z.number(),
  jobs: z.array(SummarySchema),
});

export type RecentJobsInput = z.infer<typeof InputSchema>;
export type RecentJobsOutput = z.infer<typeof OutputSchema>;

export interface RecentJobsDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

async function fetchAllJobs(token: string, deps: RecentJobsDeps, host: string): Promise<ScrapedJob[]> {
  const first = await fetchBoard(token, { fetchText: deps.fetchText, host, page: 1 });
  const all: ScrapedJob[] = [...first.jobs];
  if (first.totalPages > 1) {
    const more = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_unused, i) =>
        fetchBoard(token, { fetchText: deps.fetchText, host, page: i + 2 }),
      ),
    );
    for (const p of more) all.push(...p.jobs);
  }
  return all;
}

export async function runRecentJobs(input: RecentJobsInput, deps: RecentJobsDeps = {}): Promise<RecentJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const allJobs = await fetchAllJobs(token, deps, host);
  let jobs = [...allJobs].sort((a, b) =>
    a.published_at > b.published_at ? -1 : a.published_at < b.published_at ? 1 : 0,
  );
  if (input.since) {
    const cutoff = input.since;
    jobs = jobs.filter(j => j.published_at >= cutoff);
  }
  if (input.limit !== undefined) {
    jobs = jobs.slice(0, input.limit);
  }
  return {
    board: token,
    total: jobs.length,
    jobs: jobs.map(j => ({
      id: j.id,
      title: j.title,
      location: j.location,
      department: j.department,
      absolute_url: j.absolute_url,
      published_at: j.published_at,
      updated_at: j.updated_at,
    })),
  };
}

export const recentJobs = defineTool({
  name: 'recent_jobs',
  displayName: 'Recent Jobs',
  description:
    'Return the most recently published jobs on a Greenhouse public job board, sorted by published_at descending. Optional `since` (ISO timestamp) and `limit`. Useful for checking what is new at a target company since the last sweep.',
  icon: 'clock',
  group: 'Jobs',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runRecentJobs(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
