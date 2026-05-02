// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  OpenTabsPlugin: class {},
  defineTool: (config: unknown) => config,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  ToolError: {
    auth: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
    internal: (msg: string) => new Error(msg),
  },
}));

const plugin = (await import('./index.js')).default;

describe('GreenhousePlugin', () => {
  it('has the correct name', () => {
    expect(plugin.name).toBe('greenhouse');
  });

  it('has the three known job-board URL patterns', () => {
    expect(plugin.urlPatterns).toEqual(
      expect.arrayContaining([
        '*://boards.greenhouse.io/*',
        '*://job-boards.greenhouse.io/*',
        '*://job-boards.eu.greenhouse.io/*',
      ]),
    );
  });

  it('all tool names are snake_case', () => {
    for (const tool of plugin.tools) {
      expect((tool as { name: string }).name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('exposes the read-only tool surface', () => {
    const names = plugin.tools.map((t: { name: string }) => t.name);
    const expected = [
      'list_jobs',
      'get_job',
      'search_jobs',
      'recent_jobs',
      'summary',
      'compare_boards',
      'list_departments',
      'list_offices',
      'list_locations',
      'list_titles',
      'validate_api',
    ];
    for (const e of expected) {
      expect(names).toContain(e);
    }
    expect(plugin.tools).toHaveLength(11);
  });

  it('no tool name uses a banned write-verb prefix', () => {
    const banned = ['create', 'update', 'delete', 'remove', 'edit', 'modify', 'move', 'rename', 'trash'];
    for (const tool of plugin.tools) {
      const name = (tool as { name: string }).name;
      for (const verb of banned) {
        expect(name.startsWith(verb)).toBe(false);
      }
    }
  });
});
