// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { getJob } from './tools/get-job.js';
import { listDepartments } from './tools/list-departments.js';
import { listJobs } from './tools/list-jobs.js';
import { listLocations } from './tools/list-locations.js';
import { listOffices } from './tools/list-offices.js';
import { listTitles } from './tools/list-titles.js';

class GreenhousePlugin extends OpenTabsPlugin {
  override readonly name = 'greenhouse';
  override readonly displayName = 'Greenhouse';
  override readonly description =
    'List, filter and inspect jobs on any Greenhouse-hosted public job board (boards.greenhouse.io / job-boards.greenhouse.io / job-boards.eu.greenhouse.io).';
  override readonly homepage = 'https://www.greenhouse.io';
  override readonly urlPatterns = [
    '*://boards.greenhouse.io/*',
    '*://job-boards.greenhouse.io/*',
    '*://job-boards.eu.greenhouse.io/*',
  ];

  override readonly tools: ToolDefinition[] = [
    listJobs,
    getJob,
    listDepartments,
    listOffices,
    listLocations,
    listTitles,
  ];

  override async isReady(): Promise<boolean> {
    return true;
  }
}

export default new GreenhousePlugin();
