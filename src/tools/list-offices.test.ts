// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runListOffices } from './list-offices.js';

const physicsxBoardHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'),
  'utf8',
);

describe('runListOffices', () => {
  it('returns the office taxonomy preserving the nested children hierarchy', async () => {
    const result = await runListOffices(
      { board: 'physicsx' },
      { fetchText: async () => physicsxBoardHtml },
    );
    expect(result.board).toBe('physicsx');
    expect(result.offices).toEqual([
      { id: 4036123101, name: 'Singapore', children: [] },
      {
        id: 4024607101,
        name: 'UK',
        children: [{ id: 4024608101, name: 'London', children: [] }],
      },
      {
        id: 4024609101,
        name: 'USA',
        children: [{ id: 4024610101, name: 'New York', children: [] }],
      },
    ]);
  });
});
