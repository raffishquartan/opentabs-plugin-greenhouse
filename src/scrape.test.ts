// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchAllBoardData, fetchBoard, fetchJob, parseBoardPage, parseJobPage } from './scrape.js';

const FIXTURE_DIR = join(__dirname, 'fixtures/scrape');
const physicsxBoardHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-board.html'), 'utf8');
const anthropicBoardHtml = readFileSync(join(FIXTURE_DIR, 'anthropic-board.html'), 'utf8');
const physicsxJobHtml = readFileSync(join(FIXTURE_DIR, 'physicsx-job-4644845101.html'), 'utf8');

describe('parseBoardPage', () => {
  it('extracts the job list from the physicsx Remix board page', () => {
    const result = parseBoardPage(physicsxBoardHtml);
    expect(result.board).toBe('physicsx');
    expect(result.total).toBe(39);
    expect(result.jobs).toHaveLength(39);
  });

  it('extracts the department taxonomy from physicsx', () => {
    const { departments } = parseBoardPage(physicsxBoardHtml);
    expect(departments).toEqual([
      { id: 4044431101, name: 'Delivery' },
      { id: 4044434101, name: 'Operations' },
      { id: 4044432101, name: 'Product' },
      { id: 4044433101, name: 'Research' },
    ]);
  });

  it('preserves per-job fields needed downstream (id, title, location, department, urls, dates)', () => {
    const { jobs } = parseBoardPage(physicsxBoardHtml);
    const dataScientist = jobs.find(j => j.title === 'Data Scientist / Algorithm Engineer');
    expect(dataScientist).toBeDefined();
    expect(dataScientist).toMatchObject({
      id: 4749980101,
      title: 'Data Scientist / Algorithm Engineer',
      location: 'Singapore',
      absolute_url: 'https://job-boards.eu.greenhouse.io/physicsx/jobs/4749980101',
      published_at: '2026-01-11T17:15:34-05:00',
      updated_at: '2026-05-02T03:58:14-04:00',
      requisition_id: null,
      internal_job_id: 4413841101,
      is_featured: false,
      department: { id: 4044431101, name: 'Delivery' },
    });
  });

  it('parses a US-host (job-boards.greenhouse.io) board the same way', () => {
    const result = parseBoardPage(anthropicBoardHtml);
    expect(result.board).toBe('anthropic');
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0]?.absolute_url).toMatch(/^https:\/\/job-boards\.greenhouse\.io\/anthropic\/jobs\/\d+$/);
  });

  it('exposes pagination state when total exceeds one page', () => {
    // anthropic has hundreds of jobs; Greenhouse paginates at 50/page.
    const { total, jobs, page, totalPages } = parseBoardPage(anthropicBoardHtml);
    expect(jobs.length).toBeLessThanOrEqual(50);
    expect(total).toBeGreaterThan(jobs.length);
    expect(page).toBe(1);
    expect(totalPages).toBeGreaterThan(1);
  });

  it('throws a clear error when __remixContext is not present', () => {
    expect(() => parseBoardPage('<html><body>no remix here</body></html>')).toThrow(/__remixContext not found/);
  });

  it('throws a contract-drift error when a required job field is the wrong type', () => {
    const drifted = physicsxBoardHtml.replace(/"id":4749980101,"title":"[^"]+"/, '"id":"not-a-number","title":"x"');
    expect(() => parseBoardPage(drifted)).toThrow(/contract drift|expected/i);
  });
});

describe('parseJobPage', () => {
  it('extracts id, title and company_name from the per-job Remix state', () => {
    const job = parseJobPage(physicsxJobHtml);
    expect(job.id).toBe(4644845101);
    expect(job.title).toBe('Senior CFD Engineer - Turbomachinery');
    expect(job.company_name).toBe('PhysicsX');
  });

  it('extracts location, absolute_url, published_at and language', () => {
    const job = parseJobPage(physicsxJobHtml);
    expect(job.location).toBe('New York, United States');
    expect(job.absolute_url).toBe('https://job-boards.eu.greenhouse.io/physicsx/jobs/4644845101');
    expect(job.published_at).toBe('2025-08-18T14:35:06-04:00');
    expect(job.language).toBe('en');
  });

  it('returns the raw HTML content body (no surrounding chrome)', () => {
    const { content } = parseJobPage(physicsxJobHtml);
    expect(content).toMatch(/^<h2>/);
    expect(content.length).toBeGreaterThan(500);
    expect(content).not.toContain('<html');
    expect(content).not.toContain('<body');
  });

  it('throws a clear error when the per-job route is not present', () => {
    expect(() => parseJobPage(physicsxBoardHtml)).toThrow(/jobPost not present/);
  });

  it('throws a contract-drift error when published_at goes missing', () => {
    const drifted = physicsxJobHtml.replace(/"published_at":"[^"]+"/, '"published_at":null');
    expect(() => parseJobPage(drifted)).toThrow(/contract drift|wrong type/i);
  });
});

describe('fetchBoard', () => {
  it('fetches /<token> on the configured host and parses the result', async () => {
    const captured: string[] = [];
    const mockFetch = async (url: string) => {
      captured.push(url);
      return physicsxBoardHtml;
    };
    const result = await fetchBoard('physicsx', { fetchText: mockFetch, host: 'https://job-boards.eu.greenhouse.io' });
    expect(captured).toEqual(['https://job-boards.eu.greenhouse.io/physicsx']);
    expect(result.board).toBe('physicsx');
    expect(result.jobs).toHaveLength(39);
  });

  it('appends ?page=N when fetching a non-first page', async () => {
    const captured: string[] = [];
    const mockFetch = async (url: string) => {
      captured.push(url);
      return anthropicBoardHtml;
    };
    await fetchBoard('anthropic', { fetchText: mockFetch, host: 'https://job-boards.greenhouse.io', page: 3 });
    expect(captured).toEqual(['https://job-boards.greenhouse.io/anthropic?page=3']);
  });

  it('encodes the board token in the URL', async () => {
    const captured: string[] = [];
    const mockFetch = async (url: string) => {
      captured.push(url);
      return physicsxBoardHtml;
    };
    await fetchBoard('phy_sicsx', { fetchText: mockFetch, host: 'https://job-boards.eu.greenhouse.io' });
    expect(captured[0]).toContain('/phy_sicsx');
  });
});

describe('fetchAllBoardData', () => {
  it('returns the single-page result intact when totalPages is 1', async () => {
    const captured: string[] = [];
    const fetchText = async (url: string) => {
      captured.push(url);
      return physicsxBoardHtml;
    };
    const result = await fetchAllBoardData('physicsx', {
      fetchText,
      host: 'https://job-boards.eu.greenhouse.io',
    });
    expect(captured).toEqual(['https://job-boards.eu.greenhouse.io/physicsx']);
    expect(result.total).toBe(39);
    expect(result.totalPages).toBe(1);
    expect(result.jobs).toHaveLength(39);
    expect(result.departments.length).toBe(4);
    expect(result.offices.length).toBe(3);
  });

  it('fetches every page and concatenates jobs when totalPages > 1', async () => {
    const captured: string[] = [];
    const buildPage = (pageNum: number, totalPages: number, totalJobs: number, idsOnThisPage: number[]): string => {
      const data = idsOnThisPage.map(id => ({
        id,
        title: `Job ${id}`,
        internal_job_id: id,
        updated_at: '2026-05-01T00:00:00Z',
        requisition_id: null,
        location: 'Anywhere',
        absolute_url: `https://job-boards.greenhouse.io/synthetic/jobs/${id}`,
        published_at: '2026-04-01T00:00:00Z',
        department: { id: 1, name: 'Eng', path: [] },
        is_featured: false,
      }));
      const ctx = {
        state: {
          loaderData: {
            'routes/$url_token': {
              urlToken: 'synthetic',
              jobPosts: { count: data.length, page: pageNum, total: totalJobs, total_pages: totalPages, data },
              departments: [{ id: 1, name: 'Eng' }],
              offices: [],
            },
          },
        },
      };
      return `<html><body><script>window.__remixContext = ${JSON.stringify(ctx)};</script></body></html>`;
    };
    const PAGES: Record<number, number[]> = {
      1: [101, 102, 103],
      2: [201, 202, 203],
      3: [301, 302],
    };
    const fetchText = async (url: string) => {
      captured.push(url);
      const m = /[?&]page=(\d+)/.exec(url);
      const pageNum = m ? Number(m[1]) : 1;
      return buildPage(pageNum, 3, 8, PAGES[pageNum] ?? []);
    };
    const result = await fetchAllBoardData('synthetic', {
      fetchText,
      host: 'https://job-boards.greenhouse.io',
    });
    expect(captured).toEqual([
      'https://job-boards.greenhouse.io/synthetic',
      'https://job-boards.greenhouse.io/synthetic?page=2',
      'https://job-boards.greenhouse.io/synthetic?page=3',
    ]);
    expect(result.totalPages).toBe(3);
    expect(result.jobs.map(j => j.id)).toEqual([101, 102, 103, 201, 202, 203, 301, 302]);
    expect(result.total).toBe(8);
    expect(result.departments).toEqual([{ id: 1, name: 'Eng' }]);
  });
});

describe('fetchJob', () => {
  it('fetches /<token>/jobs/<id> on the configured host and parses the result', async () => {
    const captured: string[] = [];
    const mockFetch = async (url: string) => {
      captured.push(url);
      return physicsxJobHtml;
    };
    const job = await fetchJob('physicsx', 4644845101, {
      fetchText: mockFetch,
      host: 'https://job-boards.eu.greenhouse.io',
    });
    expect(captured).toEqual(['https://job-boards.eu.greenhouse.io/physicsx/jobs/4644845101']);
    expect(job.id).toBe(4644845101);
    expect(job.title).toBe('Senior CFD Engineer - Turbomachinery');
  });
});

describe('parseBoardPage (continued)', () => {
  it('extracts the office taxonomy from physicsx with hierarchy', () => {
    const { offices } = parseBoardPage(physicsxBoardHtml);
    expect(offices).toEqual([
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
