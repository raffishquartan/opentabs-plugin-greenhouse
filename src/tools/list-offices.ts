// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, fetchBoard } from '../scrape.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

type OfficeSummary = {
  id: number;
  name: string;
  children: OfficeSummary[];
};

const OfficeSummarySchema: z.ZodType<OfficeSummary> = z.lazy(() =>
  z.object({
    id: z.number(),
    name: z.string(),
    children: z.array(OfficeSummarySchema),
  }),
);

const OutputSchema = z.object({
  board: z.string(),
  offices: z.array(OfficeSummarySchema),
});

export type ListOfficesInput = z.infer<typeof InputSchema>;
export type ListOfficesOutput = z.infer<typeof OutputSchema>;

export interface ListOfficesDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

export async function runListOffices(input: ListOfficesInput, deps: ListOfficesDeps = {}): Promise<ListOfficesOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const board = await fetchBoard(token, { fetchText: deps.fetchText, host });
  return { board: token, offices: board.offices };
}

export const listOffices = defineTool({
  name: 'list_offices',
  displayName: 'List Offices',
  description:
    'Return the office taxonomy for a Greenhouse public job board, with hierarchy as nested `children`. Useful for understanding where the company hires.',
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
