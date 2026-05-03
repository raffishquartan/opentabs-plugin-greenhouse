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
  /**
   * "host_mismatch" means the fetch returned 404 from the host we tried — the
   * board likely lives on a different Greenhouse region (US vs EU). The
   * calling agent should open a tab on one of the other known hosts and
   * re-issue the call with that tab's tabId, OR call list_jobs / etc.
   * directly against that tab.
   */
  failure_reason: z.enum(['host_mismatch', 'not_found', 'invalid_input', 'other']).optional(),
  attempted_host: z.string().optional(),
  suggested_hosts: z.array(z.string()).optional(),
});

const OutputSchema = z.object({
  total_across_boards: z.number(),
  boards: z.array(BoardResultSchema),
  /**
   * Set when at least one board failed in a way the calling agent can recover
   * from by opening a different tab. Contains a single human/agent-readable
   * sentence describing the next step. Null when no recoverable failures.
   */
  cross_host_hint: z.string().nullable(),
});

export type CompareBoardsInput = z.infer<typeof InputSchema>;
export type CompareBoardsOutput = z.infer<typeof OutputSchema>;
export type BoardResult = z.infer<typeof BoardResultSchema>;

export interface CompareBoardsDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

const KNOWN_HOSTS = [
  'https://boards.greenhouse.io',
  'https://job-boards.greenhouse.io',
  'https://job-boards.eu.greenhouse.io',
];

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

function classifyError(message: string): BoardResult['failure_reason'] {
  if (/HTTP 404/i.test(message)) return 'host_mismatch';
  if (/not found|404/i.test(message)) return 'not_found';
  if (/invalid|unknown/i.test(message)) return 'invalid_input';
  return 'other';
}

async function runOneBoard(
  boardArg: string,
  filters: Omit<CompareBoardsInput, 'boards'>,
  deps: CompareBoardsDeps,
): Promise<BoardResult> {
  let token = boardArg;
  let host: string | undefined;
  try {
    token = resolveBoardToken({ board: boardArg, currentUrl: deps.currentUrl });
    host = resolveBoardHost({ board: boardArg, currentUrl: deps.currentUrl });
    const { jobs, departments } = await fetchAllBoardData(token, { fetchText: deps.fetchText, host });
    const filtered = applyJobFilters(jobs, filters, departments);
    return {
      board: token,
      ok: true,
      total: filtered.length,
      jobs: summarise(filtered),
    };
  } catch (err) {
    const rawMessage = (err as Error).message;
    const reason = classifyError(rawMessage);
    const result: BoardResult = {
      board: token,
      ok: false,
      error: rawMessage,
      failure_reason: reason,
    };
    if (reason === 'host_mismatch' && host) {
      result.attempted_host = host;
      result.suggested_hosts = KNOWN_HOSTS.filter(h => h !== host);
      result.error = `${rawMessage}\n\nThis 404 from ${host} usually means the board is on a different Greenhouse region. Open a tab on one of: ${result.suggested_hosts.join(', ')} and re-call with that tab's tabId.`;
    }
    return result;
  }
}

function buildCrossHostHint(results: BoardResult[]): string | null {
  const mismatched = results.filter(r => r.failure_reason === 'host_mismatch');
  if (mismatched.length === 0) return null;
  const boards = mismatched.map(r => r.board).join(', ');
  const suggested = new Set<string>();
  for (const r of mismatched) {
    for (const h of r.suggested_hosts ?? []) suggested.add(h);
  }
  return (
    `${mismatched.length} board(s) (${boards}) likely live on a different Greenhouse region than the active tab. ` +
    `Open a tab on one of: ${[...suggested].join(', ')} and re-call compare_boards (or call list_jobs per board) with the new tabId.`
  );
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
    cross_host_hint: buildCrossHostHint(results),
  };
}

export const compareBoards = defineTool({
  name: 'compare_boards',
  displayName: 'Compare Boards',
  description:
    'Sweep the same filter across multiple Greenhouse public job boards in one call. Each board is queried independently in parallel; per-board success or failure is reported individually. Cross-host scraping is blocked by page CSP, so calling from a US-host tab against an EU-only board (or vice versa) will surface a per-board host_mismatch failure_reason - check the top-level cross_host_hint for the next step.',
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
