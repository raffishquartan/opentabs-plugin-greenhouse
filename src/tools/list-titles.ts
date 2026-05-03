// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, fetchBoard } from '../scrape.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
});

const OutputSchema = z.object({
  board: z.string(),
  titles: z.array(
    z.object({
      title: z.string(),
      count: z.number(),
    }),
  ),
});

export type ListTitlesInput = z.infer<typeof InputSchema>;
export type ListTitlesOutput = z.infer<typeof OutputSchema>;

export interface ListTitlesDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

export async function runListTitles(input: ListTitlesInput, deps: ListTitlesDeps = {}): Promise<ListTitlesOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const board = await fetchBoard(token, { fetchText: deps.fetchText, host });
  const counts = new Map<string, number>();
  for (const job of board.jobs) {
    const title = job.title?.trim();
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const titles = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { board: token, titles };
}

export const listTitles = defineTool({
  name: 'list_titles',
  displayName: 'List Titles',
  description:
    'Return distinct job titles across all jobs on the first page of a Greenhouse public job board, with counts. Useful for spotting common role families and for shaping a title_contains filter on list_jobs.',
  icon: 'list',
  group: 'Taxonomy',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runListTitles(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
