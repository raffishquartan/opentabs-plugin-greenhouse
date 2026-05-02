// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchJobs } from '../api.js';
import type { FetchLike, Job } from '../api.js';
import { resolveBoardToken } from '../board.js';
import { htmlToMarkdown } from '../markdown.js';
import { extractWorkplaceType } from '../metadata.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
  query: z.string().min(1).describe('Search string. Case-insensitive substring match across title, location, departments, offices, and the description body.'),
});

const SearchHitSchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  offices: z.array(z.string()),
  departments: z.array(z.string()),
  absolute_url: z.string(),
  updated_at: z.string(),
  workplace_type: z.string().nullable(),
  matched_in: z.array(z.enum(['title', 'location', 'department', 'office', 'content'])),
});

const OutputSchema = z.object({
  board: z.string(),
  query: z.string(),
  total: z.number(),
  jobs: z.array(SearchHitSchema),
});

export type SearchJobsInput = z.infer<typeof InputSchema>;
export type SearchJobsOutput = z.infer<typeof OutputSchema>;

export interface SearchJobsDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

type MatchField = 'title' | 'location' | 'department' | 'office' | 'content';

function classifyMatches(job: Job, query: string): MatchField[] {
  const matches: MatchField[] = [];
  if (job.title.toLowerCase().includes(query)) matches.push('title');
  if (job.location.name.toLowerCase().includes(query)) matches.push('location');
  if (job.departments.some(d => d.name.toLowerCase().includes(query))) matches.push('department');
  if (job.offices.some(o => o.name.toLowerCase().includes(query))) matches.push('office');
  if (job.content) {
    const md = htmlToMarkdown(job.content).toLowerCase();
    if (md.includes(query)) matches.push('content');
  }
  return matches;
}

export async function runSearchJobs(
  input: SearchJobsInput,
  deps: SearchJobsDeps = {},
): Promise<SearchJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const data = await fetchJobs(token, deps.fetchImpl);
  const q = input.query.toLowerCase();
  const hits: SearchJobsOutput['jobs'] = [];
  for (const job of data.jobs) {
    const matched = classifyMatches(job, q);
    if (matched.length === 0) continue;
    hits.push({
      id: job.id,
      title: job.title,
      location: job.location.name,
      offices: job.offices.map(o => o.name),
      departments: job.departments.map(d => d.name),
      absolute_url: job.absolute_url,
      updated_at: job.updated_at,
      workplace_type: extractWorkplaceType(job),
      matched_in: matched,
    });
  }
  return {
    board: token,
    query: input.query,
    total: hits.length,
    jobs: hits,
  };
}

export const searchJobs = defineTool({
  name: 'search_jobs',
  displayName: 'Search Jobs',
  description:
    'Search across all jobs on a Greenhouse public job board for a substring (case-insensitive). Matches against title, location, department names, office names, and the markdown description body. Reports per-hit which field(s) matched. Use when filter-based list_jobs is too coarse - e.g. searching for "Kubernetes" across all engineering postings.',
  icon: 'search',
  group: 'Jobs',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runSearchJobs(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
