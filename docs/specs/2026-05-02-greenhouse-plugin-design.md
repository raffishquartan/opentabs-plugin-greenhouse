# Design: opentabs-plugin-greenhouse

Date: 2026-05-02
Status: approved (user-approved verbally; written for the record)

## Goal

A read-only OpenTabs plugin that exposes Greenhouse Job Board data so an AI agent can
list and inspect a company's open roles. Primary use case: cross-reference jobs against
a personal network to identify referral opportunities. Public, anonymous, MIT, no
identifying information about any specific user.

## Background

Greenhouse hosts public job boards on three host families:

- `boards.greenhouse.io/<token>` (legacy)
- `job-boards.greenhouse.io/<token>`
- `job-boards.eu.greenhouse.io/<token>` (EU-region presentation, but same backing API)

A single global JSON API at `boards-api.greenhouse.io` serves every board regardless
of region. No auth required. CORS-permissive (used by Greenhouse's own embed widget).

Endpoints in scope:

- `GET /v1/boards/<token>/jobs?content=true` -> all jobs, optionally with HTML body
- `GET /v1/boards/<token>/jobs/<id>` -> single job (always with content)
- `GET /v1/boards/<token>/departments` -> department tree (with embedded jobs)
- `GET /v1/boards/<token>/offices` -> office tree (with embedded departments)

## Tools

All tools snake-case, read-only, no write verbs (matches OpenTabs conventions, enforced
by tests). All accept an optional `board` argument (token string, or full job-board URL);
absent -> infer from active tab's URL.

| Tool | Input | Returns |
|------|-------|---------|
| `list_jobs` | `board?, department?, office?, location_contains?, title_contains?, updated_after?` | `{ board, total, jobs: [{ id, title, location, offices:[name], departments:[name], absolute_url, updated_at }] }` |
| `get_job` | `id (number), board?` | `{ id, title, location, offices:[{id,name}], departments:[{id,name}], absolute_url, updated_at, first_published, content_markdown, metadata:[{name,value}] }` |
| `list_departments` | `board?` | `[{ id, name, parent_id, child_ids:[], jobs_count }]` |
| `list_offices` | `board?` | `[{ id, name, location, parent_id, child_ids:[] }]` |
| `list_locations` | `board?` | `[{ name, count }]` (derived: distinct `job.location.name`) |
| `list_titles` | `board?` | `[{ title, count }]` (derived: distinct titles) |
| `validate_api` | `board?` | `{ ok, checks:[{ endpoint, ok, error? }] }` |

### Filter semantics on `list_jobs`

- `department` and `office`: match by id (number) or name (case-insensitive exact). Matches
  the named entity OR any of its descendants in the hierarchy. Unknown values throw
  `invalidInput` and include the available set in the error message.
- `location_contains`, `title_contains`: case-insensitive substring on `location.name`/`title`.
- `updated_after`: ISO-8601 string; matches jobs with `updated_at >= input`.
- All filters AND together.

### Markdown conversion

`get_job` converts the HTML `content` field to markdown via `turndown` with default
options. Markdown only - if the caller wants HTML, they can hit the API directly.

## Module layout

```
src/
  index.ts              # plugin definition + tool list export
  api.ts                # Zod schemas, fetch wrappers (jobs / job / departments / offices)
  board.ts              # resolveBoardToken({ board, currentUrl }): string
  markdown.ts           # htmlToMarkdown(html): string
  filters.ts            # applyJobFilters(jobs, filters, deptTree, officeTree)
  tools/
    list-jobs.ts
    get-job.ts
    list-departments.ts
    list-offices.ts
    list-locations.ts
    list-titles.ts
    validate-api.ts
  fixtures/
    jobs.json departments.json offices.json job-single.json
```

Each module ships a co-located `*.test.ts` (vitest, jsdom env). Tests use the
fixtures rather than the live API. A separate `api.live.test.ts` runs against airbnb
when `LIVE_API=1` (skipped by default for offline-deterministic CI).

## Schema validation

Zod schemas in `api.ts`:

- `JobSchema`: required known fields (`id`, `title`, `location.name`, `offices[]`,
  `departments[]`, `absolute_url`, `updated_at`, `first_published`, `requisition_id`,
  `language`, `company_name`); optional `content`, `metadata[]`, `internal_job_id`,
  `data_compliance[]`. `.passthrough()` so extra unknown fields are tolerated.
- `DepartmentSchema`, `OfficeSchema`: required `id`, `name`, `parent_id`, `child_ids[]`;
  passthrough for `jobs[]` (departments), `departments[]` (offices), `location`.
- Wrappers: `JobsResponseSchema { jobs: JobSchema[], meta: { total: number } }`,
  `DepartmentsResponseSchema { departments: DepartmentSchema[] }`,
  `OfficesResponseSchema { offices: OfficeSchema[] }`.

Parsing failure -> `ToolError.internal('Greenhouse API contract drift: <path> - <message>')`.

## Board resolution

```
resolveBoardToken({ board?, currentUrl? }): string
```

- If `board` is non-empty:
  - If it parses as URL with host in the known set, take path segment 1.
  - Otherwise treat as raw token: must match `^[a-z0-9_-]+$`, else `invalidInput`.
- Else if `currentUrl` is non-empty and host matches known set: extract path segment 1
  (must match token regex).
- Else `invalidInput('No board specified and current tab is not a Greenhouse board page')`.

Inside tools, `currentUrl` defaults to `globalThis.location?.href` (matches adhd360
pattern of reading `window.location` directly).

## Error model

- Network non-2xx -> `ToolError.internal('Greenhouse API <status> <statusText>: <body excerpt>')`.
- 404 from board lookup -> `ToolError.notFound('Board <token> not found')`.
- Schema mismatch -> `ToolError.internal('Greenhouse API contract drift: ...')`.
- Missing input or unresolvable board -> `ToolError.invalidInput(...)`.
- Filter referencing unknown department/office -> `ToolError.invalidInput('Unknown department <x>. Available: ...')`.

## Public artefacts (non-identifying)

- LICENSE: MIT, copyright `2026 raffishquartan`.
- README: describes plugin generically. Examples use `airbnb` (well-known public board)
  and a placeholder `mycompany`.
- package.json author: `raffishquartan`. No email, no real name.
- Per-file headers: `// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 raffishquartan`.
- No reference to any specific employer in source, tests, fixtures, README, or commits.

## Out of scope

- Private/auth-required boards (Greenhouse internal-only postings). Public Job Board API only.
- Pagination - the Greenhouse API returns all jobs in one response; we mirror that.
- Keyword search across `content` (would balloon payloads; caller can `get_job` and grep).
- Ranking, recommendation, deduplication across boards.
- Writes (apply, draft, save). Plugin is read-only by convention and policy.

## Repository

GitHub: `raffishquartan/opentabs-plugin-greenhouse`, public, MIT.
Branch protection on `main` after first push: require PR, block force-push, restrict
deletion (CLAUDE.md global policy).
