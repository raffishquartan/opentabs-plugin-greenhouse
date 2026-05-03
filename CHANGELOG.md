# Changelog

All notable changes to `opentabs-plugin-greenhouse` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-03

### Breaking change: switched from the REST API to a same-origin HTML scrape

The plugin previously called `boards-api.greenhouse.io` directly. That host is not in the `connect-src` directive of the Greenhouse job-board pages' Content-Security-Policy, so the browser blocked every request. v0.1.0 reads the same data by parsing the `window.__remixContext` JSON embedded in the same-origin job-board HTML (the workaround used by the OpenTabs `hackernews` plugin for an analogous CSP).

This is a breaking change to the tool input/output schemas - see "Removed" and "Changed" below. Tool *names* are unchanged.

### Added

- `parseBoardPage(html)` and `parseJobPage(html)` - pure parsers over the Remix payload; covered by recorded HTML fixtures and Zod runtime validation.
- `fetchBoard(token, options)` and `fetchJob(token, id, options)` - thin same-origin fetchers via the SDK's `fetchText`.
- `resolveBoardHost(input)` - chooses which Greenhouse host (boards / job-boards / job-boards.eu) to scrape, preferring an explicit board URL, then the active tab's URL, then a default.
- Live-scrape smoke test (`src/scrape.live.test.ts`, gated on `LIVE_API=1`) covering both the EU and US hosts.
- Auto-pagination across Remix's 50-jobs-per-page limit in tools that need the whole board (`list_jobs`, `recent_jobs`, `summary`, `search_jobs`, `compare_boards`).
- `search_jobs` now takes an optional `include_content: boolean` flag - when true, fetches each per-job page and substring-matches the description body. Off by default to avoid N extra HTTP requests on large boards.

### Changed

- `list_departments` returns `{id, name, jobs_count}` (flat list - the Remix payload does not expose hierarchy).
- `list_offices` returns a nested tree via `children: []` instead of the API's `parent_id` / `child_ids` fields.
- `list_jobs` per-job summary shape: `department: {id, name} | null` (single, was `departments: [...]` array of refs); fields renamed `first_published` -> `published_at`.
- `validate_api` now runs two checks (`/board`, `/job`) instead of three (`/jobs`, `/departments`, `/offices`), reflecting the scrape architecture's two HTTP entry points.
- `summary` returns `by_department` and `by_location` only.
- `get_job` output: drops `offices`, multi-department, `workplace_type`, `metadata`; gains `company_name`, `language`.
- `compare_boards` output gains `cross_host_hint` (top-level, nullable) and per-board `failure_reason` / `attempted_host` / `suggested_hosts` fields when a board fails because it lives on a different Greenhouse region than the active tab.
- `list_departments`, `list_locations`, `list_titles` now auto-paginate so their counts cover the whole board, not just page 1. (Fixes silent under-counting on boards with more than 50 jobs.)

### Removed

- `workplace_type` field everywhere (filter, list output, summary breakdown). The scraped Remix state does not include it.
- `office` filter on `list_jobs` (per-job entries on the index page only carry a single department, not offices).
- `metadata` array on `get_job`.
- Multi-department per job (only one is exposed by the Remix payload).
- Department parent/child hierarchy (Remix returns a flat list).

### Known limitations

- **Cross-host `compare_boards`**: each tool call runs in one tab and can only fetch from that tab's origin. Mixed-host calls now surface per-board `failure_reason: "host_mismatch"` plus a top-level `cross_host_hint` naming the other Greenhouse hosts to try; the calling agent is responsible for opening a tab on one of those hosts and re-issuing the call (with the new `tabId`) or splitting the comparison into per-host calls.
- **`search_jobs include_content=true`** issues N parallel HTTP requests with no concurrency limit - slow on big boards.

## [0.0.1] - 2026-04-XX

Initial release. Read-only tools backed by the Greenhouse public Job Board REST API. Superseded by 0.1.0 - see breaking-change note above.
