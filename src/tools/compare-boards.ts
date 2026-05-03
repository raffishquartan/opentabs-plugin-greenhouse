// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { ToolError, defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { applyJobFilters } from '../filters.js';
import { type FetchTextLike, type ScrapedJob, fetchAllBoardData } from '../scrape.js';

const InputSchema = z.object({
  boards: z
    .array(z.string())
    .describe('Array of board tokens or full job-board URLs (mixed allowed). Each is queried independently.'),
  department: z.union([z.string(), z.number()]).optional(),
  location_contains: z.string().optional(),
  title_contains: z.string().optional(),
  updated_after: z.string().optional(),
});

const SummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.string(),
  department: z.object({ id: z.number(), name: z.string() }).nullable(),
  absolute_url: z.string(),
  updated_at: z.string(),
  published_at: z.string(),
});

const BoardResultSchema = z.object({
  board: z.string(),
  ok: z.boolean(),
  total: z.number().optional(),
  jobs: z.array(SummarySchema).optional(),
  error: z.string().optional(),
});

const OutputSchema = z.object({
  total_across_boards: z.number(),
  boards: z.array(BoardResultSchema),
});

export type CompareBoardsInput = z.infer<typeof InputSchema>;
export type CompareBoardsOutput = z.infer<typeof OutputSchema>;

export interface CompareBoardsDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

function summarise(jobs: ScrapedJob[]): z.infer<typeof SummarySchema>[] {
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

async function runOneBoard(
  boardArg: string,
  filters: Omit<CompareBoardsInput, 'boards'>,
  deps: CompareBoardsDeps,
): Promise<z.infer<typeof BoardResultSchema>> {
  let token = boardArg;
  try {
    token = resolveBoardToken({ board: boardArg, currentUrl: deps.currentUrl });
    const host = resolveBoardHost({ board: boardArg, currentUrl: deps.currentUrl });
    const { jobs, departments } = await fetchAllBoardData(token, { fetchText: deps.fetchText, host });
    const filtered = applyJobFilters(jobs, filters, departments);
    return {
      board: token,
      ok: true,
      total: filtered.length,
      jobs: summarise(filtered),
    };
  } catch (err) {
    return {
      board: token,
      ok: false,
      error: (err as Error).message,
    };
  }
}

export async function runCompareBoards(
  input: CompareBoardsInput,
  deps: CompareBoardsDeps = {},
): Promise<CompareBoardsOutput> {
  if (input.boards.length === 0) {
    throw ToolError.validation('compare_boards requires at least one board in `boards`');
  }
  const { boards, ...filters } = input;
  const results = await Promise.all(boards.map(b => runOneBoard(b, filters, deps)));
  const total = results.reduce((sum, r) => sum + (r.total ?? 0), 0);
  return {
    total_across_boards: total,
    boards: results,
  };
}

export const compareBoards = defineTool({
  name: 'compare_boards',
  displayName: 'Compare Boards',
  description:
    'Sweep the same filter across multiple Greenhouse public job boards in one call. Each board is queried independently in parallel; per-board success or failure is reported individually so one bad board token does not fail the whole call. Note: cross-host scraping is blocked by page CSP, so calling from a US-host tab against an EU-only board (or vice versa) will surface a per-board error.',
  icon: 'columns',
  group: 'Jobs',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runCompareBoards(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
