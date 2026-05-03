# Release process

This is the checklist for cutting a new version of `opentabs-plugin-greenhouse`. The package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The GitHub release tag and the npm version must always match (e.g. tag `v0.1.1` <-> npm version `0.1.1`).

## Before you start

- Working tree is clean and on `main` (or a release branch off `main`).
- `npm run check` and `npm test` pass locally.
- `CHANGELOG.md` has an entry describing the changes since the last release. Move them out of any `## [Unreleased]` section into a new `## [X.Y.Z] - YYYY-MM-DD` section.

## 1. Decide the version

- Patch (`0.1.0` -> `0.1.1`): bug fix or doc-only change, no API change.
- Minor (`0.1.0` -> `0.2.0`): new tools, new optional inputs, additive changes that don't break existing tool calls.
- Major (`0.1.0` -> `1.0.0`): breaking change to a tool's input or output schema, or to a tool name.

While the package is still pre-1.0 (`0.x.y`), breaking changes may be released as a minor bump - call them out clearly in the CHANGELOG.

## 2. Bump the version and tag

```bash
npm version <patch|minor|major>
```

`npm version` will:

- Update `package.json` and `package-lock.json`.
- Create a commit `vX.Y.Z`.
- Create an annotated git tag `vX.Y.Z`.

Push the commit and the tag together:

```bash
git push --follow-tags
```

## 3. Cut the GitHub release

Either:

- **GitHub UI**: Releases -> Draft a new release -> choose the `vX.Y.Z` tag -> set the title to `vX.Y.Z` -> paste the matching CHANGELOG section into the body -> Publish release.
- **gh CLI**: `gh release create vX.Y.Z --title vX.Y.Z --notes-from-tag` (or `--notes-file <changelog-snippet>`).

## 4. Publish to npm

The `prepublishOnly` script in `package.json` runs `npm run check && npm test` automatically, so a broken bundle cannot be published.

### Option A - publish locally

```bash
npm login          # one-time, if you are not already logged in
npm publish
```

`publishConfig` pins the upload to the public npmjs registry; for an unscoped package the access defaults to public.

### Option B - publish from a GitHub release

If the repo has a `release.yml` workflow that triggers on `release: published`, the GitHub release in step 3 will publish to npm automatically. Otherwise add one (uses `NPM_TOKEN` repo secret) before relying on this path.

## 5. Verify

- `npm view opentabs-plugin-greenhouse version` shows the new version.
- `https://www.npmjs.com/package/opentabs-plugin-greenhouse` shows the new version and the updated README.
- The GitHub release page shows the matching tag.
