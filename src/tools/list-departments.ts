// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { resolveBoardHost, resolveBoardToken } from '../board.js';
import { type FetchTextLike, fetchAllBoardData } from '../scrape.js';

const InputSchema = z.object({
  board: z
    .string()
    .optional()
    .describe('Board token or full job-board URL. Optional - if omitted the board is inferred from the active tab.'),
});

const DeptSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  jobs_count: z
    .number()
    .describe('Number of jobs on the board whose department.id matches this id (across all pages).'),
});

const OutputSchema = z.object({
  board: z.string(),
  departments: z.array(DeptSummarySchema),
});

export type ListDepartmentsInput = z.infer<typeof InputSchema>;
export type ListDepartmentsOutput = z.infer<typeof OutputSchema>;

export interface ListDepartmentsDeps {
  fetchText?: FetchTextLike;
  currentUrl?: string;
}

export async function runListDepartments(
  input: ListDepartmentsInput,
  deps: ListDepartmentsDeps = {},
): Promise<ListDepartmentsOutput> {
  const token = resolveBoardToken({ board: input.board, currentUrl: deps.currentUrl });
  const host = resolveBoardHost({ board: input.board, currentUrl: deps.currentUrl });
  const board = await fetchAllBoardData(token, { fetchText: deps.fetchText, host });
  const counts = new Map<number, number>();
  for (const job of board.jobs) {
    if (job.department) counts.set(job.department.id, (counts.get(job.department.id) ?? 0) + 1);
  }
  return {
    board: token,
    departments: board.departments.map(d => ({
      id: d.id,
      name: d.name,
      jobs_count: counts.get(d.id) ?? 0,
    })),
  };
}

export const listDepartments = defineTool({
  name: 'list_departments',
  displayName: 'List Departments',
  description:
    'Return the department taxonomy for a Greenhouse public job board. Useful for discovering valid department filters before calling list_jobs. Note: the same-origin scraper does not expose parent/child relationships, so departments are returned as a flat list.',
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
