// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { htmlToMarkdown } from '../markdown.js';
import { extractSalaryRange } from '../metadata.js';
import { type FetchTextLike, fetchJob } from '../scrape.js';

const InputSchema = z.object({
  id: z.number().describe('The numeric Greenhouse job id (e.g. 7649441).'),
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

const SalaryRangeSchema = z.object({
  min: z.string(),
  max: z.string(),
  currency: z.string().nullable(),
  period: z.string().nullable(),
  raw: z.string(),
});

const OutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string(),
  location: z.string(),
  absolute_url: z.string(),
  published_at: z.string(),
  language: z.string(),
  salary_range: SalaryRangeSchema.nullable().describe(
    'Best-effort salary range extracted from the description body, or null if absent.',
  ),
  content_markdown: z.string().describe('Job description converted from HTML to markdown.'),
});

export type GetJobInput = z.infer<typeof InputSchema>;
export type GetJobOutput = z.infer<typeof OutputSchema>;

export interface GetJobDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

export async function runGetJob(input: GetJobInput, deps: GetJobDeps = {}): Promise<GetJobOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const job = await fetchJob(token, input.id, { fetchText: deps.fetchText, host });
  return {
    id: job.id,
    title: job.title,
    company_name: job.company_name,
    location: job.location,
    absolute_url: job.absolute_url,
    published_at: job.published_at,
    language: job.language,
    salary_range: extractSalaryRange(job.content),
    content_markdown: htmlToMarkdown(job.content),
  };
}

export const getJob = defineTool({
  name: 'get_job',
  displayName: 'Get Job',
  description:
    'Return full details for a single Greenhouse job, including the description converted from HTML to markdown. Useful when list_jobs has surfaced an interesting role and you need the full body to summarise or match against context.',
  icon: 'file-text',
  group: 'Jobs',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runGetJob(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
