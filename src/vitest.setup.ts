// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

// Global vitest setup. Runs before each test file and ensures the
// process-wide response cache in api.ts is empty so cached fixture data
// from one test does not leak into another.

import { beforeEach } from 'vitest';
import { __clearApiCache } from './api.js';

beforeEach(() => {
  __clearApiCache();
});
