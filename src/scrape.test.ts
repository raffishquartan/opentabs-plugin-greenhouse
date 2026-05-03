// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchBoard, fetchJob, parseBoardPage, parseJobPage } from './scrape.js';

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
