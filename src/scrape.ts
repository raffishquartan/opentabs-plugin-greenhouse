// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

export interface ScrapedJob {
  id: number;
  title: string;
  location: string;
  absolute_url: string;
  updated_at: string;
  published_at: string;
  requisition_id: string | null;
  internal_job_id: number | null;
  is_featured: boolean;
  department: { id: number; name: string } | null;
}

export interface ScrapedDepartment {
  id: number;
  name: string;
}

export interface ScrapedOffice {
  id: number;
  name: string;
  children: ScrapedOffice[];
}

export interface ScrapedBoard {
  board: string;
  total: number;
  page: number;
  totalPages: number;
  jobs: ScrapedJob[];
  departments: ScrapedDepartment[];
  offices: ScrapedOffice[];
}

const REMIX_CONTEXT_RE = /window\.__remixContext\s*=\s*(\{[\s\S]+?\});\s*<\/script>/;

interface RemixContext {
  state?: {
    loaderData?: Record<string, unknown>;
  };
}

function extractRemixContext(html: string): RemixContext {
  const m = REMIX_CONTEXT_RE.exec(html);
  if (!m) throw new Error('parseBoardPage: window.__remixContext not found in HTML');
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
  return {
    board,
    total,
    page,
    totalPages,
    jobs: data as ScrapedJob[],
    departments,
    offices,
  };
}
