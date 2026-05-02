// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchJob } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';
import { htmlToMarkdown } from '../markdown.js';
import { extractSalaryRange, extractWorkplaceType } from '../metadata.js';

const InputSchema = z.object({
  id: z.number().describe('The numeric Greenhouse job id (e.g. 7649441).'),
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

const RefSchema = z.object({ id: z.number(), name: z.string() });

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
  location: z.string(),
  offices: z.array(RefSchema),
  departments: z.array(RefSchema),
  absolute_url: z.string(),
  updated_at: z.string(),
  first_published: z.string(),
  workplace_type: z.string().nullable().describe('Workplace type extracted from metadata, or null if not provided.'),
  salary_range: SalaryRangeSchema.nullable().describe('Best-effort salary range extracted from the description body, or null if absent.'),
  content_markdown: z.string().describe('Job description converted from HTML to markdown.'),
  metadata: z.array(z.unknown()).describe('Greenhouse job metadata fields verbatim from the API.'),
});

export type GetJobInput = z.infer<typeof InputSchema>;
export type GetJobOutput = z.infer<typeof OutputSchema>;

export interface GetJobDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

export async function runGetJob(input: GetJobInput, deps: GetJobDeps = {}): Promise<GetJobOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const job = await fetchJob(token, input.id, deps.fetchImpl);
  return {
    id: job.id,
    title: job.title,
    location: job.location.name,
    offices: job.offices.map(o => ({ id: o.id, name: o.name })),
    departments: job.departments.map(d => ({ id: d.id, name: d.name })),
    absolute_url: job.absolute_url,
    updated_at: job.updated_at,
    first_published: job.first_published,
    workplace_type: extractWorkplaceType(job),
    salary_range: extractSalaryRange(job.content),
    content_markdown: htmlToMarkdown(job.content),
    metadata: job.metadata ?? [],
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
