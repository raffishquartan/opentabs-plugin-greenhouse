# opentabs-plugin-greenhouse

An [OpenTabs](https://opentabs.dev) plugin that exposes read-only tools over the
public [Greenhouse](https://www.greenhouse.io) Job Board API. Lets an AI agent or other
client list, filter and inspect openings on any company's public Greenhouse-hosted job
board.

## Use cases

- Scan a company's openings for roles your network might fit, to plan referrals.
- Filter by office, department, location or title across an entire company's board.
- Pull a single job's full markdown description for review or summarisation.

## Supported job-board hosts

The plugin activates on tabs whose URL matches:

- `boards.greenhouse.io/<token>`
- `job-boards.greenhouse.io/<token>`
- `job-boards.eu.greenhouse.io/<token>`

It uses Greenhouse's public Job Board API (`boards-api.greenhouse.io`), so it works for
any company that publishes openings on a public Greenhouse board, regardless of region.
No authentication is required.

## Tools

| Tool | Purpose |
|------|---------|
| `list_jobs` | List jobs on a board with optional filters (department, office, location-substring, title-substring, updated-after) |
| `get_job` | Full details for a single job including the description as markdown |
| `list_departments` | Department taxonomy with parent/child hierarchy |
| `list_offices` | Office taxonomy with parent/child hierarchy |
| `list_locations` | Distinct posted-location strings across all jobs, with counts |
| `list_titles` | Distinct job titles, with counts |
| `validate_api` | Probe each Greenhouse API endpoint and verify response schema; fail fast on contract drift |

All tools accept an optional `board` argument (a board token like `airbnb`, or a full job-
board URL). If omitted, the board is inferred from the active tab's URL. This means you
can leave a single Greenhouse tab open and query other companies' boards by passing
their token explicitly - useful for sweeping multiple companies in one session.

### Filter semantics on `list_jobs`

- `department` and `office`: name (case-insensitive exact) or numeric id. Match includes
  the named entity *and any descendants* in the hierarchy. So filtering on the parent
  office "EMEA" returns jobs in London, Paris, Berlin, etc.
- `location_contains` and `title_contains`: case-insensitive substring match.
- `updated_after`: ISO-8601 timestamp; matches jobs with `updated_at >= input`.
- All filters AND together. Unknown department or office values produce a clear error
  message listing the available values.

### `get_job` markdown

The `content` HTML field is converted to markdown via `turndown`. The plugin returns
markdown only - if you need the raw HTML, fetch the API directly.

## Contract validation

The plugin validates every API response against a Zod schema. Known fields are required
with expected types; unknown fields are tolerated (Greenhouse may add fields). If a known
field is missing or wrong-typed, the tool throws `Greenhouse API contract drift: ...`
with the exact path and issue, so a contract change fails fast and visibly rather than
silently producing bad results. The `validate_api` tool probes each endpoint explicitly
for proactive monitoring.

## Example

```jsonc
// list_jobs with no board arg, when active tab is a Greenhouse board
{}

// list_jobs filtered to engineering openings in London, on a specific board
{
  "board": "airbnb",
  "department": "Engineering",
  "location_contains": "London"
}

// get_job for a specific job id
{
  "board": "airbnb",
  "id": 7649441
}
```

## Development

```bash
npm install
npm test            # vitest, offline (uses fixtures)
LIVE_API=1 npm test # also runs live-API smoke test against airbnb's public board
npm run build       # tsc + opentabs-plugin build -> dist/
npm run check       # build + typecheck + lint + format check
```

## License

MIT - see [LICENSE](./LICENSE).
