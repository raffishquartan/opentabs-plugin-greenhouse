// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opentabs-dev/plugin-sdk', () => ({
  defineTool: (config: unknown) => config,
  fetchText: async () => '',
}));

import { runListDepartments } from './list-departments.js';

const physicsxBoardHtml = readFileSync(join(__dirname, '..', 'fixtures', 'scrape', 'physicsx-board.html'), 'utf8');

describe('runListDepartments', () => {
  it('returns the flat department taxonomy with jobs_count populated from job assignments', async () => {
    const result = await runListDepartments({ board: 'physicsx' }, { fetchText: async () => physicsxBoardHtml });
    expect(result.board).toBe('physicsx');
    expect(result.departments.length).toBe(4);
    const names = result.departments.map(d => d.name).sort();
    expect(names).toEqual(['Delivery', 'Operations', 'Product', 'Research']);
    for (const d of result.departments) {
      expect(d.id).toEqual(expect.any(Number));
      expect(d.jobs_count).toBeGreaterThanOrEqual(0);
    }
    const total = result.departments.reduce((s, d) => s + d.jobs_count, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(39);
  });

  it('counts jobs across all pages, not just page 1 (paginated boards)', async () => {
    // Synthesise a 3-page board with department counts spread across pages so a
    // page-1-only count would undercount. Tests the auto-pagination behaviour
    // landed in v0.1.0 (issue 5a).
    const buildPage = (pageNum: number, totalPages: number, totalJobs: number, ids: number[], deptIds: number[]) => {
      const data = ids.map((id, i) => ({
        id,
        title: `Job ${id}`,
        internal_job_id: id,
        updated_at: '2026-05-01T00:00:00Z',
        requisition_id: null,
        location: 'Anywhere',
        absolute_url: `https://job-boards.greenhouse.io/synthetic/jobs/${id}`,
        published_at: '2026-04-01T00:00:00Z',
        department: { id: deptIds[i] ?? 1, name: deptIds[i] === 2 ? 'Sales' : 'Eng', path: [] },
        is_featured: false,
      }));
      const ctx = {
        state: {
          loaderData: {
            'routes/$url_token': {
              urlToken: 'synthetic',
              jobPosts: { count: data.length, page: pageNum, total: totalJobs, total_pages: totalPages, data },
              departments: [
                { id: 1, name: 'Eng' },
                { id: 2, name: 'Sales' },
              ],
              offices: [],
            },
          },
        },
      };
      return `<html><body><script>window.__remixContext = ${JSON.stringify(ctx)};</script></body></html>`;
    };
    const PAGES: Record<number, { ids: number[]; deptIds: number[] }> = {
      1: { ids: [1, 2, 3], deptIds: [1, 1, 1] },
      2: { ids: [4, 5, 6], deptIds: [1, 2, 2] },
      3: { ids: [7, 8], deptIds: [2, 2] },
    };
    const fetchText = async (url: string) => {
      const m = /[?&]page=(\d+)/.exec(url);
      const pageNum = m ? Number(m[1]) : 1;
      const p = PAGES[pageNum] ?? { ids: [], deptIds: [] };
      return buildPage(pageNum, 3, 8, p.ids, p.deptIds);
    };
    const result = await runListDepartments({ board: 'synthetic' }, { fetchText });
    const eng = result.departments.find(d => d.name === 'Eng');
    const sales = result.departments.find(d => d.name === 'Sales');
    // Eng appears 4 times across 3 pages (3+1+0); Sales appears 4 times (0+2+2).
    expect(eng?.jobs_count).toBe(4);
    expect(sales?.jobs_count).toBe(4);
  });

  it('propagates fetch errors', async () => {
    await expect(
      runListDepartments(
        { board: 'physicsx' },
        {
          fetchText: async () => {
            throw new Error('boom');
          },
        },
      ),
    ).rejects.toThrow('boom');
  });
});
