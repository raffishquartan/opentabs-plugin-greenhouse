# opentabs-plugin-greenhouse

[![check](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/check.yml/badge.svg)](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/check.yml)
[![live-api-canary](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/live-api-canary.yml/badge.svg)](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/live-api-canary.yml)

An [OpenTabs](https://opentabs.dev) plugin that exposes read-only tools for any
company's [Greenhouse](https://www.greenhouse.io) public job board. Lets an AI agent or
other client list, filter and inspect openings without authentication.

## Use cases

- Scan a company's openings for roles your network might fit, to plan referrals.
- Filter by department, location or title across an entire company's board.
- Pull a single job's full markdown description for review or summarisation.

## Supported job-board hosts

The plugin activates on tabs whose URL matches:

- `boards.greenhouse.io/<token>`
- `job-boards.greenhouse.io/<token>`
- `job-boards.eu.greenhouse.io/<token>`

## Architecture: same-origin scrape, not REST API

> **As of v0.1.0 the plugin no longer calls `boards-api.greenhouse.io`.**
>
> Greenhouse-hosted job-board pages serve a Content-Security-Policy that blocks
> cross-origin `fetch()` to `boards-api.greenhouse.io` from inside the page context.
> The plugin's adapter runs in the page context, so the API host was unreachable.
>
> v0.1.0 switches to the OpenTabs `hackernews`-style pattern: scrape the same-origin
> Remix HTML pages and parse `window.__remixContext` for job, department and office
> data, then fetch per-job pages for full descriptions. CSP is satisfied by
> construction because everything is same-origin.
>
> Side-effects of the switch (covered in CHANGELOG and below):
>
> - Tools that crossed hosts (e.g. `compare_boards` between an EU and a US board)
>   now fail per-board with a CSP error - same-host queries work normally.
> - The `workplace_type` field and filter are removed - the data isn't in the
>   scraped Remix state.
> - The `office` filter on `list_jobs` is removed - per-job entries on the index
>   page only carry a single department, not offices.
> - Department hierarchy (parent/child) is replaced by a flat list - again, the
>   scraped data is flat.
> - Office hierarchy is now expressed as nested `children: []` rather than the
>   API's `parent_id` / `child_ids` shape.

## Tools

| Tool | Purpose |
|------|---------|
| `list_jobs` | List jobs on a board with optional filters (department, location-substring, title-substring, updated-after). Auto-paginates. |
| `get_job` | Full details for a single job including the description as markdown |
| `search_jobs` | Substring search across titles, locations, departments and offices. `include_content=true` also searches per-job description bodies (slow). |
| `recent_jobs` | Most recently published jobs, sorted by `published_at` descending |
| `summary` | Total job count plus breakdowns by department and location |
| `compare_boards` | Sweep the same filter across multiple boards in parallel; per-board success/failure reported individually |
| `list_departments` | Department taxonomy (flat) |
| `list_offices` | Office taxonomy with nested `children` hierarchy |
| `list_locations` | Distinct posted-location strings across all jobs, with counts |
| `list_titles` | Distinct job titles, with counts |
| `validate_api` | Probe the scrape path: parse the board page and one per-job page; fail fast on parser drift |

All tools accept an optional `board` argument (a board token like `airbnb`, or a full
job-board URL). If omitted, the board is inferred from the active tab's URL. The host
to scrape is also inferred from the active tab - querying a board on a different
greenhouse host will fail with a CSP error at runtime.

### Filter semantics on `list_jobs`

- `department`: name (case-insensitive exact) or numeric id. Single-department-per-job
  match (Remix exposes only one). Unknown values produce a clear error listing the
  available departments.
- `location_contains` and `title_contains`: case-insensitive substring match.
- `updated_after`: ISO-8601 timestamp; matches jobs with `updated_at >= input`.
- All filters AND together.

### `get_job` markdown

The `content` HTML field from the per-job Remix state is converted to markdown via
`turndown`. The plugin returns markdown only - if you need the raw HTML, fetch the page
yourself.

## Contract validation

The plugin validates every parsed Remix payload against a Zod schema. Known fields are
required with expected types; unknown fields are tolerated. If a known field is missing
or wrong-typed, the parser throws `parseBoardPage: contract drift at <path>: ...` (or the
equivalent for `parseJobPage`), so a Greenhouse front-end change fails fast and visibly.
The `validate_api` tool probes both the board and per-job paths explicitly for proactive
monitoring.

## Example

```jsonc
// list_jobs with no board arg, when active tab is a Greenhouse board
{}

// list_jobs filtered to engineering openings in London, on a specific board
{
  "board": "physicsx",
  "department": "Delivery",
  "location_contains": "London"
}

// get_job for a specific job id
{
  "board": "physicsx",
  "id": 4644845101
}
```

## Development

```bash
npm install
npm test            # vitest, offline (uses recorded HTML fixtures)
LIVE_API=1 npm test # also runs live scrape smoke tests against physicsx + anthropic
npm run build       # tsc + opentabs-plugin build -> dist/
npm run check       # build + typecheck + lint + format check
```

## License

MIT - see [LICENSE](./LICENSE).
