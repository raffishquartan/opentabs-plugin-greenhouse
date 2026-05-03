// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { fetchText as sdkFetchText } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';

export type FetchTextLike = (url: string) => Promise<string>;

export interface FetchBoardOptions {
  fetchText?: FetchTextLike;
  host?: string;
  page?: number;
}

export interface FetchJobOptions {
  fetchText?: FetchTextLike;
  host?: string;
}

const DEFAULT_HOST = 'https://job-boards.greenhouse.io';

function defaultFetchText(): FetchTextLike {
  return (url: string) => sdkFetchText(url);
}

export const ScrapedJobSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    location: z.string(),
    absolute_url: z.string(),
    updated_at: z.string(),
    published_at: z.string(),
    requisition_id: z.string().nullable(),
    internal_job_id: z.number().nullable(),
    is_featured: z.boolean(),
    department: z.object({ id: z.number(), name: z.string() }).nullable(),
  })
  .passthrough();

export const ScrapedDepartmentSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export type ScrapedOffice = {
  id: number;
  name: string;
  children: ScrapedOffice[];
};

export const ScrapedOfficeSchema: z.ZodType<ScrapedOffice> = z.lazy(() =>
  z.object({
    id: z.number(),
    name: z.string(),
    children: z.array(ScrapedOfficeSchema),
  }),
);

export const ScrapedBoardSchema = z.object({
  board: z.string(),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
  jobs: z.array(ScrapedJobSchema),
  departments: z.array(ScrapedDepartmentSchema),
  offices: z.array(ScrapedOfficeSchema),
});

export type ScrapedJob = z.infer<typeof ScrapedJobSchema>;
export type ScrapedDepartment = z.infer<typeof ScrapedDepartmentSchema>;
export type ScrapedBoard = z.infer<typeof ScrapedBoardSchema>;

const REMIX_CONTEXT_RE = /window\.__remixContext\s*=\s*(\{[\s\S]+?\});\s*<\/script>/;

interface RemixContext {
  state?: {
    loaderData?: Record<string, unknown>;
  };
}

function extractRemixContext(html: string): RemixContext {
  const m = REMIX_CONTEXT_RE.exec(html);
  if (!m?.[1]) throw new Error('parseBoardPage: window.__remixContext not found in HTML');
  try {
    return JSON.parse(m[1]) as RemixContext;
  } catch (err) {
    throw new Error(`parseBoardPage: failed to parse __remixContext JSON: ${(err as Error).message}`);
  }
}

interface RouteData {
  urlToken?: string;
  jobPosts?: {
    total?: number;
    page?: number;
    total_pages?: number;
    data?: unknown[];
  };
  departments?: unknown[];
  offices?: unknown[];
}

interface RawDepartment {
  id: number;
  name: string;
}

interface RawOffice {
  id: number;
  name: string;
  children?: RawOffice[];
}

function mapOffice(raw: RawOffice): ScrapedOffice {
  return {
    id: raw.id,
    name: raw.name,
    children: (raw.children ?? []).map(mapOffice),
  };
}

export function parseBoardPage(html: string): ScrapedBoard {
  const ctx = extractRemixContext(html);
  const route = ctx.state?.loaderData?.['routes/$url_token'] as RouteData | undefined;
  if (!route) {
    throw new Error('parseBoardPage: routes/$url_token loaderData not present');
  }
  const board = route.urlToken;
  const total = route.jobPosts?.total;
  const page = route.jobPosts?.page;
  const totalPages = route.jobPosts?.total_pages;
  const data = route.jobPosts?.data;
  if (
    typeof board !== 'string' ||
    typeof total !== 'number' ||
    typeof page !== 'number' ||
    typeof totalPages !== 'number' ||
    !Array.isArray(data)
  ) {
    throw new Error('parseBoardPage: urlToken / jobPosts.{total,page,total_pages,data} missing or wrong type');
  }
  const departments = (route.departments ?? []).map(d => {
    const r = d as RawDepartment;
    return { id: r.id, name: r.name };
  });
  const offices = (route.offices ?? []).map(o => mapOffice(o as RawOffice));
  const candidate = {
    board,
    total,
    page,
    totalPages,
    jobs: data,
    departments,
    offices,
  };
  const parsed = ScrapedBoardSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join('.') ?? '<root>';
    throw new Error(`parseBoardPage: contract drift at ${path}: ${first?.message ?? 'unknown'}`);
  }
  return parsed.data;
}

export const ScrapedJobFullSchema = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string(),
  content: z.string(),
  location: z.string(),
  absolute_url: z.string(),
  published_at: z.string(),
  language: z.string(),
});

export type ScrapedJobFull = z.infer<typeof ScrapedJobFullSchema>;

interface RawJobPost {
  title?: string;
  content?: string;
  company_name?: string;
  job_post_location?: string;
  public_url?: string;
  published_at?: string;
  language?: string;
}

interface JobRouteData {
  jobPost?: RawJobPost;
  jobPostId?: number | string;
}

export function parseJobPage(html: string): ScrapedJobFull {
  const ctx = extractRemixContext(html);
  const loaderData = ctx.state?.loaderData ?? {};
  const route = loaderData['routes/$url_token_.jobs_.$job_post_id'] as JobRouteData | undefined;
  if (!route?.jobPost) {
    throw new Error('parseJobPage: routes/$url_token_.jobs_.$job_post_id.jobPost not present');
  }
  const idRaw = route.jobPostId;
  const id = typeof idRaw === 'string' ? Number(idRaw) : idRaw;
  const post = route.jobPost;
  const candidate = {
    id,
    title: post.title,
    company_name: post.company_name,
    content: post.content,
    location: post.job_post_location,
    absolute_url: post.public_url,
    published_at: post.published_at,
    language: post.language,
  };
  const parsed = ScrapedJobFullSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join('.') ?? '<root>';
    throw new Error(`parseJobPage: contract drift at ${path}: ${first?.message ?? 'unknown'}`);
  }
  return parsed.data;
}

export async function fetchBoard(token: string, options: FetchBoardOptions = {}): Promise<ScrapedBoard> {
  const ft = options.fetchText ?? defaultFetchText();
  const host = options.host ?? DEFAULT_HOST;
  const page = options.page ?? 1;
  const pageQuery = page > 1 ? `?page=${page}` : '';
  const url = `${host}/${encodeURIComponent(token)}${pageQuery}`;
  const html = await ft(url);
  return parseBoardPage(html);
}

export interface AllBoardData {
  jobs: ScrapedJob[];
  departments: ScrapedDepartment[];
  offices: ScrapedOffice[];
  total: number;
  totalPages: number;
}

/**
 * Fetch every page of a board's jobs (Remix paginates at 50 jobs/page) and
 * concatenate. Departments and offices come from page 1 - they are taxonomy,
 * not paginated. Use this whenever a tool needs the *whole* board (counts,
 * filters, search) rather than just the visible page.
 */
export async function fetchAllBoardData(token: string, options: FetchBoardOptions = {}): Promise<AllBoardData> {
  const first = await fetchBoard(token, { ...options, page: 1 });
  const allJobs: ScrapedJob[] = [...first.jobs];
  if (first.totalPages > 1) {
    const more = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_unused, i) => fetchBoard(token, { ...options, page: i + 2 })),
    );
    for (const p of more) allJobs.push(...p.jobs);
  }
  return {
    jobs: allJobs,
    departments: first.departments,
    offices: first.offices,
    total: first.total,
    totalPages: first.totalPages,
  };
}

export async function fetchJob(token: string, id: number, options: FetchJobOptions = {}): Promise<ScrapedJobFull> {
  const ft = options.fetchText ?? defaultFetchText();
  const host = options.host ?? DEFAULT_HOST;
  const url = `${host}/${encodeURIComponent(token)}/jobs/${id}`;
  const html = await ft(url);
  return parseJobPage(html);
}
