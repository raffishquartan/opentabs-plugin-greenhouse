// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { htmlToMarkdown } from '../markdown.js';
import { type FetchTextLike, type ScrapedJob, type ScrapedOffice, fetchBoard, fetchJob } from '../scrape.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
  query: z
    .string()
    .min(1)
    .describe(
      'Search string. Case-insensitive substring match across title, location, departments, offices, and (optionally) the description body.',
    ),
  include_content: z
    .boolean()
    .optional()
    .describe(
      'When true, ALSO fetches each per-job page so the description body is searched. Slow on large boards (one HTTP per job). Default false.',
    ),
});

const SearchHitSchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  department: z.object({ id: z.number(), name: z.string() }).nullable(),
  absolute_url: z.string(),
  updated_at: z.string(),
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
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

type MatchField = 'title' | 'location' | 'department' | 'office' | 'content';

function flattenOffices(offices: ScrapedOffice[]): string[] {
  const out: string[] = [];
  const stack = [...offices];
  while (stack.length > 0) {
    const o = stack.pop();
    if (!o) continue;
    out.push(o.name);
    for (const c of o.children) stack.push(c);
  }
  return out;
}

function classifyShallow(job: ScrapedJob, query: string, officeNames: string[]): MatchField[] {
  const matches: MatchField[] = [];
  if (job.title.toLowerCase().includes(query)) matches.push('title');
  if (job.location.toLowerCase().includes(query)) matches.push('location');
  if (job.department && job.department.name.toLowerCase().includes(query)) matches.push('department');
  if (officeNames.some(n => n.toLowerCase().includes(query))) matches.push('office');
  return matches;
}

async function fetchAllJobs(
  token: string,
  deps: SearchJobsDeps,
  host: string,
): Promise<{ jobs: ScrapedJob[]; offices: ScrapedOffice[] }> {
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
  return { jobs: all, offices: first.offices };
}

export async function runSearchJobs(input: SearchJobsInput, deps: SearchJobsDeps = {}): Promise<SearchJobsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const { jobs, offices } = await fetchAllJobs(token, deps, host);
  const officeNames = flattenOffices(offices);
  const q = input.query.toLowerCase();

  const hits: SearchJobsOutput['jobs'] = [];
  for (const job of jobs) {
    const matched = classifyShallow(job, q, officeNames);
    if (matched.length > 0) {
      hits.push({
        id: job.id,
        title: job.title,
        location: job.location,
        department: job.department,
        absolute_url: job.absolute_url,
        updated_at: job.updated_at,
        matched_in: matched,
      });
    }
  }

  if (input.include_content) {
    const alreadyHit = new Set(hits.map(h => h.id));
    const results = await Promise.all(
      jobs.map(async j => {
        if (alreadyHit.has(j.id)) return null;
        try {
          const full = await fetchJob(token, j.id, { fetchText: deps.fetchText, host });
          const md = htmlToMarkdown(full.content).toLowerCase();
          if (!md.includes(q)) return null;
          return {
            id: j.id,
            title: j.title,
            location: j.location,
            department: j.department,
            absolute_url: j.absolute_url,
            updated_at: j.updated_at,
            matched_in: ['content'] as MatchField[],
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (r) hits.push(r);
    }
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
    'Search across all jobs on a Greenhouse public job board for a substring (case-insensitive). Matches against title, location, department name and office names. Pass include_content=true to additionally search the per-job description body — slow on large boards, off by default.',
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
