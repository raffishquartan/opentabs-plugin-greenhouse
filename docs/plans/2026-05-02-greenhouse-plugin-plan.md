# Implementation plan: opentabs-plugin-greenhouse

Date: 2026-05-02
References: docs/specs/2026-05-02-greenhouse-plugin-design.md

## Branch / commit strategy

Each numbered task gets its own `f/<NN>-<topic>` branch. After each task is green
(tests + typecheck + lint + format) it merges back to `main` with a single fast-forward
or `--no-ff` merge commit, and the branch is deleted. All commits use imperative mood
and end with `[Cld]`.

## Tasks

### 0. Scaffold (`f/00-scaffold`)
- [x] git init on `main`
- [x] `.gitignore`, `LICENSE`, `package.json`, `tsconfig.json`, `biome.json`,
  `vitest.config.ts`, `README.md`
- [x] `docs/specs/...design.md`, `docs/plans/...plan.md`
- [x] `src/fixtures/{jobs,departments,offices,job-single}.json` from live airbnb data
- [ ] Initial empty `src/index.ts` so `npm install` succeeds
- [ ] `npm install`
- [ ] Commit + merge to main

### 1. `board.ts` resolveBoardToken (`f/01-board`)
TDD red->green->refactor, one test at a time:
- token-regex validates a simple token
- token-regex rejects bad characters
- known job-boards URL extracts token
- legacy boards.greenhouse.io URL extracts token
- EU job-boards URL extracts token
- bare token passes through
- empty input + greenhouse currentUrl: extracts from currentUrl
- empty input + non-greenhouse currentUrl: throws invalidInput
- empty input + empty currentUrl: throws invalidInput

### 2. `api.ts` schemas + fetchers (`f/02-api`)
- Zod schemas: `JobSchema`, `DepartmentSchema`, `OfficeSchema`, response wrappers
  - parse fixtures successfully
  - reject objects with wrong-typed required fields
  - tolerate unknown extra fields (passthrough)
- `fetchJobs(token, fetchImpl?)`: returns parsed jobs, calls boards-api with content=true
  - 200 + valid JSON -> returns parsed
  - non-2xx -> throws with status in message
  - 404 -> throws notFound with token in message
  - schema mismatch -> throws contract-drift
- `fetchJob(token, id, fetchImpl?)`
- `fetchDepartments(token, fetchImpl?)`
- `fetchOffices(token, fetchImpl?)`
- All take an optional `fetchImpl` for injection in tests; default `globalThis.fetch`.

### 3. `markdown.ts` (`f/03-markdown`)
- `htmlToMarkdown(html)`: thin wrapper around turndown
- empty/null/undefined -> empty string
- simple `<p>x</p>` -> `x`
- nested lists, links, headings preserved sensibly
- script/style content stripped

### 4. `filters.ts` (`f/04-filters`)
- `applyJobFilters(jobs, filters, deptTree, officeTree)`:
  - no filters -> return all
  - department by name (exact) -> matched
  - department by id -> matched
  - department descendant matching: filter on parent matches child-dept jobs
  - office by name -> matched
  - office descendant matching
  - location_contains -> case-insensitive substring on `location.name`
  - title_contains -> case-insensitive substring on `title`
  - updated_after -> jobs with `updated_at >= ISO`
  - filters AND
  - unknown department -> throws invalidInput with available set
  - unknown office -> throws invalidInput
- `descendantIds(tree, rootId)`: helper, returns set of all descendant ids inclusive

### 5. Plugin shell (`f/05-plugin-shell`)
- `src/index.ts`: `OpenTabsPlugin` subclass with name/displayName/description/homepage/
  urlPatterns/tools (initially empty)/isReady (always true; the API is public)
- `src/index.test.ts`: mirrors adhd360's tests:
  - correct name/urlPatterns
  - tool count = 7 (will grow as tools land)
  - all tool names snake_case
  - no banned write-verb prefixes

### 6. Tools, one branch each, in this order:
- 6a. `list_jobs` (`f/06a-tool-list-jobs`)
- 6b. `get_job` (`f/06b-tool-get-job`)
- 6c. `list_departments` (`f/06c-tool-list-departments`)
- 6d. `list_offices` (`f/06d-tool-list-offices`)
- 6e. `list_locations` (`f/06e-tool-list-locations`)
- 6f. `list_titles` (`f/06f-tool-list-titles`)
- 6g. `validate_api` (`f/06g-tool-validate-api`)

Each tool:
- input/output Zod schemas
- handler delegating to api.ts + filters.ts/markdown.ts as needed
- unit tests using fixtures + mocked fetch
- registered in `src/index.ts`
- index.test.ts updated to expect the new tool

### 7. Live-API smoke test (`f/07-live-smoke`)
- `src/api.live.test.ts` gated by `LIVE_API` env var (`describe.runIf(...)`)
- hits boards-api.greenhouse.io for `airbnb` and confirms parse succeeds end-to-end

### 8. Final check + publish (`f/08-publish`)
- `npm run check` clean
- `gh repo create raffishquartan/opentabs-plugin-greenhouse --public --source=. --push --remote=origin`
- Configure branch protection on `main` (require PR, block force push, restrict deletion)
- Final WORKLOG entry

## Notes

- Strict TDD per CLAUDE.md: one failing test, minimal code to pass, refactor, repeat.
- Never modify a passing test to make it pass. Fix implementation.
- Commits small and coherent. One logical change per commit.
- Test fixtures pre-trimmed; no large blobs in git history.
- jsdom test environment is set; tests can rely on `globalThis.fetch` mocked or `vi.fn()`.
