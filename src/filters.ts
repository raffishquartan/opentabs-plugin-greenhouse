// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { ToolError } from '@opentabs-dev/plugin-sdk';
import type { Department, Job, Office } from './api.js';

export interface JobFilters {
  department?: string | number;
  office?: string | number;
  location_contains?: string;
  title_contains?: string;
  updated_after?: string;
}

interface TreeNode {
  id: number;
  name: string;
  child_ids: number[];
}

export function descendantIds(nodes: Array<{ id: number; child_ids: number[] }>, rootId: number): Set<number> {
  const byId = new Map<number, { id: number; child_ids: number[] }>();
  for (const n of nodes) byId.set(n.id, n);
  const out = new Set<number>();
  const stack = [rootId];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || out.has(next)) continue;
    out.add(next);
    const node = byId.get(next);
    if (node) for (const c of node.child_ids) stack.push(c);
  }
  return out;
}

function findNode(nodes: TreeNode[], match: string | number, kind: 'department' | 'office'): TreeNode {
  if (typeof match === 'number') {
    const found = nodes.find(n => n.id === match);
    if (!found) {
      throw ToolError.validation(
        `Unknown ${kind} id ${match}. Available ids: ${nodes.map(n => n.id).join(', ')}`,
      );
    }
    return found;
  }
  const lc = match.toLowerCase();
  const found = nodes.find(n => n.name.toLowerCase() === lc);
  if (!found) {
    throw ToolError.validation(
      `Unknown ${kind} '${match}'. Available: ${nodes.map(n => n.name).join(', ')}`,
    );
  }
  return found;
}

export function applyJobFilters(jobs: Job[], filters: JobFilters, depts: Department[], offices: Office[]): Job[] {
  let out = jobs;

  if (filters.department !== undefined) {
    const root = findNode(depts, filters.department, 'department');
    const allow = descendantIds(depts, root.id);
    out = out.filter(j => j.departments.some(d => allow.has(d.id)));
  }

  if (filters.office !== undefined) {
    const root = findNode(offices, filters.office, 'office');
    const allow = descendantIds(offices, root.id);
    out = out.filter(j => j.offices.some(o => allow.has(o.id)));
  }

  if (filters.location_contains) {
    const lc = filters.location_contains.toLowerCase();
    out = out.filter(j => j.location.name.toLowerCase().includes(lc));
  }

  if (filters.title_contains) {
    const lc = filters.title_contains.toLowerCase();
    out = out.filter(j => j.title.toLowerCase().includes(lc));
  }

  if (filters.updated_after) {
    const cutoff = filters.updated_after;
    out = out.filter(j => j.updated_at >= cutoff);
  }

  return out;
}
