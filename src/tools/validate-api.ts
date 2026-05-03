// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, fetchBoard, fetchJob } from '../scrape.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
});

const CheckSchema = z.object({
  endpoint: z.string(),
  ok: z.boolean(),
  error: z.string().nullable(),
});

const OutputSchema = z.object({
  board: z.string(),
  ok: z.boolean().describe('True only if every check is ok.'),
  checks: z.array(CheckSchema),
});

export type ValidateApiInput = z.infer<typeof InputSchema>;
export type ValidateApiOutput = z.infer<typeof OutputSchema>;

export interface ValidateApiDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

export async function runValidateApi(input: ValidateApiInput, deps: ValidateApiDeps = {}): Promise<ValidateApiOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });

  let boardCheck: { endpoint: string; ok: boolean; error: string | null };
  let firstJobId: number | undefined;
  try {
    const board = await fetchBoard(token, { fetchText: deps.fetchText, host });
    if (board.jobs.length === 0) {
      boardCheck = { endpoint: '/board', ok: false, error: 'board page parsed but contained no jobs' };
    } else {
      boardCheck = { endpoint: '/board', ok: true, error: null };
      firstJobId = board.jobs[0]?.id;
    }
  } catch (err) {
    boardCheck = { endpoint: '/board', ok: false, error: (err as Error).message };
  }

  let jobCheck: { endpoint: string; ok: boolean; error: string | null };
  if (firstJobId === undefined) {
    jobCheck = { endpoint: '/job', ok: false, error: 'skipped: board probe did not yield a job id' };
  } else {
    try {
      const job = await fetchJob(token, firstJobId, { fetchText: deps.fetchText, host });
      jobCheck =
        job.content.length > 0
          ? { endpoint: '/job', ok: true, error: null }
          : { endpoint: '/job', ok: false, error: 'job page parsed but content was empty' };
    } catch (err) {
      jobCheck = { endpoint: '/job', ok: false, error: (err as Error).message };
    }
  }

  const checks = [boardCheck, jobCheck];
  return {
    board: token,
    ok: checks.every(c => c.ok),
    checks,
  };
}

export const validateApi = defineTool({
  name: 'validate_api',
  displayName: 'Validate Greenhouse Scrape',
  description:
    'Probe the Greenhouse same-origin scrape path: fetch the board index page and one per-job page, asserting both parse cleanly via the embedded Remix state. Returns ok=true only if both checks pass. Use as a fail-fast diagnostic when the plugin starts producing odd results.',
  icon: 'shield-check',
  group: 'Diagnostics',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runValidateApi(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
