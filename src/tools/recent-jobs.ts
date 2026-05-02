// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchJobs } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';
import { extractWorkplaceType } from '../metadata.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
  since: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp; only jobs with first_published >= this value are returned.'),
  limit: z.number().int().positive().max(500).optional().describe('Maximum number of jobs to return. Defaults to all.'),
});

const SummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  offices: z.array(z.string()),
  departments: z.array(z.string()),
  absolute_url: z.string(),
  first_published: z.string(),
  updated_at: z.string(),
  workplace_type: z.string().nullable(),
});

const OutputSchema = z.object({
  board: z.string(),
  total: z.number(),
  jobs: z.array(SummarySchema),
});

export type RecentJobsInput = z.infer<typeof InputSchema>;
export type RecentJobsOutput = z.infer<typeof OutputSchema>;

export interface RecentJobsDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

export async function runRecentJobs(input: RecentJobsInput, deps: RecentJobsDeps = {}): Promise<RecentJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const data = await fetchJobs(token, deps.fetchImpl);
  let jobs = [...data.jobs].sort((a, b) =>
    a.first_published > b.first_published ? -1 : a.first_published < b.first_published ? 1 : 0,
  );
  if (input.since) {
    const cutoff = input.since;
    jobs = jobs.filter(j => j.first_published >= cutoff);
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
      location: j.location.name,
      offices: j.offices.map(o => o.name),
      departments: j.departments.map(d => d.name),
      absolute_url: j.absolute_url,
      first_published: j.first_published,
      updated_at: j.updated_at,
      workplace_type: extractWorkplaceType(j),
    })),
  };
}

export const recentJobs = defineTool({
  name: 'recent_jobs',
  displayName: 'Recent Jobs',
  description:
    'Return the most recently published jobs on a Greenhouse public job board, sorted by first_published descending. Optional `since` (ISO timestamp) and `limit`. Useful for checking what is new at a target company since the last sweep.',
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
