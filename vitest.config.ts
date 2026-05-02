// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
  },
});
