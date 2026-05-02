// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { fetchDepartments } from '../api.js';
import type { FetchLike } from '../api.js';
import { resolveBoardToken } from '../board.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

const DeptSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable(),
  child_ids: z.array(z.number()),
  jobs_count: z.number().describe('Number of jobs directly attributed to this department in the API response.'),
});

const OutputSchema = z.object({
  board: z.string(),
  departments: z.array(DeptSummarySchema),
});

export type ListDepartmentsInput = z.infer<typeof InputSchema>;
export type ListDepartmentsOutput = z.infer<typeof OutputSchema>;

export interface ListDepartmentsDeps {
  fetchImpl?: FetchLike;
  currentUrl?: string;
}

export async function runListDepartments(
  input: ListDepartmentsInput,
  deps: ListDepartmentsDeps = {},
): Promise<ListDepartmentsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const data = await fetchDepartments(token, deps.fetchImpl);
  return {
    board: token,
    departments: data.departments.map(d => ({
      id: d.id,
      name: d.name,
      parent_id: d.parent_id,
      child_ids: d.child_ids,
      jobs_count: d.jobs?.length ?? 0,
    })),
  };
}

export const listDepartments = defineTool({
  name: 'list_departments',
  displayName: 'List Departments',
  description:
    'Return the department taxonomy for a Greenhouse public job board, including parent/child relationships. Useful for discovering valid department filters before calling list_jobs.',
  icon: 'folder-tree',
  group: 'Taxonomy',
  input: InputSchema,
  output: OutputSchema,
  async handle(input) {
    return runListDepartments(input, {
      currentUrl: typeof globalThis !== 'undefined' ? globalThis.location?.href : undefined,
    });
  },
});
