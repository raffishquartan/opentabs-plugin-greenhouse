# opentabs-plugin-greenhouse

[![check](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/check.yml/badge.svg)](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/check.yml)
[![live-api-canary](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/live-api-canary.yml/badge.svg)](https://github.com/raffishquartan/opentabs-plugin-greenhouse/actions/workflows/live-api-canary.yml)

An [OpenTabs](https://opentabs.dev) plugin that exposes any company's public [Greenhouse](https://www.greenhouse.io) job board as a set of read-only MCP tools. Lets an AI agent or other MCP client list, filter and inspect openings without authentication.

## What you can do with it

- "Show me all open ML engineering roles at PhysicsX in London."
- "How many of Anthropic's openings are in Dublin? Group by department."
- "Pull the full description of job 4644845101 as markdown so I can summarise it."
- "Sweep this same role title across our company plus a peer set."
- "What's been posted at PhysicsX in the last week?"

Anything you'd manually click through the company's Greenhouse careers page for, an agent can do via the MCP tools instead.

## How it works (and why same-origin)

OpenTabs plugins run inside the page context of the active tab. The Greenhouse job-board pages serve a strict Content-Security-Policy that blocks `fetch()` to anything outside the page's own origin, including `boards-api.greenhouse.io`. So this plugin scrapes the data straight out of the Remix state object embedded in each job-board page (`window.__remixContext`) - the same object the page itself uses to render the job list and per-job details. No authentication, no third-party hosts, one same-origin GET per page fetched.

Practical implication: a single tool call always runs from one tab, and that tab's origin is the only Greenhouse host the call can reach. For most use cases that's invisible; the only place you'll feel it is `compare_boards` across two regions (see [Limitations](#limitations)).

## Supported pages

The plugin activates on tabs whose URL matches one of:

- `https://boards.greenhouse.io/<token>`
- `https://job-boards.greenhouse.io/<token>` (US-region)
- `https://job-boards.eu.greenhouse.io/<token>` (EU-region)

`<token>` is whatever the company is named on Greenhouse - e.g. `airbnb`, `physicsx`, `anthropic`. You can also pass a full URL to any tool's optional `board` argument; the plugin extracts the token (and the host).

## Tools

| Tool | What it does |
|------|---------|
| `list_jobs` | Auto-paginated list of jobs on a board. Filters: department, location-substring, title-substring, updated-after. Returns lightweight summaries; call `get_job` for the full body. |
| `get_job` | Full details for a single job including the description as markdown. |
| `search_jobs` | Substring search across titles, locations, departments and offices. Pass `include_content: true` to also search per-job description bodies (slow). |
| `recent_jobs` | Most recently published jobs, sorted by `published_at` descending. Optional `since` and `limit`. |
| `summary` | Total job count plus breakdowns by department and location. |
| `compare_boards` | Sweep the same filter across multiple boards in parallel; per-board success/failure reported individually. |
| `list_departments` | Department taxonomy (flat). |
| `list_offices` | Office taxonomy with nested `children` hierarchy. |
| `list_locations` | Distinct posted-location strings across all jobs, with counts. |
| `list_titles` | Distinct job titles, with counts. |
| `validate_api` | Probe the scrape path: parse the board page and one per-job page; fail fast on parser drift if Greenhouse changes its front-end. |

All tools accept an optional `board` argument (token or full URL). If omitted, the board and host are inferred from the active tab's URL - so you can leave a single Greenhouse tab open and query other companies' boards by passing their token explicitly.

## Filter semantics on `list_jobs`

- `department`: name (case-insensitive exact) or numeric id. Single-department-per-job match (Remix exposes one). Unknown values produce a clear validation error listing the available departments.
- `location_contains` / `title_contains`: case-insensitive substring match.
- `updated_after`: ISO-8601 timestamp; matches `updated_at >= input`.
- All filters combine with AND.

## `get_job` markdown

The HTML description body in the per-job Remix state is converted to markdown via [turndown](https://github.com/mixmark-io/turndown) so the output is small, readable and safe to feed straight into a model prompt or summarisation flow.

## Contract validation

Every parsed Remix payload is validated against a Zod schema before tools see it. If Greenhouse changes a known field's type, the parser throws `parseBoardPage: contract drift at <path>: <message>` (or the equivalent for `parseJobPage`) so the failure is loud and obvious instead of producing silently-wrong output. The `validate_api` tool exists for proactive monitoring of both the board and per-job paths.

## Examples

```jsonc
// list_jobs with no board arg, when the active tab is a Greenhouse board
{}

// list_jobs filtered to engineering roles in London on a specific board
{
  "board": "physicsx",
  "department": "Product",
  "location_contains": "London"
}

// get_job for a specific job id
{
  "board": "physicsx",
  "id": 4644845101
}

// search the entire board including description bodies (slow)
{
  "board": "anthropic",
  "query": "rust",
  "include_content": true
}
```

## Installation

You need a working OpenTabs install (browser extension + MCP server) - see <https://opentabs.dev>.

```bash
git clone https://github.com/raffishquartan/opentabs-plugin-greenhouse.git
cd opentabs-plugin-greenhouse
npm install
npm run build
```

The build emits the adapter bundle into `dist/`. Point your OpenTabs install at this directory in the way it expects (consult the OpenTabs docs for the current registration mechanism). Approve the plugin from the OpenTabs Chrome side panel when it first surfaces.

## Limitations

- **Cross-host `compare_boards`**: tool calls run in one tab and can only fetch from that tab's origin. A single mixed-host call returns per-board failures with `failure_reason: "host_mismatch"`, plus a top-level `cross_host_hint` string that names the other Greenhouse hosts to try. The calling agent should open a tab on one of the suggested hosts and either re-issue `compare_boards` with that tab's `tabId` (if all remaining boards share that host) or split the comparison into per-host calls.
- **`search_jobs include_content=true`** issues N parallel HTTP requests with no concurrency limit - fine for small boards (tens of jobs), slow for large ones (hundreds).
- **`workplace_type`** is not available; Greenhouse doesn't include it in the page's Remix state.
- **Multi-department jobs** show only one department (the one Greenhouse picked as primary).
- **Some companies have migrated** their job boards from Greenhouse-hosted URLs to their own careers domain (e.g. `careers.airbnb.com`). Those are no longer reachable by this plugin.

## Development

```bash
npm install
npm test            # vitest, offline (uses recorded HTML fixtures)
LIVE_API=1 npm test # also runs live scrape smoke tests against physicsx + anthropic
npm run build       # tsc + opentabs-plugin build -> dist/
npm run check       # build + typecheck + lint + format check
```

The repo follows strict TDD: every behaviour change starts with a failing test. Live tests are gated on `LIVE_API=1` so the offline run stays deterministic.

## License

MIT - see [LICENSE](./LICENSE).
