// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, type ScrapedJob, fetchAllBoardData } from '../scrape.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
});

const FacetEntrySchema = z.object({ name: z.string(), count: z.number() });

const OutputSchema = z.object({
  board: z.string(),
  total: z.number(),
  by_department: z.array(FacetEntrySchema),
  by_location: z.array(FacetEntrySchema),
});

export type SummaryInput = z.infer<typeof InputSchema>;
export type SummaryOutput = z.infer<typeof OutputSchema>;

export interface SummaryDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

function tally(jobs: ScrapedJob[], pick: (j: ScrapedJob) => string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    for (const name of pick(j)) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function runSummary(input: SummaryInput, deps: SummaryDeps = {}): Promise<SummaryOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const { jobs } = await fetchAllBoardData(token, { fetchText: deps.fetchText, host });
  return {
    board: token,
    total: jobs.length,
    by_department: tally(jobs, j => (j.department ? [j.department.name] : [])),
    by_location: tally(jobs, j => [j.location]),
  };
}

export const summary = defineTool({
  name: 'summary',
  displayName: 'Board Summary',
  description:
    'Return a one-shot summary of a Greenhouse public job board: total jobs plus counts by department and location. Useful for orienting against a new company in one call.',
  icon: 'pie-chart',
  group: 'Taxonomy',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runSummary(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
