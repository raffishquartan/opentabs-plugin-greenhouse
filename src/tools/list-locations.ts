// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchJobs } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';

const InputSchema = z.object({
  board: z.string().optional().describe('Board token or full job-board URL. Optional.'),
});

const OutputSchema = z.object({
  board: z.string(),
  locations: z.array(
    z.object({
      name: z.string(),
      count: z.number().describe('Number of jobs whose posted location matches this name.'),
    }),
  ),
});

export type ListLocationsInput = z.infer<typeof InputSchema>;
export type ListLocationsOutput = z.infer<typeof OutputSchema>;

export interface ListLocationsDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

export async function runListLocations(
  input: ListLocationsInput,
  deps: ListLocationsDeps = {},
): Promise<ListLocationsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const data = await fetchJobs(token, deps.fetchImpl);
  const counts = new Map<string, number>();
  for (const job of data.jobs) {
    const name = job.location.name?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const locations = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { board: token, locations };
}

export const listLocations = defineTool({
  name: 'list_locations',
  displayName: 'List Locations',
  description:
    'Return the distinct posted-location strings (e.g. "London, UK", "Remote - Americas") across all jobs on a Greenhouse public job board, with counts. Locations are free-text per-job so this is the only authoritative source. Useful for shaping a location_contains filter on list_jobs.',
  icon: 'map-pin',
  group: 'Taxonomy',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runListLocations(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
