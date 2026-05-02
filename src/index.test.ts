// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  OpenTabsPlugin: class {},
  defineTool: (config: unknown) => config,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  ToolError: class extends Error {
    static auth(msg: string) {
      return new this(msg);
    }
    static notFound(msg: string) {
      return new this(msg);
    }
    static validation(msg: string) {
      return new this(msg);
    }
    static internal(msg: string) {
      return new this(msg);
    }
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

  it('exposes list_jobs, get_job, list_departments and list_offices', () => {
    const names = plugin.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('list_jobs');
    expect(names).toContain('get_job');
    expect(names).toContain('list_departments');
    expect(names).toContain('list_offices');
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
