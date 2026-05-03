// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { applyJobFilters } from '../filters.js';
import { type FetchTextLike, type ScrapedJob, fetchAllBoardData } from '../scrape.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe(
      'Board token like "airbnb", or a full URL such as https://job-boards.greenhouse.io/airbnb. Optional - if omitted the board is inferred from the active tab.',
    ),
  department: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      'Filter by department name (case-insensitive exact) or numeric id. Note: scrape exposes only one department per job, so multi-department jobs will only match one of theirs.',
    ),
  location_contains: z.string().optional().describe("Case-insensitive substring filter on the job's posted location."),
  title_contains: z.string().optional().describe('Case-insensitive substring filter on the job title.'),
  updated_after: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp; only jobs with updated_at >= this value are returned.'),
});

const JobSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  department: z.object({ id: z.number(), name: z.string() }).nullable(),
  absolute_url: z.string(),
  updated_at: z.string(),
  published_at: z.string(),
});

const OutputSchema = z.object({
  board: z.string().describe('The resolved board token.'),
  total: z.number().describe('Total matching jobs after filtering, across all pages fetched.'),
  jobs: z.array(JobSummarySchema),
});

export type ListJobsInput = z.infer<typeof InputSchema>;
export type ListJobsOutput = z.infer<typeof OutputSchema>;

export interface ListJobsDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

function summarise(jobs: ScrapedJob[]): ListJobsOutput['jobs'] {
  return jobs.map(j => ({
    id: j.id,
    title: j.title,
    location: j.location,
    department: j.department,
    absolute_url: j.absolute_url,
    updated_at: j.updated_at,
    published_at: j.published_at,
  }));
}

export async function runListJobs(input: ListJobsInput, deps: ListJobsDeps = {}): Promise<ListJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const { jobs, departments } = await fetchAllBoardData(token, { fetchText: deps.fetchText, host });
  const filtered = applyJobFilters(
    jobs,
    {
      department: input.department,
      location_contains: input.location_contains,
      title_contains: input.title_contains,
      updated_after: input.updated_after,
    },
    departments,
  );
  return {
    board: token,
    total: filtered.length,
    jobs: summarise(filtered),
  };
}

export const listJobs = defineTool({
  name: 'list_jobs',
  displayName: 'List Jobs',
  description:
    'List all jobs on a Greenhouse public job board with optional filters by department, location substring, title substring, and updated-after timestamp. Auto-paginates across pages of 50 jobs. Returns lightweight summaries (no description body); call get_job for the full description.',
  icon: 'briefcase',
  group: 'Jobs',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runListJobs(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
