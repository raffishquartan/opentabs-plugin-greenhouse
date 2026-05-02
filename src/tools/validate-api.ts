// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchDepartments, fetchJobs, fetchOffices } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';

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
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

interface Probe {
  endpoint: string;
  run: () => Promise<unknown>;
}

export async function runValidateApi(
  input: ValidateApiInput,
  deps: ValidateApiDeps = {},
): Promise<ValidateApiOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const probes: Probe[] = [
    { endpoint: '/jobs', run: () => fetchJobs(token, deps.fetchImpl) },
    { endpoint: '/departments', run: () => fetchDepartments(token, deps.fetchImpl) },
    { endpoint: '/offices', run: () => fetchOffices(token, deps.fetchImpl) },
  ];
  const checks = await Promise.all(
    probes.map(async p => {
      try {
        await p.run();
        return { endpoint: p.endpoint, ok: true, error: null };
      } catch (err) {
        return { endpoint: p.endpoint, ok: false, error: (err as Error).message };
      }
    }),
  );
  return {
    board: token,
    ok: checks.every(c => c.ok),
    checks,
  };
}

export const validateApi = defineTool({
  name: 'validate_api',
  displayName: 'Validate Greenhouse API',
  description:
    'Probe the three Greenhouse Job Board endpoints (/jobs, /departments, /offices) for the resolved board and verify each response parses against the expected schema. Returns ok=true only if every endpoint is healthy and contract-clean. Useful as a fail-fast diagnostic when the plugin starts producing odd results.',
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
