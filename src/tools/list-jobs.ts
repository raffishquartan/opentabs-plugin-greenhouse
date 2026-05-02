// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchDepartments, fetchJobs, fetchOffices } from '../api.js';
import type { FetchLike, Job } from '../api.js';
import { resolveBoardToken } from '../board.js';
import { applyJobFilters } from '../filters.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe('Board token like "airbnb", or a full URL such as https://job-boards.greenhouse.io/airbnb. Optional - if omitted the board is inferred from the active tab.'),
  department: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Filter by department name (case-insensitive exact) or numeric id. Matches the entity and any descendant departments.'),
  office: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Filter by office name or numeric id. Matches the entity and any descendant offices.'),
  location_contains: z
    .string()
    .optional()
    .describe('Case-insensitive substring filter on the job\'s posted location.'),
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
  offices: z.array(z.string()),
  departments: z.array(z.string()),
  absolute_url: z.string(),
  updated_at: z.string(),
});

const OutputSchema = z.object({
  board: z.string().describe('The resolved board token.'),
  total: z.number().describe('Total matching jobs after filtering.'),
  jobs: z.array(JobSummarySchema),
});

export type ListJobsInput = z.infer<typeof InputSchema>;
export type ListJobsOutput = z.infer<typeof OutputSchema>;

export interface ListJobsDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

function summarise(jobs: Job[]): ListJobsOutput['jobs'] {
  return jobs.map(j => ({
    id: j.id,
    title: j.title,
    location: j.location.name,
    offices: j.offices.map(o => o.name),
    departments: j.departments.map(d => d.name),
    absolute_url: j.absolute_url,
    updated_at: j.updated_at,
  }));
}

export async function runListJobs(input: ListJobsInput, deps: ListJobsDeps = {}): Promise<ListJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const [jobsResponse, departmentsResponse, officesResponse] = await Promise.all([
    fetchJobs(token, deps.fetchImpl),
    fetchDepartments(token, deps.fetchImpl),
    fetchOffices(token, deps.fetchImpl),
  ]);
  const filtered = applyJobFilters(
    jobsResponse.jobs,
    {
      department: input.department,
      office: input.office,
      location_contains: input.location_contains,
      title_contains: input.title_contains,
      updated_after: input.updated_after,
    },
    departmentsResponse.departments,
    officesResponse.offices,
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
    'List jobs on a Greenhouse public job board with optional filters by department (name or id), office (name or id), location substring, title substring, and updated-after timestamp. Returns lightweight summaries (no description body). Department and office filters match the named entity AND any of its descendants.',
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
