// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const API_BASE = 'https://boards-api.greenhouse.io';

export const DepartmentRefSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    parent_id: z.number().nullable(),
    child_ids: z.array(z.number()),
  })
  .passthrough();

export const OfficeRefSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    location: z.string().nullable().optional(),
    parent_id: z.number().nullable(),
    child_ids: z.array(z.number()),
  })
  .passthrough();

export const JobSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    location: z
      .object({
        name: z.string(),
      })
      .passthrough(),
    offices: z.array(OfficeRefSchema).default([]),
    departments: z.array(DepartmentRefSchema).default([]),
    absolute_url: z.string(),
    updated_at: z.string(),
    first_published: z.string(),
    requisition_id: z.string().nullable(),
    language: z.string().optional(),
    company_name: z.string().optional(),
    content: z.string().optional(),
    metadata: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const DepartmentSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    parent_id: z.number().nullable(),
    child_ids: z.array(z.number()),
    jobs: z.array(JobSchema).optional(),
  })
  .passthrough();

export const OfficeSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    location: z.string().nullable().optional(),
    parent_id: z.number().nullable(),
    child_ids: z.array(z.number()),
    departments: z.array(DepartmentSchema).optional(),
  })
  .passthrough();

export const JobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    meta: z.object({ total: z.number() }).passthrough(),
  })
  .passthrough();

export const DepartmentsResponseSchema = z
  .object({
    departments: z.array(DepartmentSchema),
  })
  .passthrough();

export const OfficesResponseSchema = z
  .object({
    offices: z.array(OfficeSchema),
  })
  .passthrough();

export type Job = z.infer<typeof JobSchema>;
export type DepartmentRef = z.infer<typeof DepartmentRefSchema>;
export type OfficeRef = z.infer<typeof OfficeRefSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Office = z.infer<typeof OfficeSchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
export type DepartmentsResponse = z.infer<typeof DepartmentsResponseSchema>;
export type OfficesResponse = z.infer<typeof OfficesResponseSchema>;

function defaultFetch(): FetchLike {
  if (typeof globalThis.fetch !== 'function') {
    throw ToolError.internal('No fetch implementation available in this environment');
  }
  return globalThis.fetch.bind(globalThis);
}

async function getJson(url: string, fetchImpl: FetchLike, token: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    throw ToolError.internal(`Network error contacting Greenhouse API: ${(err as Error).message}`);
  }
  if (response.status === 404) {
    throw ToolError.notFound(`Greenhouse board '${token}' not found (404)`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const excerpt = body.slice(0, 200);
    throw ToolError.internal(`Greenhouse API ${response.status} ${response.statusText}: ${excerpt}`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw ToolError.internal(`Greenhouse API returned non-JSON body: ${(err as Error).message}`);
  }
}

function parseOrDrift<T>(schema: z.ZodType<T>, data: unknown, endpoint: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join('.') ?? '<root>';
    const message = first?.message ?? 'unknown';
    throw ToolError.internal(`Greenhouse API contract drift at ${endpoint}: ${path} - ${message}`);
  }
  return result.data;
}

export async function fetchJobs(token: string, fetchImpl: FetchLike = defaultFetch()): Promise<JobsResponse> {
  const url = `${API_BASE}/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const data = await getJson(url, fetchImpl, token);
  return parseOrDrift(JobsResponseSchema, data, '/jobs');
}

export async function fetchJob(token: string, id: number, fetchImpl: FetchLike = defaultFetch()): Promise<Job> {
  const url = `${API_BASE}/v1/boards/${encodeURIComponent(token)}/jobs/${id}`;
  const data = await getJson(url, fetchImpl, token);
  return parseOrDrift(JobSchema, data, `/jobs/${id}`);
}

export async function fetchDepartments(
  token: string,
  fetchImpl: FetchLike = defaultFetch(),
): Promise<DepartmentsResponse> {
  const url = `${API_BASE}/v1/boards/${encodeURIComponent(token)}/departments`;
  const data = await getJson(url, fetchImpl, token);
  return parseOrDrift(DepartmentsResponseSchema, data, '/departments');
}

export async function fetchOffices(token: string, fetchImpl: FetchLike = defaultFetch()): Promise<OfficesResponse> {
  const url = `${API_BASE}/v1/boards/${encodeURIComponent(token)}/offices`;
  const data = await getJson(url, fetchImpl, token);
  return parseOrDrift(OfficesResponseSchema, data, '/offices');
}
