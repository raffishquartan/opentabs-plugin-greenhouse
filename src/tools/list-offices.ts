// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchOffices } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

const OfficeSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  location: z.string().nullable(),
  parent_id: z.number().nullable(),
  child_ids: z.array(z.number()),
});

const OutputSchema = z.object({
  board: z.string(),
  offices: z.array(OfficeSummarySchema),
});

export type ListOfficesInput = z.infer<typeof InputSchema>;
export type ListOfficesOutput = z.infer<typeof OutputSchema>;

export interface ListOfficesDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

export async function runListOffices(
  input: ListOfficesInput,
  deps: ListOfficesDeps = {},
): Promise<ListOfficesOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const data = await fetchOffices(token, deps.fetchImpl);
  return {
    board: token,
    offices: data.offices.map(o => ({
      id: o.id,
      name: o.name,
      location: o.location ?? null,
      parent_id: o.parent_id,
      child_ids: o.child_ids,
    })),
  };
}

export const listOffices = defineTool({
  name: 'list_offices',
  displayName: 'List Offices',
  description:
    'Return the office taxonomy for a Greenhouse public job board, including parent/child relationships. Useful for discovering valid office filters before calling list_jobs (e.g. parent office "EMEA" to scope a search to all European cities).',
  icon: 'building-2',
  group: 'Taxonomy',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runListOffices(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
