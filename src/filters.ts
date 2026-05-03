// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { ToolError } from '@opentabs-dev/plugin-sdk';
import type { ScrapedDepartment, ScrapedJob } from './scrape.js';

export interface JobFilters {
  department?: string | number;
  location_contains?: string;
  title_contains?: string;
  updated_after?: string;
}

function findDepartment(depts: ScrapedDepartment[], match: string | number): ScrapedDepartment {
  if (typeof match === 'number') {
    const found = depts.find(d => d.id === match);
    if (!found) {
      throw ToolError.validation(`Unknown department id ${match}. Available ids: ${depts.map(d => d.id).join(', ')}`);
    }
    return found;
  }
  const lc = match.toLowerCase();
  const found = depts.find(d => d.name.toLowerCase() === lc);
  if (!found) {
    throw ToolError.validation(`Unknown department '${match}'. Available: ${depts.map(d => d.name).join(', ')}`);
  }
  return found;
}

export function applyJobFilters(jobs: ScrapedJob[], filters: JobFilters, depts: ScrapedDepartment[]): ScrapedJob[] {
  let out = jobs;

  if (filters.department !== undefined) {
    const dept = findDepartment(depts, filters.department);
    out = out.filter(j => j.department?.id === dept.id);
  }

  if (filters.location_contains) {
    const lc = filters.location_contains.toLowerCase();
    out = out.filter(j => j.location.toLowerCase().includes(lc));
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
